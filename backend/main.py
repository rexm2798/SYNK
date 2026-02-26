from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.data_loader import load_factory_data
from backend.models import NegotiationResponse, RushOrderRequest
from backend.orchestrator import NegotiationOrchestrator

app = FastAPI(title="SYNK Negotiation API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

factory_data = load_factory_data()
orchestrator = NegotiationOrchestrator(factory_data)


@app.get("/health")
def health() -> dict:
    return {"ok": True}


@app.post("/rush-order", response_model=NegotiationResponse)
def rush_order(order: RushOrderRequest) -> NegotiationResponse:
    return orchestrator.run(order)
