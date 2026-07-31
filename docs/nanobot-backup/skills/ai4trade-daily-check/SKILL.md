---
name: ai4trade-daily-check
description: Run the AI4Trade signal poller once, evaluate paper portfolio, deliver a brief reminder. Use for scheduled daily checks at ~07:04 HKT or on-demand.
---

## When to Use

- Scheduled daily check (~07:04 HKT, before US market open)
- On-demand check via heartbeat or user request
- Do NOT run during weekend/holiday closes — skip silently

## Steps

1. **Run the poller script**
   ```
   exec → python /root/.nanobot/workspace/scripts/ai4trade_signal_poller.py
   ```

2. **Read paper portfolio**
   ```
   read_file → /root/optitrade-clone/apps/backend/data/paper_portfolios.json
   ```

3. **Evaluate for each position** (AMD, AVGO, AXP — all 10 shares)
   - Stop-loss trigger: currentPrice ≤ avgPrice × 0.92 (−8%)
   - Target hit: currentPrice ≥ avgPrice × 1.15 (+15%)
   - If either → output actionable item

4. **Check signal feed**
   - Parse strategy array from ai4trade response
   - If new signals exist AND portfolio < 3 positions → output signal + action
   - If portfolio at 3-position limit (full) → auto-skip, no signal output

5. **Output**
   - Actionable: brief message (e.g., "AVGO hit +15% target — lock in gains?", "AMD approaching stop-loss at $537")
   - Nothing triggered: "All clear. Flat, no triggers."
   - Weekend/closed: silent skip

## Output Format

**Actionable:**
> `{TICKER}` {hit target at +X% / approaching stop-loss at $X} — {suggestion}

**All clear:**
> All clear. Flat, no triggers.

## Example

```
# Script output shows AVGO: currentPrice $473.09, avgPrice $411.38 → +15.0% target hit
AVGO hit +15% target ($473 vs $411 entry) — close position or hold?
```

## Key Rules

- Max 3 positions — auto-skip new signals when full
- Stop-loss: -8%, Target: +15%
- No status reports or PnL narration in normal output
- Use `All clear. Flat, no triggers.` only when nothing is actionable
