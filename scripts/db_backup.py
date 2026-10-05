#!/usr/bin/env python3
"""Шифрованные резервные копии базы данных PostgreSQL (и восстановление).

Копия создаётся штатной утилитой pg_dump (обычный SQL-формат) и сразу, потоком, шифруется AES-256-GCM:
на диск незашифрованные данные не попадают. Ключ выводится из парольной фразы (scrypt), поэтому фраза
хранится отдельно от копий: переменная окружения BACKUP_PASSPHRASE либо ввод с клавиатуры.

Примеры (из корня проекта):

    python scripts/db_backup.py backup                       # вся база -> backups/hotel_ГГГГММДД_ЧЧММСС.sql.enc
    python scripts/db_backup.py backup --only-forecast       # только таблицы модуля прогнозирования
    python scripts/db_backup.py verify backups/файл.sql.enc  # проверить целостность и парольную фразу
    python scripts/db_backup.py restore backups/файл.sql.enc --db hotel_restore --create-db

Параметры подключения берутся из аргументов или переменных окружения: DB_HOST, DB_PORT, DB_NAME, DB_USER,
DB_PASSWORD (как в настройках серверной части). Утилиты pg_dump/psql ищутся в PATH, в каталоге PG_BIN или
(в Windows) в стандартных каталогах установки PostgreSQL.

Формат файла: "HMBK" | версия(1) | соль(16) | префикс nonce(8) | размер блока(4) | далее блоки
[длина(4) | шифртекст с тегом]. Блок шифруется с nonce = префикс + номер блока (счётчик), в аутентифицируемые
данные входят заголовок и признак последнего блока: подмена, перестановка блоков и усечение файла обнаруживаются.
"""
from __future__ import annotations

import argparse
import datetime as dt
import getpass
import glob
import hashlib
import os
import shutil
import struct
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import BinaryIO, Iterator, Optional, Sequence

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

MAGIC = b"HMBK"
VERSION = 1
SALT_LEN = 16
PREFIX_LEN = 8
DEFAULT_CHUNK = 1024 * 1024
MAX_CHUNK = 64 * 1024 * 1024
HEADER_LEN = len(MAGIC) + 1 + SALT_LEN + PREFIX_LEN + 4
SCRYPT_N, SCRYPT_R, SCRYPT_P = 2 ** 15, 8, 1

# Таблицы модуля прогнозирования (префиксы mk_ и fc_); основные таблицы гостиницы в копию «только модуль» не входят.
FORECAST_TABLE_PATTERNS = ("mk_*", "fc_*")


class BackupError(Exception):
    """Ошибка резервного копирования или восстановления (сообщение показывается пользователю)."""


# ----------------------------------------------------------------------------------- шифрование

def derive_key(passphrase: str, salt: bytes) -> bytes:
    if not passphrase:
        raise BackupError("Парольная фраза не задана (переменная BACKUP_PASSPHRASE).")
    return hashlib.scrypt(passphrase.encode("utf-8"), salt=salt, n=SCRYPT_N, r=SCRYPT_R, p=SCRYPT_P,
                          maxmem=256 * 1024 * 1024, dklen=32)


def _nonce(prefix: bytes, counter: int) -> bytes:
    return prefix + struct.pack(">I", counter)


def _aad(header: bytes, last: bool) -> bytes:
    return header + (b"\x01" if last else b"\x00")


def _read_full(src: BinaryIO, size: int) -> bytes:
    """Читает ровно size байт (если поток кончился раньше — меньше)."""
    parts = []
    remaining = size
    while remaining > 0:
        part = src.read(remaining)
        if not part:
            break
        parts.append(part)
        remaining -= len(part)
    return b"".join(parts)


