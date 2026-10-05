"""Контракт API интеллектуального микросервиса (версия 1).

Все даты — ISO 8601, неделя задаётся датой понедельника. Денежные и количественные
величины — числа с плавающей точкой. Имена полей — snake_case.
"""
from __future__ import annotations

import math
from datetime import date, datetime, timedelta

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

CODE_PATTERN = r"^[a-z0-9_]{1,40}$"


class ChannelIn(BaseModel):
    code: str = Field(pattern=CODE_PATTERN, description="Код канала (латиница, цифры, подчёркивание)")
    name: str = Field("", max_length=100)


class SalesPoint(BaseModel):
    week_start: date
    value: float = Field(ge=0)

    @field_validator("value")
    @classmethod
    def _finite(cls, v: float) -> float:
        if not math.isfinite(v):
            raise ValueError("значение продаж должно быть конечным числом")
        return v


class SpendRow(BaseModel):
    week_start: date
    spend: dict[str, float] = Field(default_factory=dict, description="Затраты за неделю по кодам каналов")

    @field_validator("spend")
    @classmethod
    def _non_negative(cls, v: dict[str, float]) -> dict[str, float]:
        for code, amount in v.items():
            if not math.isfinite(amount) or amount < 0:
                raise ValueError(f"затраты канала «{code}» должны быть конечным неотрицательным числом")
        return v


def _check_weeks(weeks: list[date], what: str) -> None:
    for w in weeks:
        if w.weekday() != 0:
            raise ValueError(f"{what}: {w} — не понедельник")
    for prev, cur in zip(weeks, weeks[1:]):
        if cur - prev != timedelta(weeks=1):
            raise ValueError(f"{what}: недели должны идти подряд без пропусков и повторов ({prev} → {cur})")


class TrainOptions(BaseModel):
    cv_folds: int = Field(4, ge=1, le=8, description="Число окон скользящей кросс-валидации")
    cv_horizon: int = Field(12, ge=4, le=26, description="Длина окна проверки, недель")
    interval_level: float = Field(0.8, ge=0.5, le=0.99, description="Доверительная вероятность интервала")
    seed: int = 42
    candidates: list[str] | None = Field(None, description="Ограничить набор алгоритмов (для тестов)")


class TrainRequest(BaseModel):
    target: str = Field(pattern=r"^[a-z0-9_]{1,24}$", description="Метка целевого показателя: revenue, bookings…")
    channels: list[ChannelIn] = Field(min_length=1, max_length=20)
    sales: list[SalesPoint] = Field(min_length=52, max_length=1040)
    spend: list[SpendRow]
    options: TrainOptions = Field(default_factory=TrainOptions)
    fingerprint: str | None = Field(None, max_length=128, description="Отпечаток набора данных (задаёт сервер)")

    @model_validator(mode="after")
    def _validate(self) -> "TrainRequest":
        codes = [c.code for c in self.channels]
        if len(set(codes)) != len(codes):
            raise ValueError("коды каналов должны быть уникальны")
        weeks = [p.week_start for p in self.sales]
        _check_weeks(weeks, "ряд продаж")
        if [r.week_start for r in self.spend] != weeks:
            raise ValueError("строки затрат должны совпадать по неделям с рядом продаж")
        known = set(codes)
        for row in self.spend:
            unknown = set(row.spend) - known
            if unknown:
                raise ValueError(f"затраты содержат неизвестные каналы: {sorted(unknown)}")
        return self


class MetricsOut(BaseModel):
    wape: float | None
    mape: float | None
    smape: float | None
    rmse: float | None
    bias: float | None
    n: int


class CandidateOut(BaseModel):
    name: str
    label: str
    scenario_aware: bool
    selected: bool
    metrics: MetricsOut | None = None
    fold_wape: list[float] = Field(default_factory=list)
    skill_vs_naive: float | None = None
    skipped_reason: str | None = None


