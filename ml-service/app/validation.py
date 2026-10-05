"""Скользящая кросс-валидация (rolling origin) и интервальные оценки."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

import numpy as np

from .models.base import Forecaster, Frame, Metrics, compute_metrics


@dataclass
class CVResult:
    indices: np.ndarray       # номера недель кадра, вошедшие в проверочные окна
    actual: np.ndarray
    predicted: np.ndarray
    metrics: Metrics
    fold_wape: list[float]
    horizon: int

    @property
    def relative_errors(self) -> np.ndarray:
        denom = np.maximum(np.abs(self.predicted), 1e-9)
        return (self.actual - self.predicted) / denom


def fold_cuts(n: int, folds: int, horizon: int, min_train: int) -> list[int]:
    """Точки отсечения обучающей выборки: окна проверки идут встык и заканчиваются в конце ряда."""
    max_folds = (n - min_train) // horizon
    folds = max(0, min(folds, max_folds))
    return [n - (folds - k) * horizon for k in range(folds)]


def rolling_origin_cv(factory: Callable[[], Forecaster], frame: Frame, n: int, folds: int,
                      horizon: int, min_train: int) -> CVResult:
    """Для каждой точки отсечения модель обучается заново (включая подбор гиперпараметров)
    и прогнозирует следующие ``horizon`` недель, которых она не видела."""
    cuts = fold_cuts(n, folds, horizon, min_train)
    if not cuts:
        raise ValueError("недостаточно данных для скользящей кросс-валидации")
    idx, actual, predicted, fold_wape = [], [], [], []
    for cut in cuts:
        model = factory().fit(frame, cut)
        pred = model.predict(frame, cut, cut + horizon)
        act = frame.y[cut:cut + horizon]
        idx.extend(range(cut, cut + horizon))
        actual.extend(act)
        predicted.extend(pred)
        fold_wape.append(compute_metrics(act, pred).wape)
    actual_a, predicted_a = np.array(actual), np.array(predicted)
    return CVResult(np.array(idx), actual_a, predicted_a, compute_metrics(actual_a, predicted_a),
                    fold_wape, horizon)


def interval_quantiles(relative_errors: np.ndarray, level: float) -> tuple[float, float]:
    """Квантили относительной ошибки прогноза для интервала заданной доверительной вероятности."""
    alpha = (1.0 - level) / 2.0
    lo, hi = np.quantile(relative_errors, [alpha, 1.0 - alpha])
    return float(lo), float(hi)


def apply_interval(predicted: np.ndarray, q_lo: float, q_hi: float, steps_ahead: np.ndarray,
                   cv_horizon: int) -> tuple[np.ndarray, np.ndarray]:
    """Интервал вокруг прогноза. За пределами горизонта валидации он плавно расширяется
    (на 2 % за каждую дополнительную неделю): неопределённость далёкого будущего выше."""
    widen = 1.0 + 0.02 * np.maximum(steps_ahead - cv_horizon, 0)
    lower = np.maximum(predicted * (1.0 + q_lo * widen), 0.0)
    upper = predicted * (1.0 + q_hi * widen)
    return lower, upper
