"""Прогнозирование по обученной модели: интервалы и разложение по каналам."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta

import numpy as np

from .models.base import Frame
from .models.mmm import MarketingMixModel
from .serving import ServingModel
from .validation import apply_interval, interval_quantiles


class RequestError(ValueError):
    """Ошибка во входных данных запроса (преобразуется в HTTP 422)."""


@dataclass
class ForecastPoint:
    week_start: date
    predicted: float
    lower: float
    upper: float
    base: float | None
    contributions: dict[str, float] | None


@dataclass
class ForecastResult:
    points: list[ForecastPoint]
    interval_level: float
    components_available: bool


def extend_frame(model: ServingModel, rows: list[tuple[date, np.ndarray]]) -> Frame:
    """Присоединяет к обучающим данным недели с известными (фактическими или плановыми) затратами."""
    expected = model.frame.dates[model.n - 1] + timedelta(weeks=1)
    dates = list(model.frame.dates[: model.n])
    spend = [model.frame.spend[: model.n]]
    extra = []
    for week, values in rows:
        if week != expected:
            raise RequestError(
                f"строки затрат должны идти подряд по неделям, начиная с {model.data_to + timedelta(weeks=1)}; "
                f"ожидалась неделя {expected}, получена {week}")
        dates.append(week)
        extra.append(values)
        expected += timedelta(weeks=1)
    if extra:
        spend.append(np.vstack(extra))
    y = np.concatenate([model.frame.y[: model.n], np.full(len(extra), np.nan)])
    return Frame(dates, y, np.vstack(spend), list(model.channels))


def locate(frame: Frame, start_week: date, horizon: int, n: int) -> tuple[int, int]:
    if start_week not in frame.dates[n:]:
        raise RequestError("начало прогноза должно совпадать с неделей строки затрат после обучающего периода")
    start = frame.dates.index(start_week)
    stop = start + horizon
    if stop > frame.n:
        raise RequestError("строки затрат не покрывают весь горизонт прогноза")
    return start, stop


def forecast(model: ServingModel, rows: list[tuple[date, np.ndarray]], start_week: date,
             horizon: int, level: float | None = None, with_components: bool = True) -> ForecastResult:
    frame = extend_frame(model, rows)
    start, stop = locate(frame, start_week, horizon, model.n)
    predicted = model.champion.predict(frame, start, stop)

    level = level or model.interval_level
    q_lo, q_hi = interval_quantiles(model.relative_errors, level)
    steps = np.arange(start, stop) - model.n + 1
    lower, upper = apply_interval(predicted, q_lo, q_hi, steps, model.cv_horizon)

    base = contrib = None
    if with_components and model.champion.scenario_aware:
        base, contrib = decompose(model, frame, start, stop, predicted)

    points = []
    for i in range(horizon):
        points.append(ForecastPoint(
            frame.dates[start + i], float(predicted[i]), float(lower[i]), float(upper[i]),
            float(base[i]) if base is not None else None,
            {code: float(contrib[i, c]) for c, code in enumerate(model.channels)} if contrib is not None else None))
    return ForecastResult(points, level, base is not None)


def decompose(model: ServingModel, frame: Frame, start: int, stop: int,
              predicted: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Разложение прогноза на базовый уровень и вклад каналов.

    Для MMM разложение точное. Для остальных моделей вклад канала — разность прогнозов
    с затратами канала и без них (метод исключения); остаток взаимодействий относится к базе,
    поэтому база + вклады всегда равны прогнозу.
    """
    if isinstance(model.champion, MarketingMixModel):
        base, contrib = model.champion.components(frame, start, stop)
        return base, contrib
    contrib = np.zeros((stop - start, len(model.channels)))
    for c in range(len(model.channels)):
        without = model.champion.predict(frame.without_channels([c]), start, stop)
        contrib[:, c] = np.maximum(predicted - without, 0.0)
    return predicted - contrib.sum(axis=1), contrib
