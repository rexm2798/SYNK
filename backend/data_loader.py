from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Dict

import pandas as pd


@dataclass
class FactoryData:
    orders: pd.DataFrame
    production_lines: pd.DataFrame
    bill_of_materials: pd.DataFrame
    materials_master: pd.DataFrame
    shipping_mode: pd.DataFrame
    qa_team_capacity: pd.DataFrame
    product_costing: pd.DataFrame


REQUIRED_SHEETS = [
    "orders",
    "production_lines",
    "bill_of_materials",
    "materials_master",
    "shipping_mode",
    "qa_team_capacity",
    "product_costing",
]


def _fallback_data() -> FactoryData:
    return FactoryData(
        orders=pd.DataFrame([
            {"order_id": 4471, "priority_score": 9, "due_days": 2, "units": 500},
            {"order_id": 4472, "priority_score": 6, "due_days": 3, "units": 350},
        ]),
        production_lines=pd.DataFrame([
            {"line": "A", "max_units_per_day": 800, "scheduled_load_pct": 90, "overtime_units_per_day": 250}
        ]),
        bill_of_materials=pd.DataFrame([
            {"product_id": "P-100", "material": "steel", "qty_per_unit": 1.1},
            {"product_id": "P-100", "material": "motor", "qty_per_unit": 0.3},
            {"product_id": "P-100", "material": "seal", "qty_per_unit": 1.8},
            {"product_id": "P-200", "material": "steel", "qty_per_unit": 1.5},
            {"product_id": "P-200", "material": "copper", "qty_per_unit": 0.6},
            {"product_id": "P-200", "material": "coolant", "qty_per_unit": 0.4},
            {"product_id": "P-300", "material": "steel", "qty_per_unit": 0.8},
            {"product_id": "P-300", "material": "polymer", "qty_per_unit": 1.2},
            {"product_id": "P-300", "material": "seal", "qty_per_unit": 1.2},
        ]),
        materials_master=pd.DataFrame([
            {"material": "steel", "inventory": 900, "cost_per_unit": 18, "spot_multiplier": 1.25},
            {"material": "motor", "inventory": 140, "cost_per_unit": 44, "spot_multiplier": 1.45},
            {"material": "seal", "inventory": 1800, "cost_per_unit": 6, "spot_multiplier": 1.4},
            {"material": "copper", "inventory": 420, "cost_per_unit": 27, "spot_multiplier": 1.35},
            {"material": "coolant", "inventory": 250, "cost_per_unit": 21, "spot_multiplier": 1.3},
            {"material": "polymer", "inventory": 550, "cost_per_unit": 13, "spot_multiplier": 1.32},
        ]),
        shipping_mode=pd.DataFrame([
            {"mode": "standard", "days": 3, "cost_per_unit": 5},
            {"mode": "expedited", "days": 1, "cost_per_unit": 12},
        ]),
        qa_team_capacity=pd.DataFrame([
            {"daily_capacity_hours": 300, "overtime_hours": 110}
        ]),
        product_costing=pd.DataFrame([
            {"product_id": "P-100", "base_cost": 210, "inspection_hours_per_unit": 0.45},
            {"product_id": "P-200", "base_cost": 260, "inspection_hours_per_unit": 0.5},
            {"product_id": "P-300", "base_cost": 160, "inspection_hours_per_unit": 0.4},
        ]),
    )


def load_factory_data(excel_path: str | None = None) -> FactoryData:
    path = excel_path or os.getenv("FACTORY_EXCEL_PATH", "Hackathon Dataset.xlsx")
    if not os.path.exists(path):
        return _fallback_data()

    sheets: Dict[str, pd.DataFrame] = pd.read_excel(path, sheet_name=REQUIRED_SHEETS)
    return FactoryData(
        orders=sheets["orders"],
        production_lines=sheets["production_lines"],
        bill_of_materials=sheets["bill_of_materials"],
        materials_master=sheets["materials_master"],
        shipping_mode=sheets["shipping_mode"],
        qa_team_capacity=sheets["qa_team_capacity"],
        product_costing=sheets["product_costing"],
    )
