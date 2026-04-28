"""FastAPI surface called by the Rails Sidekiq workers."""

import logging
import os
import uuid
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from . import __version__
from .models import DetectRequest, DetectResponse, GenerateRequest, GenerateResponse
from .pattern import detect
from .sop import generate

logger = logging.getLogger(__name__)


def _init_sentry() -> None:
    dsn = os.environ.get("SENTRY_DSN", "").strip()
    if not dsn:
        return
    try:
        import sentry_sdk

        sentry_sdk.init(
            dsn=dsn,
            environment=os.environ.get("SENTRY_ENVIRONMENT", "production"),
            release=os.environ.get("SENTRY_RELEASE"),
            traces_sample_rate=float(os.environ.get("SENTRY_TRACES_SAMPLE_RATE", "0.05")),
            send_default_pii=False,
        )
    except Exception:  # pragma: no cover — never block startup on telemetry
        logger.exception("Failed to initialise Sentry")


_init_sentry()

app = FastAPI(title="Vopro AI Engine", version=__version__)


# ---------------------------------------------------------------------------
# Request id propagation
# ---------------------------------------------------------------------------
# A `@app.middleware("http")` function plays nicely with FastAPI's exception
# handlers, unlike `BaseHTTPMiddleware` which is known to swallow exceptions
# raised by downstream handlers (starlette/starlette#1438). We stash the id on
# `request.state` so the exception handlers can include it in the envelope,
# and we mirror the Rails-side header so a single id traces a request across
# the whole stack: agent → backend → ai-engine.


@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    rid = request.headers.get("x-request-id") or str(uuid.uuid4())
    request.state.request_id = rid
    try:
        response = await call_next(request)
    except Exception:
        # Exception handlers below will format the body; the response they
        # produce won't go through this middleware again, so we never get to
        # add the header. That's fine — the exception handlers add it directly.
        raise
    response.headers["X-Request-ID"] = rid
    return response


# ---------------------------------------------------------------------------
# Unified error envelope — matches the Rails contract documented in
# docs/API.md so all services speak the same shape.
# ---------------------------------------------------------------------------

def _envelope(
    *,
    status_code: int,
    code: str,
    message: str,
    request_id: str | None,
    details: Any | None = None,
) -> dict[str, Any]:
    error: dict[str, Any] = {
        "code": code,
        "message": message,
        "status": status_code,
        "request_id": request_id,
    }
    if details is not None:
        error["details"] = details
    return {"error": error}


def _request_id(request: Request) -> str:
    """Return the request id, generating one if the middleware didn't run."""
    rid = getattr(request.state, "request_id", None)
    if not rid:
        rid = request.headers.get("x-request-id") or str(uuid.uuid4())
    return rid


def _error_response(
    *,
    status_code: int,
    code: str,
    message: str,
    request_id: str,
    details: Any | None = None,
) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content=_envelope(
            status_code=status_code,
            code=code,
            message=message,
            request_id=request_id,
            details=details,
        ),
        headers={"X-Request-ID": request_id},
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    rid = _request_id(request)
    code_map = {
        400: "bad_request",
        401: "unauthorized",
        403: "forbidden",
        404: "not_found",
        409: "conflict",
        413: "payload_too_large",
        422: "unprocessable_entity",
        429: "rate_limited",
    }
    code = code_map.get(exc.status_code, f"http_{exc.status_code}")
    detail = exc.detail if isinstance(exc.detail, (dict, list)) else None
    message = exc.detail if isinstance(exc.detail, str) else "Request failed"
    return _error_response(
        status_code=exc.status_code,
        code=code,
        message=message,
        request_id=rid,
        details=detail,
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    rid = _request_id(request)
    return _error_response(
        status_code=422,
        code="unprocessable_entity",
        message="Validation failed",
        request_id=rid,
        # `errors()` returns a list of {loc, msg, type, ...} — pydantic-shaped.
        details={"errors": exc.errors()},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    rid = _request_id(request)
    logger.exception(
        "[%s] unhandled exception: %s",
        rid,
        exc.__class__.__name__,
    )
    if os.environ.get("VOPRO_AI_ENV", "production").lower() == "production":
        message = "An unexpected error occurred"
    else:
        message = f"{exc.__class__.__name__}: {exc}"
    return _error_response(
        status_code=500,
        code="internal_error",
        message=message,
        request_id=rid,
    )


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/health")
def health() -> dict:
    return {"status": "ok", "version": __version__}


@app.post("/detect", response_model=DetectResponse)
def detect_endpoint(req: DetectRequest) -> DetectResponse:
    return DetectResponse(candidates=detect(req.events))


@app.post("/generate", response_model=GenerateResponse)
def generate_endpoint(req: GenerateRequest) -> GenerateResponse:
    return generate(req.workflow, req.events)
