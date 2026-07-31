---
name: ai4trade-signal-polling
description: Run the AI4Trade signal poller to fetch copy-trading signals, parse recommendations, evaluate against paper portfolio rules, and sync positions to OptiTrade's PortfolioWidget. Use when user asks about copy-trading checks, ai4trade signal results, or wants to manually trigger the signal poller.
---

# AI4Trade Signal Polling

## When to Use
- Manual or scheduled copy-trading signal checks
- Evaluating whether new recommendations fit current portfolio rules
- Syncing paper portfolio positions to OptiTrade's PortfolioWidget display

## Steps

### 1. Run the Poller
```bash
python /root/.nanobot/workspace/scripts/ai4trade_signal_poller.py
```

Uses 10s timeout (ai4trade.ai is prone to read timeouts).

### 2. Parse Signals
The script outputs markdown strategy content. Look for:
```
### AMD: **BUY** (Score: 7.8)
### AXP: **BUY** (Score: 7.5)
```

Parse per-symbol recommendations from the strategy markdown.

### 3. Evaluate Against Portfolio Rules
| Rule | Limit |
|------|-------|
| Max positions | 3 |
| Stop-loss | -8% |
| Target | +15% |
| Quantity | 10 shares per trade |

- If at 3-position limit → skip new BUY signals (cannot add)
- Check existing positions: any hitting -8% stop or +15% target?
- Signal score threshold: no fixed cutoff — use judgment relative to existing portfolio

### 4. Sync to OptiTrade
Dual-write to both files so PortfolioWidget shows real-time prices:
- **Paper portfolio**: `/root/optitrade-clone/apps/backend/data/paper_portfolios.json`
- **Editable portfolio**: `/root/optitrade-clone/apps/backend/data/editable_portfolio.json`

Schema per position:
```json
{
  "symbol": "AMD",
  "quantity": 10,
  "avgPrice": 536.75,
  "currentPrice": 537.37
}
```

To version-control `editable_portfolio.json`:
```bash
# Remove from gitignore then untrack
git rm --cached apps/backend/data/editable_portfolio.json
```

### 5. Report
Only speak when actionable:
- **New BUY signal** → "New signal: TICKER (Score: X.X)"
- **Stop-loss hit** → "Stop triggered: TICKER"
- **Target hit** → "Target hit: TICKER"
- **No action** → "All clear. Flat, no triggers."
- **At limit, signal skipped** → brief note only if user asks

## Output Format
```
# Discord / plain text: short sentences
All clear. Flat, no triggers.

# WebSocket: openui-lang format
root = Callout(message="All clear. Flat, no triggers.", variant="info")
```

## Example
```
$ python /root/.nanobot/workspace/scripts/ai4trade_signal_poller.py

=== AI4Trade Signal Poller ===
Portfolio: ai4trade_hermes | Strategy: HermesTradingX

### AMD: **BUY** (Score: 7.8)
### AVGO: **HOLD** (Score: 6.5)
```

Current paper portfolio has AMD, AVGO, AXP (3/3 positions). AMD BUY skipped — at limit.
