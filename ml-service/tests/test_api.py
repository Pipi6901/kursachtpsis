import copy
import dataclasses

import pytest

from .conftest import HEADERS, spend_rows, train_payload


def test_health_is_open_and_reports_encryption(api):
    client, _ = api
    body = client.get("/health").json()
    assert body["status"] == "ok" and body["encryption_enabled"] is True


@pytest.mark.parametrize("headers", [{}, {"X-API-Key": "wrong"}])
def test_api_requires_valid_key(api, headers):
    client, _ = api
    assert client.get("/api/v1/models", headers=headers).status_code == 401
    assert client.post("/api/v1/models/train", json={}, headers=headers).status_code == 401


def test_train_response_contract(trained):
    assert trained["champion"] in ("mmm_ridge", "gbm")
    assert trained["n_obs"] == 196 and trained["data_from"] == "2023-01-02" and trained["data_to"] == "2026-09-28"
    names = {c["name"] for c in trained["leaderboard"]}
    assert {"seasonal_naive", "holt_winters", "mmm_ridge", "gbm"} <= names
    assert sum(c["selected"] for c in trained["leaderboard"]) == 1
    assert len(trained["channel_effects"]) == 6 and len(trained["backtest"]) == 48
    assert 0 < trained["metrics"]["wape"] < 0.1
    for point in trained["backtest"]:
        assert point["lower"] <= point["predicted"] <= point["upper"]


def test_channel_with_constant_spend_is_flagged_as_unreliable(api, data):
    """Если затраты канала не меняются, его эффект неотделим от базового уровня: канал помечается и в предупреждениях."""
    client, _ = api
    spend = data.spend.copy()
    spend[:, 0] = float(spend[:, 0].mean())
    flat = dataclasses.replace(data, spend=spend)
    resp = client.post("/api/v1/models/train", headers=HEADERS,
                       json=train_payload(flat, candidates=["seasonal_naive", "mmm_ridge"]))
    assert resp.status_code == 201, resp.text
    body = resp.json()
    constant = data.channel_codes[0]
    effects = {e["code"]: e for e in body["channel_effects"]}
    assert effects[constant]["low_variation"] is True
    assert any(constant in w and "ненадёжна" in w for w in body["warnings"])


def test_model_artifact_is_encrypted_on_disk(api, trained):
    _, settings = api
    from pathlib import Path
    raw = (Path(settings.models_dir) / f"{trained['model_id']}.model").read_bytes()
    assert raw.startswith(b"FCM1") and b"search" not in raw


def test_models_listing_and_details(api, trained):
    client, _ = api
    ids = [m["model_id"] for m in client.get("/api/v1/models", headers=HEADERS).json()]
    assert trained["model_id"] in ids
    detail = client.get(f"/api/v1/models/{trained['model_id']}", headers=HEADERS).json()
    assert detail["champion"] == trained["champion"] and detail["leaderboard"]


def test_forecast_with_components(api, data, trained):
    client, _ = api
    n, h = data.n_hist, 12
    body = {"start_week": data.weeks[n].isoformat(), "horizon_weeks": h, "spend": spend_rows(data, n, h)}
    resp = client.post(f"/api/v1/models/{trained['model_id']}/forecast", json=body, headers=HEADERS)
    assert resp.status_code == 200, resp.text
    out = resp.json()
    assert len(out["points"]) == h and out["components_available"] is True
    for p in out["points"]:
        assert p["lower"] <= p["predicted"] <= p["upper"]
        assert p["base"] + sum(p["contributions"].values()) == pytest.approx(p["predicted"], rel=1e-6)
    assert out["totals"]["predicted"] == pytest.approx(sum(p["predicted"] for p in out["points"]))


def test_forecast_reacts_to_scenario(api, data, trained):
    client, _ = api
    n, h = data.n_hist, 12
    plan = spend_rows(data, n, h)
    doubled = copy.deepcopy(plan)
    for row in doubled:
        row["spend"] = {k: v * 2 for k, v in row["spend"].items()}
    zero = copy.deepcopy(plan)
    for row in zero:
        row["spend"] = {k: 0.0 for k in row["spend"]}
    total = {}
    for name, rows in (("plan", plan), ("double", doubled), ("zero", zero)):
        body = {"start_week": data.weeks[n].isoformat(), "horizon_weeks": h, "spend": rows}
        total[name] = client.post(f"/api/v1/models/{trained['model_id']}/forecast", json=body,
                                  headers=HEADERS).json()["totals"]["predicted"]
    assert total["zero"] < total["plan"] < total["double"]


