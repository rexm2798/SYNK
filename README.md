# SYNK — Rush Order Negotiation Demo

This repo now includes:
- A visual frontend demo (`index.html`, `styles.css`, `script.js`)
- A FastAPI backend with a shared-memory multi-agent negotiation loop (`backend/`)
- Optional Groq LLM summarization layer (for negotiation narrative)

## 1) Run frontend on localhost

```bash
python3 -m http.server 4173
```

Open: `http://localhost:4173`

## 2) Run backend API (Excel + agents)

Install dependencies:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Run API:

```bash
uvicorn backend.main:app --reload --port 8000
```

Open API docs: `http://localhost:8000/docs`

## 3) Configure data source

By default backend tries to read `Hackathon Dataset.xlsx` from repo root.
You can override with:

```bash
export FACTORY_EXCEL_PATH="/absolute/path/Hackathon Dataset.xlsx"
```

If file/sheets are missing, backend uses built-in fallback synthetic data for demo continuity.

## 4) Groq LLM integration (optional)

Set your key in environment (do **not** hardcode keys in code):

```bash
export GROQ_API_KEY="<your_key_here>"
```

Backend uses model `openai/gpt-oss-120b` via `from groq import Groq` to generate a concise negotiation summary.

## API example

```bash
curl -X POST http://localhost:8000/rush-order \
  -H "Content-Type: application/json" \
  -d '{
    "product_id":"P-200",
    "quantity":1200,
    "deadline_days":2,
    "price":360,
    "margin_floor":18
  }'
```
