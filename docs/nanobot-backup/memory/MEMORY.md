# Long-term Memory  ← 19d

## User — Timmy  ← 19d
- **Primary broker**: IBKR (portfolio tracking)  ← 19d
- **Secondary broker**: 富途 (Futu) — HK options context (INTC collar, FIG covered call)  ← 19d

## OptiTrade Setup  ← 19d
- **Repo**: https://github.com/onenylxus/optitrade (branch: master)  ← 19d
- **Clone path**: `/root/optitrade-clone` (single clone, not duplicated elsewhere)  ← 16d
- **Repo owner**: Nicholas Ng (onenylxus@gmail.com)  ← 16d
- **Backend**: FastAPI on `apps/backend/` (Python/uv) → http://127.0.0.1:8000  ← 19d
- **Frontend**: Next.js on `apps/frontend/` → http://127.0.0.1:3000  ← 19d
- **Backend env vars**: `FMP_API_KEY`, `OPENROUTER_API_KEY`, `GOOGLE_APPLICATION_CREDENTIALS`  ← 19d
- **Frontend env vars**: `NEXT_PUBLIC_BACKEND_URL`, Firebase config (7 vars)  ← 19d
- **Firebase project**: optitrade-hku; service account JSON at `apps/backend/optitrade-hku-firebase-adminsdk.json`  ← 19d
- **Backend startup**: `.venv/bin/python main.py` (not `next` or bare `python`)  ← 19d
- **Frontend startup**: `pnpm dev -H 0.0.0.0` from `apps/frontend/`  ← 19d
- **Backend router pattern**: `app.include_router(stock_router, prefix="/api/stock", tags=["stock"])` — register new routers in `main.py`  ← 16d
- **Backend restart required**: After adding new `/api/price` or other route, restart backend with `.venv/bin/python main.py`  ← 16d
- **Git path workaround**: Escape parentheses in `git add` for Next.js route directories — e.g., `git add 'app/\(home)/'` for `app/(home)/`  ← 16d
- **Git squash strategy**: User prefers squash (reset --hard + force push) to keep commit history clean; insists commits fully removed via reset --hard + force push, NOT revert commits. Lesson: reset target must be origin/master, not local branch tip  ← 16d
- **Git rebase resolution (2026-07-08)**: optitrade master now at commit `95ca418` "AI4Trade poller: aggressive rotation + SQLite live-flush fix" after linear rebase of 5 remote-only commits (8326752, 39d5976, 08ff284, 39b8bf2, 6358629 — all from another machine/worktree), no conflicts; replaced rejected local commit `8390c9d`
- **Non-fast-forward push lesson**: when local commit rejected because origin has newer commits from a different machine/worktree that appear legitimate, use `git pull --rebase` rather than force-push — user's squash+force-push preference does NOT apply when remote commits are legitimate work (preserves remote history)
- **apply_patch tool quirk**: requires relative paths in this environment; for absolute paths (e.g. `/root/optitrade-clone/...`), switch to shell `cat << EOF > file.patch` redirect workaround

### Frontend API Routes  ← 16d
- **Location**: `apps/frontend/app/api/<route>/route.ts`  ← 16d
- **Pattern**: Next.js App Router — use `GET` handler, return `NextResponse.json()`  ← 16d
- **File path resolution**: Next.js API routes using relative paths like `../backend/...` fail at runtime; always use absolute paths like `/root/optitrade-clone/apps/backend/data/...` for file system operations  ← 16d
- **Routes**: `/api/paper-trading/history`, `/api/prediction/daily`  ← 16d
- **Data pipeline**: Python/yfinance → JSON file → Next.js API route → Widget component  ← 16d

### Widgets  ← 16d
- **Location**: `apps/frontend/components/dashboard/`  ← 16d
- **Registration**: `fixtures.ts` (WidgetType enum, spans, widgetLibrary) — must add enum + library entry  ← 16d
- **Renderer**: `WidgetRenderer` wired for all widget types (paper-trading-history, daily-prediction)  ← 16d

### Market Clock Widget  ← 19d
- **File**: `apps/frontend/components/dashboard/market-clock-widget.tsx`  ← 19d
- **Requirements**: smaller analogue clock (keep widget size), must show hour/minute/second hands (時針分針秒針), must handle US holidays/weekends with correct reopen time  ← 19d
- **Layout**: status text (e.g. "Sunday — reopens in 25:34") and time must be side-by-side horizontal flex, not vertically stacked  ← 18d
- **SVG bug fixes**:  ← 19d
  - `y1`/`y2` in `describeArc`/`PhaseArc` used `Math.cos` instead of `Math.sin` → arcs rendered as flat ovals  ← 19d
  - Hour hand used 12h scale (`hrs % 12`) causing 2 rotations/24h → fixed to 24h scale `((hrs + min/60) / 24) * 360`  ← 19d
  - `minutesToAngle` must normalize wrapped values (e.g. 1290 min for 21:30) with modulo  ← 19d
  - Multiple EDT/EST/HKT timezone conversion fixes (7 commits)  ← 16d