class ChannelEffectOut(BaseModel):
    code: str
    adstock_decay: float
    saturation_scale: float
    max_effect: float
    total_spend: float
    mean_weekly_spend: float
    active_weeks: int
    spend_cv: float
    contribution_total: float
    contribution_share: float
    roi: float | None
    marginal_roi: float | None
    saturation_level: float
    low_variation: bool


class BacktestPoint(BaseModel):
    week_start: date
    actual: float
    predicted: float
    lower: float
    upper: float


class TrainResponse(BaseModel):
    model_id: str
    target: str
    created_at: datetime
    champion: str
    champion_label: str
    data_from: date
    data_to: date
    n_obs: int
    fingerprint: str | None
    interval_level: float
    cv_folds: int
    cv_horizon: int
    metrics: MetricsOut
    leaderboard: list[CandidateOut]
    channel_effects: list[ChannelEffectOut]
    backtest: list[BacktestPoint]
    warnings: list[str] = Field(default_factory=list)


class ModelMeta(BaseModel):
    model_id: str
    target: str
    created_at: datetime
    champion: str
    data_from: date
    data_to: date
    n_obs: int
    wape: float | None
    mape: float | None
    fingerprint: str | None = None


class ForecastRequest(BaseModel):
    start_week: date
    horizon_weeks: int = Field(ge=1, le=52)
    spend: list[SpendRow] = Field(min_length=1, max_length=260,
                                  description="Затраты подряд по неделям: от недели после обучения до конца горизонта")
    interval_level: float | None = Field(None, ge=0.5, le=0.99)
    include_components: bool = True

    @model_validator(mode="after")
    def _validate(self) -> "ForecastRequest":
        if self.start_week.weekday() != 0:
            raise ValueError("start_week должна быть понедельником")
        _check_weeks([r.week_start for r in self.spend], "строки затрат")
        return self


class ForecastPointOut(BaseModel):
    week_start: date
    predicted: float
    lower: float
    upper: float
    base: float | None = None
    contributions: dict[str, float] | None = None


class ForecastTotals(BaseModel):
    predicted: float
    lower: float
    upper: float
    base: float | None = None
    contributions: dict[str, float] | None = None


class ForecastResponse(BaseModel):
    model_id: str
    champion: str
    interval_level: float
    components_available: bool
    points: list[ForecastPointOut]
    totals: ForecastTotals


class ConstraintIn(BaseModel):
    code: str = Field(pattern=CODE_PATTERN)
    min_share: float = Field(0.0, ge=0, le=1)
    max_share: float = Field(1.0, ge=0, le=1)

    @model_validator(mode="after")
    def _order(self) -> "ConstraintIn":
        if self.min_share > self.max_share:
            raise ValueError("min_share не может превышать max_share")
        return self


class OptimizeRequest(BaseModel):
    start_week: date
    horizon_weeks: int = Field(ge=1, le=52)
    total_budget: float = Field(gt=0, description="Бюджет на весь горизонт")
    spend: list[SpendRow] = Field(min_length=1, max_length=260)
    constraints: list[ConstraintIn] = Field(default_factory=list, max_length=20)

    @model_validator(mode="after")
    def _validate(self) -> "OptimizeRequest":
        if self.start_week.weekday() != 0:
            raise ValueError("start_week должна быть понедельником")
        _check_weeks([r.week_start for r in self.spend], "строки затрат")
        return self


class AllocationOut(BaseModel):
    code: str
    weekly_spend: float
    total_spend: float
    share: float
    expected_effect: float
    marginal_return: float
    plan_total_spend: float
    plan_effect: float


class OptimizeResponse(BaseModel):
    model_id: str
    total_budget: float
    spent_budget: float
    plan_budget: float
    plan_marketing_effect: float
    optimized_marketing_effect: float
    uplift_abs: float
    uplift_pct: float | None
    allocations: list[AllocationOut]
    notes: list[str] = Field(default_factory=list)


class HealthResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    status: str
    version: str
    models_total: int
    encryption_enabled: bool
