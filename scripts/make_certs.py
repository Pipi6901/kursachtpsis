#!/usr/bin/env python3
"""Самоподписанный сертификат для HTTPS между серверной частью и интеллектуальным сервисом.

Создаёт в каталоге certs/ (по умолчанию):
  ml-service.crt       сертификат (PEM) — открытая часть;
  ml-service.key       закрытый ключ (PEM) — для ML-сервиса, нигде не публикуется;
  ml-truststore.p12    хранилище доверенных сертификатов (PKCS12) для Java — серверная часть доверяет только ему.

Сертификат выдан на localhost, 127.0.0.1, ::1 и имя этого компьютера (дополнительные имена: --host).
Для промышленной эксплуатации используйте сертификат, выпущенный вашим удостоверяющим центром.

    python scripts/make_certs.py
"""
from __future__ import annotations

import argparse
import datetime as dt
import ipaddress
import os
import shutil
import socket
import subprocess
import sys
from pathlib import Path
from typing import Optional, Sequence

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import ExtendedKeyUsageOID, NameOID

CERT_NAME = "ml-service.crt"
KEY_NAME = "ml-service.key"
TRUSTSTORE_NAME = "ml-truststore.p12"
ALIAS = "ml-service"


def _san(names: Sequence[str]) -> list:
    entries = []
    for name in dict.fromkeys(names):
        try:
            entries.append(x509.IPAddress(ipaddress.ip_address(name)))
        except ValueError:
            entries.append(x509.DNSName(name))
    return entries


def generate(out_dir: Path, hosts: Sequence[str] = (), days: int = 365,
             now: Optional[dt.datetime] = None) -> tuple:
    """Создаёт ключ и самоподписанный сертификат. Возвращает пути (сертификат, ключ)."""
    names = ["localhost", "127.0.0.1", "::1", *hosts]
    try:
        names.append(socket.gethostname())
    except OSError:
        pass
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    subject = x509.Name([
        x509.NameAttribute(NameOID.ORGANIZATION_NAME, "HotelManager"),
        x509.NameAttribute(NameOID.COMMON_NAME, "ml-service"),
    ])
    start = (now or dt.datetime.now(dt.timezone.utc)) - dt.timedelta(minutes=5)
    cert = (x509.CertificateBuilder()
            .subject_name(subject).issuer_name(subject).public_key(key.public_key())
            .serial_number(x509.random_serial_number())
            .not_valid_before(start).not_valid_after(start + dt.timedelta(days=days))
            .add_extension(x509.BasicConstraints(ca=False, path_length=None), critical=True)
            .add_extension(x509.KeyUsage(digital_signature=True, key_encipherment=True, content_commitment=False,
                                         data_encipherment=False, key_agreement=False, key_cert_sign=False,
                                         crl_sign=False, encipher_only=False, decipher_only=False), critical=True)
            .add_extension(x509.ExtendedKeyUsage([ExtendedKeyUsageOID.SERVER_AUTH]), critical=False)
            .add_extension(x509.SubjectAlternativeName(_san(names)), critical=False)
            .sign(key, hashes.SHA256()))
    out_dir.mkdir(parents=True, exist_ok=True)
    cert_path, key_path = out_dir / CERT_NAME, out_dir / KEY_NAME
    cert_path.write_bytes(cert.public_bytes(serialization.Encoding.PEM))
    key_path.write_bytes(key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8,
                                           serialization.NoEncryption()))
    try:
        os.chmod(key_path, 0o600)
    except OSError:
        pass
    return cert_path, key_path


def find_keytool() -> Optional[str]:
    java_home = os.environ.get("JAVA_HOME")
    exe = "keytool.exe" if os.name == "nt" else "keytool"
    if java_home and (Path(java_home) / "bin" / exe).is_file():
        return str(Path(java_home) / "bin" / exe)
    return shutil.which("keytool")


def make_truststore(cert_path: Path, out_dir: Path, password: str, keytool: Optional[str] = None) -> Optional[Path]:
    """Импортирует сертификат в хранилище PKCS12 утилитой keytool из JDK. Без JDK возвращает None."""
    keytool = keytool or find_keytool()
    if not keytool:
        return None
    store = out_dir / TRUSTSTORE_NAME
    store.unlink(missing_ok=True)
    result = subprocess.run([keytool, "-importcert", "-noprompt", "-alias", ALIAS, "-file", str(cert_path),
                             "-keystore", str(store), "-storetype", "PKCS12", "-storepass", password],
                            capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError("keytool завершился с ошибкой: " + (result.stderr or result.stdout).strip())
    return store


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Самоподписанный сертификат для HTTPS между узлами")
    parser.add_argument("--out", default="certs", help="каталог для файлов (по умолчанию certs)")
    parser.add_argument("--host", action="append", default=[], help="дополнительное имя или IP узла ML-сервиса")
    parser.add_argument("--days", type=int, default=365, help="срок действия, дней (по умолчанию 365)")
    parser.add_argument("--truststore-password", default=os.environ.get("ML_TRUST_STORE_PASSWORD", "changeit"))
    parser.add_argument("--keytool", help="путь к keytool из JDK (по умолчанию JAVA_HOME или PATH)")
    parser.add_argument("--no-truststore", action="store_true", help="не создавать хранилище PKCS12")
    args = parser.parse_args(argv)

    out = Path(args.out)
    cert, key = generate(out, args.host, args.days)
    print(f"Сертификат: {cert}\nЗакрытый ключ: {key}  (храните в секрете, в репозиторий не добавляется)")
    store = None
    if not args.no_truststore:
        try:
            store = make_truststore(cert, out, args.truststore_password, args.keytool)
        except RuntimeError as error:
            print("Ошибка: " + str(error), file=sys.stderr)
            return 2
        if store is None:
            print("keytool не найден (нужен JDK 17+): хранилище для серверной части не создано. "
                  "Добавьте каталог bin JDK в PATH или задайте JAVA_HOME и повторите.", file=sys.stderr)
        else:
            print(f"Хранилище доверенных сертификатов для серверной части: {store}")
    print("\nВключение HTTPS:\n"
          f"  ML-сервис:  ML_SSL_CERTFILE={cert}  ML_SSL_KEYFILE={key}\n"
          "  Сервер:     ML_SERVICE_URL=https://localhost:8001  "
          f"ML_TRUST_STORE={store or out / TRUSTSTORE_NAME}  ML_TRUST_STORE_PASSWORD=<пароль хранилища>")
    return 0


if __name__ == "__main__":
    sys.exit(main())