- **Path resolution**: nanobot file ops on OptiTrade repo need explicit `/root/optitrade-clone/` prefix  ← 19d

## Market Context & Analysis (2026)  ← 19d

### Semiconductor / AI Hardware  ← 19d
- **MU** (Micron): blacklisted from follow list 2026-07-09 after 8 re-entries with 12.5% win rate (see AI4Trade Tier 1 filter constants) — early-2026 "low PE + HBM leader" thesis invalidated by trade outcomes
- **QCOM**: Best AI hardware dividend stock; ~2.2% yield, $0.86/quarter, $20B buyback, Forward PE 8.75x  ← 19d
- **NVDA**: Extremely expensive PE — bubble territory; TSM/QCOM more reasonably valued  ← 19d
- **SMH**: Preferred semiconductor ETF (NVDA 22% weight, $23B AUM) over SOXX/SOXQ/XSD  ← 19d
- **Semiconductor bubble assessment**: Rally backed by real GPU demand but valuations optimistic; retail rotated from crypto ETFs into semiconductor ETFs  ← 19d

### Sector Coverage  ← 19d
- **Investor consensus**: Burry bearish, Druckenmiller cautious near-term bullish long-term TSM, Buffett all-cash, Howard Marks cautious  ← 19d

## AI4Trade Copy-Trading  ← 19d
- **Platform**: ai4trade.ai (github.com/HKUDS/AI-Trader) — base URL `https://ai4trade.ai/api`, auth via `Authorization: Bearer {token}` from `POST /api/claw/agents/selfRegister` or `/api/claw/agents/login`; default cash $100K, agent starts 1000 points
- **Platform endpoints**:
  - `/api/signals/feed` — raw, filters: `sort=active|following`, `market=us-stock`, `keyword=...`
  - `/api/signals/grouped?limit=20` — per-agent leaderboard with `signal_count` / `last_signal_at` / `latest_signal_id` / `latest_signal_type`; `total_pnl` always null
  - `/api/signals/{agent_id}` — per-agent history
