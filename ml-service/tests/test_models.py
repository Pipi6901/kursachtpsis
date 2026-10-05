import numpy as np
import pytest

from app.models.base import Frame, compute_metrics
from app.models.gbm import GradientBoosting
from app.models.holt_winters import HoltWinters
from app.models.mmm import MMMHyper, MarketingMixModel
from app.models.seasonal_naive import SeasonalNaive


@pytest.fixture(scope="module")
def frame(data):
    n = data.n_hist
    return Frame(data.weeks[:n], data.bookings, data.spend[:n], data.channel_codes)


def test_metrics_definitions():
    m = compute_metrics(np.array([100.0, 200.0]), np.array([110.0, 180.0]))
    assert m.wape == pytest.approx(30 / 300)
    assert m.mape == pytest.approx((0.10 + 0.10) / 2)
    assert m.rmse == pytest.approx(np.sqrt((100 + 400) / 2))
    assert m.bias == pytest.approx((-10 + 20) / 2 / 150)


def test_seasonal_naive_reproduces_pure_seasonality(data):
    n = 130
    y = 100 + 20 * np.sin(2 * np.pi * np.arange(n) / 52)
    frame = Frame(data.weeks[:n], y, np.zeros((n, 1)), ["x"])
    pred = SeasonalNaive().fit(frame, 104).predict(frame, 104, 130)
    assert np.allclose(pred, y[104:130], rtol=0.02)


def test_holt_winters_requires_two_seasons(frame):
    with pytest.raises(ValueError, match="104"):
        HoltWinters().fit(frame, 80)


def test_mmm_has_nonnegative_channel_effects_and_exact_decomposition(frame):
    model = MarketingMixModel().fit(frame, 150)
    assert (model.betas() >= 0).all()
    pred = model.predict(frame, 150, 170)
    base, contrib = model.components(frame, 150, 170)
    assert np.allclose(base + contrib.sum(axis=1), pred, rtol=1e-9)


def test_mmm_forecast_responds_monotonically_to_spend(frame):
    model = MarketingMixModel().fit(frame, 150)
    low = frame.with_spend(frame.spend * np.where(np.arange(frame.n)[:, None] >= 150, 0.5, 1.0))
    high = frame.with_spend(frame.spend * np.where(np.arange(frame.n)[:, None] >= 150, 2.0, 1.0))
    p_low, p_base, p_high = (model.predict(f, 150, 170).sum() for f in (low, frame, high))
    assert p_low < p_base < p_high


def test_mmm_shows_diminishing_returns(frame):
    model = MarketingMixModel().fit(frame, 150)
    total = []
    for factor in (0.0, 1.0, 2.0, 3.0):
        scaled = frame.with_spend(frame.spend * np.where(np.arange(frame.n)[:, None] >= 150, factor, 1.0))
        total.append(model.predict(scaled, 150, 190).sum())
    gains = np.diff(total)
    assert gains[0] > gains[1] > gains[2] > 0  # каждая следующая единица затрат даёт меньше


def test_mmm_restored_from_hyperparameters_gives_identical_forecast(frame):
    fitted = MarketingMixModel().fit(frame, 150)
    restored = MarketingMixModel(MMMHyper.from_dict(fitted.hyperparameters())).fit(frame, 150)
    assert np.allclose(fitted.predict(frame, 150, 170), restored.predict(frame, 150, 170))


def test_gbm_is_monotone_in_spend_and_deterministic(frame):
    a = GradientBoosting(seed=1).fit(frame, 150)
    b = GradientBoosting(seed=1).fit(frame, 150)
    assert np.allclose(a.predict(frame, 150, 170), b.predict(frame, 150, 170))
    more = frame.with_spend(frame.spend * np.where(np.arange(frame.n)[:, None] >= 150, 1.5, 1.0))
    assert (a.predict(more, 150, 170) >= a.predict(frame, 150, 170) - 1e-9).all()
