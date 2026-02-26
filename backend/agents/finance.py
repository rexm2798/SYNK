from __future__ import annotations

from backend.models import AgentResult, RushOrderRequest


def evaluate(order: RushOrderRequest, shared_memory: dict, data) -> AgentResult:
    product = data.product_costing[data.product_costing["product_id"] == order.product_id].iloc[0]
    base_cost = float(product["base_cost"]) * order.quantity

    overtime_units = float(shared_memory.get("production", {}).get("overtime_units", 0))
    overtime_cost = overtime_units * 24

    shipping_cost = float(shared_memory.get("logistics", {}).get("cost_per_unit", 5)) * order.quantity
    qa_cost = float(shared_memory.get("quality", {}).get("overtime_hours", 0)) * 18
    material_delta = float(shared_memory.get("procurement", {}).get("extra_material_cost", 0))

    total_cost = base_cost + overtime_cost + shipping_cost + qa_cost + material_delta
    revenue = order.quantity * order.price
    margin = ((revenue - total_cost) / revenue) * 100

    details = {
        "revenue": round(revenue, 2),
        "total_cost": round(total_cost, 2),
        "margin_pct": round(margin, 2),
        "margin_floor": order.margin_floor,
    }
    shared_memory["finance"] = details

    feasible = margin >= order.margin_floor
    return AgentResult(
        agent="finance",
        feasible=feasible,
        status="Yes" if feasible else "No",
        constraint=None if feasible else "Margin below floor",
        proposal="Financially viable" if feasible else "Increase price or reduce expedite/overtime spend",
        details=details,
    )