def encrypt_stream(src: BinaryIO, dst: BinaryIO, passphrase: str, chunk_size: int = DEFAULT_CHUNK) -> int:
    """Шифрует поток src в dst. Возвращает число исходных байт."""
    if not 1 <= chunk_size <= MAX_CHUNK:
        raise BackupError("Недопустимый размер блока шифрования.")
    salt = os.urandom(SALT_LEN)
    prefix = os.urandom(PREFIX_LEN)
    header = MAGIC + bytes([VERSION]) + salt + prefix + struct.pack(">I", chunk_size)
    aes = AESGCM(derive_key(passphrase, salt))
    dst.write(header)
    total = 0
    counter = 0
    current = _read_full(src, chunk_size)
    while True:
        following = _read_full(src, chunk_size) if len(current) == chunk_size else b""
        last = len(following) == 0
        sealed = aes.encrypt(_nonce(prefix, counter), current, _aad(header, last))
        dst.write(struct.pack(">I", len(sealed)))
        dst.write(sealed)
        total += len(current)
        if last:
            return total
        counter += 1
        current = following


def decrypt_stream(src: BinaryIO, passphrase: str) -> Iterator[bytes]:
    """Расшифровывает поток блок за блоком. Любое нарушение целостности — BackupError."""
    header = _read_full(src, HEADER_LEN)
    if len(header) < HEADER_LEN or header[:len(MAGIC)] != MAGIC:
        raise BackupError("Это не файл резервной копии (неверный заголовок).")
    if header[len(MAGIC)] != VERSION:
        raise BackupError("Неподдерживаемая версия формата резервной копии.")
    offset = len(MAGIC) + 1
    salt = header[offset:offset + SALT_LEN]
    prefix = header[offset + SALT_LEN:offset + SALT_LEN + PREFIX_LEN]
    (chunk_size,) = struct.unpack(">I", header[-4:])
    if not 1 <= chunk_size <= MAX_CHUNK:
        raise BackupError("Файл повреждён: недопустимый размер блока.")
    aes = AESGCM(derive_key(passphrase, salt))
    counter = 0
    length_bytes = _read_full(src, 4)
    if len(length_bytes) < 4:
        raise BackupError("Файл повреждён или усечён: нет данных после заголовка.")
    while True:
        (length,) = struct.unpack(">I", length_bytes)
        if not 16 <= length <= chunk_size + 16:
            raise BackupError("Файл повреждён: недопустимая длина блока.")
        sealed = _read_full(src, length)
        if len(sealed) < length:
            raise BackupError("Файл повреждён или усечён.")
        next_length = _read_full(src, 4)
        last = len(next_length) == 0
        if 0 < len(next_length) < 4:
            raise BackupError("Файл повреждён или усечён.")
        try:
            yield aes.decrypt(_nonce(prefix, counter), sealed, _aad(header, last))
        except InvalidTag:
            raise BackupError("Не удалось расшифровать: неверная парольная фраза либо файл изменён или усечён.") from None
        if last:
            return
        counter += 1
        length_bytes = next_length


def decrypt_file(path: Path, dst: BinaryIO, passphrase: str) -> int:
    """Расшифровывает файл в dst. Возвращает число расшифрованных байт."""
    total = 0
    with open(path, "rb") as src:
        for block in decrypt_stream(src, passphrase):
            dst.write(block)
            total += len(block)
    return total


# ----------------------------------------------------------------------------------- PostgreSQL

class Connection:
    def __init__(self, host: str, port: int, user: str, password: Optional[str], database: Optional[str]):
        self.host, self.port, self.user, self.password, self.database = host, port, user, password, database

    def env(self) -> dict:
        env = dict(os.environ)
        if self.password:
            env["PGPASSWORD"] = self.password
        env.setdefault("PGCLIENTENCODING", "UTF8")
        return env

    def args(self) -> list:
        return ["-h", self.host, "-p", str(self.port), "-U", self.user]


