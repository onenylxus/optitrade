---
name: ai4trade-copy-trading
description: Poll ai4trade.ai signals feed → parse strategy recommendations → sync positions to OptiTrade PortfolioWidget. Use when user asks about copy-trading setup, ai4trade signal pipeline, or wants to manage the automated signal poller.
---

# AI4Trade Copy-Trading Workflow

## Context

- **Platform**: ai4trade.ai — AI signal marketplace, follow traders, competitions
- **Agent ID**: OptiTrade (14163)
- **Token**: `9dYToQwfOLY1paF6FX6s2MhnkrG9Hypdn5LH_S1WtsA`
- **API base**: `https://ai4trade.ai/api`
- **Poller script**: `/root/.nanobot/workspace/scripts/ai4trade_signal_poller.py`

## When to Use

- User asks to set up / check / modify the ai4trade copy-trading pipeline
- Signal poller errors or falls behind schedule
- User wants to review current copied positions
- Adding new leader to follow

## Steps

### 1. Poll Signals Feed

```bash
curl -s -H "Authorization: Bearer 9dYToQwfOLY1paF6FX6s2MhnkrG9Hypdn5LH_S1WtsA" \
  "https://ai4trade.ai/api/signals/feed"
```

### 2. Parse Strategy Content

The `strategy` type feed returns markdown. Extract per-symbol signals:

```
### AMD: **BUY** (Score: 4.2)
### AVGO: **SELL** (Score: 3.8)
```

Regex pattern (escape `+` as literal `\+` in Python string):
```python
import re
pattern = r"###\s+([A-Z]{1,5}):\s+\*\*(\w+)\*\*\s+\(Score:\s+([\d.]+)\)"
matches = re.findall(pattern, content)
```

### 3. Filter Signals

Apply copy criteria:
- Score ≥ 3
- US stocks only (NYSE/Nasdaq tickers)
- Max 3 open positions
- No duplicates for symbols already held

### 4. Fetch Live Prices

For each candidate, fetch current price via `stock_data.py` or yfinance:

```python
import yfinance as yf
ticker = yf.Ticker(symbol)
price = getattr(ticker.fast_info, 'last_price')
```

### 5. Sync to Portfolio Widget

Dual-write to both files:

**`paper_portfolios.json`** (own record):
```json
{
  "positions": [
    {"symbol": "AMD", "side": "LONG", "entry_price": 536.75, "live_price": 545.00, "quantity": 10}
  ]
}
```

**`editable_portfolio.json`** (PortfolioWidget schema):
```json
[
  {"symbol": "AMD", "avgPrice": 536.75, "currentPrice": 545.00, "quantity": 10}
]
```

Path: `/root/.nanobot/workspace/optitrade/backend/data/`

### 6. Execution Defaults

- **Stop-loss**: -8% from entry
- **Target**: +15% from entry
- **Quantity**: 10 shares (placeholder — adjust by capital allocation)

## Output Format

```
📡 AI4TRADE COPY-TRADING STATUS

Leader: raftapart
Copied positions: 3/3 max
  AMD  LONG  @ $536.75  current $545.00  +1.5%
  AVGO LONG  @ $411.38  current $408.20  -0.8%
  AXP  LONG  @ $339.98  current $342.10  +0.6%

Signal poller: ✅ Running (every 30 min)
Last poll: <timestamp>
```

## Example

```
curl .../api/signals/feed
→ {"type":"strategy","content":"### AMD: **BUY** (Score: 4.2)\n### MSFT: **BUY** (Score: 3.5)"}

Parse → AMD (BUY, 4.2), MSFT (BUY, 3.5)
Filter → Both pass (score ≥ 3, US stocks, <3 positions)
Fetch live prices → AMD $545, MSFT $412
Sync → Update editable_portfolio.json with both positions
```