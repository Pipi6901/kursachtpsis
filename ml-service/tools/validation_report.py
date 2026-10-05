"""Отчёт о валидации интеллектуального компонента на данных с известной «истиной».

Запуск из каталога ml-service:
    python -m tools.validation_report [путь_к_отчёту.md]

Отчёт можно использовать в разделе «Тестирование и валидация интеллектуального компонента».
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

import numpy as np

from app.models.base import Frame, compute_metrics
from app.optimizer import optimize
from app.serving import build_serving
from app.training import train
from app.validation import apply_interval, interval_quantiles
from tools.synthetic import generate, true_marketing_effect

HOLDOUT, HORIZON = 26, 12
LABELS = {"seasonal_naive": "Сезонная наивная (ориентир)", "holt_winters": "Хольта–Уинтерса (без маркетинга)",
          "mmm_ridge": "Маркетинговый микс (MMM)", "gbm": "Градиентный бустинг"}


def pct(x: float | None) -> str:
    return "—" if x is None else f"{x * 100:.2f}".replace(".", ",") + " %"


def serving(frame: Frame, n_train: int, outcome, target: str):
    return build_serving({
        "model_id": f"{target}-20260101T000000-0123abcd", "target": target, "channels": frame.channels,
        "data": {"dates": [d.isoformat() for d in frame.dates[:n_train]],
                 "y": [float(v) for v in frame.y[:n_train]],
                 "spend": [[float(v) for v in r] for r in frame.spend[:n_train]]},
        "champion": outcome.champion, "hyperparameters": outcome.hyperparameters,
        "relative_errors": [float(x) for x in outcome.relative_errors], "cv_horizon": outcome.cv_horizon,
        "interval_level": 0.8, "seed": 42})


def main() -> None:
    d = generate()
    n = d.n_hist
    lines = ["# Отчёт о валидации интеллектуального компонента", "",
             f"Синтетические данные: {n} недель истории ({d.weeks[0]} — {d.weeks[n - 1]}), "
             f"{len(d.channels)} каналов, шум 5,5 %, seed {d.meta['seed']}.", ""]

    # 1. скользящая кросс-валидация на всей истории
    frame = Frame(d.weeks[:n], d.revenue, d.spend[:n], d.channel_codes)
    full = train(frame, n)
    lines += ["## 1. Скользящая кросс-валидация (4 окна по 12 недель), целевой показатель — выручка", "",
              "| Алгоритм | Учитывает маркетинг | WAPE | MAPE | RMSE | Выигрыш к наивной |", "|---|---|---|---|---|---|"]
    for c in full.candidates:
        m = c.metrics
        mark = " **(выбран)**" if c.selected else ""
        lines.append(f"| {LABELS.get(c.name, c.name)}{mark} | {'да' if c.scenario_aware else 'нет'} | "
                     f"{pct(m.wape) if m else '—'} | {pct(m.mape) if m else '—'} | "
                     f"{f'{m.rmse:,.0f}'.replace(',', ' ') if m else '—'} | {pct(c.skill_vs_naive)} |")
    lines.append("")

    # 2. честная проверка вне выборки
    n_train = n - HOLDOUT
    outcome = train(frame, n_train)
    pred = outcome.champion_model.predict(frame, n_train, n)
    actual = frame.y[n_train:]
    q_lo, q_hi = interval_quantiles(outcome.relative_errors, 0.8)
    lo, hi = apply_interval(pred, q_lo, q_hi, np.arange(1, HOLDOUT + 1), outcome.cv_horizon)
    coverage = float(((actual >= lo) & (actual <= hi)).mean())
    m = compute_metrics(actual, pred)
    lines += [f"## 2. Проверка вне выборки: обучение на {n_train} неделях, прогноз на {HOLDOUT} недель", "",
              f"* чемпион: {LABELS.get(outcome.champion, outcome.champion)}",
              f"* WAPE = {pct(m.wape)}, MAPE = {pct(m.mape)}, смещение = {pct(m.bias)}",
              f"* фактическое покрытие 80 %-го интервала: {pct(coverage)}", ""]

    # 3. восстановление вклада каналов
    bookings = Frame(d.weeks[:n], d.bookings, d.spend[:n], d.channel_codes)
    effects = train(bookings, n, only=["mmm_ridge"]).effects
    est = np.array([e.contribution_total for e in effects])
    truth = d.truth_contrib.sum(axis=0)
    lines += ["## 3. Восстановление вклада каналов (целевой показатель — бронирования)", "",
              "| Канал | Истинная доля | Оценка модели | Отклонение, п.п. | ROI (брон. на $1000) |", "|---|---|---|---|---|"]
    for c, e, es, ts in zip(d.channels, effects, est / est.sum(), truth / truth.sum()):
        lines.append(f"| {c.name} | {pct(ts)} | {pct(es)} | {(es - ts) * 100:+.1f} | "
                     f"{(e.roi or 0) * 1000:.1f} |")
    lines += ["", f"Общий вклад маркетинга: оценка {est.sum():.0f}, истина {truth.sum():.0f} "
                  f"(отклонение {abs(est.sum() - truth.sum()) / truth.sum() * 100:.1f} %).".replace(".", ","), ""]

    # 4. оптимизатор против истинной функции отклика
    b_out = train(bookings, n_train, only=["mmm_ridge"])
    model = serving(bookings, n_train, b_out, "bookings")
    plan = d.spend[n_train:n_train + HORIZON]
    rows = [(d.weeks[n_train + i], plan[i]) for i in range(HORIZON)]
    budget = float(plan.sum())
    res = optimize(model, rows, d.weeks[n_train], HORIZON, budget)
    u = np.array([a.weekly_spend for a in res.allocations])

    def true_effect(weekly: np.ndarray) -> float:
        spend = d.spend[:n_train + HORIZON].copy()
        spend[n_train:] = weekly
        return true_marketing_effect(d, spend, n_train, n_train + HORIZON)

    plan_eff = true_marketing_effect(d, d.spend[:n_train + HORIZON], n_train, n_train + HORIZON)
    equal_eff = true_effect(np.full(len(u), budget / HORIZON / len(u)))
    opt_eff = true_effect(u)
    budget_text = f"{budget:,.0f}".replace(",", " ")
    lines += [f"## 4. Оптимизация бюджета ({HORIZON} недель, бюджет {budget_text} $)", "",
              "Эффект оценён по истинной функции отклика, которой модель не видела:", "",
              "| Распределение | Эффект, бронирований | К плану |", "|---|---|---|",
              f"| План менеджера | {plan_eff:.0f} | — |",
              f"| Равномерное по каналам | {equal_eff:.0f} | {(equal_eff / plan_eff - 1) * 100:+.1f} % |",
              f"| Рекомендация оптимизатора | {opt_eff:.0f} | {(opt_eff / plan_eff - 1) * 100:+.1f} % |".replace(".", ","), ""]

    text = re.sub(r"(?<=\d)\.(?=\d)", ",", "\n".join(lines))  # десятичная запятая
    target = Path(sys.argv[1]) if len(sys.argv) > 1 else None
    if target:
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(text + "\n", encoding="utf-8")
    print(text)


if __name__ == "__main__":
    main()
