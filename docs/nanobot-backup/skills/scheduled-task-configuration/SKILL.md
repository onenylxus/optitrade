---
name: scheduled-task-configuration
description: Create, manage, and query scheduled tasks for trading workflows — heartbeat monitors, recurring signal checks, earnings countdowns, and market-open alerts. Use whenever the user asks to "schedule", "set a reminder", "check every X", "monitor", or "add to heartbeat".
---

## When to Use

- User asks to schedule recurring checks (e.g., "check AI4Trade signals every 30 min", "watch for stop-losses daily")
- User wants a countdown or alert before a known event (earnings date, option expiry, catalyst)
- User asks "what's scheduled?" or "check the heartbeat"
- Setting up market-open or market-close tasks
- Periodic portfolio review reminders
- Any "do X regularly" or "remind me at Y" request

## Prerequisites

Read `memory/MEMORY.md` first for current portfolio state, open positions, pending decisions, and any existing heartbeat tasks.

## Steps

### 1. Identify the Task Type

| Type | Tool | Example |
|---|---|---|
| One-time reminder | `cron` skill | "Remind me June 30 to check FIG earnings" |
| Recurring interval check | `heartbeat-monitoring` skill + script | "Check AI4Trade signals every 30 min during US market hours" |
| Countdown alert | `heartbeat-monitoring` skill | "Alert me 1 day before INTC earnings" |
| Market-open/close task | `heartbeat-monitoring` skill | "At market open, check NFLX and report" |

### 2. Set the Schedule in HKT

System timezone is **UTC+8 (HKT)**. All cron expressions and countdown targets must be in HKT unless explicitly stated otherwise.

- US market hours: **21:30–04:00 HKT** (next-day morning)
- HK market hours: **09:30–16:00 HKT**
- Cron format: `minute hour day month day-of-week`

### 3. Create the Task

**For recurring signal/market checks:**
```
Use exec to create/edit the script at:
/root/.nanobot/workspace/scripts/<task_name>.py

Example — AI4Trade signal poller (every 30 min during US hours):
/root/.nanobot/workspace/scripts/ai4trade_signal_poller.py

The script should:
1. Fetch signals from ai4trade.ai (handle read timeouts — 10s timeout)
2. Parse strategy recommendations from markdown format: ### <TICKER>: **BUY** (Score: X.X)
3. Compare against paper_portfolios.json (3-position cap, -8% stop, +15% target)
4. If actionable: write to HEARTBEAT.md as an alert
5. If nothing actionable: suppress silently
6. Run via heartbeat-monitoring at 30-min intervals
```

**For one-time reminders / countdowns:**
```
Use the cron skill:
/nanobot cron "<human-readable schedule>" "<message>"

Example: /nanobot cron "09:00 2026-06-25" "NFLX earnings today — review position before market open"
```

**For heartbeat-based monitors:**
```
Use the heartbeat-monitoring skill to register the task.
Each task should include: ticker, action type (stop-loss/target/earnings/signal), threshold, and direction.
```

### 4. Record in HEARTBEAT.md

After creating a task, append to `memory/HEARTBEAT.md` (or create it if missing):

```
## Active Monitoring Tasks

| Task | Target | Trigger | Interval | Status |
|---|---|---|---|---|
| AI4Trade signal poller | ai4trade.ai | New signal or position trigger | 30 min (US hours) | Active |
| NFLX earnings countdown | NFLX | 1 day before earnings | One-time | Pending |
| INTC collar expiry | INTC | 2026-06-28 | One-time | Pending |
```

### 5. Suppress When Idle

Trading-specific scheduled tasks should **not fire during market holidays or weekends** unless explicitly requested. Add market-hours guards in scripts or cron expressions.

### 6. Query Existing Tasks

Before creating a new task, check for conflicts:
```
read_file memory/HEARTBEAT.md
```
Deduplicate if the same ticker + trigger type is already registered.

## Output Format

When a scheduled task fires, the agent should output:

```
[Scheduled: <task_name>]
<brief one-line result>
```

If actionable:
```
[Scheduled: AI4Trade signal check]
AMD triggered target hit (+15%) — current $617.95 vs $537.37 entry. Close position? [BUY/SELL/HOLD]
```

If nothing actionable:
```
[Scheduled: AI4Trade signal check]
Nothing triggered.
```

## Example

**User**: "Check AI4Trade signals every 30 min and alert me if there's a new stock to buy"

**Agent steps**:
1. `read_file memory/MEMORY.md` → find paper portfolio, current positions, 3-position cap
2. Check if script already exists at `/root/.nanobot/workspace/scripts/ai4trade_signal_poller.py`
3. If not, create it with timeout handling, markdown parsing, and position-limit logic
4. Register as heartbeat task: "AI4Trade signal poller" — every 30 min during US market hours
5. Append to `memory/HEARTBEAT.md`
6. Confirm: "Poller registered — will alert only when there's a new buy signal or a stop-loss/target hit. Skips silently when nothing's actionable."

## Common Trading Schedules (HKT Reference)

| Event | HKT Time | Cron Expression |
|---|---|---|
| US market open | 21:30 Mon–Fri | `30 21 * * 1-5` |
| US market close | 04:00 Mon–Fri | `0 4 * * 2-6` |
| HK market open | 09:30 Mon–Fri | `30 9 * * 1-5` |
| HK market close | 16:00 Mon–Fri | `0 16 * * 1-5` |
| AI4Trade check (30 min) | Every 30 min US hours | `*/30 21-23,0-4 * * 1-5` |
