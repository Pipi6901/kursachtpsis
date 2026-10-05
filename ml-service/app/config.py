"""Настройки микросервиса (переменные окружения с префиксом ML_)."""
from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict

DEFAULT_API_KEY = "dev-ml-key-change-me"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="ML_", env_file=".env", extra="ignore")

    api_key: str = DEFAULT_API_KEY             # общий секрет «сервер ↔ ML-сервис»
    models_dir: str = "models"                 # каталог реестра моделей
    encryption_key: str | None = None          # парольная фраза для шифрования артефактов (AES-256-GCM)
    max_concurrent_trainings: int = 1          # одновременных обучений (CPU-ёмкая операция)
    model_cache_size: int = 8                  # моделей, удерживаемых в памяти
    docs_enabled: bool = True                  # публиковать Swagger UI (/docs)
    max_body_bytes: int = 10 * 1024 * 1024     # лимит размера тела запроса
    host: str = "127.0.0.1"
    port: int = 8001
    ssl_certfile: str | None = None            # TLS: сертификат и ключ (PEM) для HTTPS между узлами
    ssl_keyfile: str | None = None
    log_level: str = "INFO"


@lru_cache
def get_settings() -> Settings:
    return Settings()
