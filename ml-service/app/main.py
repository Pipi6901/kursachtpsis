"""Точка входа HTTP API интеллектуального микросервиса."""
from __future__ import annotations

import logging
import threading
import time
from contextlib import asynccontextmanager

from fastapi import APIRouter, Depends, FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from . import __version__, service
from .config import DEFAULT_API_KEY, Settings, get_settings
from .crypto import DecryptionError
from .forecasting import RequestError
from .registry import ModelNotFound, ModelRegistry
from .schemas import (ForecastRequest, ForecastResponse, HealthResponse, ModelMeta, OptimizeRequest,
                      OptimizeResponse, TrainRequest, TrainResponse)
from .security import require_api_key
from .serving import ModelStore

log = logging.getLogger("ml-service")


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    logging.basicConfig(level=settings.log_level.upper(),
                        format="%(asctime)s %(levelname)s %(name)s: %(message)s")

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        if settings.api_key == DEFAULT_API_KEY:
            log.warning("Используется ключ доступа по умолчанию — задайте ML_API_KEY перед эксплуатацией")
        if not settings.encryption_key:
            log.warning("Шифрование артефактов моделей отключено — задайте ML_ENCRYPTION_KEY")
        yield

    app = FastAPI(
        title="Интеллектуальный сервис прогнозирования продаж",
        description="Изолированный микросервис: обучение моделей, прогноз с учётом мультиканального "
                    "маркетинга, оптимизация бюджета. Доступ — только для серверной части (X-API-Key).",
        version=__version__, lifespan=lifespan,
        docs_url="/docs" if settings.docs_enabled else None,
        redoc_url=None, openapi_url="/openapi.json" if settings.docs_enabled else None)
    registry = ModelRegistry(settings.models_dir, settings.encryption_key)
    app.state.settings = settings
    app.state.registry = registry
    app.state.store = ModelStore(registry, settings.model_cache_size)
    app.state.training_slots = threading.BoundedSemaphore(settings.max_concurrent_trainings)

    @app.middleware("http")
    async def guard(request: Request, call_next):
        started = time.perf_counter()
        length = request.headers.get("content-length")
        if length and length.isdigit() and int(length) > settings.max_body_bytes:
            return JSONResponse(status_code=413, content={"error": "payload_too_large",
                                                          "message": "Слишком большой запрос"})
        response = await call_next(request)
        log.info("%s %s -> %s (%.0f мс)", request.method, request.url.path, response.status_code,
                 (time.perf_counter() - started) * 1000)
        return response

    @app.exception_handler(StarletteHTTPException)
    async def http_error_handler(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        # единый формат ошибок {"error": ..., "message": ...}
        body = exc.detail if isinstance(exc.detail, dict) else {"error": "http_error", "message": str(exc.detail)}
        return JSONResponse(status_code=exc.status_code, content=body)

    @app.exception_handler(RequestValidationError)
    async def validation_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
        parts = []
        for err in exc.errors():
            where = ".".join(str(x) for x in err["loc"] if x != "body")
            parts.append(f"{where}: {err['msg']}" if where else err["msg"])
        return JSONResponse(status_code=422, content={"error": "validation_error",
                                                      "message": "; ".join(parts[:5])})

    @app.exception_handler(RequestError)
    async def request_error_handler(_: Request, exc: RequestError) -> JSONResponse:
        return JSONResponse(status_code=422, content={"error": "invalid_request", "message": str(exc)})

    @app.exception_handler(ModelNotFound)
    async def not_found_handler(_: Request, exc: ModelNotFound) -> JSONResponse:
        return JSONResponse(status_code=404, content={"error": "model_not_found",
                                                      "message": f"Модель не найдена: {exc.args[0]}"})

    @app.exception_handler(DecryptionError)
    async def decrypt_handler(_: Request, exc: DecryptionError) -> JSONResponse:
        log.error("Ошибка расшифровки артефакта: %s", exc)
        return JSONResponse(status_code=500, content={"error": "artifact_unreadable", "message": str(exc)})

    @app.get("/health", response_model=HealthResponse, tags=["Служебные"], summary="Проверка работоспособности")
    def health(request: Request) -> HealthResponse:
        registry: ModelRegistry = request.app.state.registry
        return HealthResponse(status="ok", version=__version__, models_total=len(registry.list_meta()),
                              encryption_enabled=registry.encrypted)

    api = APIRouter(prefix="/api/v1", tags=["Модели"], dependencies=[Depends(require_api_key)])

    @api.post("/models/train", response_model=TrainResponse, status_code=201,
              summary="Обучить модели, выбрать лучшую и сохранить в реестр")
    def train(req: TrainRequest, request: Request) -> TrainResponse:
        slots: threading.BoundedSemaphore = request.app.state.training_slots
        if not slots.acquire(blocking=False):
            raise HTTPException(status_code=429, detail={
                "error": "busy", "message": "Обучение уже выполняется, повторите позже"})
        try:
            return service.train_model(req, request.app.state.registry, request.app.state.store)
        finally:
            slots.release()

    @api.get("/models", response_model=list[ModelMeta], summary="Список моделей реестра")
    def list_models(request: Request) -> list[ModelMeta]:
        return [ModelMeta(**m) for m in request.app.state.registry.list_meta()]

    @api.get("/models/{model_id}", response_model=TrainResponse, summary="Описание и качество модели")
    def get_model(model_id: str, request: Request) -> TrainResponse:
        return TrainResponse(**request.app.state.registry.load(model_id)["result"])

    @api.post("/models/{model_id}/forecast", response_model=ForecastResponse,
              summary="Прогноз по плану затрат с интервалом и вкладом каналов")
    def forecast(model_id: str, req: ForecastRequest, request: Request) -> ForecastResponse:
        return service.forecast_model(request.app.state.store.get(model_id), req)

    @api.post("/models/{model_id}/optimize", response_model=OptimizeResponse,
              summary="Оптимальное распределение бюджета между каналами")
    def optimize(model_id: str, req: OptimizeRequest, request: Request) -> OptimizeResponse:
        return service.optimize_model(request.app.state.store.get(model_id), req)

    app.include_router(api)
    return app


app = create_app()
