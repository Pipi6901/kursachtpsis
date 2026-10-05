"""Модель маркетингового микса (Marketing Mix Model, MMM).

    y_t = (1 + g·τ_t) · [ b0 + Σ_k (сезонные гармоники) + Σ_h (праздники)
                          + Σ_c β_c · S_c(A_c(x_{c,t})) ] + ε_t

* τ_t — время в годах, g — годовой темп роста (мультипликативный тренд: сезонные
  колебания и отдача рекламы растут вместе с масштабом бизнеса);
* A_c — перенос эффекта рекламы на последующие недели (геометрический adstock);
* S_c(a) = 1 − exp(−a / k_c) — убывающая отдача (насыщение канала);
* β_c ≥ 0 — максимальный недельный эффект канала (ограничение неотрицательности
  исключает «отрицательную рекламу» и делает оценки интерпретируемыми);
* коэффициенты оцениваются регуляризованным МНК с ограничениями (BVLS);
* гиперпараметры (decay_c, k_c, число гармоник, сила регуляризации, g) подбираются
  покоординатным поиском по блочной кросс-валидации — только на обучающем окне.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from scipy.optimize import lsq_linear

from ..calendar_features import fourier_features, holiday_features, trend_feature
from ..transforms import adstock, saturation, saturation_slope
from .base import Forecaster, Frame

DECAY_GRID = (0.0, 0.25, 0.5, 0.75)
KAPPA_GRID = (0.4, 0.8, 1.6, 3.2)
FOURIER_GRID = (2, 3, 4)
RIDGE_GRID = (0.3, 3.0)
GROWTH_GRID = (0.0, 0.04, 0.08, 0.12)
MIN_TRAIN = 52
CV_BLOCK = 26      # целевая длина блока блочной кросс-валидации, недель
CV_BUFFER = 3      # недель вокруг блока, исключаемых из обучения (защита от утечки через перенос эффекта)


@dataclass
class MMMHyper:
    decays: list[float]
    scales: list[float]   # k_c — недельные затраты (в валюте), при которых эффект равен 63 % максимума
    fourier: int
    ridge: float
    growth: float = 0.0

    def copy(self) -> "MMMHyper":
        return MMMHyper(list(self.decays), list(self.scales), self.fourier, self.ridge, self.growth)

    def as_dict(self) -> dict:
        return {"decays": list(self.decays), "scales": list(self.scales),
                "fourier": self.fourier, "ridge": self.ridge, "growth": self.growth}

    @staticmethod
    def from_dict(d: dict) -> "MMMHyper":
        return MMMHyper([float(x) for x in d["decays"]], [float(x) for x in d["scales"]],
                        int(d["fourier"]), float(d["ridge"]), float(d.get("growth", 0.0)))


class MarketingMixModel(Forecaster):
    name = "mmm_ridge"
    label = "Модель маркетингового микса (MMM)"
    scenario_aware = True
    min_obs = MIN_TRAIN

    def __init__(self, hyper: MMMHyper | None = None) -> None:
        self.hyper = hyper
        self._coef: np.ndarray | None = None
        self._origin = None
        self._y_scale = 1.0
        self._n_base = 0

    # ------------------------------------------------------------------ признаки
    def _growth_factor(self, frame: Frame, growth: float) -> np.ndarray:
        return 1.0 + growth * trend_feature(frame.dates, self._origin)

    def _base_matrix(self, frame: Frame, fourier: int) -> np.ndarray:
        return np.hstack([np.ones((frame.n, 1)), fourier_features(frame.dates, fourier),
                          holiday_features(frame.dates)])

    @staticmethod
    def _accumulated(frame: Frame, decays: list[float]) -> np.ndarray:
        return np.column_stack([adstock(frame.spend[:, c], decays[c]) for c in range(len(decays))])

    def _design(self, frame: Frame, hyper: MMMHyper) -> np.ndarray:
        acc = self._accumulated(frame, hyper.decays)
        sat = np.column_stack([saturation(acc[:, c], hyper.scales[c]) for c in range(acc.shape[1])])
        return np.hstack([self._base_matrix(frame, hyper.fourier), sat])

    # ------------------------------------------------------------------ обучение
    @staticmethod
    def _solve(design: np.ndarray, target: np.ndarray, n_base: int, ridge: float) -> np.ndarray:
        p = design.shape[1]
        penalty = np.sqrt(ridge) * np.eye(p)
        penalty[0, 0] = 0.0  # свободный член не штрафуется
        lower = np.concatenate([np.full(n_base, -np.inf), np.zeros(p - n_base)])
        res = lsq_linear(np.vstack([design, penalty]), np.concatenate([target, np.zeros(p)]),
                         bounds=(lower, np.full(p, np.inf)), method="bvls")
        return res.x

    def _blocked_score(self, window: Frame, hyper: MMMHyper) -> float:
        """WAPE блочной кросс-валидации: каждый блок прогнозируется моделью, не видевшей его (и его окрестность)."""
        n = window.n
        blocks = max(3, min(8, n // CV_BLOCK))
        design = self._design(window, hyper)
        gf = self._growth_factor(window, hyper.growth)
        y_scale = float(window.y.mean())
        target = window.y / gf / y_scale
        n_base = 1 + 2 * hyper.fourier + 3
        idx = np.arange(n)
        total_err = total_abs = 0.0
        for chunk in np.array_split(idx, blocks):
            lo, hi = chunk[0], chunk[-1]
            keep = (idx < lo - CV_BUFFER) | (idx > hi + CV_BUFFER)
            if keep.sum() < MIN_TRAIN // 2:
                continue
            coef = self._solve(design[keep], target[keep], n_base, hyper.ridge)
            pred = np.maximum(design[chunk] @ coef, 0.0) * gf[chunk] * y_scale
            total_err += float(np.abs(window.y[chunk] - pred).sum())
            total_abs += float(np.abs(window.y[chunk]).sum())
        return total_err / total_abs if total_abs > 0 else float("inf")

    def search(self, frame: Frame, n_train: int) -> MMMHyper:
        """Покоординатный подбор гиперпараметров по блочной кросс-валидации."""
        self._origin = frame.dates[0]
        window = Frame(frame.dates[:n_train], frame.y[:n_train], frame.spend[:n_train], frame.channels)
        n_ch = len(frame.channels)
        ref = []
        for c in range(n_ch):
            pos = window.spend[:, c][window.spend[:, c] > 0]
            ref.append(float(pos.mean()) if pos.size else 1.0)
        active = [c for c in range(n_ch) if (window.spend[:, c] > 0).sum() >= 4]

        hyper = MMMHyper([0.4] * n_ch, list(ref), 3, 1.0, 0.04)
        best = self._blocked_score(window, hyper)
        for _ in range(2):
            improved = False
            for c in active:
                for decay in DECAY_GRID:
                    for kappa in KAPPA_GRID:
                        cand = hyper.copy()
                        cand.decays[c] = decay
                        cand.scales[c] = kappa * ref[c]
                        score = self._blocked_score(window, cand)
                        if score < best - 1e-9:
                            best, hyper, improved = score, cand, True
            if not improved:
                break
        for growth in GROWTH_GRID:
            for fourier in FOURIER_GRID:
                for ridge in RIDGE_GRID:
                    cand = hyper.copy()
                    cand.growth, cand.fourier, cand.ridge = growth, fourier, ridge
                    score = self._blocked_score(window, cand)
                    if score < best - 1e-9:
                        best, hyper = score, cand
        return hyper

    def fit(self, frame: Frame, n_train: int) -> "MarketingMixModel":
        if n_train < MIN_TRAIN:
            raise ValueError(f"для модели маркетингового микса нужно не менее {MIN_TRAIN} недель данных")
        self._origin = frame.dates[0]
        if self.hyper is None:  # заранее заданные гиперпараметры (реестр) подбор не запускают
            self.hyper = self.search(frame, n_train)
        window = Frame(frame.dates[:n_train], frame.y[:n_train], frame.spend[:n_train], frame.channels)
        self._y_scale = float(window.y.mean())
        gf = self._growth_factor(window, self.hyper.growth)
        self._n_base = 1 + 2 * self.hyper.fourier + 3
        self._coef = self._solve(self._design(window, self.hyper), window.y / gf / self._y_scale,
                                 self._n_base, self.hyper.ridge)
        return self

    # ------------------------------------------------------------------ прогноз
    def predict(self, frame: Frame, start: int, stop: int) -> np.ndarray:
        assert self._coef is not None and self.hyper is not None, "модель не обучена"
        design = self._design(frame, self.hyper)[start:stop]
        gf = self._growth_factor(frame, self.hyper.growth)[start:stop]
        return np.maximum(design @ self._coef, 0.0) * gf * self._y_scale

    def components(self, frame: Frame, start: int, stop: int) -> tuple[np.ndarray, np.ndarray]:
        """Разложение прогноза: базовый уровень (без маркетинга) и вклад каждого канала.

        Для аддитивной модели разложение точное: ŷ = base + Σ contribution_c.
        """
        assert self._coef is not None and self.hyper is not None, "модель не обучена"
        design = self._design(frame, self.hyper)[start:stop]
        gf = (self._growth_factor(frame, self.hyper.growth)[start:stop] * self._y_scale)[:, None]
        nb = self._n_base
        base = (design[:, :nb] @ self._coef[:nb])[:, None] * gf
        contrib = design[:, nb:] * self._coef[nb:] * gf
        return base.ravel(), contrib

    # ------------------------------------------------------------------ интерпретация
    def channel_parameters(self, reference_scale: float | None = None) -> dict:
        """Параметры каналов. ``max_effect`` — недельный потолок эффекта при масштабе ``reference_scale``."""
        assert self._coef is not None and self.hyper is not None
        scale = self._y_scale if reference_scale is None else reference_scale
        return {"max_effect": (self._coef[self._n_base:] * scale).tolist(),
                "decays": list(self.hyper.decays), "scales": list(self.hyper.scales)}

    def hyperparameters(self) -> dict:
        assert self.hyper is not None
        return self.hyper.as_dict()

    def accumulated(self, frame: Frame) -> np.ndarray:
        """Накопленный (adstock) уровень затрат по каналам для каждой недели кадра."""
        assert self.hyper is not None
        return self._accumulated(frame, self.hyper.decays)

    def effect_weights(self, frame: Frame, start: int, stop: int) -> np.ndarray:
        """Множитель масштаба (1+g·τ)·y_scale для недель [start, stop) — для оптимизатора."""
        assert self.hyper is not None
        return self._growth_factor(frame, self.hyper.growth)[start:stop] * self._y_scale

    def betas(self) -> np.ndarray:
        assert self._coef is not None
        return self._coef[self._n_base:].copy()
