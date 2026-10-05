"""Шифрование артефактов моделей на диске: AES-256-GCM с ключом из парольной фразы (PBKDF2)."""
from __future__ import annotations

import os

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

MAGIC = b"FCM1"          # признак зашифрованного файла и версия формата
SALT_LEN, NONCE_LEN = 16, 12
KDF_ITERATIONS = 200_000


class DecryptionError(Exception):
    pass


def _key(passphrase: str, salt: bytes) -> bytes:
    kdf = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=KDF_ITERATIONS)
    return kdf.derive(passphrase.encode("utf-8"))


def encrypt(plaintext: bytes, passphrase: str) -> bytes:
    """Формат: MAGIC | salt(16) | nonce(12) | шифртекст + тег аутентификации."""
    salt, nonce = os.urandom(SALT_LEN), os.urandom(NONCE_LEN)
    ciphertext = AESGCM(_key(passphrase, salt)).encrypt(nonce, plaintext, MAGIC)
    return MAGIC + salt + nonce + ciphertext


def is_encrypted(blob: bytes) -> bool:
    return blob.startswith(MAGIC)


def decrypt(blob: bytes, passphrase: str) -> bytes:
    if not is_encrypted(blob):
        raise DecryptionError("файл не является зашифрованным артефактом")
    salt = blob[len(MAGIC):len(MAGIC) + SALT_LEN]
    nonce = blob[len(MAGIC) + SALT_LEN:len(MAGIC) + SALT_LEN + NONCE_LEN]
    ciphertext = blob[len(MAGIC) + SALT_LEN + NONCE_LEN:]
    try:
        return AESGCM(_key(passphrase, salt)).decrypt(nonce, ciphertext, MAGIC)
    except InvalidTag as exc:
        raise DecryptionError("неверный ключ шифрования или файл повреждён") from exc
