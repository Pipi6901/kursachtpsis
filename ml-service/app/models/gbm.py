"""Градиентный бустинг над признаками маркетинга — нелинейный претендент на «чемпиона»."""
from __future__ import annotations

import numpy as np
from sklearn.ensemble import HistGradientBoostingRegressor

from ..calendar_features import fourier_features, holiday_features, trend_feature
from .base import Forecaster, Frame
from .mmm import MIN_TRAIN, MMMHyper, MarketingMixModel
from ..transforms import adstock


class GradientBoosting(Forecaster):
    """Гибрид: мультипликативный тренд + бустинг над сезонностью и накопленными затратами каналов.

    Тренд (1 + g·τ) вычитается отдельно, потому что деревья не умеют экстраполировать.
    Для признаков затрат задана монотонность (больше затрат — не меньше продаж),
    а перенос эффекта и темп роста берутся из подобранных гиперпараметров MMM.
    """

    name = "gbm"
    label = "Градиентный бустинг"
    scenario_aware = True
    min_obs = MIN_TRAIN

    def __init__(self, hyper: MMMHyper | None = None, seed: int = 42) -> None:
        self.hyper = hyper
        self.seed = seed
        self._model: HistGradientBoostingRegressor | None = None
        self._y_scale = 1.0
        self._origin = None
        self._fourier = 3

    def _features(self, frame: Frame) -> np.ndarray:
        assert self.hyper is not None
        acc = np.column_stack([adstock(frame.spend[:, c], self.hyper.decays[c])
                               for c in range(frame.spend.shape[1])])
        acc = acc / np.array(self.hyper.scales)  # безразмерные накопленные затраты
        return np.hstack([fourier_features(frame.dates, self._fourier), holiday_features(frame.dates), acc])

    def fit(self, frame: Frame, n_train: int) -> "GradientBoosting":
        if n_train < MIN_TRAIN:
            raise ValueError(f"для градиентного бустинга нужно не менее {MIN_TRAIN} недель данных")
        self._origin = frame.dates[0]
        if self.hyper is None:
            self.hyper = MarketingMixModel().search(frame, n_train)
        self._fourier = self.hyper.fourier
        window = Frame(frame.dates[:n_train], frame.y[:n_train], frame.spend[:n_train], frame.channels)
        self._y_scale = float(window.y.mean())
        y = window.y / self._growth(window) / self._y_scale
        x = self._features(frame)[:n_train]
        n_season = x.shape[1] - len(frame.channels)
        monotonic = [0] * n_season + [1] * len(frame.channels)
        self._model = HistGradientBoostingRegressor(
            max_iter=250, learning_rate=0.06, max_depth=3, min_samples_leaf=8,
            l2_regularization=1.0, monotonic_cst=monotonic, random_state=self.seed)
        self._model.fit(x, y)
        return self

    def _growth(self, frame: Frame) -> np.ndarray:
        assert self.hyper is not None
        return 1.0 + self.hyper.growth * trend_feature(frame.dates, self._origin)

    def predict(self, frame: Frame, start: int, stop: int) -> np.ndarray:
        assert self._model is not None, "модель не обучена"
        x = self._features(frame)[start:stop]
        gf = self._growth(frame)[start:stop]
        return np.maximum(self._model.predict(x), 0.0) * gf * self._y_scale

    def hyperparameters(self) -> dict:
        assert self.hyper is not None
        return self.hyper.as_dict()
