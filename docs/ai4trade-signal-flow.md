# AI4Trade Signal-to-Trade Flow & Bug Audit

**Last updated:** 2026-07-09 17:06 HKT
**Poller:** `apps/backend/scripts/ai4trade_signal_poller.py`
**DB module:** `apps/backend/src/db.py`
**State file:** `/root/.nanobot/workspace/logs/ai4trade_poller_state.json`
**Cron:** `afc54318` (every 30 min, `deliver:false`)
**EOD review:** `6dab36f1` (Thursday 06:30 HKT)

---

## Part 1 — End-to-End Flow (v5, with Phase 4 enrichment)

```
[ai4trade.ai platform]
  8+ AI agents 各自出 strategy messages
                ↓
  Aggregated signal feed
                ↓
[1. Signal Ingest]                    ──── 30 min cron 觸發
  GET /api/signals/feed?limit=15
  → raw signals (timestamp, agent, content, market)
                ↓
[2. Dynamic Follow-List Resolution]   ──── 4h cache TTL
  cache hit? → return cached list
  cache miss → GET /api/signals/grouped?market=us-stock
                ↓
  filter: signal within 72h, signal_count ≥ 50
  merge: PINNED (raftapart) + top 5 by signal_count
                ↓
  SQLite: follow_list_cache(id, list_json, refreshed_at)
  log: resolved follow_list
                ↓
[3. Signal Parsing]                   ──── 硬性 SKIP gate
  parse_strategy_content(content)
  → list of {symbol, side, score, price, raw_content}
                ↓
[4. Pre-enrichment Hard Filters]      ──── 全部 return SKIP shape
  ┌─ check 1: BLACKLIST_SYMBOLS (MU) ──────── SKIP, no enrichment
  ├─ check 2: signal age ≤ 15 min ────────── SKIP, no enrichment
  ├─ check 3: market ∈ {us-stock} ────────── SKIP, no enrichment
  ├─ check 4: live price exists ──────────── return None (retry)
  └─ check 5: |live − entry| ≤ 1.5% ──────── SKIP
                ↓
[5. Scoring Layer]                    ──── base 0
  +3 agent_score ≥ 7
  +2 agent_score ≥ 5
  +1 agent_score ≥ 4
  +2 |live − entry| ≤ 0.5%
  +1 |live − entry| ≤ 1.5%
  +1 market = us-stock
  +1 keyword match in (earnings/FDA/M&A/squeeze/...)
                ↓
[6. ENRICHMENT GATE — Phase 4 analytical layer]
  enrich_signal(sym, side, agent_score, price, market, raw_content)
                ↓
  ┌─ trend analysis (yfinance 6mo daily)
  │    cached 5min
  │    compute: price, SMA20, SMA50, SMA200, trend
  │    trend ∈ {strong_up, up, sideways, down, strong_down}
  │
  ├─ our history on this symbol (SQLite)
  │    COUNT/SUM/AVG over paper_trades WHERE symbol=? AND status='closed'
  │    count ≥ 2 AND avg > +1%  → +1
  │    count ≥ 2 AND avg < -3%  → -1
  │
  ├─ market regime (SPY)
  │    cached 10min
  │    SPY down + LONG  → -1 + risk flag
  │    SPY up + LONG    → reason (+supportive)
  │
  └─ catalyst classification (regex)
       BEAT 8% / MISS 4% / FDA APPROVAL → strong label
       THEMED (any kw)                  → generic label
       NONE                             → risk flag
                ↓
  return {score_bonus, reasons, risks, enrich_notes(JSON), thesis}
                ↓
[7. Analytical Veto]
  score = base_score + score_bonus
                ↓
  if score ≥ MIN_SCORE_FOLLOW (=4)
     AND ≥2 risk flags
     AND score_bonus ≤ -1
     → demote FOLLOW → WATCH
     → score -= 2 (但保留 ≥ MIN_SCORE_REPORT=2)
                ↓
[8. Decision]
  score < 2           → SKIP
  2 ≤ score < 4       → WATCH
  score ≥ 4           → FOLLOW
                ↓
[9. Signal Log Persistence]            ──── AUDIT TRAIL
  log_signal(received_at, agent, symbol, side, agent_score,
              market, raw_content, parsed_action, score,
              entry_price, live_price, skip_reasons(JSON),
              enrich_notes(JSON), thesis)
                ↓
  SQLite: signal_log table (UNIQUE INDEX on agent+symbol+created_at+side)
  13 indexes: (id, received_at, agent_name, symbol)
                ↓
  ⚠ 關鍵：FOLLOW/WATCH/SKIP 都會 log 入 signal_log
                ↓
[10. Position-level Gates]
  ☐ open count < MAX_POSITIONS (=4)
  ☐ 1 symbol not already open (MAX_POSITIONS_PER_SYMBOL=1)
                ↓
[11. Volatility-Adaptive Stop/Target]
  intraday_range = yfinance 5d daily (today)
  if range > 8%: stop/target = 7.5% / 15% (1.5x)
  else:          stop/target = 5% / 10%
                ↓
[12. Open Trade]
  signal @ entry, stop @ entry·0.95, target @ entry·1.10
  quantity = TRADE_QUANTITY = 50
                ↓
[13. DB Write — upsert_paper_trade()]
  row {
    id = "paper-{sym}-{YYYY-MM-DD-HH}",
    agent, symbol, side, entry_price, stop_loss, target_price,
    quantity = 50,                ← fixed 2026-07-09 (was 10)
    status = 'open',
    pnl_pct = 0,
    current_price = live,
    notes = {thesis + risks + strategy playbook},
    strategy = "AI4Trade — {agent}",
    signal_log_id = ev['_signal_log_id'],   ← NEW: audit linkage
    partial_tp_taken = 0,                    ← NEW: TP flag
    created_at, updated_at, closed_at = null,
  }
                ↓
[14. Position Monitoring — every 30 min]
  for each open position:
    fetch live_price (yfinance → FMP fallback)
                ↓
    live-flush: current_price, pnl_pct, updated_at
                ↓
    check triggers:
      • stop_loss  hit → close @ stop  (STOP_LOSS)
      • target     hit → close @ target (TARGET_HIT)
      • stagnation (≥3d, PnL ∈ [-2%, +3%]) → close @ market
      • partial TP (+5%, not yet taken) → emit PARTIAL_TP signal
      • PnL swing ≥ ±3%                 → emit notification
                ↓
[15. State-File Diff → Discord Notification]
  atomic write: ai4trade_poller_state.json
                ↓
  diff previous vs current:
    new open? new close? PnL swing?  → NOTIFY (diff) line
    nothing changed?                  → silent (cron deliver:false)
                ↓
[16. Retention Sweep — end of every pass]   ──── 30d purge
  DELETE FROM signal_log     WHERE received_at  < now-30d
  DELETE FROM news_articles  WHERE created_at   < now-30d
  DELETE FROM news_analyses  WHERE article_id IN (old articles)
  DELETE FROM price_cache    WHERE fetched_at   < now-30d
  ── preserved indefinitely ──
  paper_trades   (audit trail, ~50 rows/month)
  follow_list_cache, editable_portfolio
                ↓
[17. PortfolioWidget Render]
  GET /api/paper-trading/history
                ↓
  FastAPI → SQLite paper_trades table
  → JSON { open: [...], closed: [...], stats: {...} }
                ↓
  Widget displays:
    • Open: ticker, qty, entry, live, PnL%
    • Closed: exit_reason filter, win/loss bars
    • "Why I entered" section ← reads notes field
    • Aggregate: total PnL, win rate, avg hold
```