def find_pg_tool(name: str, pg_bin: Optional[str] = None) -> str:
    """Путь к утилите PostgreSQL (pg_dump, psql): PG_BIN, PATH, стандартные каталоги Windows."""
    exe = name + (".exe" if os.name == "nt" else "")
    if pg_bin:
        candidate = Path(pg_bin) / exe
        if candidate.is_file():
            return str(candidate)
        raise BackupError(f"В каталоге {pg_bin} не найден {exe}.")
    found = shutil.which(name)
    if found:
        return found
    if os.name == "nt":
        roots = [os.environ.get("ProgramFiles", r"C:\Program Files"), os.environ.get("ProgramFiles(x86)", "")]
        for root in roots:
            for path in sorted(glob.glob(os.path.join(root, "PostgreSQL", "*", "bin", exe)), reverse=True):
                return path
    raise BackupError(f"Не найдена утилита {name}. Добавьте каталог bin PostgreSQL в PATH "
                      "либо задайте переменную PG_BIN.")


def dump_command(pg_dump: str, conn: Connection, only_forecast: bool, clean: bool) -> list:
    command = [pg_dump, *conn.args(), "--format=plain", "--encoding=UTF8", "--no-owner", "--no-privileges"]
    if clean:
        command += ["--clean", "--if-exists"]
    if only_forecast:
        for pattern in FORECAST_TABLE_PATTERNS:
            command += ["--table", pattern]
    command.append(conn.database)
    return command


