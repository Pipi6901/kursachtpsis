import io
import os
import struct
from pathlib import Path

import pytest

import db_backup as bk

PASS = "тестовая-парольная-фраза"

# Подмена pg_dump делается shell-скриптом, поэтому эти проверки выполняются только в Linux/macOS.
posix_only = pytest.mark.skipif(os.name == "nt", reason="подмена pg_dump shell-скриптом")


def encrypt(data: bytes, chunk: int = 16, passphrase: str = PASS) -> bytes:
    out = io.BytesIO()
    assert bk.encrypt_stream(io.BytesIO(data), out, passphrase, chunk) == len(data)
    return out.getvalue()


def decrypt(blob: bytes, passphrase: str = PASS) -> bytes:
    return b"".join(bk.decrypt_stream(io.BytesIO(blob), passphrase))


@pytest.mark.parametrize("size", [0, 1, 15, 16, 17, 32, 33, 1000])
def test_roundtrip_for_boundary_sizes(size):
    data = os.urandom(size)
    assert decrypt(encrypt(data)) == data


def test_cyrillic_sql_roundtrip():
    data = "-- PostgreSQL database dump\nINSERT INTO t VALUES ('Гостиница');\n".encode("utf-8")
    assert decrypt(encrypt(data, chunk=1024)) == data


def test_ciphertext_hides_plaintext_and_is_randomized():
    data = b"secret-secret-secret-secret"
    first, second = encrypt(data, chunk=1024), encrypt(data, chunk=1024)
    assert b"secret" not in first
    assert first != second  # соль и nonce случайны


def test_wrong_passphrase_is_rejected():
    with pytest.raises(bk.BackupError, match="парольная фраза"):
        decrypt(encrypt(b"x" * 100), "другая-фраза")


def test_empty_passphrase_is_rejected():
    with pytest.raises(bk.BackupError):
        encrypt(b"data", passphrase="")


def test_flipped_byte_is_detected():
    blob = bytearray(encrypt(b"a" * 100))
    blob[bk.HEADER_LEN + 10] ^= 0x01
    with pytest.raises(bk.BackupError):
        decrypt(bytes(blob))


def test_modified_header_is_detected():
    blob = bytearray(encrypt(b"a" * 100))
    blob[len(bk.MAGIC) + 1 + bk.SALT_LEN] ^= 0x01  # префикс nonce входит в аутентифицируемые данные
    with pytest.raises(bk.BackupError):
        decrypt(bytes(blob))


def test_truncated_file_is_detected():
    blob = encrypt(b"a" * 100, chunk=16)  # 7 блоков
    first_chunk_end = bk.HEADER_LEN + 4 + 16 + 16
    with pytest.raises(bk.BackupError):
        decrypt(blob[:first_chunk_end])  # отрезан хвост по границе блока
    with pytest.raises(bk.BackupError):
        decrypt(blob[:-3])  # отрезан посреди блока
    with pytest.raises(bk.BackupError):
        decrypt(blob[:bk.HEADER_LEN])  # остался только заголовок


def test_reordered_chunks_are_detected():
    blob = encrypt(b"a" * 64, chunk=16)  # 4 блока по 16 байт данных, каждый 4+32 байта
    header, body = blob[:bk.HEADER_LEN], blob[bk.HEADER_LEN:]
    size = 4 + 32
    chunks = [body[i:i + size] for i in range(0, len(body), size)]
    assert len(chunks) == 4
    swapped = header + chunks[1] + chunks[0] + chunks[2] + chunks[3]
    with pytest.raises(bk.BackupError):
        decrypt(swapped)


def test_not_a_backup_file():
    with pytest.raises(bk.BackupError, match="заголовок"):
        decrypt(b"just some text that is not a backup")


def test_unsupported_version():
    blob = bytearray(encrypt(b"abc"))
    blob[len(bk.MAGIC)] = 99
    with pytest.raises(bk.BackupError, match="версия"):
        decrypt(bytes(blob))