---

## Part 2 — Bug Audit (post-2026-07-09 fix pass)

### Fixed (commit `66bc80f`)

| # | Bug | Severity | Fix |
|---|---|---|---|
| 1 | **`build_trade_row` quantity mismatch** — wrote 10 shares instead of 50 per AI4Trade 2026 Aggressive spec | CRITICAL | Added `TRADE_QUANTITY = 50` constant; migrated any existing open trades from 10 → 50 |
| 2 | **`signal_log` no dedup** — same signal could be logged twice across cron passes within freshness window | HIGH (DB integrity) | Added `UNIQUE INDEX uq_signal_log_dedup` on `(agent_name, symbol, created_at, side)`; `log_signal()` now SELECTs existing first, falls back to `INSERT OR IGNORE` with race-condition recovery |
| 3 | **No audit linkage from trade → signal_log** — couldn't answer "why did we open this trade?" | MEDIUM | Added `paper_trades.signal_log_id` column; `build_trade_row()` threads `ev["_signal_log_id"]` through; both schema migrations are idempotent |
| 4 | **No SQLite retention** — `signal_log` would grow to ~13k rows/month unbounded | MEDIUM | Added `run_cleanup()` invoked at end of every poller pass; purges `signal_log`/`news_articles`/`news_analyses`/`price_cache` older than 30 days; preserves `paper_trades` (audit trail) and `follow_list_cache`/`editable_portfolio` |
| 5 | **Schema migration was manual** — adding columns required one-shot SQL | LOW (workflow) | `db.init_schema()` now also runs `_run_migrations()` for idempotent `ALTER TABLE ADD COLUMN`; auto-upgrades existing DBs on next poller pass — no manual SQL |

### Verification (all passing)

```
Test 1: Idempotent schema migration  → ✓
Test 2: build_trade_row              → ✓ quantity=50, signal_log_id=42, partial_tp=0
Test 3: dedup                        → ✓ same id returned, no warning
Test 4: 30-day retention             → ✓ 45d-old purged, recent kept
Test 5: paper_trades preserved       → ✓ 13 rows unchanged
Test 6: end-to-end main() pass       → ✓ second pass silent (state diff)
```

### Open issues (not yet fixed)

