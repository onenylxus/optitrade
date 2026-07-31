# Long-term Memory

## User — Timmy
- **Primary broker**: IBKR (portfolio tracking)
- **Secondary broker**: 富途 (Futu) — HK options context (INTC collar, FIG covered call)
- **Portfolio (live)**: NVDA ×200, AAPL, MSFT, AMZN, JPM, NFLX — total ~$110,211 with +20.45% unrealized gains (confirmed via WebSocket refresh 2026-05-17)

## OptiTrade Setup
- **Repo**: https://github.com/onenylxus/optitrade (branch: master)
- **Clone path**: `/root/optitrade-clone` (single clone, not duplicated elsewhere)
- **Repo owner**: Nicholas Ng (onenylxus@gmail.com)
- **Backend**: FastAPI on `apps/backend/` (Python/uv) → http://127.0.0.1:8000
- **Frontend**: Next.js on `apps/frontend/` → http://127.0.0.1:3000
- **Backend env vars**: `FMP_API_KEY`, `OPENROUTER_API_KEY`, `GOOGLE_APPLICATION_CREDENTIALS`
- **Frontend env vars**: `NEXT_PUBLIC_BACKEND_URL`, Firebase config (7 vars)
- **Firebase project**: optitrade-hku; service account JSON at `apps/backend/optitrade-hku-firebase-adminsdk.json`
- **Backend startup**: `.venv/bin/python main.py` (not `next` or bare `python`)
- **Frontend startup**: `pnpm dev -H 0.0.0.0` from `apps/frontend/`
- **Backend router pattern**: `app.include_router(stock_router, prefix="/api/stock", tags=["stock"])` — register new routers in `main.py`
- **Backend restart required**: After adding new `/api/price` or other route, restart backend with `.venv/bin/python main.py`
- **Git path workaround**: Escape parentheses in `git add` for Next.js route directories — e.g., `git add 'app/\(home)/'` for `app/(home)/`
- **Git squash strategy**: User prefers squash (reset --hard + force push) to keep commit history clean; insists commits fully removed via reset --hard + force push, NOT revert commits. Lesson: reset target must be origin/master, not local branch tip
- **Dify chatbot integration**: Removed in favor of floating chat widget

### Frontend API Routes
- **Location**: `apps/frontend/app/api/<route>/route.ts`
- **Pattern**: Next.js App Router — use `GET` handler, return `NextResponse.json()`
- **File path resolution**: Next.js API routes using relative paths like `../backend/...` fail at runtime; always use absolute paths like `/root/optitrade-clone/apps/backend/data/...` for file system operations
- **Routes**: `/api/paper-trading/history`, `/api/prediction/daily`
- **Data pipeline**: Python/yfinance → JSON file → Next.js API route → Widget component

### Widgets
- **Location**: `apps/frontend/components/dashboard/`
- **Registration**: `fixtures.ts` (WidgetType enum, spans, widgetLibrary) — must add enum + library entry
- **Renderer**: `WidgetRenderer` wired for all widget types (paper-trading-history, daily-prediction)

### Market Clock Widget
- **File**: `apps/frontend/components/dashboard/market-clock-widget.tsx`
- **Requirements**: smaller analogue clock (keep widget size), must show hour/minute/second hands (時針分針秒針), must handle US holidays/weekends with correct reopen time
- **Layout**: status text (e.g. "Sunday — reopens in 25:34") and time must be side-by-side horizontal flex, not vertically stacked
- **SVG bug fixes**:
  - `y1`/`y2` in `describeArc`/`PhaseArc` used `Math.cos` instead of `Math.sin` → arcs rendered as flat ovals
  - Hour hand used 12h scale (`hrs % 12`) causing 2 rotations/24h → fixed to 24h scale `((hrs + min/60) / 24) * 360`
  - `minutesToAngle` must normalize wrapped values (e.g. 1290 min for 21:30) with modulo
  - Multiple EDT/EST/HKT timezone conversion fixes (7 commits)
- **Path resolution**: nanobot file ops on OptiTrade repo need explicit `/root/optitrade-clone/` prefix

## Market Context & Analysis (2026)

### Portfolio Performance
- Total value: ~$110,211 | Unrealized: +20.45% (2026-05-17)