def test_optimize_endpoint(api, data, trained):
    client, _ = api
    n, h = data.n_hist, 12
    rows = spend_rows(data, n, h)
    budget = sum(sum(r["spend"].values()) for r in rows)
    body = {"start_week": data.weeks[n].isoformat(), "horizon_weeks": h, "total_budget": budget, "spend": rows,
            "constraints": [{"code": "outdoor", "min_share": 0.0, "max_share": 0.05}]}
    resp = client.post(f"/api/v1/models/{trained['model_id']}/optimize", json=body, headers=HEADERS)
    assert resp.status_code == 200, resp.text
    out = resp.json()
    assert out["optimized_marketing_effect"] >= out["plan_marketing_effect"] - 1e-6
    assert sum(a["total_spend"] for a in out["allocations"]) == pytest.approx(out["spent_budget"], rel=1e-6)
    assert next(a for a in out["allocations"] if a["code"] == "outdoor")["share"] <= 0.05 + 1e-6


@pytest.mark.parametrize("mutate,fragment", [
    (lambda p: p["sales"].__setitem__(0, {**p["sales"][0], "week_start": "2023-01-03"}), "понедельник"),
    (lambda p: p.__setitem__("sales", p["sales"][:40]), "sales"),
    (lambda p: p["sales"].pop(10), "подряд"),
    (lambda p: p["spend"][3]["spend"].__setitem__("unknown_channel", 10.0), "неизвестные"),
    (lambda p: p["spend"][3]["spend"].__setitem__("search", -5.0), "неотрицательным"),
    (lambda p: p["channels"].append(dict(p["channels"][0])), "уникальны"),
])
def test_train_rejects_invalid_input(api, data, mutate, fragment):
    client, _ = api
    payload = train_payload(data, n=80)
    mutate(payload)
    resp = client.post("/api/v1/models/train", json=payload, headers=HEADERS)
    assert resp.status_code == 422
    assert resp.json()["error"] == "validation_error" and fragment in resp.json()["message"]


def test_forecast_errors(api, data, trained):
    client, _ = api
    n = data.n_hist
    url = f"/api/v1/models/{trained['model_id']}/forecast"
    gap = {"start_week": data.weeks[n + 2].isoformat(), "horizon_weeks": 4, "spend": spend_rows(data, n + 1, 8)}
    assert client.post(url, json=gap, headers=HEADERS).json()["error"] == "invalid_request"
    short = {"start_week": data.weeks[n].isoformat(), "horizon_weeks": 12, "spend": spend_rows(data, n, 4)}
    assert client.post(url, json=short, headers=HEADERS).status_code == 422
    unknown = {"start_week": data.weeks[n].isoformat(), "horizon_weeks": 1,
               "spend": [{"week_start": data.weeks[n].isoformat(), "spend": {"ghost": 1.0}}]}
    assert client.post(url, json=unknown, headers=HEADERS).status_code == 422


def test_unknown_model_and_path_traversal(api, data):
    client, _ = api
    n = data.n_hist
    body = {"start_week": data.weeks[n].isoformat(), "horizon_weeks": 1, "spend": spend_rows(data, n, 1)}
    assert client.post("/api/v1/models/revenue-20200101T000000-00000000/forecast", json=body,
                       headers=HEADERS).status_code == 404
    assert client.get("/api/v1/models/..%2F..%2Fetc%2Fpasswd", headers=HEADERS).status_code == 404


def test_concurrent_training_is_limited(api, data):
    client, _ = api
    slots = client.app.state.training_slots
    assert slots.acquire(blocking=False)
    try:
        resp = client.post("/api/v1/models/train", json=train_payload(data, n=80), headers=HEADERS)
        assert resp.status_code == 429 and resp.json()["error"] == "busy"
    finally:
        slots.release()


def test_oversized_request_is_rejected(api):
    client, _ = api
    resp = client.post("/api/v1/models/train", content=b"x" * 10, headers={
        **HEADERS, "content-type": "application/json", "content-length": "99999999"})
    assert resp.status_code == 413
