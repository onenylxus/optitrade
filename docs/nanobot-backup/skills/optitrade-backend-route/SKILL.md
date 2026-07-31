---
name: optitrade-backend-route
description: Add a new FastAPI backend route to OptiTrade — register the route, wire the router in main.py, restart the backend. Use when asked to add a new /api endpoint, create a backend data fetcher, or extend the FastAPI backend.
---

# OptiTrade Backend Route

Add a new FastAPI route to the OptiTrade backend and make it live.

## When to Use

- Asked to add a new `/api/...` endpoint
- Building a backend data fetcher powered by yfinance or other Python library
- Creating a route to serve JSON data to the frontend

## Steps

### 1. Create the Router File

Create `apps/backend/routers/<name>_router.py`:

```python
from fastapi import APIRouter
import json
import yfinance as yf

router = APIRouter()

@router.get("/price/{symbol}")
async def get_price(symbol: str):
    t = yf.Ticker(symbol)
    info = t.info
    return {
        "symbol": symbol.upper(),
        "price": info.get("currentPrice") or info.get("regularMarketPrice"),
        "change": info.get("regularMarketChangePercent"),
        "timestamp": str(info.get("regularMarketTime", "")),
    }
```

### 2. Register the Router in main.py

In `apps/backend/main.py`, import and register:

```python
from routers.<name>_router import router as <name>_router

app.include_router(
    <name>_router,
    prefix="/api/<name>",
    tags=["<name>"]
)
```

Path prefix format: `/api/<name>` (not `/api/v1/<name>`).

### 3. Restart the Backend

```bash
cd /root/optitrade-clone
pkill -f "python main.py"  # stop existing
.venv/bin/python apps/backend/main.py  # restart fresh
```

Or from the `apps/backend/` directory:
```bash
.venv/bin/python main.py
```

Verify: `curl http://127.0.0.1:8000/api/<name>/price/AAPL`

## Backend Router Pattern

Standard pattern for new routers:

```python
# routers/stock_router.py
from fastapi import APIRouter
router = APIRouter()

@router.get("/price/{symbol}")
async def get_price(symbol: str):
    ...

@router.get("/earnings/{symbol}")
async def get_earnings(symbol: str):
    ...

# main.py
from routers.stock_router import router as stock_router
app.include_router(stock_router, prefix="/api/stock", tags=["stock"])
```

## Common Mistakes

| Mistake | Fix |
|---|---|
| Forgot to restart backend after adding route | Restart with `.venv/bin/python main.py` |
| Route works in terminal but not in browser | Check firewall/port; backend listens on 127.0.0.1:8000 |
| Route not found after restart | Verify import path and `app.include_router()` call |
| yfinance returning `None` for price | Use `info.get("regularMarketPrice")` as fallback |

## Notes

- Backend path: `/root/optitrade-clone/apps/backend/`
- Startup command: `.venv/bin/python main.py` (from `apps/backend/`)
- Never use bare `python` — use the `.venv` virtual environment
- All routes are CORS-accessible from the Next.js frontend on port 3000