def backup(conn: Connection, out_dir: Path, passphrase: str, only_forecast: bool = False, clean: bool = False,
           pg_bin: Optional[str] = None, now: Optional[dt.datetime] = None) -> Path:
    pg_dump = find_pg_tool("pg_dump", pg_bin)
    out_dir.mkdir(parents=True, exist_ok=True)
    stamp = (now or dt.datetime.now()).strftime("%Y%m%d_%H%M%S")
    scope = "forecast" if only_forecast else "full"
    target = out_dir / f"{conn.database}_{scope}_{stamp}.sql.enc"
    partial = target.with_suffix(target.suffix + ".part")
    derive_key(passphrase, b"\x00" * SALT_LEN)  # быстрая проверка, что фраза задана, до запуска pg_dump
    process = subprocess.Popen(dump_command(pg_dump, conn, only_forecast, clean), env=conn.env(),
                               stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    try:
        with open(partial, "wb") as dst:
            size = encrypt_stream(process.stdout, dst, passphrase)
        error = process.stderr.read().decode("utf-8", "replace").strip()
        code = process.wait()
    except BaseException:
        process.kill()
        partial.unlink(missing_ok=True)
        raise
    if code != 0 or size == 0:
        partial.unlink(missing_ok=True)
        raise BackupError(f"pg_dump завершился с ошибкой ({code}): {error or 'пустой вывод'}")
    os.replace(partial, target)
    try:
        os.chmod(target, 0o600)
    except OSError:
        pass
    return target


def verify(path: Path, passphrase: str) -> int:
    """Проверяет парольную фразу и целостность всего файла. Возвращает размер исходного SQL в байтах."""
    total = 0
    first = b""
    with open(path, "rb") as src:
        for block in decrypt_stream(src, passphrase):
            if not first:
                first = block[:200]
            total += len(block)
    if b"PostgreSQL database dump" not in first:
        raise BackupError("Расшифровка прошла, но содержимое не похоже на дамп PostgreSQL.")
    return total


def restore(path: Path, conn: Connection, passphrase: str, create_db: bool = False,
            pg_bin: Optional[str] = None) -> None:
    psql = find_pg_tool("psql", pg_bin)
    verify(path, passphrase)  # не начинаем восстановление из повреждённого файла
    if create_db:
        created = subprocess.run([psql, *conn.args(), "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-c",
                                  f'CREATE DATABASE "{conn.database}" ENCODING \'UTF8\''],
                                 env=conn.env(), capture_output=True)
        if created.returncode != 0:
            raise BackupError("Не удалось создать базу данных: " + created.stderr.decode("utf-8", "replace").strip())
    fd, temp_name = tempfile.mkstemp(prefix="hotel_restore_", suffix=".sql")
    temp = Path(temp_name)
    try:
        with os.fdopen(fd, "wb") as out:
            decrypt_file(path, out, passphrase)
        result = subprocess.run([psql, *conn.args(), "-d", conn.database, "-v", "ON_ERROR_STOP=1",
                                 "--single-transaction", "--quiet", "-f", str(temp)],
                                env=conn.env(), capture_output=True)
        if result.returncode != 0:
            raise BackupError("Восстановление отменено (изменения не применены): "
                              + result.stderr.decode("utf-8", "replace").strip()[-600:])
    finally:
        temp.unlink(missing_ok=True)


# ----------------------------------------------------------------------------------- командная строка

def _passphrase(args: argparse.Namespace, confirm: bool) -> str:
    value = os.environ.get("BACKUP_PASSPHRASE")
    if value:
        return value
    if not sys.stdin.isatty():
        raise BackupError("Задайте парольную фразу в переменной окружения BACKUP_PASSPHRASE.")
    value = getpass.getpass("Парольная фраза для шифрования копий: ")
    if confirm and getpass.getpass("Повторите фразу: ") != value:
        raise BackupError("Фразы не совпадают.")
    return value


def _connection(args: argparse.Namespace, database: Optional[str] = None) -> Connection:
    return Connection(
        host=args.host or os.environ.get("DB_HOST", "localhost"),
        port=int(args.port or os.environ.get("DB_PORT", "5432")),
        user=args.user or os.environ.get("DB_USER", "postgres"),
        password=os.environ.get("PGPASSWORD") or os.environ.get("DB_PASSWORD"),
        database=database or args.db or os.environ.get("DB_NAME", "hotel"))


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Шифрованные резервные копии БД PostgreSQL")
    sub = parser.add_subparsers(dest="command", required=True)

    def connection_options(p: argparse.ArgumentParser) -> None:
        p.add_argument("--host", help="узел СУБД (по умолчанию DB_HOST или localhost)")
        p.add_argument("--port", help="порт (по умолчанию DB_PORT или 5432)")
        p.add_argument("--user", help="пользователь (по умолчанию DB_USER или postgres)")
        p.add_argument("--pg-bin", default=os.environ.get("PG_BIN"), help="каталог bin PostgreSQL (или PG_BIN)")

    b = sub.add_parser("backup", help="создать зашифрованную копию")
    connection_options(b)
    b.add_argument("--db", help="имя базы данных (по умолчанию DB_NAME или hotel)")
    b.add_argument("--out", default="backups", help="каталог для копий (по умолчанию backups)")
    b.add_argument("--only-forecast", action="store_true", help="только таблицы модуля прогнозирования (mk_*, fc_*)")
    b.add_argument("--clean", action="store_true", help="добавить DROP перед созданием (восстановление поверх существующих таблиц)")

    v = sub.add_parser("verify", help="проверить целостность и парольную фразу")
    v.add_argument("file")

    r = sub.add_parser("restore", help="восстановить копию в указанную базу данных")
    connection_options(r)
    r.add_argument("file")
    r.add_argument("--db", required=True, help="база для восстановления (указывается явно, чтобы не затереть рабочую)")
    r.add_argument("--create-db", action="store_true", help="создать базу данных перед восстановлением")
    return parser


def main(argv: Optional[Sequence[str]] = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        if args.command == "backup":
            conn = _connection(args)
            target = backup(conn, Path(args.out), _passphrase(args, confirm=True), args.only_forecast, args.clean,
                            args.pg_bin)
            print(f"Копия создана: {target} ({target.stat().st_size} байт, AES-256-GCM)")
        elif args.command == "verify":
            size = verify(Path(args.file), _passphrase(args, confirm=False))
            print(f"Файл цел, парольная фраза верна. Размер SQL-дампа: {size} байт.")
        else:
            restore(Path(args.file), _connection(args), _passphrase(args, confirm=False), args.create_db, args.pg_bin)
            print(f"Копия восстановлена в базу данных «{args.db}».")
        return 0
    except BackupError as error:
        print("Ошибка: " + str(error), file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
