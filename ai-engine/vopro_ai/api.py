"""FastAPI surface called by the Rails Sidekiq workers."""

from fastapi import FastAPI

from . import __version__
from .models import DetectRequest, DetectResponse, GenerateRequest, GenerateResponse
from .pattern import detect
from .sop import generate

app = FastAPI(title="Vopro AI Engine", version=__version__)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "version": __version__}


@app.post("/detect", response_model=DetectResponse)
def detect_endpoint(req: DetectRequest) -> DetectResponse:
    return DetectResponse(candidates=detect(req.events))


@app.post("/generate", response_model=GenerateResponse)
def generate_endpoint(req: GenerateRequest) -> GenerateResponse:
    return generate(req.workflow, req.events)