### Semiconductor / AI Hardware
- **MU** (Micron): HBM leader, Fwd PE 7.3x — best risk/reward in sector; entry target $650-680 (current ~$747 ATH, -8 to -13% pullback = good zone)
- **QCOM**: Best AI hardware dividend stock; ~2.2% yield, $0.86/quarter, $20B buyback, Forward PE 8.75x
- **NVDA**: Extremely expensive PE — bubble territory; TSM/QCOM more reasonably valued
- **SMH**: Preferred semiconductor ETF (NVDA 22% weight, $23B AUM) over SOXX/SOXQ/XSD
- **Semiconductor bubble assessment**: Rally backed by real GPU demand but valuations optimistic; retail rotated from crypto ETFs into semiconductor ETFs

### Sector Coverage
- **AI optical/AI storage** (2026-05-19): MU, COHR (optical chip), GLW (fiber base), WDC (watch for pullback), LITE, AAOI (avoid today — weak)
- **Investor consensus**: Burry bearish, Druckenmiller cautious near-term bullish long-term TSM, Buffett all-cash, Howard Marks cautious

## AI4Trade Copy-Trading
- **Script**: `/root/.nanobot/workspace/scripts/ai4trade_signal_poller.py`
- **Paper portfolio file**: `/root/optitrade-clone/apps/backend/data/paper_portfolios.json`
- **Editable portfolio file**: `/root/optitrade-clone/apps/backend/data/editable_portfolio.json` (used by PortfolioWidget)
- **To version-control `editable_portfolio.json`**: remove `data/*.json` from `apps/backend/.gitignore` then `git rm --cached apps/backend/data/editable_portfolio.json`
- **Schema**: `avgPrice` ← entry price, `currentPrice` ← live price, `quantity` ← shares, `symbol` ← ticker
- **Poller dual-writes**: keeps `paper_portfolios.json` AND syncs normalized data to `editable_portfolio.json` so PortfolioWidget shows real-time prices
- **Git sync**: After each check, auto-commits portfolio JSON to GitHub — BUT: cron job must NOT auto-commit price changes; only commit when explicitly requested
- **Market closed behavior**: No signals/triggers returned during evening hours (market closed); script returns empty results at ~18:56, 19:26, 19:56, 20:27 HKT — brief "Market closed" response preferred over position reports
- **Poller check frequency**: ~30-min intervals (observed runs: 18:09, 18:39, 19:09, 20:57, 21:27)
- **Capacity constraint**: At max 3/3 slots — raftapart has 16 new stock picks available but cannot be acted upon until slots free up
- **Reminder format decision (2026-07-07)**: Always include portfolio status + PnL summary in AI4Trade reminders even when no triggers fire — confirmed approach, overrides "Market closed behavior" quiet format above; see USER.md AI4Trade carve-out

## AI4Trade 2026 Aggressive Strategy (activated 2026-06-24)
**Capital**: $100K | **Slots**: 5 | **Deployment target**: 95%+ (currently 99.8% deployed)
- **Stop-loss**: -5% per trade (tight, not -8%)
- **Target**: +10% per trade (not +15%)
- **Trailing stop**: Activates at +5% gain, trails 3% from peak
- **Scale-up**: +5% gain → add 50% more shares automatically
- **New position sizing**: 50 shares per signal (was 10)
- **Position limits**: Max 5 slots

### Current Open Positions (2026-06-24)
| Symbol | Qty | Entry | Stop | Target | Strategy |
|--------|-----|-------|------|--------|----------|
| MU | 57 | $1051.77 | $999.18 | $1156.95 | WSB FOMO momentum |
| SOUN | 1000 | $6.44 | $5.80 | $7.08 | Speculative high-beta |
| AMZN | 50 | $336.18 | $319.37 | $369.80 | Cloud/AI swing (CLOSED — stale price error; entry was $336.18 but actual was ~$234, would be -30%) |
| AVGO | 30 | $380.15 | $378.47 | $418.17 | Hold/cooldown — ⚠️ CRITICAL: current price $380.15 only $1.68 above stop loss |
| AMD | 10 | $519.85 | $493.86 | $571.84 | Momentum-scale anchor |

### Followed Traders
- raftapart (US stocks — primary signal source)
- HermesTradingX (crypto)
- Yuzu Octopus (crypto)

### Market Context (2026-06-24)
- Fear & Greed Index: 28 (Extreme Fear)
- VIX: 19.49
- SPY: $583.70 | QQQ: $526.80
- RSI: 57

