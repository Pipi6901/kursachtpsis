"""Загрузка обученных моделей для обслуживания запросов (прогноз, оптимизация)."""
from __future__ import annotations

import threading
from collections import OrderedDict
from dataclasses import dataclass
from datetime import date

import numpy as np

from .models.base import Forecaster, Frame
from .models.gbm import GradientBoosting
from .models.holt_winters import HoltWinters
from .models.mmm import MMMHyper, MarketingMixModel
from .models.seasonal_naive import SeasonalNaive
from .registry import ModelRegistry


@dataclass
class ServingModel:
    model_id: str
    target: str
    channels: list[str]
    frame: Frame                 # обучающие данные (только история)
    n: int
    champion_name: str
    champion: Forecaster
    mmm: MarketingMixModel | None
    relative_errors: np.ndarray
    cv_horizon: int
    interval_level: float

    @property
    def data_to(self) -> date:
        return self.frame.dates[self.n - 1]


def _restore(name: str, hyper: dict | None, frame: Frame, n: int, seed: int) -> Forecaster:
    """Воспроизводит модель по сохранённым гиперпараметрам (без повторного подбора)."""
    if name == MarketingMixModel.name:
        return MarketingMixModel(MMMHyper.from_dict(hyper or {})).fit(frame, n)
    if name == GradientBoosting.name:
        return GradientBoosting(MMMHyper.from_dict(hyper or {}), seed=seed).fit(frame, n)
    if name == HoltWinters.name:
        return HoltWinters().fit(frame, n)
    if name == SeasonalNaive.name:
        return SeasonalNaive().fit(frame, n)
    raise ValueError(f"неизвестный алгоритм: {name}")


def build_serving(payload: dict) -> ServingModel:
    data = payload["data"]
    dates = [date.fromisoformat(d) for d in data["dates"]]
    frame = Frame(dates, np.array(data["y"], dtype=float), np.array(data["spend"], dtype=float),
                  list(payload["channels"]))
    n = frame.n
    seed = int(payload.get("seed", 42))
    champion_name = payload["champion"]
    hypers = payload["hyperparameters"]
    champion = _restore(champion_name, hypers.get(champion_name), frame, n, seed)
    mmm: MarketingMixModel | None = None
    if isinstance(champion, MarketingMixModel):
        mmm = champion
    elif MarketingMixModel.name in hypers:
        mmm = _restore(MarketingMixModel.name, hypers[MarketingMixModel.name], frame, n, seed)  # type: ignore[assignment]
    return ServingModel(payload["model_id"], payload["target"], list(payload["channels"]), frame, n,
                        champion_name, champion, mmm, np.array(payload["relative_errors"], dtype=float),
                        int(payload["cv_horizon"]), float(payload["interval_level"]))


class ModelStore:
    """Кэш готовых к работе моделей (LRU). Модель собирается из реестра при первом обращении."""

    def __init__(self, registry: ModelRegistry, capacity: int = 8) -> None:
        self._registry = registry
        self._capacity = capacity
        self._cache: OrderedDict[str, ServingModel] = OrderedDict()
        self._lock = threading.Lock()

    def put(self, model: ServingModel) -> None:
        with self._lock:
            self._cache[model.model_id] = model
            self._cache.move_to_end(model.model_id)
            while len(self._cache) > self._capacity:
                self._cache.popitem(last=False)

    def get(self, model_id: str) -> ServingModel:
        with self._lock:
            if model_id in self._cache:
                self._cache.move_to_end(model_id)
                return self._cache[model_id]
        payload = self._registry.load(model_id)  # KeyError, если модели нет
        model = build_serving(payload)
        self.put(model)
        return model
