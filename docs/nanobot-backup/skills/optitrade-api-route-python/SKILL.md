---
name: optitrade-api-route-python
description: Create a Python backend data fetcher + Next.js API route for OptiTrade. Use when building a widget that needs external data (earnings, options, fundamentals), or when asked to add a new API route backed by Python/yfinance scripts.
---

# OptiTrade API Route (Python Backend → Next.js)

Pattern for adding data-fetching routes to OptiTrade.

## When to Use

- Building a widget that needs live data (earnings, options chain, financials, news)
- Asked to create a new API route backed by Python/yfinance

## Architecture

```
Python script (yfinance/fetch)
    → backend/data/<name>_data.json
        → Next.js app/api/<name>/route.ts
            → Widget component (fetch via SWR/React Query)
```

## Steps

### 1. Python Fetcher Script

Create `backend/scripts/fetch_<name>.py` using yfinance:

```python
import yfinance as yf
import json
from datetime import datetime, timedelta

# Example: earnings calendar
tickers = ["NVDA", "JPM", "NFLX", "GOOGL", "META", "MSFT", "AAPL", "AMZN", "FIG"]
results = []
for ticker in tickers:
    t = yf.Ticker(tickericker)
    # ... gather data
    results.append({...})

with open("backend/data/<name>_data.json", "w") as f:
    json.dump(results, f, indent=2, default=str)
```

### 2. Next.js API Route

`app/api/<name>/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

export async function GET() {
  const filePath = join(process.cwd(), 'backend', 'data', '<name>_data.json');
  const raw = readFileSync(filePath, 'utf-8');
  const data = JSON.parse(raw);
  return NextResponse.json(data);
}
```

### 3. Commit

Use escaped parentheses in `git add` for Next.js route app directories:

```bash
git add backend/scripts/fetch_earnings.py
git add app/api/earnings/route.ts      # works
git add 'app/\(home\)/'                 # escape parens for (home) routes
```

### 4. Cron Refresh (optional)

Add to `HEARTBEAT.md` or a cron job:

```
30 * * * * cd /path/to/optitrade && python backend/scripts/fetch_<name>.py
```

## Output Format

```
✅ Python fetcher → backend/data/<name>_data.json
✅ Next.js API route → app/api/<name>/route.ts
✅ Cron job (optional) → refresh data hourly
```

## Example

Earnings Calendar data pipeline:
- Fetcher: `backend/scripts/fetch_earnings.py` (yfinance) → `backend/data/earnings_data.json`
- Route: `app/api/earnings/route.ts` reads that JSON
- Widget: `earnings-widget.tsx` fetches from `/api/earnings`

## Notes

- Data is JSON file-based, not live API-to-API. Python runs on a schedule, writes JSON, Next.js reads it.
- No auth on `/api/<name>` routes — internal use only.
- `default=str` in `json.dump` to handle datetime serialization.