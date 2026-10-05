"""Календарные признаки недельного временного ряда.

Все функции работают с датами понедельников (начало недели) и не хранят состояния,
поэтому признаки можно детерминированно пересчитать при загрузке модели из реестра.
"""
from __future__ import annotations

from datetime import date, timedelta
from functools import lru_cache
from typing import Sequence

import numpy as np

# Окна праздничных периодов (месяц, день) — включительно. Эффект праздников оценивается
# моделью как доля дней недели, попавших в окно, поэтому окна подбирались с запасом.
HOLIDAY_WINDOWS: dict[str, tuple[tuple[int, int], tuple[int, int]]] = {
    "new_year": ((12, 24), (1, 8)),      # Новый год и Рождество
    "womens_day": ((3, 6), (3, 9)),      # 8 Марта
    "may_holidays": ((4, 30), (5, 11)),  # 1 и 9 Мая
}


def week_dates(start: date, count: int) -> list[date]:
    """Последовательность из `count` понедельников, начиная с `start`."""
    return [start + timedelta(weeks=i) for i in range(count)]


def is_monday(d: date) -> bool:
    return d.weekday() == 0


def _in_window(d: date, window: tuple[tuple[int, int], tuple[int, int]]) -> bool:
    (m1, d1), (m2, d2) = window
    md = (d.month, d.day)
    if (m1, d1) <= (m2, d2):
        return (m1, d1) <= md <= (m2, d2)
    # окно «через Новый год»: 24.12 … 08.01
    return md >= (m1, d1) or md <= (m2, d2)


@lru_cache(maxsize=64)
def _holiday_cached(dates: tuple[date, ...]) -> np.ndarray:
    out = np.zeros((len(dates), len(HOLIDAY_WINDOWS)))
    for i, week in enumerate(dates):
        for j, window in enumerate(HOLIDAY_WINDOWS.values()):
            hits = sum(_in_window(week + timedelta(days=k), window) for k in range(7))
            out[i, j] = hits / 7.0
    out.flags.writeable = False
    return out


def holiday_features(dates: Sequence[date]) -> np.ndarray:
    """Доля дней каждой недели, попавших в праздничные окна. Форма (n, число окон)."""
    return _holiday_cached(tuple(dates))


@lru_cache(maxsize=256)
def _fourier_cached(dates: tuple[date, ...], order: int) -> np.ndarray:
    if order <= 0:
        return np.zeros((len(dates), 0))
    doy = np.array([(d + timedelta(days=3)).timetuple().tm_yday for d in dates], dtype=float)
    angle = 2.0 * np.pi * doy / 365.25
    cols = []
    for k in range(1, order + 1):
        cols.append(np.sin(k * angle))
        cols.append(np.cos(k * angle))
    out = np.column_stack(cols)
    out.flags.writeable = False
    return out


def fourier_features(dates: Sequence[date], order: int) -> np.ndarray:
    """Гармоники годовой сезонности. Угол считается по середине недели (четверг)."""
    return _fourier_cached(tuple(dates), order)


def trend_feature(dates: Sequence[date], origin: date) -> np.ndarray:
    """Линейный тренд в годах от даты `origin` (первая неделя обучающей выборки)."""
    return np.array([(d - origin).days / 365.25 for d in dates], dtype=float)
