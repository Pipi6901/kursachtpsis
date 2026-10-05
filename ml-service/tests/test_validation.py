import numpy as np
import pytest

from app.validation import apply_interval, fold_cuts, interval_quantiles


def test_fold_cuts_end_at_series_end_and_respect_min_train():
    assert fold_cuts(196, 4, 12, 52) == [148, 160, 172, 184]
    assert fold_cuts(90, 4, 12, 52) == [54, 66, 78]        # данных хватает лишь на три окна
    assert fold_cuts(60, 4, 12, 52) == []


def test_interval_quantiles_cover_requested_share():
    rng = np.random.default_rng(1)
    errors = rng.normal(0, 0.05, 5000)
    lo, hi = interval_quantiles(errors, 0.8)
    assert ((errors >= lo) & (errors <= hi)).mean() == pytest.approx(0.8, abs=0.02)
    assert lo < 0 < hi


def test_interval_widens_beyond_validation_horizon():
    pred = np.full(3, 100.0)
    lo1, hi1 = apply_interval(pred, -0.1, 0.1, np.array([5, 12, 13]), cv_horizon=12)
    assert lo1[0] == lo1[1] == pytest.approx(90.0) and hi1[0] == hi1[1] == pytest.approx(110.0)
    assert lo1[2] < lo1[1] and hi1[2] > hi1[1]
    assert (lo1 >= 0).all()
