from __future__ import annotations

from backend.models import AgentResult, RushOrderRequest


def evaluate(order: RushOrderRequest, shared_memory: dict, data) -> AgentResult:
    product = data.product_costing[data.product_costing["product_id"] == order.product_id].iloc[0]
    qa = data.qa_team_capacity.iloc[0]

    hours_per_unit = float(product["inspection_hours_per_unit"])
    needed = order.quantity * hours_per_unit
    base_cap = float(qa["daily_capacity_hours"]) * order.deadline_days
    full_cap = (float(qa["daily_capacity_hours"]) + float(qa["overtime_hours"])) * order.deadline_days

    details = {
        "hours_needed": round(needed, 2),
        "base_capacity": base_cap,
        "full_capacity": full_cap,
        "overtime_hours": max(0.0, needed - base_cap),
    }
    shared_memory["quality"] = details

    if needed <= base_cap:
        return AgentResult(agent="quality", feasible=True, status="Yes", proposal="QA capacity sufficient", details=details)
    if needed <= full_cap:
        return AgentResult(
            agent="quality",
            feasible=True,
            status="Conditional",
            constraint="QA overtime required",
            proposal=f"Add {round(needed - base_cap, 1)} QA overtime hours",
            details=details,
        )

    return AgentResult(
        agent="quality",
        feasible=False,
        status="No",
        constraint="QA overload",
        proposal="Increase inspection staffing or extend deadline",
        details=details,
    )
