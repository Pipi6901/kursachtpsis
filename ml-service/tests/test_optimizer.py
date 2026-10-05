import numpy as np
import pytest

from app.forecasting import RequestError
from app.models.base import Frame
from app.optimizer import ChannelConstraint, allocate, optimize
from app.training import train

from .conftest import serving_from_outcome


@pytest.fixture(scope="module")
def setup(data):
    n = data.n_hist
    n_train, horizon = n - 26, 12
    frame = Frame(data.weeks[:n], data.bookings, data.spend[:n], data.channel_codes)
    outcome = train(frame, n_train, only=["mmm_ridge"])
    model = serving_from_outcome(frame, n_train, outcome, target="bookings")
    rows = [(data.weeks[n_train + i], data.spend[n_train + i]) for i in range(horizon)]
    return model, rows, data.weeks[n_train], horizon, float(data.spend[n_train:n_train + horizon].sum())


def test_allocation_spends_exactly_the_budget_within_bounds(setup):
    model, rows, start, horizon, budget = setup
    r = optimize(model, rows, start, horizon, budget)
    assert r.spent_budget == pytest.approx(budget, rel=1e-6)
    assert all(a.weekly_spend >= -1e-9 for a in r.allocations)
    hist_max = model.frame.spend[: model.n].max(axis=0)
    plan_max = np.max([row[1] for row in rows], axis=0)
    for a, cap in zip(r.allocations, np.maximum(1.5 * hist_max, plan_max)):
        assert a.weekly_spend <= cap + 1e-6


def test_marginal_returns_are_equal_for_interior_channels(setup):
    """Условие оптимальности: у каналов не на границах предельная отдача одинакова."""
    model, rows, start, horizon, budget = setup
    r = optimize(model, rows, start, horizon, budget)
    hist_max = model.frame.spend[: model.n].max(axis=0)
    interior = [a.marginal_return for a, cap in zip(r.allocations, 1.5 * hist_max)
                if 1e-6 < a.weekly_spend < cap - 1e-6]
    assert len(interior) >= 2
    assert max(interior) - min(interior) < 0.01 * max(interior)
    for a in r.allocations:
        if a.weekly_spend < 1e-6:                      # неиспользуемый канал не окупается лучше «цены денег»
            assert a.marginal_return <= max(interior) * 1.01


def test_effect_grows_with_budget_and_returns_diminish(setup):
    model, rows, start, horizon, budget = setup
    effects = [optimize(model, rows, start, horizon, budget * f).optimized_marketing_effect
               for f in (0.5, 1.0, 1.5, 2.0)]
    gains = np.diff(effects)
    assert (gains > 0).all() and gains[0] > gains[1] > gains[2]


def test_constraints_are_respected(setup):
    model, rows, start, horizon, budget = setup
    constraints = [ChannelConstraint("outdoor", min_share=0.10, max_share=0.10),
                   ChannelConstraint("search", max_share=0.20)]
    r = optimize(model, rows, start, horizon, budget, constraints)
    by_code = {a.code: a for a in r.allocations}
    assert by_code["outdoor"].share == pytest.approx(0.10, abs=1e-6)
    assert by_code["search"].share <= 0.20 + 1e-6


def test_incompatible_constraints_are_rejected(setup):
    model, rows, start, horizon, budget = setup
    with pytest.raises(RequestError):
        optimize(model, rows, start, horizon, budget,
                 [ChannelConstraint(c, min_share=0.3) for c in model.channels])
    with pytest.raises(RequestError):
        optimize(model, rows, start, horizon, -5)


def test_budget_above_capacity_is_capped_with_note(setup):
    model, rows, start, horizon, budget = setup
    r = optimize(model, rows, start, horizon, budget * 50)
    assert r.spent_budget < budget * 50 and any("не распределена" in n for n in r.notes)


def test_allocate_solves_simple_concave_problem_exactly():
    # f_c(u) = w_c * (1 - exp(-u / k)), общий бюджет 10: аналитически u* из равенства производных
    w, k = np.array([3.0, 1.0]), np.array([4.0, 4.0])
    grad = lambda u: w / k * np.exp(-u / k)
    u = allocate(grad, np.zeros(2), np.full(2, 100.0), 10.0)
    assert u.sum() == pytest.approx(10.0)
    assert u[0] - u[1] == pytest.approx(4.0 * np.log(3.0), rel=1e-6)
