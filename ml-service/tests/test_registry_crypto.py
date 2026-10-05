import json

import pytest

from app.crypto import DecryptionError, decrypt, encrypt, is_encrypted
from app.registry import ModelNotFound, ModelRegistry

MODEL_ID = "revenue-20260101T000000-0123abcd"


def test_encrypt_decrypt_roundtrip_and_randomization():
    blob1, blob2 = encrypt(b"secret data", "pass"), encrypt(b"secret data", "pass")
    assert is_encrypted(blob1) and blob1 != blob2          # соль и nonce случайны
    assert b"secret data" not in blob1
    assert decrypt(blob1, "pass") == b"secret data"


def test_wrong_key_and_tampering_are_detected():
    blob = encrypt(b"payload", "pass")
    with pytest.raises(DecryptionError):
        decrypt(blob, "other")
    tampered = bytearray(blob)
    tampered[-1] ^= 0x01
    with pytest.raises(DecryptionError):
        decrypt(bytes(tampered), "pass")


def test_registry_stores_encrypted_artifact(tmp_path):
    reg = ModelRegistry(tmp_path, "pass")
    reg.save(MODEL_ID, {"channels": ["search_secret_name"]}, {"model_id": MODEL_ID})
    raw = (tmp_path / f"{MODEL_ID}.model").read_bytes()
    assert b"search_secret_name" not in raw and is_encrypted(raw)
    assert reg.load(MODEL_ID)["channels"] == ["search_secret_name"]


def test_registry_plain_mode_and_missing_key(tmp_path):
    ModelRegistry(tmp_path).save(MODEL_ID, {"a": 1}, {"model_id": MODEL_ID})
    assert json.loads((tmp_path / f"{MODEL_ID}.model").read_text())["a"] == 1
    ModelRegistry(tmp_path, "pass").save("revenue-20260101T000001-0123abcd", {"a": 2}, {})
    with pytest.raises(DecryptionError):
        ModelRegistry(tmp_path).load("revenue-20260101T000001-0123abcd")


@pytest.mark.parametrize("bad", ["../secret", "revenue", "a/b-20260101T000000-0123abcd", ""])
def test_registry_rejects_unsafe_ids(tmp_path, bad):
    with pytest.raises(ModelNotFound):
        ModelRegistry(tmp_path).load(bad)
