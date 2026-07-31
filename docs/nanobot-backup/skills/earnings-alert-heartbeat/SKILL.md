---
name: earnings-alert-heartbeat
description: Register upcoming earnings dates as Heartbeat monitoring tasks with countdown so WebSocket alerts fire at market open on earnings day.
---

# Earnings Alert Heartbeat Integration

## When to Use

- User asks about a stock with upcoming earnings
- User wants to sell covered calls around earnings but hasn't set a reminder
- A new earnings date is identified (confirmed from calendar or options chain)
- After identifying a stock with a confirmed earnings date (confirmed, not estimated)

## Steps

```
1. Confirm earnings date from reliable source (FMP, yfinance, options chain)
2. read_file /root/.nanobot/workspace/HEARTBEAT.md
3. Add entry with format:
   - [EARNINGS] {TICKER} Q{quarter} {year} — {date} (X days away)
4. If user is considering a covered call on this stock:
   - Add a note: "CC consideration — strike TBD"
   - Remind user to decide before 5-7 DTE window closes
5. On earnings day (or at market open):
   - Send WebSocket alert to user
   - If no reply in 1-2 hours → follow up with brief summary
6. After earnings → update HEARTBEAT.md with result (beat/miss) and remove entry
```

## Earnings Date Quality Rules

- **Confirmed**: yfinance `earningsDates`, FMP API, or actual earnings announcement → add to heartbeat
- **Estimated (whisper)**: Only from options chain or analyst estimate → flag as `[EARNINGS EST]`, do not add to heartbeat until confirmed
- **Never add speculative earnings dates** — false alarms break trust

## HEARTBEAT.md Entry Format

```
Last check: 2026-05-14 09:00 HKT
- [EARNINGS] FIG Q1 2026 — 2026-05-14 (TODAY) ⚡
- [EARNINGS] COHR Q2 2026 — 2026-05-22 (~8 days)
- [CATALYST] MU earnings beat confirmed — awaiting confirmation of entry
```

## Follow-Up Protocol

```
Earnings day alert → No reply in 2 hours:
→ Send brief follow-up:
  "FIG Q1 2026 earnings today. Result: missed beat. Current price action: -X%."
  Include: new price, whether CC strike was hit, what to watch overnight
```

## Key Rules

- **Use heartbeat for tracking, not prompting**: HEARTBEAT.md is a monitoring file, not a task queue — do not put action items that nanobot will execute as prompts
- **Earnings alert → don't assume user saw it**: Always follow up if no reply, especially for high-stakes events
- **Remove entries after resolved**: Don't keep strike-through entries — delete once complete

## Example

**Input**: "Let me set up a covered call on FIG before earnings next week"

**Assistant action**:
```
1. Confirm FIG earnings date: 2026-05-14 (yfinance earningsDates)
2. Today is 2026-05-09 — 5 days away (within the 5-7 DTE window ✓)
3. Write to HEARTBEAT.md:
   - [EARNINGS] FIG Q1 2026 — 2026-05-14 (5 days) | CC consideration: $21.5 strike
4. Warn: "5 DTE is tight — if you want to sell the $21.5 call, you'd need to enter by tomorrow (5/13 or early 5/14 pre-market). At current IV, premium will be ~$73 for 2 contracts."
```

## Output Format

```
## Earnings Alert Registered — {TICKER}

| Field | Value |
|-------|-------|
| Company | {name} |
| Quarter/Year | Q{x} {year} |
| Date | {YYYY-MM-DD} |
| Days Away | {N} |
| Status | [CONFIRMED / ESTIMATED] |
| CC Consideration | Strike TBD — decide by {date-5} |

✅ Added to HEARTBEAT.md — alert will fire at market open on {date}
```
