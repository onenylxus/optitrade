---
name: ai4trade-scheduled-check
description: Run the AI4Trade signal poller on a schedule, evaluate paper portfolio against rules, and deliver a brief reminder only when actionable. Use for automated scheduled checks or on-demand portfolio reviews.
---

## When to Use

- Automated scheduled check (triggered by heartbeat/cron or user request)
- On-demand review of AI4Trade copy-trading portfolio
- Do NOT run during weekend/holiday US market closes — skip silently

## Steps

1. **Market hours check**
   - If US market is closed (weekend/holiday) → silent skip, no output

2. **Run the poller script**
   ```
   exec → python /root/.nanobot/workspace/scripts/ai4trade_signal_poller.py
   ```
   - Uses 10s timeout (ai4trade.ai is prone to read timeouts)

3. **Read paper portfolio**
   ```
   read_file → /root/optitrade-clone/apps/backend/data/paper_portfolios.json
   ```
   - Schema: `avgPrice` (entry), `currentPrice` (live), `quantity`, `symbol`

4. **Evaluate each position** (AMD, AVGO, AXP — 10 shares each)
   - Stop-loss: currentPrice ≤ avgPrice × 0.92 (−8%)
   - Target hit: currentPrice ≥ avgPrice × 1.15 (+15%)
   - If either → output actionable item

5. **Check signal feed**
   - Parse strategy array from ai4trade response
   - If new signals exist AND portfolio < 3 positions → output signal + action
   - If portfolio at 3-position limit (full) → auto-skip, no signal output

6. **Output**
   - Actionable: brief message (e.g., "AVGO hit +15% target — lock in gains?", "AMD approaching stop-loss at $537")
   - Nothing triggered: `All clear. Flat, no triggers.`
   - Weekend/closed: silent skip

## Portfolio Rules

| Rule | Value |
|------|-------|
| Max positions | 3 (currently full) |
| Stop-loss | −8% |
| Target | +15% |
| Shares per trade | 10 |

## Output Format

**Actionable:**
> `{TICKER}` {hit target at +X% / approaching stop-loss at $X} — {suggestion}

**All clear:**
> All clear. Flat, no triggers.

## Example

```
# Script output: AVGO currentPrice $473.09, avgPrice $411.38 → +15.0% target hit
AVGO hit +15% target ($473 vs $411 entry) — close position or hold?

# All positions within bounds, no new signals, portfolio full
All clear. Flat, no triggers.
```

## Key Rules

- Max 3 positions — auto-skip new signals when full
- Stop-loss: -8%, Target: +15%
- No status reports or PnL percentages in normal output
- Use `All clear. Flat, no triggers.` only when nothing is actionable
- GitHub sync is automatic after each poller run
