# Real-Time AI Negotiation Engine for Rush Orders

## One-Line Pitch

We built a real-time AI negotiation engine that compresses cross-functional factory decision-making from **24 hours to 30 seconds** with full financial and operational transparency.

## Personas

1. **Sales Manager** — needs instant customer commitment
2. **Production Planner** — owns capacity and schedule
3. **Procurement Lead** — owns material availability and supplier costs
4. **Logistics Manager** — owns shipping feasibility
5. **Quality Head** — owns compliance and inspection
6. **Finance Controller** — owns margin floor
7. **Plant Head (Approver)** — final human decision-maker

## Core Product User Stories

### 1) Rush Order Submission

**As a Sales Manager**, I want to input a rush order (quantity, deadline, price, SLA) so I can instantly know whether we can commit.

**Acceptance Criteria**
- Order fields: `product_id`, `quantity`, `due_date`, `price`
- System triggers all departmental agents simultaneously
- Initial response generated in < 30 seconds

### 2) Parallel Department Evaluation

**As the System**, I want Production, Procurement, Logistics, Quality, and Finance agents to evaluate in parallel to reduce decision time from hours to seconds.

**Agent Data Inputs**
- Production → `production_lines`, `orders`
- Procurement → `bill_of_materials`, `materials_master`
- Logistics → `shipping_mode`
- Quality → `qa_team_capacity`
- Finance → `product_costing`

**Each agent returns**
- Feasibility (`yes`/`no`)
- Constraints
- Trade-off proposals

### 3) Negotiation Loop

**As a Department Agent**, I want to propose trade-offs so I can move from “No” to “Conditional Yes.”

- **Production Agent:** simulate delaying Order `#4471` by 2 days to free machine-hours
- **Procurement Agent:** compute incremental material demand and spot-buy impact
- **Finance Agent:** recompute margin and validate against floor (18%)

### 4) Impact Recalculation

**As the Orchestrator Agent**, I want to aggregate all trade-offs and recompute:
- Updated margin
- Capacity impact
- Risk score
- SLA risk probability

**Acceptance Criteria**
- Recompute after each negotiation round
- Display delta vs baseline plan
- Stop when consensus thresholds are met

### 5) Human-in-the-Loop Approval

**As Plant Head**, I want a transparent dashboard for final approval/rejection.

**Dashboard Example**
- Margin: `21%` (Floor: `18%`)
- Delayed Order: `#4471 (+2 days)`
- Extra Material Cost: `+$14,000`
- Risk Score: `Medium`
- Shipping Mode: `Air Freight`

## Agent-to-Agent Negotiation Stories

### Shared Memory

**As an Agent**, I want shared context memory so I can read other agents’ constraints before responding.

Examples:
- Production sees margin impact from Finance
- Finance sees shipping cost from Logistics
- Procurement sees QA bottlenecks

### Consensus Mechanism

**As the System**, I want to auto-detect consensus and exit the loop when all thresholds are satisfied:
- Margin ≥ 18%
- QA load within daily capacity
- Delivery date achievable
- Production schedule feasible
- No high-priority order displaced beyond SLA

## Data-Driven Stories (Synthetic Factory Dataset)

### Capacity Conflict
- Rush requirement: 1200 units
- Line A capacity: 800/day
- Existing load: 90%
- Production proposes overtime or controlled displacement

Tables: `production_lines`, `orders`, `max_units_per_day`

### BOM Explosion
- Rush order needs 200 units of Component X
- Inventory = 50 units
- Spot supplier multiplier = 1.4x

Tables: `bill_of_materials`, `materials_master`

### Shipping Trade-Off
- Standard shipping: 3 days, $5/unit
- Expedited shipping: 1 day, $12/unit

Table: `shipping_mode`

### QA Constraint
- Inspection hours per unit: 0.5
- Rush quantity: 1000
- QA capacity: 300 hrs/day
- Quality recommends overtime window

Tables: `qa_team_capacity`, `inspection_hours_per_unit`

### Margin Stress
- Base margin: 34%
- Post trade-offs margin: 21%
- Margin floor: 18%
- Finance verdict: viable

Table: `product_costing`

## Demo Storyboard

Narration:
> “Today, when a rush order comes in, five departments email each other. We simulate that entire conversation using AI agents in real time.”

Live flow:
1. Enter rush order
2. Agents evaluate in parallel
3. Production pushes back on capacity
4. Procurement proposes spot-buy
5. Finance recalculates margin
6. Orchestrator synthesizes recommendation
7. Plant Head approves or rejects

Closing line:
> “What used to take 24 hours now takes 30 seconds.”

## Advanced Extensions

1. **Strategy Simulation Mode**
   - Aggressive Growth → margin floor = 15%
   - Conservative Margin → no order displacement

2. **Learning Memory**
   - Log accepted rush orders, realized profit, SLA breaches

3. **Customer Agent**
   - Evaluate penalty clauses, long-term value, relationship score
   - Enables cross-enterprise negotiation
