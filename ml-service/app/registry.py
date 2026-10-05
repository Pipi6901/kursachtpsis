"""Реестр моделей: версионируемое хранилище артефактов обучения на диске узла ML-сервиса.

Артефакт — JSON с гиперпараметрами и снимком обучающих данных (без pickle: загрузка
не исполняет код). При заданном ключе шифрования файл защищён AES-256-GCM, а тег
аутентификации не позволяет незаметно подменить артефакт.
"""
from __future__ import annotations

import json
import os
import re
import tempfile
import threading
from pathlib import Path

from .crypto import DecryptionError, decrypt, encrypt, is_encrypted

MODEL_ID_RE = re.compile(r"^[a-z0-9_]{1,24}-\d{8}T\d{6}-[0-9a-f]{8}$")


class ModelNotFound(KeyError):
    pass


class ModelRegistry:
    def __init__(self, directory: str | Path, passphrase: str | None = None) -> None:
        self.directory = Path(directory)
        self.directory.mkdir(parents=True, exist_ok=True)
        self._passphrase = passphrase or None
        self._lock = threading.Lock()

    @property
    def encrypted(self) -> bool:
        return self._passphrase is not None

    @staticmethod
    def _check_id(model_id: str) -> None:
        if not MODEL_ID_RE.match(model_id):
            raise ModelNotFound(model_id)  # защита от выхода за пределы каталога

    def _artifact(self, model_id: str) -> Path:
        return self.directory / f"{model_id}.model"

    def _meta(self, model_id: str) -> Path:
        return self.directory / f"{model_id}.meta.json"

    def _atomic_write(self, path: Path, data: bytes) -> None:
        fd, tmp = tempfile.mkstemp(dir=self.directory, suffix=".tmp")
        try:
            with os.fdopen(fd, "wb") as fh:
                fh.write(data)
            os.replace(tmp, path)
        finally:
            if os.path.exists(tmp):
                os.unlink(tmp)

    def save(self, model_id: str, payload: dict, meta: dict) -> None:
        self._check_id(model_id)
        raw = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        blob = encrypt(raw, self._passphrase) if self._passphrase else raw
        with self._lock:
            self._atomic_write(self._artifact(model_id), blob)
            self._atomic_write(self._meta(model_id), json.dumps(meta, ensure_ascii=False).encode("utf-8"))

    def load(self, model_id: str) -> dict:
        self._check_id(model_id)
        path = self._artifact(model_id)
        if not path.exists():
            raise ModelNotFound(model_id)
        blob = path.read_bytes()
        if is_encrypted(blob):
            if not self._passphrase:
                raise DecryptionError("артефакт зашифрован, а ключ шифрования не задан")
            blob = decrypt(blob, self._passphrase)
        return json.loads(blob.decode("utf-8"))

    def list_meta(self) -> list[dict]:
        items = []
        for path in sorted(self.directory.glob("*.meta.json")):
            try:
                items.append(json.loads(path.read_text(encoding="utf-8")))
            except (OSError, ValueError):
                continue
        return sorted(items, key=lambda m: m.get("created_at", ""), reverse=True)

    def get_meta(self, model_id: str) -> dict:
        self._check_id(model_id)
        path = self._meta(model_id)
        if not path.exists():
            raise ModelNotFound(model_id)
        return json.loads(path.read_text(encoding="utf-8"))
