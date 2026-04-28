"""Tests for the unified error envelope on the FastAPI surface."""

from __future__ import annotations

import os

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

# Make sure unhandled exceptions surface their underlying message in tests so
# the suite can assert on it. The middleware switches to an opaque message in
# production.
os.environ.setdefault("VOPRO_AI_ENV", "test")

from vopro_ai.api import app


@app.get("/__test/boom")
def _boom_route() -> dict:
    raise RuntimeError("synthetic explosion")


@app.get("/__test/teapot")
def _teapot_route() -> dict:
    raise HTTPException(status_code=418, detail="I'm a teapot")


@pytest.fixture()
def client() -> TestClient:
    return TestClient(app, raise_server_exceptions=False)


def test_envelope_on_unhandled_exception(client: TestClient) -> None:
    res = client.get("/__test/boom")
    assert res.status_code == 500
    body = res.json()
    assert body["error"]["code"] == "internal_error"
    assert body["error"]["status"] == 500
    assert body["error"]["request_id"]
    assert "synthetic explosion" in body["error"]["message"]
    assert res.headers["x-request-id"] == body["error"]["request_id"]


def test_envelope_on_http_exception(client: TestClient) -> None:
    res = client.get("/__test/teapot")
    assert res.status_code == 418
    body = res.json()
    # 418 isn't in the standard map; falls back to http_<status>.
    assert body["error"]["code"] == "http_418"
    assert body["error"]["message"] == "I'm a teapot"
    assert body["error"]["request_id"]


def test_envelope_on_validation_error(client: TestClient) -> None:
    # /generate expects a structured body — a bare {} should 422.
    res = client.post("/generate", json={})
    assert res.status_code == 422
    body = res.json()
    assert body["error"]["code"] == "unprocessable_entity"
    assert body["error"]["message"] == "Validation failed"
    assert isinstance(body["error"]["details"]["errors"], list)


def test_request_id_passthrough(client: TestClient) -> None:
    res = client.get("/__test/boom", headers={"X-Request-ID": "rid_abc_123"})
    assert res.status_code == 500
    assert res.headers["x-request-id"] == "rid_abc_123"
    assert res.json()["error"]["request_id"] == "rid_abc_123"


def test_health_endpoint_unaffected(client: TestClient) -> None:
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"
    assert "x-request-id" in {k.lower() for k in res.headers.keys()}
