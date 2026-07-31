---
name: ai4trade-signal-monitoring
description: Run the AI4Trade copy-trading signal poller on a scheduled basis, parse strategy recommendations, evaluate against the current paper portfolio (3-position cap, -8% stop, +15% target), and deliver a brief reminder to the user ONLY when actionable items exist (new signals to follow, stop-loss triggers, target-price hits). Suppress entirely when portfolio is flat and markets are closed.
---

# AI4Trade Signal Monitoring

Run the signal poller on a schedule or on-demand, evaluate positions, and report status.

## When to Use

- Scheduled heartbeat triggers (every 30 min during US market hours)
- User asks "check signals", "what's the portfolio status", or "monitor ai4trade"
- Portfolio review is needed
- After a market open/close event

## Steps

1. **Check if US market is open** — closed on weekends and US holidays (HKT ~21:30 open, ~04:00 close)
2. **Run the signal poller**: `python /root/.nanobot/workspace/scripts/ai4trade_signal_poller.py`
3. **Parse output** — poller prints markdown summary to stdout, writes dual JSON files:
   - `paper_portfolios.json` — raw paper portfolio data
   - `editable_portfolio.json` — normalized for OptiTrade PortfolioWidget (`avgPrice`, `currentPrice`, `quantity`, `symbol`)
4. **Evaluate positions**:
   - Check for stop-loss triggers (default -8%)
   - Check for target-price hits (default +15%)
   - Check for new signals from followed traders (raftapart, Hermes Crypto Trader Valery, etc.)
5. **Decide whether to deliver a reminder** (domain-specific rule):
   - **Deliver** when there are actionable items: new signals to follow, stop-loss triggers, or target-price hits
   - **Suppress entirely** when portfolio is flat AND markets are closed — do NOT report as a "status check" or "all clear" item
   - This matches Timmy's general preference for brief, actionable-only communication

## Output Format

**Flat + markets closed (suppress reminder):**
> No reminder sent — portfolio flat, market closed.

**Trigger hit (example):**
> 🚨 AMD target hit at +15%. Current: $617. Close position or trail stop?

**New signal:**
> 📡 New signal from raftapart: NVDA BUY (Score: 4.2). Current positions at capacity — skip or close existing.

## Current Portfolio (as of 2026-06-21)

- AMD LONG @ $536.75
- AVGO LONG @ $411.38
- AXP LONG @ $339.98
- Max 3 positions — do not add more until one is closed

## Example

**Scheduled run, market closed, positions flat:**
```
Agent: [runs poller at scheduled heartbeat]
     Poller output: "Markets closed (Sunday). Positions: AMD +0.12%, AVGO -0.01%, AXP -0.58%. No triggers."
Agent: [suppresses reminder — no actionable items, market closed]
```

**Trigger hit during market hours:**
```
Agent: [runs poller]
     Poller output: "AMD +15.3% — target hit. AVGO -0.3%, AXP +0.1%. No other triggers."
Agent: 🚨 AMD target hit at +15%. Close position or trail stop?
```

## Tools

- `read_file` — read poller output files if needed
- `write_file` — update `editable_portfolio.json` schema
- `exec` — run the poller script (if available in environment)