- **Platform features**: Polymarket paper trading with real market data + simulated execution (since 2026-03-03); yfinance fallback for US stock prices when Alpha Vantage unavailable (since 2026-06-08)
- **Signal poller internal parsing agents**: y_0e5d199d, Antigravity_0e5d199d, Claude-Opus — used internally by the poller to parse/structure recommendations from the signal feed (distinct from the followed-source agents on the feed itself)
- **Script**: `/root/optitrade-clone/apps/backend/scripts/ai4trade_signal_poller.py` (SQLite-backed, moved from nanobot workspace 2026-07-06)
- **Cron change (2026-07-09)**: removed `ai4trade-signal-poller-sqlite` (id `dee715aa`, `deliver:true`); replaced with `ai4trade-signal-poller-sqlite` (id `afc54318`, `deliver:false`, every 30 min) — reminder format spec lives in SOUL.md / ai4trade-poller-reminder-format skill
- **Exact poller scheduled-task shell command** (manual repro): `cd /root/optitrade-clone/apps/backend/scripts && .venv/bin/python ai4trade_signal_poller.py >> /root/.nanobot/workspace/logs/ai4trade_poll.log 2>&1` — appends to `ai4trade_poll.log`; uses venv interpreter (NOT system `python3`)
- **User scheduled reminder (2026-07-31)**: 16:30 HKT daily reminder to execute AI4Trade signal poller script (`/root/optitrade-clone/apps/backend/scripts/ai4trade_signal_poller.py`)
- **Run cadence (corrected 2026-07-12)**: poller fires on a 30-min cron schedule (NOT top-of-hour) — observed runs at 09:44, 10:14 HKT on 2026-07-12 confirm 30-min interval; silent runs (e.g. 2026-07-15T15:00 → 0 recommendations) standard during market-closed/low-signal periods
- **Poller health check**: alert fires if last poller run > 90 minutes (≈3 missed 30-min slots); Friday 19:00 HKT trading-workflow health check runs via nanobot — checks poller cadence + follow-list health (separate from per-run poller schedule). Friday health check is **silent by default** — alerts only fire on anomalies (last poller run >90 min gap, or errors in poller log); healthy runs produce no notification.
- **EOD review cron `6dab36f1`**: `30 6 * * 4` (Thursday 06:30 HKT), purpose = weekly review of Tier 1 vs Tier 2 filter hit rates
- **State file (2026-07-09)**: `/root/.nanobot/workspace/logs/ai4trade_poller_state.json`; atomic tmp-replace writes; `compute_diff()` compares previous state against current
- **NOTIFY diff trigger criteria (2026-07-27)**: `compute_diff()` only emits NOTIFY on **new open position, new close (any exit type), or ±3% PnL swing** vs prior state — the criteria producing "Flat, no triggers." fallback when none fire (silent runs = no material change); distinct from the 15-min signal-age staleness filter and 72h loss cooldown, which suppress trades but do NOT emit NOTIFY events
- **Log file**: `/root/.nanobot/workspace/logs/ai4trade_poll.log`; DB: `apps/backend/data/optitrade.db`
- **`sqlite3` CLI unavailable** on system — use Python `sqlite3` module for ad-hoc queries: `python3 -c "import sqlite3; con=sqlite3.connect('/root/optitrade-clone/apps/backend/data/optitrade.db'); ..."`
- **GitHub sync DISABLED**: AI4Trade poller does NOT auto-commit to git — only commit on explicit user request
- **Schema**: `avgPrice` ← entry price, `currentPrice` ← live price, `quantity` ← shares, `symbol` ← ticker  ← 19d
- **Tier 1 filter constants (2026-07-08/09, tightened 2026-07-10)**: `BLACKLIST_SYMBOLS={"MU"}` (blacklisted 2026-07-09 after 8 re-entries, 12.5% win rate), `MIN_SCORE_FOLLOW=4`, `MAX_POSITIONS=4` (poller cap — UI shows total "5 slots free" with 5th slot reserved for manual/proactive), `MAX_POSITIONS_PER_SYMBOL=1`, `SAME_SYMBOL_COOLDOWN_HOURS=24` (tightened from 48 on 2026-07-10), `TRADE_QUANTITY=50` shares, signal age ≤15 min, |live−entry| filter ≤1.5%
- **Stagnation / partial-TP**: `STAGNATION_DAYS=3`, `STAGNATION_LOW=-2.0%`, `STAGNATION_HIGH=+3.0%`, `PARTIAL_TP_PCT=5.0`
- **2026-07-10 hardening additions**: `MIN_SCORE_REPORT=2` (separate reporting tier below `MIN_SCORE_FOLLOW=4`), `SAME_SYMBOL_LOSS_COOLDOWN_HOURS=72` (loss-specific cooldown — supersedes general `SAME_SYMBOL_COOLDOWN_HOURS=24` for 72h after closing a position at a loss; has a 3h grace window before the lockout activates, so signals within the first 3h after a loss-close can re-enter the same symbol), enrichment trend cache TTL=5min, SPY regime cache TTL=10min
## Editable Portfolio Table (separate from paper_trades)
- **Table**: `editable_portfolio` in `apps/backend/data/optitrade.db`
- **Purpose**: user-managed copy portfolio — distinct from `paper_trades` which tracks AI4Trade copy-trading auto-entries
- **Tracked positions (as of 2026-07-10)**: AXP, AVGO, AMD, MU — 4 long positions
- **Key columns**: `symbol`, `quantity`, `avgPrice`, `currentPrice`, side/signal metadata

## AI4Trade Poller Schema & Config
- **paper_trades schema additions**: `signal_log_id INTEGER` (FK→signal_log) + `partial_tp_taken INTEGER DEFAULT 0`; both MUST be in `upsert_paper_trade()` cols tuple (root cause of prior 50→10 quantity bug)
- **signal_log dedup**: UNIQUE INDEX `uq_signal_log_dedup` on (agent_name, symbol, created_at, COALESCE(side,'')); INSERT OR IGNORE + SELECT existing returns same id within same transaction
- **build_trade_row notes**: writes thesis + risks block + strategy playbook into `notes` field (TEXT) — widget reads this for "Why I entered"

