---
name: market-closed-alert-skip
description: Skip detailed reports when US equities market is closed — respond briefly instead
---

## When to Use
- AI4Trade signal poller returns empty results during evening/overnight hours
- Market clock shows US equities closed (after 16:00 EST / before 09:30 EST)
- User asks for a check but market is not open

## Steps
1. Check if US equities market is open (09:30–16:00 EST, Mon–Fri, not a holiday)
2. If **market open**: proceed with full check, evaluate positions, report actionable items
3. If **market closed**: respond with single brief message — no position counts, no P&L, no lists
4. Never list underwater positions or stop-loss proximity when market is closed

## Output Format
- **Market open**: Full evaluation — signals, position status, actionable items
- **Market closed**: `Market closed — no signals.` (or equivalent in user's language)

## Examples
```
Market closed — no signals.
```
```
市埸收盤了，沒有信號。
```
```
Market closed. Next open: Mon 09:30 EST.
```

## Notes
- This prevents useless "all positions underwater" reports when market is closed
- The poller script returns empty results when market is closed — use that as the signal
- If market is open but no signals triggered → `Nothing triggered. All clear.`
- Suppress entirely only when both conditions are true: market closed AND portfolio flat
