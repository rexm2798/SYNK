from __future__ import annotations

from backend.models import AgentResult, RushOrderRequest


def evaluate(order: RushOrderRequest, shared_memory: dict, data) -> AgentResult:
    bom = data.bill_of_materials[data.bill_of_materials["product_id"] == order.product_id]

    shortages = []
    extra_material_cost = 0.0

    for _, item in bom.iterrows():
        material = item["material"]
        qty_per_unit = float(item["qty_per_unit"])
        req = qty_per_unit * order.quantity

        mat_row = data.materials_master[data.materials_master["material"] == material].iloc[0]
        inv = float(mat_row["inventory"])
        if req > inv:
            shortage = req - inv
            spot_multiplier = float(mat_row["spot_multiplier"])
            unit_cost = float(mat_row["cost_per_unit"])
            extra_material_cost += shortage * unit_cost * (spot_multiplier - 1)
            shortages.append({"material": material, "short_by": round(shortage, 2)})

    details = {"shortages": shortages, "extra_material_cost": round(extra_material_cost, 2)}
    shared_memory["procurement"] = details

    if shortages:
        return AgentResult(
            agent="procurement",
            feasible=True,
            status="Conditional",
            constraint="Material shortage",
            proposal="Use spot supplier for missing materials",
            details=details,
        )

    return AgentResult(
        agent="procurement",
        feasible=True,
        status="Yes",
        proposal="Inventory fully covers BOM",
        details=details,
    )
