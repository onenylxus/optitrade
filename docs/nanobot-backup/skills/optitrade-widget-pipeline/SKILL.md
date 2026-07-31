---
name: optitrade-widget-pipeline
description: Build the full data pipeline for OptiTrade dashboard widgets — Python/yfinance → JSON file → Next.js API route → Widget component. Use when asked to add a new data-driven widget, build a widget data pipeline, or connect external data to a widget.
---

# OptiTrade Widget Data Pipeline

Build a complete end-to-end data pipeline for dashboard widgets.

## When to Use

- Adding a new widget that needs live or scheduled data
- Creating a data-fetching API route for a widget
- Extending existing widgets with new data sources

## Architecture

```
yfinance (Python fetcher)
    → apps/backend/data/<name>_data.json
        → apps/frontend/app/api/<name>/route.ts
            → Widget component (SWR/fetch)
```

## Steps

### 1. Python Fetcher Script

Create `apps/backend/scripts/fetch_<name>.py`:

```python
import yfinance as yf
import json
from datetime import datetime

def fetch_data():
    tickers = ["NVDA", "AAPL"]
    results = []
    for ticker in tickers:
        t = yf.Ticker(ticker)
        info = t.info
        results.append({
            "symbol": ticker,
            "price": info.get("currentPrice") or info.get("regularMarketPrice"),
            "change": info.get("regularMarketChangePercent"),
            "timestamp": datetime.now().isoformat(),
        })
    return results

data = fetch_data()
with open("apps/backend/data/<name>_data.json", "w") as f:
    json.dump(data, f, indent=2, default=str)
```

Run manually: `cd /root/optitrade-clone && .venv/bin/python apps/backend/scripts/fetch_<name>.py`

### 2. Backend API Route (FastAPI)

In `apps/backend/main.py`, add router and route:

```python
from fastapi import APIRouter
import json

router = APIRouter()

@router.get("/price/{symbol}")
async def get_price(symbol: str):
    # Read from JSON or fetch directly with yfinance
    with open("apps/backend/data/<name>_data.json") as f:
        data = json.load(f)
    item = next((x for x in data if x["symbol"] == symbol.upper()), None)
    return item or {"error": "not found"}
```

Register router in `main.py`:
```python
app.include_router(router, prefix="/api", tags=["price"])
```

**Restart backend**: `.venv/bin/python apps/backend/main.py` (from `/root/optitrade-clone`)

### 3. Next.js API Route

`apps/frontend/app/api/<name>/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

export async function GET() {
  const filePath = join(process.cwd(), '..', 'backend', 'data', '<name>_data.json');
  const raw = readFileSync(filePath, 'utf-8');
  return NextResponse.json(JSON.parse(raw));
}
```

### 4. Widget Component

`apps/frontend/components/dashboard/<name>-widget.tsx`:

```typescript
'use client';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function NameWidget() {
  const { data } = useSWR('/api/<name>', fetcher, { refreshInterval: 60000 });
  if (!data) return <div>Loading...</div>;
  return <div>{/* render data */}</div>;
}
```

### 5. Register Widget

In `fixtures.ts`:
1. Add to `WidgetType` enum
2. Add default span (e.g., `{ width: 4, height: 5 }`)
3. Add to `widgetLibrary`

In `WidgetRenderer.tsx`:
- Import the widget
- Add case in switch/if to render it by type

### 6. Git Add (Path Escaping)

```bash
cd /root/optitrade-clone
git add apps/backend/scripts/fetch_<name>.py
git add apps/frontend/app/api/<name>/route.ts
git add apps/frontend/components/dashboard/<name>-widget.tsx
# Escape parentheses in app directory names:
git add 'apps/frontend/app/\(home)/'  # if modified
```

## Output Format

```
✅ Python fetcher → apps/backend/data/<name>_data.json
✅ Backend FastAPI route → /api/<name> (restart required)
✅ Next.js API route → /api/<name>
✅ Widget component → apps/frontend/components/dashboard/<name>-widget.tsx
✅ Widget registration → fixtures.ts + WidgetRenderer
```

## Example

`/api/price/MU` — fetches Micron live price from yfinance JSON backend:
- Fetcher: `fetch_prices.py` → `prices_data.json`
- Route: `GET /api/price/{symbol}`
- Widget: `market-overview-widget.tsx` displays it