### AMZN Position
- **Closed** (2026-06-24): Entry was $336.18 but actual stale price was ~$234 → -30% discrepancy; position fully closed

### Widgets — Details
- **paper-trading-history** (4×5): Shows closed trades log with win/loss stats; filter by exit reason; "Why I entered" section pulling from `notes` field per trade; originally filtered only `status === 'closed'` → showed empty because all 4 positions were open; fixed with tab-based filtering across all positions
- **daily-prediction** (4×6): AI-generated daily outlook including VIX level, Fear & Greed index, SPY/QQQ key levels, signal summary, sector picks, catalyst calendar, risk flags
- **Bug fixes**: `.catch()` fell back to raw object instead of array → `trades.filter is not a function`; fixed with Array.isArray guards. Relative API path `../backend/...` failed at runtime → fixed with absolute path `/root/optitrade-clone/apps/backend/data/paper_portfolios.json`
- **Daily Prediction improvement**: Show last prediction during market hours (don't leave empty), only update after close

### Earnings Calendar Widget
- **Status**: Phase 1 complete — hardcoded demo data displayed
- **Phase 2**: Wire backend cron to fetch live earnings data

## Nanobot & System

- **Nanobot workspace**: `/root/.nanobot/workspace` is nanobot's own agent workspace, NOT the OptiTrade repo
- **Docs rule**: Any new/modified widget → update `/root/optitrade-clone/docs/widgets/nanobot-widgets.md` before pushing (AGENTS.md, SOUL.md, skills, memory, sessions), NOT the OptiTrade repo
- **Pending commits**: 59 commits ahead of origin/master (commit c1dba7a) as of 2026-06-24; 22 meaningful commits not yet pushed (market clock widget fixes including SVG bugs and timezone fixes, floating chat widget replacing Dify, Thinking block, portfolio bullish/bearish tags, Reliability Rate feature, NEXT_DEV_HOST env var, news data cleanup); 35 AI4Trade sync commits are gitignored data files auto-generated every 30 min (not user code — will be squashed out before push)
- **Data layer**: Paid MCP tools fully disabled (`.mcp.json` cleared, 11 tools removed); custom `stock_data.py` using yfinance is primary data source
- **Heartbeat monitoring**: Active tasks for market volatility alerts (>3%), FIG catalyst countdown, covered call expiry tracking, 2026 aggressive portfolio P&L tracking
- **AI4Trade follow-list volatility 2026-07-27**: intra-day base composition shifted at 11:00 HKT — **CursorComposerAgent** joined base in place of **Bullroom Official AAPL Strategy Agent 2** (which was base at 08:12 HKT); stable across 08:12 and 11:00 snapshots = Antigravity_0e5d199d, ClawTrader-minimax-m2.5, Vyom, kk-song, raftapart (6-agent base); portfolio state unchanged (3 open LONG, -24.52% Closed PnL) — confirms follow-list volatility without triggering new entries; canonical follow-list state still lives in the dated snapshots section of MEMORY.md (no longer in USER.md)

- **WebSocket session persistence**: Connect with `?chat_id=<session_id>` query param (fallback: `"ws:default"`) so SOUL.md/USER.md/MEMORY.md load on every fresh connection
- **Model**: MiniMax-M3 (confirmed active 2026-06-21T22:39)
- **MEMORY.md recovery**: File was wiped/lost on ~2026-06-21; fully rebuilt from conversation history on 2026-06-21T10:10
- **Anthropics financial-services repo** reviewed (17.6k stars, 9 finance agents for DCF/LBO/comps/earnings) — noted for future workflow enhancement
- **SOUL.md upgrade (2026-05-19)**: Extended capabilities — earnings analysis, idea generation, DCF valuation, sector analysis, catalyst calendars, operational discipline (no "Done"/"Reminded" tags)
- **Next.js dev server**: Always restart after adding new API routes; PIDs can linger from old builds (confirmed 2026-06-24: old PID 82127 from Jun 23 still running stale build)
- **Slow filesystem**: `.next/dev` directory benchmarked at 787ms → typical OptiTrade dev environment issue
- **Next.js version**: 16.2.9 (confirmed 2026-06-24)
- **Git rebase integrity**: Git history confirmed no positions lost during rebase; apparent loss was React state hydration issue in browser
- **API proxy pattern**: Both Paper Trading and Daily Prediction use `BACKEND_URL` backend proxy with live fallback
