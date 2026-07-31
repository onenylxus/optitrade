# User Profile

## Basic Information

- **Name**: Timmy
- **Timezone**: UTC+8 (HK)
- **Language**: Traditional Chinese (Cantonese/HK style, written) for casual + English tech terms inline; English/Mandarin for deep analysis; concise status tables with PnL% and price triggers; **terse trading-system notifications (e.g. AI4Trade poller reminders) accept English** as the channel-specific default
- **Paper portfolio (AI4Trade 2026 Aggressive)**: 5 slots, -5% stop-loss, +10% target, 50 shares per signal (full details in MEMORY.md)
- **AI4Trade poller `force=False`**: User runs the follow-list reconciliation with `force=False` — only explicitly followed agents generate trades; pinned agents (raftapart) still preserved despite chronic staleness rather than being force-demoted
- **AI4Trade agent identity**: User's active us-stock trading agent is registered as `XingHuo-Trader` on ai4trade.ai
- **Trading bot ID ambiguity (2026-07-27; verify)**: A setup note identifies `TradingBot_MYT` as the trading bot ID, but the platform agent identity is `XingHuo-Trader`; `TradingBot_MYT` also appears in follow-list auto-expansion history. Clarify whether it is a separate local bot/process ID or an identity change.
- **Trading philosophy**: "signal is signal" — follow any valid signal regardless of source agent; wants data-driven dynamic follow-list
- **Test-after-change**: User wants a test run after every code change to verify behavior before declaring done
- **Pre-execution analytical gate**: Wants validation of thesis/regime/risks before executing OR discarding trades
- **Audit completeness**: All signal decisions (FOLLOW/WATCH/SKIP) must be recorded to DB regardless of outcome for full audit trail

## Communication Preferences

- **Language**: Traditional Chinese (Cantonese/HK style, written) for casual; English/Mandarin for analysis; expects concise status tables with PnL% and price triggers
- **Style**: Brief and direct — no status reports, no preambles, no user IDs, no progress narration, no summaries
- **Response length**: 1-2 sentences max for routine checks; depth only when asked
- **Channel routing**: Discord → plain text; WebSocket → openui-lang declarative UI
- **Discord EOD summary channel ID**: `1493855604031225876` (scheduled end-of-day trading summaries delivered here)

## Special Instructions

- If nothing actionable, just say it briefly (e.g., "Nothing triggered.")
- **Action over discussion**: Prefers "OK, do it" — give concrete actions rather than lengthy deliberations; one-sentence confirmation suffices
- **No preambles**: No "Here's" / "Let me" / "Status report:" / "Done" / "Reminded" tags — just respond directly with the content or "Flat, no triggers."
- Do not add bullet lists for routine checks
