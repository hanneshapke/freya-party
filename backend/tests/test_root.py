from fastapi.testclient import TestClient

from app.main import app


def test_root_returns_ok() -> None:
    with TestClient(app) as client:
        r = client.get("/")
    assert r.status_code == 200
    assert r.json() == {"service": "freya-party", "status": "ok"}
