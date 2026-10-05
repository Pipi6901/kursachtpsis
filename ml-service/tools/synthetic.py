"""Генератор синтетических данных «продажи + маркетинговые активности».

Используется в двух целях:
1. демонстрационный набор для серверной части (файл forecast-demo-data.json);
2. тестирование и валидация интеллектуального компонента: данные порождаются
   процессом с ИЗВЕСТНЫМИ параметрами влияния каналов, поэтому можно проверить,
   что модель восстанавливает вклад каналов и честно оценивает точность.

Процесс порождения намеренно отличается от формы модели (насыщение по Хиллу, а не
экспоненциальное): модель не «угадывает» истинную функцию, а аппроксимирует её.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, timedelta

import numpy as np

from app.calendar_features import HOLIDAY_WINDOWS, holiday_features, week_dates
from app.transforms import adstock


@dataclass(frozen=True)
class ChannelSpec:
    code: str
    name: str
    kind: str                # тип канала: ONLINE_PAID / ONLINE_OWNED / PARTNER / OFFLINE
    prefix: str              # префикс названия кампаний
    decay: float             # истинный коэффициент переноса эффекта
    half_sat: float          # затраты в неделю, при которых достигается половина максимума
    hill: float              # крутизна кривой Хилла
    beta: float              # максимальный недельный эффект (бронирований)
    pattern: str             # always_on | pulsed | bursts
    level: tuple[float, float]       # диапазон недельных затрат ($)
    on_weeks: tuple[int, int] = (1, 1)
    off_weeks: tuple[int, int] = (0, 0)
    season_amp: float = 0.0  # насколько менеджер «разгоняет» затраты в высокий сезон
    pause_prob: float = 0.0  # вероятность паузы (нулевых затрат) в блоке постоянного канала


CHANNELS: tuple[ChannelSpec, ...] = (
    ChannelSpec("search", "Контекстная реклама", "ONLINE_PAID", "Поиск",
                0.30, 420, 1.3, 22, "always_on", (120, 720), (2, 5), (0, 0), 0.30, 0.12),
    ChannelSpec("social", "Социальные сети (таргет)", "ONLINE_PAID", "Соцсети",
                0.50, 280, 1.2, 14, "pulsed", (160, 480), (2, 6), (1, 4), 0.25),
    ChannelSpec("email", "Email и мессенджер-рассылки", "ONLINE_OWNED", "Рассылка",
                0.20, 70, 1.5, 8, "bursts", (40, 140), (1, 1), (1, 4), 0.10),
    ChannelSpec("ota", "Онлайн-агрегаторы (OTA)", "ONLINE_PAID", "Агрегаторы",
                0.40, 650, 1.4, 30, "always_on", (250, 1100), (3, 7), (0, 0), 0.40, 0.06),
    ChannelSpec("partners", "Партнёры и корпоративные клиенты", "PARTNER", "Партнёры",
                0.70, 220, 1.3, 10, "pulsed", (120, 420), (1, 4), (3, 9), 0.0),
    ChannelSpec("outdoor", "Наружная реклама и радио", "OFFLINE", "Наружка",
                0.75, 480, 1.6, 9, "pulsed", (300, 800), (4, 8), (6, 16), 0.20),
)

THEMES = {
    1: "Зимние каникулы", 2: "Февральские выходные", 3: "8 Марта", 4: "Весенний отдых",
    5: "Майские праздники", 6: "Начало лета", 7: "Лето у воды", 8: "Конец лета",
    9: "Бархатный сезон", 10: "Осенние скидки", 11: "Ноябрьские выходные", 12: "Новый год",
}


def season_index(d: date) -> float:
    """Гладкая годовая сезонность (пик — лето, спад — поздняя осень/февраль)."""
    doy = (d + timedelta(days=3)).timetuple().tm_yday
    angle = 2.0 * np.pi * doy / 365.25
    return float(0.26 * np.sin(angle - 2.0 * np.pi * 110 / 365.25)
                 + 0.09 * np.sin(2.0 * angle - 2.0 * np.pi * 20 / 365.25))


@dataclass
class Campaign:
    channel: str
    name: str
    start: date
    end: date
    budget: float


@dataclass
class SyntheticData:
    weeks: list[date]                 # все недели: история + план
    n_hist: int
    channels: tuple[ChannelSpec, ...]
    campaigns: list[Campaign]
    spend: np.ndarray                 # (n_total, C) — недельные затраты по кампаниям
    bookings: np.ndarray              # (n_hist,)
    revenue: np.ndarray               # (n_hist,)
    truth_contrib: np.ndarray         # (n_hist, C) — истинный вклад каналов (бронирований)
    truth_base: np.ndarray            # (n_hist,) — истинный базовый уровень
    meta: dict = field(default_factory=dict)

    @property
    def history_weeks(self) -> list[date]:
        return self.weeks[: self.n_hist]

    @property
    def channel_codes(self) -> list[str]:
        return [c.code for c in self.channels]


def _plan_channel(rng: np.random.Generator, spec: ChannelSpec, weeks: list[date]) -> list[tuple[int, int, float]]:
    """Список кампаний канала: (индекс первой недели, число недель, затраты в неделю)."""
    n = len(weeks)
    out: list[tuple[int, int, float]] = []
    i = int(rng.integers(0, 4)) if spec.pattern != "always_on" else 0
    lo, hi = spec.level
    while i < n:
        length = int(rng.integers(spec.on_weeks[0], spec.on_weeks[1] + 1))
        length = min(length, n - i)
        season = season_index(weeks[min(i + length // 2, n - 1)])
        level = rng.uniform(lo, hi) * (1.0 + spec.season_amp * season / 0.3)
        level = float(np.clip(level, lo * 0.6, hi * 1.5))
        level = round(level / 10.0) * 10.0
        if spec.pause_prob and rng.random() < spec.pause_prob:
            level = 0.0  # пауза: канал выключен на время блока
        if level > 0:
            out.append((i, length, max(level, 10.0)))
        gap = 0
        if spec.off_weeks[1] > 0:
            gap = int(rng.integers(spec.off_weeks[0], spec.off_weeks[1] + 1))
        i += length + gap
    return out


def generate(start: date = date(2023, 1, 2), history_end: date = date(2026, 9, 28),
             plan_weeks: int = 26, seed: int = 20260928,
             noise: float = 0.055) -> SyntheticData:
    """Строит историю продаж и кампании. ``history_end`` — понедельник последней полной недели."""
    assert start.weekday() == 0 and history_end.weekday() == 0
    n_hist = (history_end - start).days // 7 + 1
    n_total = n_hist + plan_weeks
    weeks = week_dates(start, n_total)
    rng = np.random.default_rng(seed)

    spend = np.zeros((n_total, len(CHANNELS)))
    campaigns: list[Campaign] = []
    for c_idx, spec in enumerate(CHANNELS):
        for first, length, level in _plan_channel(rng, spec, weeks):
            spend[first:first + length, c_idx] = level
            s_date = weeks[first]
            e_date = weeks[first + length - 1] + timedelta(days=6)
            theme = THEMES[(s_date + timedelta(days=14)).month]
            campaigns.append(Campaign(spec.code, f"{spec.prefix}: {theme}", s_date, e_date,
                                      round(level * length, 2)))

    # истинный базовый уровень: тренд × сезонность × праздники
    hist = weeks[:n_hist]
    years = np.array([(d - start).days / 365.25 for d in hist])
    season = np.array([season_index(d) for d in hist])
    hol = holiday_features(hist) @ np.array([0.22, 0.10, 0.12])  # new_year, womens_day, may_holidays
    assert list(HOLIDAY_WINDOWS) == ["new_year", "womens_day", "may_holidays"]
    base = 52.0 * (1.0 + 0.075 * years) * (1.0 + season + hol)

    contrib = np.zeros((n_hist, len(CHANNELS)))
    for c_idx, spec in enumerate(CHANNELS):
        acc = adstock(spend[:n_hist, c_idx], spec.decay)
        hill_s = acc ** spec.hill / (acc ** spec.hill + spec.half_sat ** spec.hill)
        contrib[:, c_idx] = spec.beta * hill_s

    mean_level = base + contrib.sum(axis=1)
    eps = rng.lognormal(mean=-0.5 * noise ** 2, sigma=noise, size=n_hist)
    bookings = np.maximum(np.round(mean_level * eps), 5.0)

    avg_check = 205.0 * (1.0 + 0.10 * season) * (1.025 ** years) * rng.lognormal(-0.5 * 0.035 ** 2, 0.035, n_hist)
    revenue = np.round(bookings * avg_check, 2)

    return SyntheticData(weeks=weeks, n_hist=n_hist, channels=CHANNELS, campaigns=campaigns,
                         spend=spend, bookings=bookings, revenue=revenue,
                         truth_contrib=contrib, truth_base=base,
                         meta={"seed": seed, "start": start.isoformat(),
                               "history_end": history_end.isoformat(), "plan_weeks": plan_weeks})


def hill(acc: np.ndarray, half_sat: float, shape: float) -> np.ndarray:
    return acc ** shape / (acc ** shape + half_sat ** shape)


def true_marketing_effect(data: SyntheticData, spend: np.ndarray, start: int, stop: int) -> float:
    """Истинный суммарный маркетинговый эффект (бронирований) на неделях [start, stop)
    для матрицы затрат ``spend`` (строки — недели от начала ряда). Нужен для проверки оптимизатора."""
    total = 0.0
    for c_idx, spec in enumerate(data.channels):
        acc = adstock(spend[:, c_idx], spec.decay)
        total += float((spec.beta * hill(acc[start:stop], spec.half_sat, spec.hill)).sum())
    return total