def test_dump_command_for_whole_database():
    conn = bk.Connection("db.local", 5433, "backup", "pw", "hotel")
    command = bk.dump_command("/usr/bin/pg_dump", conn, only_forecast=False, clean=False)
    assert command[0] == "/usr/bin/pg_dump"
    assert command[command.index("-h") + 1] == "db.local"
    assert command[command.index("-p") + 1] == "5433"
    assert "--no-owner" in command and "--format=plain" in command
    assert "--table" not in command and "--clean" not in command
    assert command[-1] == "hotel"
    assert "pw" not in command  # пароль передаётся окружением, а не аргументом (не виден в списке процессов)
    assert conn.env()["PGPASSWORD"] == "pw"


def test_dump_command_only_forecast_tables():
    conn = bk.Connection("localhost", 5432, "postgres", None, "hotel")
    command = bk.dump_command("pg_dump", conn, only_forecast=True, clean=True)
    tables = [command[i + 1] for i, part in enumerate(command) if part == "--table"]
    assert tables == ["mk_*", "fc_*"]
    assert "--clean" in command and "--if-exists" in command


@posix_only
def test_backup_with_fake_pg_dump(tmp_path: Path, monkeypatch):
    """pg_dump подменён скриптом: проверяем потоковое шифрование, имя файла и проверку целостности."""
    fake = tmp_path / "pg_dump"
    fake.write_text("#!/bin/sh\necho '-- PostgreSQL database dump'\necho \"INSERT INTO mk_channel VALUES ('Поиск');\"\n")
    fake.chmod(0o755)
    monkeypatch.setattr(bk, "find_pg_tool", lambda name, pg_bin=None: str(fake))
    conn = bk.Connection("localhost", 5432, "postgres", None, "hotel")
    import datetime as dt
    target = bk.backup(conn, tmp_path / "out", PASS, only_forecast=True, now=dt.datetime(2026, 10, 5, 23, 14, 55))
    assert target.name == "hotel_forecast_20261005_231455.sql.enc"
    raw = target.read_bytes()
    assert b"mk_channel" not in raw and b"PostgreSQL" not in raw
    assert bk.verify(target, PASS) > 0
    out = io.BytesIO()
    bk.decrypt_file(target, out, PASS)
    assert "Поиск" in out.getvalue().decode("utf-8")
    assert not list((tmp_path / "out").glob("*.part"))
    with pytest.raises(bk.BackupError):
        bk.verify(target, "неверная")


@posix_only
def test_failed_pg_dump_leaves_no_partial_file(tmp_path: Path, monkeypatch):
    fake = tmp_path / "pg_dump"
    fake.write_text("#!/bin/sh\necho 'connection refused' >&2\nexit 1\n")
    fake.chmod(0o755)
    monkeypatch.setattr(bk, "find_pg_tool", lambda name, pg_bin=None: str(fake))
    conn = bk.Connection("localhost", 5432, "postgres", None, "hotel")
    with pytest.raises(bk.BackupError, match="connection refused"):
        bk.backup(conn, tmp_path / "out", PASS)
    assert list((tmp_path / "out").iterdir()) == []


def test_restore_refuses_corrupted_file_before_touching_database(tmp_path: Path, monkeypatch):
    blob = bytearray(encrypt(b"-- PostgreSQL database dump\n" * 10, chunk=64))
    blob[-5] ^= 0xFF
    broken = tmp_path / "broken.sql.enc"
    broken.write_bytes(bytes(blob))
    called = []
    monkeypatch.setattr(bk, "find_pg_tool", lambda name, pg_bin=None: "psql")
    monkeypatch.setattr(bk.subprocess, "run", lambda *a, **k: called.append(a))
    with pytest.raises(bk.BackupError):
        bk.restore(broken, bk.Connection("localhost", 5432, "postgres", None, "hotel_restore"), PASS, create_db=True)
    assert called == []


def test_restore_requires_explicit_database(capsys):
    with pytest.raises(SystemExit):
        bk.main(["restore", "file.enc"])
    assert "--db" in capsys.readouterr().err
