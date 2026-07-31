---
name: ai4trade-signal-poller
description: Run the AI4Trade signal poller script, auto-follow raftapart signals meeting the score threshold, open positions with computed stop-loss/target, scan existing positions for stop/target triggers, and sync the paper portfolio to OptiTrade's PortfolioWidget. Use for cron-driven or on-demand AI4Trade copy-trading checks.
---

# AI4Trade Signal Poller

## When to Use
- Scheduled (cron) AI4Trade copy-trading signal checks
- On-demand portfolio review triggered by user
- Pre-trade validation of a raftapart signal before opening a position
- Checking whether any open position hit stop-loss or target

## Steps

### 1. Run the Poller
```bash
python /root/.nanobot/workspace/scripts/ai4trade_signal_poller.py
```

10s timeout (ai4trade.ai is prone to read timeouts). Script returns empty during off-hours — that's expected, no action needed.

### 2. Parse Signals
Output is markdown strategy content. Look for `### TICKER: **BUY/HOLD/SELL** (Score: X.X)` blocks. Per-symbol entries include direction, score, and any explicit SL/target.

### 3. Auto-Follow raftapart Signals
For signals from `raftapart` with score ≥ 4.5★ AND a portfolio slot available:
- Open LONG at the signal price (current price from poller output)
- Compute stop-loss and target if not explicit:
  - Stop-loss: -5% below entry
  - Target: +10% above entry
- Append to `paper_portfolios.json` with quantity 50 (per AI4Trade 2026 Aggressive Strategy)
- Scale-up: at +5% gain, add 50% more shares automatically

### 4. Scan Open Positions for Triggers
For each open position, check current price vs SL/target:
- **Stop-loss hit** → close position, record realized PnL, mark `status: "closed"` with `exitReason: "stop_loss"`
- **Target hit** → close position, record realized PnL, mark `status: "closed"` with `exitReason: "target"`
- Custom stop override: per-position stops (e.g. -8% on AVGO) take precedence over default -5%

### 5. Dual-Write Portfolio JSON
Sync positions to BOTH files so PortfolioWidget renders real-time prices:
- **Paper portfolio** (canonical): `/root/optitrade-clone/apps/backend/data/paper_portfolios.json`
- **Editable portfolio** (normalized for widget): `/root/optitrade-clone/apps/backend/data/editable_portfolio.json`

Schema per position:
```json
{
  "symbol": "AMD",
  "quantity": 50,
  "avgPrice": 536.75,
  "currentPrice": 524.01
}
```

### 6. Git Sync (manual only)
Auto-commit price-only changes is **disabled** — cron must NOT push to GitHub.
Only commit portfolio JSON when user explicitly requests a sync:
```bash
cd /root/optitrade-clone && git add apps/backend/data/ && git commit -m "..." && git push
```

### 7. Report (per USER.md)
Follow brief output discipline:
- **New position opened** → "Opened TICKER LONG @ $X.XX (score X.X★, SL $X.XX, target $X.XX)"
- **Stop triggered** → "Stop hit: TICKER @ $X.XX (PnL -X.XX%)"
- **Target hit** → "Target hit: TICKER @ $X.XX (PnL +X.XX%)"
- **No new signals, no triggers** → "Nothing triggered." (skip position counts and PnL)
- **At position cap (5 slots)** → "At 5-slot limit — skipped N signal(s)"
- **Market closed / off-hours** → suppress report entirely

## Current Strategy State (2026-06-26)
- **Capital**: $100K | **Slots**: 5 | **Deployed**: 99.8%
- **Stop-loss**: -5% default (per-position override supported)
- **Target**: +10%
- **Trailing stop**: activates at +5% gain, trails 3% from peak
- **Position sizing**: 50 shares per new signal; +50% at +5% gain
- **Followed traders (6)**: Hermes Crypto Trader Valery, ProfitBot-100, Btc8219Trader, 爱马仕-AI, HashClaw, Vyom
- **Primary US-stock source**: raftapart (4.5★ threshold)

## Open Positions (as of 2026-06-26 17:06)
- AMD LONG @ $536.75 (SL $510.41, target $590.43)
- AXP LONG @ $339.98 (SL $322.98, target $373.98)
- MU LONG @ $1,220.62 (SL $1,159.59, target $1,342.68)

## Process Discipline
- Always re-fetch live prices before reporting PnL (no reusing old numbers)
- Flag open positions approaching stop-loss even when "no new signals" reported — "no triggers" output underreports actionable items
- Brief mention + flag is fine; long WARNING that overrides USER.md format is NOT fine
- If `editable_portfolio.json` is missing from version control, untrack it first: `git rm --cached apps/backend/data/editable_portfolio.json`

## Output Format
```
# Discord / plain text — short sentences
Opened MU LONG @ $1,220.62 (score 4.5★, SL $1,159.59, target $1,342.68)

# WebSocket — openui-lang format
root = Callout(message="Opened MU LONG @ $1,220.62", variant="success")
```

## Example
```bash
$ python /root/.nanobot/workspace/scripts/ai4trade_signal_poller.py

=== AI4Trade Signal Poller ===
Portfolio: ai4trade_hermes | Strategy: HermesTradingX

### MU: **BUY** (Score: 4.5★) [raftapart]
Entry: $1,220.62 | SL: $1,159.59 | Target: $1,342.68
```

Poller output: 1 new signal from raftapart at 4.5★. Portfolio has 2 open slots used (AMD, AXP). Auto-followed: opened MU LONG @ $1,220.62, dual-wrote JSON, no commit.

Report: "Opened MU LONG @ $1,220.62 (score 4.5★, SL $1,159.59, target $1,342.68)"
