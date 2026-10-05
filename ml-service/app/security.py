"""Аутентификация «сервис — сервис»: общий секрет в заголовке X-API-Key."""
from __future__ import annotations

import secrets

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import APIKeyHeader

from .config import Settings, get_settings

_header = APIKeyHeader(name="X-API-Key", auto_error=False, description="Секрет доступа серверной части")


def require_api_key(request: Request, provided: str | None = Depends(_header)) -> None:
    settings: Settings = request.app.state.settings
    # сравнение за постоянное время — защита от подбора ключа по времени ответа
    if not provided or not secrets.compare_digest(provided.encode("utf-8"), settings.api_key.encode("utf-8")):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail={
            "error": "unauthorized", "message": "Неверный или отсутствующий ключ доступа X-API-Key"})


__all__ = ["require_api_key", "get_settings"]
