from __future__ import annotations

from backend.models import AgentResult, RushOrderRequest


def evaluate(order: RushOrderRequest, shared_memory: dict, data) -> AgentResult:
    row = data.production_lines.iloc[0]
    max_units = float(row["max_units_per_day"])
    load_pct = float(row["scheduled_load_pct"])
    overtime_units_per_day = float(row["overtime_units_per_day"])

    available = int(max_units * (1 - load_pct / 100) * order.deadline_days)
    gap = max(0, order.quantity - available)
    overtime_cap = int(overtime_units_per_day * order.deadline_days)

    payload = {"available": available, "gap": gap, "overtime_cap": overtime_cap, "delay_days": 0}

    if gap == 0:
        status = "Yes"
        feasible = True
        proposal = "No schedule adjustment required"
        constraint = None
    elif gap <= overtime_cap:
        status = "Conditional"
        feasible = True
        proposal = f"Approve with overtime of {gap} units"
        constraint = "Overtime needed"
        payload["overtime_units"] = gap
    else:
        delay_days = int((gap - overtime_cap + max_units - 1) // max_units)
        payload["delay_days"] = delay_days
        payload["overtime_units"] = overtime_cap
        status = "No"
        feasible = False
        proposal = f"Delay order #4471 by {delay_days} day(s) + max overtime"
        constraint = "Capacity overload"

    shared_memory["production"] = payload
    return AgentResult(
        agent="production",
        feasible=feasible,
        status=status,
        constraint=constraint,
        proposal=proposal,
        details=payload,
    )