## Follow List & Filtering
- **Follow list is dynamic**: always reconcile against runtime state via `reconcile_follow_list_cache()`; auto-expansion adds/removes actively-publishing us-stock agents on each pass; pinned agents (raftapart) always preserved regardless of freshness; dropped agents (e.g. ClawTrader-Henry, GenericAgentLearner_049_77e407, HermesCodyAgent2) can reappear once they resume signal activity; see dated snapshots below for concrete base membership at specific points in time
- **US-stock recommendation tag `[kk-song]`** (in reminder output): poller prefixes us-stock recommendations from `kk-song` agent (and similar actively-publishing us-stock agents) with `[kk-song]` tag in reminder output — visual marker distinguishing us-stock signal source from crypto/other categories; aligns with us-only scope guardrail (crypto entries suppressed)
- **raftapart signal staleness**: signals chronically exceed 15m max age threshold — all raftapart recommendations skipped on every poller run; agent remains pinned on follow list but never produces actionable signals; US-stock portion no longer actionable, scope guardrail doesn't help when all signals are skipped due to age; consider whether to keep pinned or demote to logged-only
- **Bullroom repeated polling (2026-07-27 ~13:55 HKT)**: Bullroom was polled 11× in a single poller run — possible misconfiguration in the per-agent fetch loop; investigate duplicate agent IDs or repeated calls in the parse/recommendation pass.
- **Test-agent filter `_is_test_agent()`**: excludes names with `MockAgent`/`TestAgent_`/`E2E_`/`VerifyFix_`/`RET_` prefixes or `_test_` substring (also `FinalE2E_*`, `AuditE2E_*`, `FinalClean_*`)

## AI4Trade API Gotchas
- `/api/signals/feed?market=X` and `/api/signals/grouped?limit=N` return SPA HTML, not JSON — call `fetch_signals(limit=20)` (no market filter) at `ai4trade_signal_poller.py:288`
- Correct names: `fetch_signals`/`fetch_agent_leaderboard` (NOT `fetch_feed`)
- `fetch_signals` MUST pass `market="us-stock"` query param (missing prior wasted quota on crypto)
- **Recurring ai4trade.ai read timeouts (13+ tracked incidents 2026-07-15 → 2026-07-24, all port 443 read timeout 10s on /api/signals/feed and /api/signals/grouped, daily-cadence systemic pattern)**: HTTPSConnectionPool read timed out after 10s during poller runs on 2026-07-15 22:00, 2026-07-16 ~14:00, 2026-07-17 ~01:00, 2026-07-18 ~15:43, 2026-07-19 ~07:30, ~10:00, ~13:00, ~15:25 HKT, 2026-07-20 ~19:30, ~20:30 HKT, 2026-07-23 ~02:30, 2026-07-24 ~10:00 HKT — symptoms: leaderboard fetches returned `[]`, signal fetch returned empty, partial-failure state; poller continues with fallback behavior (no crash, empty results fully processed); prioritize retry/backoff in `fetch_signals`/`fetch_agent_leaderboard` (still unimplemented)
- **ai4trade.ai HTTP 500 errors (2026-07-28 13:00 HKT poller run)**: both `/api/signals/feed` and `/api/signals/grouped` returned 500 — distinct failure mode from the documented 10s read-timeout pattern; poller fallback behavior TBD (empty results vs explicit error path)

## Recent Bug Fixes (commit `66bc80f`, 2026-07-10)
- `notifications_emitted` UnboundLocalError → use `bool(diff_msgs)` instead of mutable flag
- Daily-cap query: `skip_reasons LIKE '%proactive%'` → `agent_name='proactive_scan'`
- `reconcile_follow_list_cache()` removes stale cached entries; pinned agents always preserved

## Commits Pushed to master (2026-07-10)
- `f7dd5e1` — market filter + auto-expand
- `d37d44e` — signal_log_id linkage + test-agent filter
- `cfc5fa4` — proactive_scan engine + reconcile + test patterns (+298 lines)
- `66bc80f` — critical bug fixes (quantity, dedup, signal_log_id, 30-day retention)

## Proactive Scan (commit `cfc5fa4`, SUGGEST-ONLY)
- **Universe**: 30 stocks (already in MEMORY.md); indicators = SMA20/50/200, RSI(14), MACD(12,26,9), Bollinger Bands(20,2), ATR(14); market regime via SPY/QQQ/VIX; sector rotation XLK/XLF/XLE/XLV
- **Position sizing**: 50 shares; stop=2×ATR; target=max(5%, 3×ATR); daily cap=2; symbol cooldown=4h; formula = min(equity × 10%, 2 × ATR distance × shares)
- **Thresholds**: LONG = RSI≤35 + price>SMA200 + MACD>0; SHORT = RSI≥70 + price<SMA200 + MACD<0
- **Current issue**: veto logic too strict — macd often stays negative → engine rarely fires; ratio-based fix pending

## Out-of-Scope Non-Critical Issues (Pending)
- FMP fallback risk; enrichment batch issue; widget not rendering enrich_notes; intraday SMA staleness; veto logic too strict (see Proactive Scan)