| # | Issue | Severity | Notes |
|---|---|---|---|
| 6 | **FMP fallback may not function** — `FMP_API_KEY` is on legacy plan, `stable/quote-v1` endpoint blocked since Aug 31 2025 | MEDIUM | Need Polygon or Alpha Vantage fallback when yfinance is stuck |
| 7 | **Enrichment doesn't batch yfinance calls** — each signal fetches its own 6mo daily, cache mitigates but doesn't eliminate | LOW | Pre-warm cache for all open symbols + signal symbols before enrichment loop |
| 8 | **Widget doesn't render `enrich_notes`** — trend/history/regime data lands in DB but UI doesn't surface it | LOW | Add collapsible "Analysis" section to PortfolioWidget reading enrich_notes JSON |
| 9 | **Enrichment uses daily close during market hours** — SMA50 intraday is unstable | LOW | Cache TTL (5 min) covers this; but should ensure price is from previous close |
| 10 | **Veto logic too aggressive** — `score_bonus ≤ -1` AND ≥2 risks triggers demote, but `+3 + -1 = 2` is still reasonable | LOW | Switch to ratio-based: `|score_bonus| / base_score > 0.5` |
| 11 | **No slippage model** — `entry_price = signal.entry`, real fills will drift 0.05%+ | LOW (paper) | Add 0.05% slippage constant for realism |
| 12 | **`build_trade_row` doesn't write `signal_log_id` in upsert path** — only on create | LOW | Verify upsert path includes the new column (code reviewed, but not runtime-tested with concurrent open) |

---

## Part 3 — Configuration Constants (snapshot 2026-07-09)

```python
# Position sizing
MAX_POSITIONS          = 4        # USER.md says 5 (slots); code uses 4 (aggressive)
MAX_POSITIONS_PER_SYMBOL = 1
TRADE_QUANTITY         = 50       # shares per signal (was 10, fixed 2026-07-09)

# Blacklist
BLACKLIST_SYMBOLS      = {"MU"}   # 1 win / 7 losses-or-flat, 12.5%
ALLOWED_MARKETS        = {"us-stock"}

# Signal freshness
SIGNAL_MAX_AGE_MINUTES = 15       # tightened from 6h on 2026-07-09
SAME_SYMBOL_COOLDOWN_HOURS        = 24   # post-win
SAME_SYMBOL_LOSS_COOLDOWN_HOURS   = 72   # post-loss

# Stops / targets
DEFAULT_STOP_PCT       = 5.0
DEFAULT_TARGET_PCT     = 10.0
STAGNATION_DAYS        = 3
STAGNATION_LOW         = -2.0
STAGNATION_HIGH        = +3.0
PARTIAL_TP_PCT         = 5.0
PNL_ALERT_PCT          = 3.0      # re-notify threshold

# Scoring (base score, before enrichment bonus)
MIN_SCORE_FOLLOW       = 4        # FOLLOW threshold
MIN_SCORE_REPORT       = 2        # WATCH threshold

# Retention
SQLITE_RETENTION_DAYS  = 30       # purged tables: signal_log, news_*, price_cache
```

---

## Part 4 — Quick Reference

### Where to find things

| What | Path |
|---|---|
| Poller script | `/root/optitrade-clone/apps/backend/scripts/ai4trade_signal_poller.py` |
| DB module | `/root/optitrade-clone/apps/backend/src/db.py` |
| State file | `/root/.nanobot/workspace/logs/ai4trade_poller_state.json` |
| Run log | `/root/.nanobot/workspace/logs/ai4trade_poll.log` |
| Cron | `afc54318` (30 min) + `6dab36f1` (Thu 06:30 HKT EOD) |
| SQLite DB | `/root/optitrade-clone/apps/backend/data/optitrade.db` |
| GitHub | https://github.com/onenylxus/optitrade (master) |

### Useful queries

```sql
-- Recent FOLLOW decisions
SELECT received_at, agent_name, symbol, side, score, thesis
FROM signal_log
WHERE parsed_action = 'FOLLOW'
ORDER BY received_at DESC LIMIT 20;

-- Top skipped signals (potential missed opportunities)
SELECT received_at, agent_name, symbol, score, skip_reasons
FROM signal_log
WHERE parsed_action = 'SKIP' AND score >= 3
ORDER BY received_at DESC LIMIT 20;

-- Per-agent actionable signal rate (7d)
SELECT agent_name,
       COUNT(*) AS total,
       SUM(CASE WHEN parsed_action='FOLLOW' THEN 1 ELSE 0 END) AS follows
FROM signal_log
WHERE received_at > datetime('now', '-7 days')
GROUP BY agent_name
ORDER BY follows DESC;

-- Retention check (should be ~13.5k rows max for signal_log)
SELECT COUNT(*) FROM signal_log;

-- Open positions + signal_log audit linkage
SELECT pt.id, pt.symbol, pt.quantity, pt.pnl_pct,
       sl.agent_name, sl.thesis
FROM paper_trades pt
LEFT JOIN signal_log sl ON pt.signal_log_id = sl.id
WHERE pt.status = 'open';
```