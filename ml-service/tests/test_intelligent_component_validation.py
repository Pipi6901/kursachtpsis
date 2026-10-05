"""Валидация интеллектуального компонента на данных с известной «истиной».

Данные порождены процессом с заданными параметрами каналов (насыщение по Хиллу, перенос эффекта,
сезонность, праздники, шум 5,5 %). Проверяется не только точность прогноза, но и то,
что модель восстанавливает вклад каналов и честно оценивает неопределённость.
"""
import numpy as np
import pytest

from app.models.base import Frame, compute_metrics
from app.optimizer import ChannelConstraint, optimize
from app.forecasting import RequestError, forecast
from app.training import train
from tools.synthetic import true_marketing_effect

from .conftest import serving_from_outcome

HOLDOUT = 26


@pytest.fixture(scope="module")
def holdout_run(data):
    """Обучение без последних 26 недель; эти недели — честная проверка вне выборки."""
    n = data.n_hist
    frame = Frame(data.weeks[:n], data.revenue, data.spend[:n], data.channel_codes)
    outcome = train(frame, n - HOLDOUT)
    return frame, n - HOLDOUT, outcome


def test_marketing_aware_model_beats_naive_baseline(holdout_run):
    _, _, outcome = holdout_run
    metrics = {c.name: c.metrics for c in outcome.candidates if c.metrics}
    best_aware = min(m.wape for name, m in metrics.items() if name in ("mmm_ridge", "gbm"))
    assert best_aware < 0.8 * metrics["seasonal_naive"].wape      # не менее чем на 20 % точнее наивной
    assert best_aware < metrics["holt_winters"].wape              # маркетинг добавляет информацию
    assert outcome.champion in ("mmm_ridge", "gbm")


def test_out_of_sample_accuracy_and_interval_coverage(holdout_run, data):
    frame, n_train, outcome = holdout_run
    pred = outcome.champion_model.predict(frame, n_train, n_train + HOLDOUT)
    actual = frame.y[n_train:n_train + HOLDOUT]
    assert compute_metrics(actual, pred).wape < 0.09
    # интервал 80 %: фактическое покрытие на 26 «будущих» неделях должно быть близко к номиналу
    from app.validation import apply_interval, interval_quantiles
    q_lo, q_hi = interval_quantiles(outcome.relative_errors, 0.8)
    steps = np.arange(1, HOLDOUT + 1)
    lo, hi = apply_interval(pred, q_lo, q_hi, steps, outcome.cv_horizon)
    coverage = float(((actual >= lo) & (actual <= hi)).mean())
    assert 0.6 <= coverage <= 0.97, coverage


def test_channel_contributions_are_recovered(data):
    n = data.n_hist
    frame = Frame(data.weeks[:n], data.bookings, data.spend[:n], data.channel_codes)
    outcome = train(frame, n, only=["mmm_ridge"])
    est = np.array([e.contribution_total for e in outcome.effects])
    truth = data.truth_contrib.sum(axis=0)
    est_share, true_share = est / est.sum(), truth / truth.sum()
    assert np.abs(est_share - true_share).max() < 0.08            # доли вклада каналов
    assert abs(est.sum() - truth.sum()) / truth.sum() < 0.12      # общий вклад маркетинга
    # три самых результативных канала определены верно и в верном порядке (малые каналы с вкладом
    # 1–2 % неразличимы на фоне шума, поэтому их взаимный порядок не проверяется)
    assert list(np.argsort(-est)[:3]) == list(np.argsort(-truth)[:3])


def test_optimizer_improves_true_marketing_effect(data):
    """Рекомендация оптимизатора проверяется по ИСТИННОЙ функции отклика, которой модель не видела."""
    n = data.n_hist
    n_train, horizon = n - HOLDOUT, 12
    frame = Frame(data.weeks[:n], data.bookings, data.spend[:n], data.channel_codes)
    outcome = train(frame, n_train, only=["mmm_ridge"])
    model = serving_from_outcome(frame, n_train, outcome, target="bookings")
    plan = data.spend[n_train:n_train + horizon]
    rows = [(data.weeks[n_train + i], plan[i]) for i in range(horizon)]
    budget = float(plan.sum())
    result = optimize(model, rows, data.weeks[n_train], horizon, budget)

    assert result.spent_budget == pytest.approx(budget, rel=1e-6)
    u = np.array([a.weekly_spend for a in result.allocations])

    def true_effect(weekly: np.ndarray) -> float:
        spend = data.spend[:n_train + horizon].copy()
        spend[n_train:] = weekly
        return true_marketing_effect(data, spend, n_train, n_train + horizon)

    plan_effect = true_marketing_effect(data, data.spend[:n_train + horizon], n_train, n_train + horizon)
    equal_split = np.full(len(u), budget / horizon / len(u))
    assert true_effect(u) > plan_effect * 1.02                   # лучше плана более чем на 2 % по истинной функции
    assert true_effect(u) > true_effect(equal_split)             # и лучше равномерного распределения


def test_forecast_rejects_gap_in_spend_rows(data):
    n = data.n_hist
    frame = Frame(data.weeks[:n], data.revenue, data.spend[:n], data.channel_codes)
    outcome = train(frame, n - 40, only=["mmm_ridge"])
    model = serving_from_outcome(frame, n - 40, outcome)
    skip_week = [(data.weeks[n - 39], data.spend[n - 39])]       # пропущена неделя сразу после обучения
    with pytest.raises(RequestError, match="подряд"):
        forecast(model, skip_week, data.weeks[n - 39], 1)
