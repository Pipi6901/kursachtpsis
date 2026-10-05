"""Преобразования маркетинговых затрат: перенос эффекта (adstock) и насыщение."""
from __future__ import annotations

import numpy as np
from scipy.signal import lfilter


def adstock(spend: np.ndarray, decay: float, initial: float | None = None) -> np.ndarray:
    """Геометрический перенос эффекта рекламы на последующие недели.

    a_t = (1 - decay) * x_t + decay * a_{t-1}

    Нормировка (1 - decay) сохраняет масштаб: при постоянных затратах x
    накопленный эффект стремится к x, поэтому параметр насыщения не зависит от decay.
    ``initial`` — состояние до первой недели; по умолчанию средний уровень первых недель
    (грубое приближение установившегося режима, чтобы не занижать начало ряда).
    """
    spend = np.asarray(spend, dtype=float)
    if spend.size == 0:
        return spend.copy()
    if not 0.0 <= decay < 1.0:
        raise ValueError("decay должен лежать в диапазоне [0, 1)")
    if initial is None:
        initial = float(np.mean(spend[: min(4, spend.size)]))
    out, _ = lfilter([1.0 - decay], [1.0, -decay], spend, zi=[decay * initial])
    return out


def saturation(accumulated: np.ndarray, scale: float) -> np.ndarray:
    """Закон убывающей отдачи: s = 1 - exp(-a / scale), значение в диапазоне [0, 1)."""
    if scale <= 0:
        raise ValueError("scale должен быть положительным")
    return 1.0 - np.exp(-np.asarray(accumulated, dtype=float) / scale)


def saturation_slope(accumulated: np.ndarray, scale: float) -> np.ndarray:
    """Производная насыщения ds/da = exp(-a / scale) / scale — предельная отдача."""
    return np.exp(-np.asarray(accumulated, dtype=float) / scale) / scale
