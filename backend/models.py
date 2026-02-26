from __future__ import annotations

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class RushOrderRequest(BaseModel):
    product_id: str
    quantity: int = Field(gt=0)
    deadline_days: int = Field(gt=0, le=30)
    price: float = Field(gt=0)
    margin_floor: float = Field(default=18, ge=0, le=100)


class AgentResult(BaseModel):
    agent: str
    feasible: bool
    status: str
    constraint: Optional[str] = None
    proposal: Optional[str] = None
    details: Dict[str, Any] = Field(default_factory=dict)


class NegotiationRound(BaseModel):
    round: int
    agent_results: List[AgentResult]
    shared_memory: Dict[str, Any]
    consensus: bool


class NegotiationResponse(BaseModel):
    rounds: List[NegotiationRound]
    final_margin: float
    risk_score: str
    decision: str
    summary: Dict[str, Any]
    llm_summary: Optional[str] = None