## Recent AI4Trade Observations (2026-07-28 → 2026-07-30)
- **AI Hedge Fund v2 0-recommendation pattern (2026-07-28 ~10:30 HKT)**: AI Hedge Fund v2 returned 0 recommendations parsed across multiple scan iterations — same 0-recommendation pattern as Antigravity_0e5d199d (per 16:30 HKT observation below); both signal streams currently yield no actionable recommendations despite being reachable.
- **Antigravity_0e5d199d parsing behavior (2026-07-28 16:30 HKT)**: Antigravity_0e5d199d source is reachable but consistently parses 0 recommendations from signal feed — distinct from raftapart which produces stale-but-present signals (skipped on age), and from upstream ai4trade.ai HTTPS timeouts which return empty results at the HTTP layer; Antigravity_0e5d199d is one of the internal parsing agents listed under "Signal poller internal parsing agents".
- **Follow-list snapshot 2026-07-29 11:20+ HKT**: 7-agent base = AI Hedge Fund v2, Antigravity_0e5d199d, ClawTrader-minimax-m2.5, HermesCodyAgent2, ginaaa, kk-song, raftapart — ginaaa added between 10:13 and 11:20 HKT; supersedes 6-agent 10:13 HKT snapshot.
- **Follow-list snapshot 2026-07-30 00:04 HKT**: 10-agent base = AlpacaBot, Antigravity_0e5d199d, Bullroom Official AAPL Strategy Agent 2, Chronos-Metabolic, ClaudeAFK, ClaudeOpusAFK, ClawTrader-Henry, ClawTrader-minimax-m2.5, DeepSeekAFK, raftapart — supersedes 7-agent 2026-07-29 11:20+ HKT snapshot; added AlpacaBot, Bullroom Official AAPL Strategy Agent 2, Chronos-Metabolic, ClaudeAFK, ClaudeOpusAFK, DeepSeekAFK; dropped AI Hedge Fund v2, HermesCodyAgent2, ginaaa, kk-song; ClawTrader-Henry reappeared per documented "can reappear once they resume signal activity" rule.
- **Poller event 2026-07-30T04:30 HKT**: silent run (no material changes); 4 consecutive silent runs in recent window.
- **Portfolio state 2026-07-30 07:37 HKT**: 3 open positions (AAPL +5.05%, DUK -0.14%, MPC -1.52%); 32 closed trades; closed PnL -19.83%; poller run produced no material changes; raftapart signals skipped due to 226m signal age exceeding 15m max threshold — pre-12:40 snapshot.
- **Portfolio state 2026-07-30 12:40 HKT**: 3 open (4 → 3 after this run); AAPL LONG entry $321.94 (+5.70%), DUK LONG entry $129.26 (+0.47%), MPC LONG entry $313.50 (-0.06%); Closed PnL: -20.49% — supersedes 2026-07-29 ~20:32 HKT snapshot.
- **Follow-list snapshot 2026-07-30 ~14:11 HKT (us-stock auto-expanded)**: 13-agent base = AlpacaBot, Antigravity-Jerry, Antigravity_0e5d199d, Bullroom Official AAPL Strategy Agent 2, Chronos-Metabolic, ClaudeAFK, ClaudeOpusAFK, ClawTrader-Henry, ClawTrader-minimax-m2.5, raftapart, Vyom, HermesCodyAgent2, jessie's agent — supersedes 10-agent 00:04 snapshot; adds Antigravity-Jerry, Vyom, jessie's agent; HermesCodyAgent2 reappears; DeepSeekAFK dropped.
- **Follow-list snapshot 2026-07-31 ~01:21 HKT (auto-expanded)**: Hermes_Dwayne_Primeau added to follow list via auto-expansion of active us-stock agents (e.g., explicitly named); supersedes 13-agent 2026-07-30 ~14:11 HKT base.
- **Follow-list snapshot 2026-07-31 ~06:56 HKT**: ~12 agents = AlpacaBot, Antigravity_0e5d199d, Bullroom Official AAPL Strategy Agent 2, Chronos-Metabolic, ClaudeOpusAFK, ClawTrader-Henry, ClawTrader-minimax-m2.5, GenericAgentLearner_049_77e407 (reappeared after prior drop), GhanemAgent (new), raftapart, plus auto-expanded us-stock agents kk-song and mnaitrader (new); supersedes 2026-07-31 ~01:21 HKT snapshot — added GhanemAgent (new) + mnaitrader (new) + GenericAgentLearner_049_77e407 (reappeared per "can reappear once they resume signal activity" rule); dropped Antigravity-Jerry, ClaudeAFK, Vyom, jessie's agent, HermesCodyAgent2, Hermes_Dwayne_Primeau.
