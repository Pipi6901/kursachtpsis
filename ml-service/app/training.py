"""Обучение: сравнение моделей-кандидатов, выбор «чемпиона», интерпретация каналов."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable

import numpy as np

from .models.base import Forecaster, Frame, Metrics
from .models.gbm import GradientBoosting
from .models.holt_winters import HoltWinters
from .models.mmm import MMMHyper, MarketingMixModel
from .models.seasonal_naive import SeasonalNaive
from .transforms import saturation_slope
from .validation import CVResult, fold_cuts, interval_quantiles, rolling_origin_cv

MMM_NAME = MarketingMixModel.name
NAIVE_NAME = SeasonalNaive.name
# GBM заменяет MMM в роли чемпиона только при заметном выигрыше по точности
GBM_REQUIRED_GAIN = 0.05
LOW_VARIATION_CV = 0.2
MIN_ACTIVE_WEEKS = 8


def candidate_factories(seed: int) -> dict[str, Callable[[], Forecaster]]:
    return {
        SeasonalNaive.name: SeasonalNaive,
        HoltWinters.name: HoltWinters,
        MarketingMixModel.name: MarketingMixModel,
        GradientBoosting.name: lambda: GradientBoosting(seed=seed),
    }


@dataclass
class CandidateOutcome:
    name: str
    label: str
    scenario_aware: bool
    metrics: Metrics | None = None
    fold_wape: list[float] = field(default_factory=list)
    skill_vs_naive: float | None = None
    skipped_reason: str | None = None
    cv: CVResult | None = None
    selected: bool = False


@dataclass
class ChannelEffect:
    code: str
    adstock_decay: float
    saturation_scale: float          # k_c: затраты в неделю, при которых достигается 63 % потолка
    max_effect: float                # потолок недельного эффекта (в единицах целевого показателя)
    total_spend: float
    mean_weekly_spend: float
    active_weeks: int
    spend_cv: float                  # коэффициент вариации недельных затрат
    contribution_total: float
    contribution_share: float
    roi: float | None                # единиц целевого показателя на 1 затраченную денежную единицу
    marginal_roi: float | None       # прирост на 1 доп. единицу постоянных недельных затрат
    saturation_level: float          # какая доля потолка достигнута при недавнем уровне затрат
    low_variation: bool              # вариации затрат мало: вклад канала оценивается ненадёжно


@dataclass
class TrainingOutcome:
    champion: str
    candidates: list[CandidateOutcome]
    champion_model: Forecaster
    mmm_model: MarketingMixModel | None
    hyperparameters: dict[str, dict]
    relative_errors: np.ndarray          # относительные ошибки CV чемпиона (для интервалов)
    effects: list[ChannelEffect]
    cv_horizon: int
    warnings: list[str]


def _select_champion(outcomes: list[CandidateOutcome], warnings: list[str]) -> CandidateOutcome:
    valid = [o for o in outcomes if o.metrics is not None]
    if not valid:
        raise ValueError("ни одна модель не смогла обучиться на переданных данных")
    aware = [o for o in valid if o.scenario_aware]
    if not aware:
        warnings.append("Модели, учитывающие маркетинг, недоступны: прогноз не реагирует на сценарии затрат.")
        return min(valid, key=lambda o: o.metrics.wape)  # type: ignore[union-attr]
    best = min(aware, key=lambda o: o.metrics.wape)  # type: ignore[union-attr]
    mmm = next((o for o in aware if o.name == MMM_NAME), None)
    if mmm is not None and best is not mmm and best.metrics.wape > mmm.metrics.wape * (1 - GBM_REQUIRED_GAIN):  # type: ignore[union-attr]
        return mmm  # при близкой точности предпочитаем интерпретируемую модель
    return best


def channel_effects(mmm: MarketingMixModel, frame: Frame, n: int) -> list[ChannelEffect]:
    """Оценка вклада, окупаемости и насыщения каналов по обучающему окну."""
    window = Frame(frame.dates[:n], frame.y[:n], frame.spend[:n], frame.channels)
    base, contrib = mmm.components(window, 0, n)
    total_target = float(window.y.sum())
    acc = mmm.accumulated(window)
    weights = mmm.effect_weights(window, 0, n)
    betas = mmm.betas()
    hyper = mmm.hyper
    assert hyper is not None
    recent = slice(max(0, n - 13), n)
    out: list[ChannelEffect] = []
    for c, code in enumerate(frame.channels):
        spend = window.spend[:, c]
        total_spend = float(spend.sum())
        mean_weekly = float(spend.mean())
        active = int((spend > 0).sum())
        cv = float(spend.std() / mean_weekly) if mean_weekly > 0 else 0.0
        c_total = float(contrib[:, c].sum())
        a_recent = float(acc[recent, c].mean())
        scale = hyper.scales[c]
        w_recent = float(weights[recent].mean())
        marginal = float(betas[c] * saturation_slope(np.array(a_recent), scale) * w_recent) if betas[c] > 0 else 0.0
        out.append(ChannelEffect(
            code=code, adstock_decay=hyper.decays[c], saturation_scale=scale,
            max_effect=float(betas[c] * w_recent), total_spend=total_spend,
            mean_weekly_spend=mean_weekly, active_weeks=active, spend_cv=cv,
            contribution_total=c_total,
            contribution_share=c_total / total_target if total_target > 0 else 0.0,
            roi=c_total / total_spend if total_spend > 0 else None,
            marginal_roi=marginal if total_spend > 0 else None,
            saturation_level=float(1.0 - np.exp(-a_recent / scale)),
            low_variation=bool(active < MIN_ACTIVE_WEEKS or cv < LOW_VARIATION_CV),
        ))
    return out


def train(frame: Frame, n: int, *, cv_folds: int = 4, cv_horizon: int = 12, interval_level: float = 0.8,
          seed: int = 42, only: list[str] | None = None) -> TrainingOutcome:
    """Полный цикл обучения на первых ``n`` неделях кадра."""
    factories = candidate_factories(seed)
    if only:
        factories = {k: v for k, v in factories.items() if k in only or k == NAIVE_NAME}
    warnings: list[str] = []
    cuts = fold_cuts(n, cv_folds, cv_horizon, MarketingMixModel.min_obs)
    if not cuts:
        raise ValueError(f"для обучения нужно не менее {MarketingMixModel.min_obs + cv_horizon} недель данных")

    outcomes: list[CandidateOutcome] = []
    for name, factory in factories.items():
        proto = factory()
        outcome = CandidateOutcome(name, proto.label, proto.scenario_aware)
        if proto.min_obs > cuts[0]:
            outcome.skipped_reason = (f"недостаточно истории: нужно не менее {proto.min_obs} недель "
                                      f"в обучающей части, доступно {cuts[0]}")
        else:
            try:
                cv = rolling_origin_cv(factory, frame, n, cv_folds, cv_horizon, proto.min_obs)
                outcome.cv, outcome.metrics, outcome.fold_wape = cv, cv.metrics, cv.fold_wape
            except Exception as exc:  # одна неудавшаяся модель не должна ронять обучение
                outcome.skipped_reason = f"ошибка обучения: {exc}"
        outcomes.append(outcome)

    naive = next((o for o in outcomes if o.name == NAIVE_NAME and o.metrics), None)
    if naive is not None:
        for o in outcomes:
            if o.metrics is not None and naive.metrics is not None and naive.metrics.wape > 0:
                o.skill_vs_naive = 1.0 - o.metrics.wape / naive.metrics.wape
    for o in outcomes:
        if o.skipped_reason and o.name != NAIVE_NAME:
            warnings.append(f"Модель «{o.label}» пропущена: {o.skipped_reason}.")

    champion = _select_champion(outcomes, warnings)
    champion.selected = True

    champion_model = factories[champion.name]().fit(frame, n)
    mmm_model: MarketingMixModel | None = None
    if isinstance(champion_model, MarketingMixModel):
        mmm_model = champion_model
    elif MMM_NAME in factories:
        try:
            mmm_model = MarketingMixModel().fit(frame, n)
        except Exception as exc:
            warnings.append(f"Модель маркетингового микса недоступна для анализа каналов: {exc}.")

    hyper: dict[str, dict] = {}
    hyper[champion.name] = champion_model.hyperparameters()
    if mmm_model is not None:
        hyper[MMM_NAME] = mmm_model.hyperparameters()

    effects: list[ChannelEffect] = []
    if mmm_model is not None:
        effects = channel_effects(mmm_model, frame, n)
        for e in effects:
            if e.low_variation:
                warnings.append(f"Канал «{e.code}»: затраты почти не меняются или редки — "
                                f"оценка вклада ненадёжна.")

    assert champion.cv is not None
    return TrainingOutcome(champion.name, outcomes, champion_model, mmm_model, hyper,
                           champion.cv.relative_errors, effects, cv_horizon, warnings)


def interval_for(outcome_errors: np.ndarray, level: float) -> tuple[float, float]:
    return interval_quantiles(outcome_errors, level)


__all__ = ["train", "TrainingOutcome", "CandidateOutcome", "ChannelEffect", "channel_effects",
           "MMMHyper", "interval_for"]
