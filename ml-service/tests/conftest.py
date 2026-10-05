import sys
import tempfile
from datetime import timedelta
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.config import Settings  # noqa: E402
from app.main import create_app  # noqa: E402
from tools.synthetic import generate  # noqa: E402

API_KEY = "test-key"
HEADERS = {"X-API-Key": API_KEY}


@pytest.fixture(scope="session")
def data():
    """Синтетика с известными параметрами влияния каналов (фиксированный seed)."""
    return generate()


def train_payload(data, target="revenue", n=None, candidates=None, series=None):
    n = n or data.n_hist
    series = data.revenue if series is None else series
    codes = data.channel_codes
    payload = {
        "target": target,
        "channels": [{"code": c.code, "name": c.name} for c in data.channels],
        "sales": [{"week_start": data.weeks[i].isoformat(), "value": float(series[i])} for i in range(n)],
        "spend": [{"week_start": data.weeks[i].isoformat(),
                   "spend": {codes[j]: float(data.spend[i, j]) for j in range(len(codes))}} for i in range(n)],
    }
    if candidates:
        payload["options"] = {"candidates": candidates}
    return payload


def spend_rows(data, start, count):
    codes = data.channel_codes
    return [{"week_start": data.weeks[i].isoformat(),
             "spend": {codes[j]: float(data.spend[i, j]) for j in range(len(codes))}}
            for i in range(start, start + count)]


@pytest.fixture(scope="session")
def api():
    """Клиент API с временным реестром и включённым шифрованием артефактов."""
    models_dir = tempfile.mkdtemp(prefix="ml-models-")
    settings = Settings(api_key=API_KEY, models_dir=models_dir, encryption_key="test-passphrase",
                        max_body_bytes=2_000_000, log_level="WARNING")
    app = create_app(settings)
    return TestClient(app), settings


@pytest.fixture(scope="session")
def trained(api, data):
    """Модель, обученная один раз на всю историю (обучение занимает несколько секунд)."""
    client, _ = api
    resp = client.post("/api/v1/models/train", json=train_payload(data), headers=HEADERS)
    assert resp.status_code == 201, resp.text
    return resp.json()


def serving_from_outcome(frame, n_train, outcome, model_id="revenue-20260101T000000-0123abcd", target="revenue"):
    """Собирает модель для обслуживания по результату обучения (как это делает реестр)."""
    from app.serving import build_serving
    payload = {
        "model_id": model_id, "target": target, "channels": frame.channels,
        "data": {"dates": [d.isoformat() for d in frame.dates[:n_train]],
                 "y": [float(v) for v in frame.y[:n_train]],
                 "spend": [[float(v) for v in row] for row in frame.spend[:n_train]]},
        "champion": outcome.champion, "hyperparameters": outcome.hyperparameters,
        "relative_errors": [float(x) for x in outcome.relative_errors],
        "cv_horizon": outcome.cv_horizon, "interval_level": 0.8, "seed": 42}
    return build_serving(payload)
