"""Тройное экспоненциальное сглаживание (Хольта–Уинтерса) — модель без маркетинга."""
from __future__ import annotations

import warnings

import numpy as np
from statsmodels.tsa.holtwinters import ExponentialSmoothing

from .base import Forecaster, Frame

SEASON = 52
MIN_OBS = 2 * SEASON  # для оценки сезонных индексов нужно не менее двух полных лет


class HoltWinters(Forecaster):
    name = "holt_winters"
    label = "Хольта–Уинтерса (ETS)"
    scenario_aware = False
    min_obs = MIN_OBS

    def __init__(self) -> None:
        self._result = None
        self._n_train = 0

    def fit(self, frame: Frame, n_train: int) -> "HoltWinters":
        if n_train < MIN_OBS:
            raise ValueError(f"для модели Хольта–Уинтерса нужно не менее {MIN_OBS} недель данных")
        y = frame.y[:n_train]
        seasonal = "mul" if float(y.min()) > 0 else "add"
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            model = ExponentialSmoothing(y, trend="add", damped_trend=True, seasonal=seasonal,
                                         seasonal_periods=SEASON, initialization_method="estimated")
            self._result = model.fit()
        self._n_train = n_train
        return self

    def predict(self, frame: Frame, start: int, stop: int) -> np.ndarray:
        assert self._result is not None, "модель не обучена"
        steps = stop - self._n_train
        fc = np.asarray(self._result.forecast(steps))
        return fc[start - self._n_train:]
