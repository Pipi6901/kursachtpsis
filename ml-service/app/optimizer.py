"""Оптимизация распределения маркетингового бюджета по каналам.

Максимизируется суммарный маркетинговый эффект за горизонт при фиксированном бюджете.
Решение — постоянные недельные затраты по каналам. Для геометрического adstock накопленный
уровень имеет замкнутую форму a_t = u + λ^t·(a_0 − u), где a_0 — состояние на начало горизонта,
поэтому целевая функция — сумма вогнутых по u_c слагаемых, то есть задача распределения ресурса
с разделимой вогнутой целью. Она решается точно: на оптимуме предельная отдача всех каналов,
не упёршихся в границы, одинакова (множитель Лагранжа μ). Метод — вложенная бисекция по μ и по u_c;
найденный максимум глобальный (без зависимости от начального приближения).
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Callable

import numpy as np

from .forecasting import RequestError, extend_frame, locate
from .serving import ServingModel

HISTORY_CAP_FACTOR = 1.5   # верхняя граница затрат канала: 1,5 максимума наблюдавшихся недельных затрат


@dataclass
class ChannelConstraint:
    code: str
    min_share: float = 0.0
    max_share: float = 1.0


@dataclass
class ChannelAllocation:
    code: str
    weekly_spend: float
    total_spend: float
    share: float
    expected_effect: float
    marginal_return: float
    plan_total_spend: float
    plan_effect: float


@dataclass
class OptimizeResult:
    allocations: list[ChannelAllocation]
    total_budget: float
    spent_budget: float
    plan_budget: float
    plan_marketing_effect: float
    optimized_marketing_effect: float
    uplift_abs: float
    uplift_pct: float | None
    notes: list[str]


def allocate(gradient: Callable[[np.ndarray], np.ndarray], lower: np.ndarray, upper: np.ndarray,
             budget: float) -> np.ndarray:
    """Распределение бюджета по равенству предельных отдач (метод множителей Лагранжа).

    ``gradient(u)`` возвращает вектор производных эффекта по недельным затратам каналов;
    каждая компонента зависит только от «своего» канала и убывает по нему (вогнутость).
    """
    def spend_at(mu: float) -> np.ndarray:
        a, b = lower.copy(), upper.copy()
        for _ in range(80):  # по каждому каналу ищем u: g(u) = mu внутри [lower, upper]
            mid = (a + b) / 2.0
            above = gradient(mid) > mu
            a = np.where(above, mid, a)
            b = np.where(above, b, mid)
        u = (a + b) / 2.0
        u = np.where(gradient(lower) <= mu, lower, u)   # даже минимум не окупается при цене mu
        u = np.where(gradient(upper) >= mu, upper, u)   # даже максимум окупается выше цены mu
        return u

    if budget >= float(upper.sum()) - 1e-9:
        return upper.copy()
    if budget <= float(lower.sum()) + 1e-9:
        return lower.copy()
    mu_lo, mu_hi = 0.0, float(gradient(lower).max()) + 1.0
    u = lower.copy()
    for _ in range(100):
        mu = (mu_lo + mu_hi) / 2.0
        u = spend_at(mu)
        total = float(u.sum())
        if abs(total - budget) <= 1e-9 * max(budget, 1.0):
            break
        if total > budget:
            mu_lo = mu    # затраты велики — повышаем «цену» денег
        else:
            mu_hi = mu
    # небольшая невязка (конечная точность бисекции) снимается пропорциональной подгонкой
    gap = budget - float(u.sum())
    free = (u > lower + 1e-9) & (u < upper - 1e-9)
    if abs(gap) > 1e-9 and free.any():
        u = np.clip(u + gap * (u / u[free].sum()) * free, lower, upper)
    return u


def optimize(model: ServingModel, rows: list[tuple[date, np.ndarray]], start_week: date, horizon: int,
             total_budget: float, constraints: list[ChannelConstraint] | None = None) -> OptimizeResult:
    mmm = model.mmm
    if mmm is None or mmm.hyper is None:
        raise RequestError("для оптимизации нужна модель маркетингового микса, у этой модели её нет")
    if total_budget <= 0:
        raise RequestError("бюджет должен быть положительным")

    frame = extend_frame(model, rows)
    start, stop = locate(frame, start_week, horizon, model.n)
    n_ch = len(model.channels)
    h = horizon
    notes: list[str] = []

    acc = mmm.accumulated(frame)
    a0 = acc[start - 1]                       # накопленный эффект на начало горизонта
    weights = mmm.effect_weights(frame, start, stop)
    beta = mmm.betas()
    k = np.array(mmm.hyper.scales)
    lam = np.array(mmm.hyper.decays)
    lam_t = lam[None, :] ** np.arange(1, h + 1)[:, None]

    def accumulated(u: np.ndarray) -> np.ndarray:
        return u[None, :] + lam_t * (a0[None, :] - u[None, :])

    def per_channel_effect(u: np.ndarray) -> np.ndarray:
        sat = 1.0 - np.exp(-accumulated(u) / k)
        return (weights[:, None] * beta[None, :] * sat).sum(axis=0)

    def gradient(u: np.ndarray) -> np.ndarray:
        slope = np.exp(-accumulated(u) / k) / k
        return (weights[:, None] * beta[None, :] * slope * (1.0 - lam_t)).sum(axis=0)

    # границы затрат: не выходим за наблюдавшийся диапазон (за его пределами кривая отдачи не проверена)
    hist_max = model.frame.spend[: model.n].max(axis=0)
    plan = frame.spend[start:stop]
    weekly_budget = total_budget / h
    lower = np.zeros(n_ch)
    upper = np.maximum(HISTORY_CAP_FACTOR * hist_max, plan.max(axis=0))
    by_code = {c.code: c for c in (constraints or [])}
    for c, code in enumerate(model.channels):
        limits = by_code.get(code)
        if limits is not None:
            lower[c] = max(lower[c], limits.min_share * weekly_budget)
            upper[c] = min(upper[c], limits.max_share * weekly_budget)
    if (lower > upper + 1e-9).any():
        raise RequestError("ограничения по каналам несовместимы с допустимым диапазоном затрат")
    if lower.sum() > weekly_budget + 1e-9:
        raise RequestError("минимальные доли каналов превышают бюджет")
    if float(upper.sum()) < weekly_budget:
        notes.append("Бюджет превышает суммарные допустимые затраты каналов (наблюдавшийся диапазон ×1,5): "
                     "часть бюджета не распределена.")
        weekly_budget = float(upper.sum())

    u = allocate(gradient, lower, upper, weekly_budget)
    effect = per_channel_effect(u)
    marginal = gradient(u) / h               # прирост эффекта на 1 дополнительную единицу бюджета канала

    _, plan_contrib = mmm.components(frame, start, stop)
    plan_effect = float(plan_contrib.sum())
    optimized_effect = float(effect.sum())
    plan_total = plan.sum(axis=0)
    allocations = [ChannelAllocation(
        code=code, weekly_spend=float(u[c]), total_spend=float(u[c] * h),
        share=float(u[c] / u.sum()) if u.sum() > 0 else 0.0,
        expected_effect=float(effect[c]), marginal_return=float(marginal[c]),
        plan_total_spend=float(plan_total[c]), plan_effect=float(plan_contrib[:, c].sum()))
        for c, code in enumerate(model.channels)]
    uplift = optimized_effect - plan_effect
    return OptimizeResult(allocations, total_budget, float(u.sum() * h), float(plan_total.sum()),
                          plan_effect, optimized_effect, uplift,
                          uplift / plan_effect if plan_effect > 0 else None, notes)
