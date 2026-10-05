"""Сезонная наивная модель — контрольный ориентир для остальных алгоритмов."""
from __future__ import annotations

import numpy as np

from .base import Forecaster, Frame

SEASON = 52


class SeasonalNaive(Forecaster):
    """Прогноз = значение той же недели прошлого года × поправка на изменение уровня.

    Поправка — отношение среднего уровня последних 13 недель к тем же неделям годом ранее
    (ограничена диапазоном 0,7…1,5). Если истории меньше года — среднее последних 8 недель.
    """

    name = "seasonal_naive"
    label = "Сезонная наивная модель"
    scenario_aware = False

    def __init__(self) -> None:
        self._y: np.ndarray | None = None
        self._growth = 1.0

    def fit(self, frame: Frame, n_train: int) -> "SeasonalNaive":
        y = frame.y[:n_train]
        self._y = y.copy()
        if n_train >= SEASON + 13:
            recent = y[-13:].mean()
            year_ago = y[-13 - SEASON:-SEASON].mean()
            self._growth = float(np.clip(recent / year_ago, 0.7, 1.5)) if year_ago > 0 else 1.0
        else:
            self._growth = 1.0
        return self

    def predict(self, frame: Frame, start: int, stop: int) -> np.ndarray:
        assert self._y is not None, "модель не обучена"
        n_train = self._y.size
        if n_train < SEASON:
            return np.full(stop - start, float(self._y[-8:].mean()))
        history = list(self._y)
        preds = []
        for i in range(n_train, stop):
            # значение той же недели год назад (при необходимости — собственный прогноз)
            pred = history[i - SEASON] * self._growth
            history.append(pred)  # рекурсивно для горизонтов дальше года
            preds.append(pred)
        return np.array(preds[start - n_train:])
