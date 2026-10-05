from datetime import date

import numpy as np
import pytest

from app.calendar_features import fourier_features, holiday_features, is_monday, trend_feature, week_dates
from app.transforms import adstock, saturation, saturation_slope


def test_adstock_without_carryover_is_identity():
    x = np.array([10.0, 0.0, 5.0, 7.0])
    assert np.allclose(adstock(x, 0.0), x)


def test_adstock_geometric_decay_matches_formula():
    # a_t = (1 - d) * x_t + d * a_{t-1}; начальное состояние 0
    out = adstock(np.array([100.0, 0.0, 0.0]), 0.5, initial=0.0)
    assert np.allclose(out, [50.0, 25.0, 12.5])


def test_adstock_constant_spend_converges_to_spend_level():
    # с начальным состоянием «установившегося режима» уровень не смещается
    out = adstock(np.full(30, 200.0), 0.7)
    assert np.allclose(out, 200.0)


def test_adstock_rejects_invalid_decay():
    with pytest.raises(ValueError):
        adstock(np.ones(3), 1.0)


def test_saturation_is_monotone_bounded_and_concave():
    a = np.linspace(0, 5000, 200)
    s = saturation(a, 500.0)
    assert s[0] == 0.0 and np.all(np.diff(s) > 0) and s.max() < 1.0
    assert np.all(np.diff(s, 2) < 1e-12)  # убывающая отдача (вогнутость)
    assert saturation(np.array([500.0]), 500.0)[0] == pytest.approx(1 - np.exp(-1))


def test_saturation_slope_is_derivative():
    a, k, h = 300.0, 400.0, 1e-4
    numeric = (saturation(np.array(a + h), k) - saturation(np.array(a - h), k)) / (2 * h)
    assert saturation_slope(np.array(a), k) == pytest.approx(float(numeric), rel=1e-6)


def test_week_dates_are_consecutive_mondays():
    weeks = week_dates(date(2026, 1, 5), 5)
    assert all(is_monday(w) for w in weeks)
    assert [(b - a).days for a, b in zip(weeks, weeks[1:])] == [7, 7, 7, 7]


def test_holiday_features_new_year_week():
    f = holiday_features([date(2025, 12, 29), date(2026, 6, 15)])
    assert f[0, 0] == pytest.approx(1.0)   # неделя целиком в окне «Новый год»
    assert f[1].sum() == 0.0               # середина июня — праздников нет


def test_fourier_and_trend_shapes():
    weeks = week_dates(date(2024, 1, 1), 60)
    assert fourier_features(weeks, 3).shape == (60, 6)
    assert fourier_features(weeks, 0).shape == (60, 0)
    t = trend_feature(weeks, weeks[0])
    assert t[0] == 0 and t[52] == pytest.approx(364 / 365.25)
