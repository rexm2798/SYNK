from __future__ import annotations

from backend.models import AgentResult, RushOrderRequest


def evaluate(order: RushOrderRequest, shared_memory: dict, data) -> AgentResult:
    standard = data.shipping_mode[data.shipping_mode["mode"] == "standard"].iloc[0]
    expedited = data.shipping_mode[data.shipping_mode["mode"] == "expedited"].iloc[0]

    standard_days = int(standard["days"])
    if order.deadline_days >= standard_days:
        mode = "standard"
        status = "Yes"
        proposal = "Standard shipping is feasible"
        constraint = None
    else:
        mode = "expedited"
        status = "Conditional"
        proposal = "Switch to air freight"
        constraint = "Standard mode misses SLA"

    details = {
        "shipping_mode": mode,
        "cost_per_unit": float(expedited["cost_per_unit"] if mode == "expedited" else standard["cost_per_unit"]),
    }
    shared_memory["logistics"] = details

    return AgentResult(
        agent="logistics",
        feasible=True,
        status=status,
        constraint=constraint,
        proposal=proposal,
        details=details,
    )
