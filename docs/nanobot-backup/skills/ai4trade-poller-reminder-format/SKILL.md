---
name: ai4trade-poller-reminder-format
description: Format and deliver AI4Trade poller cron reminders. Read poller output → if no NOTIFY diff block or contains "No material change since last run", reply exactly "Flat, no triggers." and exit; if NOTIFY (diff) block present, emit one line per event (OPENED / STOP_LOSS / TARGET_HIT / STAGNATION_EXIT / PARTIAL_TP / PnL ±3% moves). Never include portfolio summary, market status, "Open: X / Y slots free", "Done" / "Reminded" tags, user IDs, or progress narration. Use when reading ai4trade poller stdout/log to compose a reminder, or when the cron fires and delivers output that needs to be reshaped into the user's preferred format.
---

# AI4Trade Poller Reminder Format

Canonical reminder format for the AI4Trade signal poller cron job. The poller script (`/root/optitrade-clone/apps/backend/scripts/ai4trade_signal_poller.py`) writes a state-file diff; the agent must reshape that output into the user's preferred brief style before delivery.

## When to use

- The 30-min cron (`ai4trade-signal-poller-sqlite`, id `afc54318`) fires and stdout appears in the chat
- Reading `/root/.nanobot/workspace/logs/ai4trade_poll.log` for a scheduled run output
- Any on-demand `ai4trade_signal_poller.py` invocation that produced stdout to be relayed

## Decision tree

```
Read poller output
   │
   ├─ Contains "No material change since last run"?
   │     → Reply exactly: "Flat, no triggers."  (and stop)
   │
   ├─ Contains "AI4Trade Poller END" with NO preceding NOTIFY (diff): block?
   │     → Reply exactly: "Flat, no triggers."  (and stop)
   │
   └─ Contains NOTIFY (diff): block?
         → Parse events; emit one line per event (see Event Format below)
         → Do NOT add anything else (no header, no summary, no footer)
```

## Event Format

Each NOTIFY diff event becomes exactly one line. Event types:

| Event | Format |
|-------|--------|
| `OPENED` | `<SIDE> <SYMBOL> @ <price> (SL <sl>, TP <tp>, score <n>/5, source: <agent>)` |
| `STOP_LOSS` | `STOP_LOSS <SYMBOL> @ <price> (<pnl%>)` |
| `TARGET_HIT` | `TARGET_HIT <SYMBOL> @ <price> (<pnl%>)` |
| `STAGNATION_EXIT` | `STAGNATION_EXIT <SYMBOL> @ <price> (<pnl%>, <days>d flat)` |
| `PARTIAL_TP` | `PARTIAL_TP <SYMBOL> @ <price> (took <X>%, remaining <Y>%)` |
| `PnL ±3%` | `PnL <SYMBOL> <±X.XX>% @ <price>` |

Multiple events → multiple lines, in the order the poller emitted them.

## Hard rules (never violate)

- ❌ No portfolio summary (open positions, closed PnL, slot count)
- ❌ No market status ("market closed", "reopens in …")
- ❌ No `Open: X / 5 slots free` line
- ❌ No `Done` / `Reminded` / `Done — reminded` / progress tags
- ❌ No user IDs (Discord ID, telegram ID, etc.)
- ❌ No preambles (`Here's`, `Let me`, `Status report:`)
- ❌ No portfolio recap at the top or bottom
- ❌ No bullet lists (just one line per event, separated by newlines)
- ✅ Silent runs → exactly `Flat, no triggers.` and exit

## Output examples

### Example 1 — Silent run (most common, ~95% of cron fires)

Poller stdout:
```
=== AI4Trade Poller @ 2026-07-13T10:14 HKT ===
[checks complete]
AI4Trade Poller END
No material change since last run.
```

Agent response:
```
Flat, no triggers.
```

### Example 2 — Position opened

Poller stdout includes:
```
NOTIFY (diff):
  OPENED: LONG TSLA @ 409.47 (SL 389.00, TP 450.42, score 5.0/5, source: raftapart)
```

Agent response:
```
LONG TSLA @ 409.47 (SL 389.00, TP 450.42, score 5.0/5, source: raftapart)
```

### Example 3 — Stop-loss + partial TP

Poller stdout includes:
```
NOTIFY (diff):
  STOP_LOSS: LIN @ 504.01 (-4.93%)
  PARTIAL_TP: AAPL @ 198.50 (took 5.0%, remaining 95%)
```

Agent response:
```
STOP_LOSS LIN @ 504.01 (-4.93%)
PARTIAL_TP AAPL @ 198.50 (took 5.0%, remaining 95%)
```

### Example 4 — Anti-example (do NOT produce this)

```
✅ Poller run complete!

Summary:
• 4 open positions, 13 closed, PnL -10.08%
• Market is open (US equities)
• Open: 1 / 5 slots free

Events:
• LONG TSLA @ 409.47

Done — reminded.
```

The above violates: header, portfolio summary, market status, slot count, progress tag, and "Done" footer. Never produce this.

## Edge cases

- **Multiple agents' signals on same run**: emit one `OPENED` line per signal; do not group them
- **Same-symbol OPENED + STOP_LOSS in same diff**: emit both lines in diff order (rare, usually one or the other)
- **Malformed event line in NOTIFY block**: emit the raw line as-is rather than guessing — better to be literal than to fabricate fields
- **Poller errors / exceptions**: still respect brief format — one line on the failure, no stack traces in the reminder

## Source of truth

This rule is captured in SOUL.md `排程信號檢查紀律` → `AI4Trade poller reminder 格式（2026-07-09）`. If the SOUL.md rule changes, this skill should be regenerated to match.