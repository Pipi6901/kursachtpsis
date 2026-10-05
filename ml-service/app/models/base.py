"""Общие структуры данных и интерфейс моделей прогнозирования."""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import date

import numpy as np


@dataclass
class Frame:
    """Недельный ряд продаж вместе с маркетинговыми затратами.

    ``y`` содержит NaN для недель, продажи которых неизвестны (будущее).
    Затраты ``spend`` известны для всех недель: фактические — для истории,
    плановые — для прогнозного периода. Это позволяет модели корректно
    переносить эффект рекламы (adstock) из прошлого в будущее.
    """
    dates: list[date]
    y: np.ndarray
    spend: np.ndarray
    channels: list[str]

    def __post_init__(self) -> None:
        self.y = np.asarray(self.y, dtype=float)
        self.spend = np.asarray(self.spend, dtype=float)
        if self.spend.ndim != 2 or self.spend.shape != (len(self.dates), len(self.channels)):
            raise ValueError("Размерность матрицы затрат не соответствует неделям и каналам")
        if self.y.shape != (len(self.dates),):
            raise ValueError("Длина ряда продаж не соответствует числу недель")

    @property
    def n(self) -> int:
        return len(self.dates)

    def with_spend(self, spend: np.ndarray) -> "Frame":
        return Frame(self.dates, self.y, spend, self.channels)

    def without_channels(self, indices: list[int]) -> "Frame":
        """Копия, в которой затраты указанных каналов обнулены (для оценки вклада методом исключения)."""
        spend = self.spend.copy()
        spend[:, indices] = 0.0
        return self.with_spend(spend)


class Forecaster(ABC):
    """Интерфейс модели. Обучение — по первым ``n_train`` строкам кадра."""

    name: str = "model"
    label: str = "Модель"
    scenario_aware: bool = False  # учитывает ли модель маркетинговые затраты
    min_obs: int = 13             # минимальная длина обучающей выборки, недель

    @abstractmethod
    def fit(self, frame: Frame, n_train: int) -> "Forecaster":
        ...

    @abstractmethod
    def predict(self, frame: Frame, start: int, stop: int) -> np.ndarray:
        """Прогноз для строк [start, stop) кадра (start >= n_train)."""

    def hyperparameters(self) -> dict:
        """Параметры, достаточные для воспроизведения модели без повторного подбора."""
        return {}


@dataclass
class Metrics:
    wape: float
    mape: float
    smape: float
    rmse: float
    bias: float
    n: int

    def as_dict(self) -> dict:
        return {"wape": self.wape, "mape": self.mape, "smape": self.smape,
                "rmse": self.rmse, "bias": self.bias, "n": self.n}


def compute_metrics(actual: np.ndarray, predicted: np.ndarray) -> Metrics:
    actual = np.asarray(actual, dtype=float)
    predicted = np.asarray(predicted, dtype=float)
    err = actual - predicted
    denom = np.abs(actual)
    safe = denom > 1e-9
    wape = float(np.abs(err).sum() / max(denom.sum(), 1e-9))
    mape = float(np.mean(np.abs(err[safe]) / denom[safe])) if safe.any() else float("nan")
    sm_den = (np.abs(actual) + np.abs(predicted)) / 2.0
    sm_safe = sm_den > 1e-9
    smape = float(np.mean(np.abs(err[sm_safe]) / sm_den[sm_safe])) if sm_safe.any() else float("nan")
    rmse = float(np.sqrt(np.mean(err ** 2)))
    bias = float(err.mean() / max(denom.mean(), 1e-9))
    return Metrics(wape, mape, smape, rmse, bias, int(actual.size))
