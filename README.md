# SYNK — Rush Order Negotiation Demo

Yes — you can run this locally on `localhost`.

## Quick start

1. Open a terminal in this folder.
2. Start a local static server:

```bash
python3 -m http.server 4173
```

3. Open your browser at:

- `http://localhost:4173`

## Are we truly multi-agent, or just rule-based math?

Short answer: **both**.

- It **is a multi-agent system architecture**:
  - Separate departmental agent modules (Production, Procurement, Logistics, Quality, Finance).
  - Shared context memory object that each agent reads/writes each round.
  - Orchestrator agent that checks consensus thresholds and decides whether to continue rounds.
  - Parallel execution pattern for department agents per round (`Promise.all`).
- It currently uses **deterministic policy logic** inside each agent (not LLM reasoning yet).
- This is intentional for hackathon reliability: transparent, testable behavior with an LLM-ready control loop.

So this is a **multi-agent protocol simulation with rule-based brains**.

## How to use

1. Fill in the rush order fields (product, quantity, due days, price, margin floor).
2. Click **Run Negotiation**.
3. Review:
   - Agent decisions (Production, Procurement, Logistics, Quality, Finance, Orchestrator)
   - Negotiation timeline (round-by-round)
   - Shared context memory snapshot
   - Human approval dashboard with margin/risk/trade-offs

## Optional stress test scenario

Click **Load Stress Scenario** and then **Run Negotiation**.

## Notes

- This is a static HTML/CSS/JS app (no backend required).
- If port `4173` is in use, run on another port:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.
