"""Прикладной слой: связывает обучение, реестр и схемы API."""
from __future__ import annotations

import math
import uuid
from datetime import datetime, timezone

import numpy as np

from . import __version__
from .forecasting import RequestError, forecast as run_forecast
from .models.base import Frame, Metrics
from .optimizer import ChannelConstraint, optimize as run_optimize
from .registry import ModelRegistry
from .schemas import (AllocationOut, BacktestPoint, CandidateOut, ChannelEffectOut, ForecastPointOut,
                      ForecastRequest, ForecastResponse, ForecastTotals, MetricsOut, ModelMeta,
                      OptimizeRequest, OptimizeResponse, TrainRequest, TrainResponse)
from .serving import ModelStore, ServingModel, build_serving
from .training import TrainingOutcome, train
from .validation import interval_quantiles


def _num(x: float | None) -> float | None:
    """JSON не допускает NaN/Infinity — заменяем на null."""
    if x is None:
        return None
    x = float(x)
    return x if math.isfinite(x) else None


def _metrics_out(m: Metrics | None) -> MetricsOut | None:
    if m is None:
        return None
    return MetricsOut(wape=_num(m.wape), mape=_num(m.mape), smape=_num(m.smape),
                      rmse=_num(m.rmse), bias=_num(m.bias), n=m.n)


def _new_model_id(target: str) -> str:
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S")
    return f"{target}-{stamp}-{uuid.uuid4().hex[:8]}"


def _frame_from_request(req: TrainRequest) -> Frame:
    codes = [c.code for c in req.channels]
    spend = np.array([[row.spend.get(code, 0.0) for code in codes] for row in req.spend], dtype=float)
    return Frame([p.week_start for p in req.sales], np.array([p.value for p in req.sales]), spend, codes)


def train_model(req: TrainRequest, registry: ModelRegistry, store: ModelStore) -> TrainResponse:
    frame = _frame_from_request(req)
    n = frame.n
    opts = req.options
    try:
        outcome: TrainingOutcome = train(frame, n, cv_folds=opts.cv_folds, cv_horizon=opts.cv_horizon,
                                         interval_level=opts.interval_level, seed=opts.seed,
                                         only=opts.candidates)
    except ValueError as exc:
        raise RequestError(str(exc)) from exc

    champion = next(o for o in outcome.candidates if o.selected)
    assert champion.cv is not None and champion.metrics is not None
    model_id = _new_model_id(req.target)
    created = datetime.now(timezone.utc)

    q_lo, q_hi = interval_quantiles(outcome.relative_errors, opts.interval_level)
    cv = champion.cv
    predicted = cv.predicted
    backtest = [BacktestPoint(week_start=frame.dates[int(i)], actual=float(a), predicted=float(p),
                              lower=float(max(p * (1 + q_lo), 0.0)), upper=float(p * (1 + q_hi)))
                for i, a, p in zip(cv.indices, cv.actual, predicted)]

    names = {c.code: c.name for c in req.channels}
    effects = [ChannelEffectOut(**{**e.__dict__,
                                   "roi": _num(e.roi), "marginal_roi": _num(e.marginal_roi)})
               for e in outcome.effects]
    leaderboard = [CandidateOut(name=o.name, label=o.label, scenario_aware=o.scenario_aware,
                                selected=o.selected, metrics=_metrics_out(o.metrics),
                                fold_wape=[float(x) for x in o.fold_wape],
                                skill_vs_naive=_num(o.skill_vs_naive), skipped_reason=o.skipped_reason)
                   for o in outcome.candidates]
    response = TrainResponse(
        model_id=model_id, target=req.target, created_at=created, champion=champion.name,
        champion_label=champion.label, data_from=frame.dates[0], data_to=frame.dates[n - 1], n_obs=n,
        fingerprint=req.fingerprint, interval_level=opts.interval_level,
        cv_folds=len(set(int(i) // cv.horizon for i in cv.indices)) if False else len(cv.fold_wape),
        cv_horizon=cv.horizon, metrics=_metrics_out(champion.metrics),  # type: ignore[arg-type]
        leaderboard=leaderboard, channel_effects=effects, backtest=backtest, warnings=outcome.warnings)

    payload = {
        "schema": 1, "model_id": model_id, "target": req.target, "created_at": created.isoformat(),
        "channels": [c.code for c in req.channels], "channel_names": names,
        "data": {"dates": [d.isoformat() for d in frame.dates],
                 "y": [float(v) for v in frame.y],
                 "spend": [[float(v) for v in row] for row in frame.spend]},
        "fingerprint": req.fingerprint, "seed": opts.seed,
        "champion": champion.name, "hyperparameters": outcome.hyperparameters,
        "relative_errors": [float(x) for x in outcome.relative_errors],
        "cv_horizon": cv.horizon, "interval_level": opts.interval_level,
        "result": response.model_dump(mode="json"),
    }
    meta = ModelMeta(model_id=model_id, target=req.target, created_at=created, champion=champion.name,
                     data_from=frame.dates[0], data_to=frame.dates[n - 1], n_obs=n,
                     wape=_num(champion.metrics.wape), mape=_num(champion.metrics.mape),
                     fingerprint=req.fingerprint)
    registry.save(model_id, payload, meta.model_dump(mode="json"))
    store.put(build_serving(payload))
    return response


def _rows(model: ServingModel, spend_rows) -> list:
    unknown = {code for row in spend_rows for code in row.spend} - set(model.channels)
    if unknown:
        raise RequestError(f"затраты содержат каналы, неизвестные модели: {sorted(unknown)}")
    return [(row.week_start, np.array([row.spend.get(code, 0.0) for code in model.channels], dtype=float))
            for row in spend_rows]


def forecast_model(model: ServingModel, req: ForecastRequest) -> ForecastResponse:
    result = run_forecast(model, _rows(model, req.spend), req.start_week, req.horizon_weeks,
                          req.interval_level, req.include_components)
    points = [ForecastPointOut(week_start=p.week_start, predicted=p.predicted, lower=p.lower, upper=p.upper,
                               base=p.base, contributions=p.contributions) for p in result.points]
    totals = ForecastTotals(
        predicted=sum(p.predicted for p in points), lower=sum(p.lower for p in points),
        upper=sum(p.upper for p in points),
        base=sum(p.base for p in points) if result.components_available else None,
        contributions={code: sum(p.contributions[code] for p in points)  # type: ignore[index]
                       for code in model.channels} if result.components_available else None)
    return ForecastResponse(model_id=model.model_id, champion=model.champion_name,
                            interval_level=result.interval_level,
                            components_available=result.components_available, points=points, totals=totals)


def optimize_model(model: ServingModel, req: OptimizeRequest) -> OptimizeResponse:
    constraints = [ChannelConstraint(c.code, c.min_share, c.max_share) for c in req.constraints]
    unknown = {c.code for c in constraints} - set(model.channels)
    if unknown:
        raise RequestError(f"ограничения заданы для неизвестных каналов: {sorted(unknown)}")
    r = run_optimize(model, _rows(model, req.spend), req.start_week, req.horizon_weeks,
                     req.total_budget, constraints)
    return OptimizeResponse(
        model_id=model.model_id, total_budget=r.total_budget, spent_budget=r.spent_budget,
        plan_budget=r.plan_budget, plan_marketing_effect=r.plan_marketing_effect,
        optimized_marketing_effect=r.optimized_marketing_effect, uplift_abs=r.uplift_abs,
        uplift_pct=_num(r.uplift_pct), notes=r.notes,
        allocations=[AllocationOut(**a.__dict__) for a in r.allocations])


def service_version() -> str:
    return __version__
