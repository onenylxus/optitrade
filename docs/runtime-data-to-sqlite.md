# OptiTrade Runtime Data: JSON + Git → SQLite

**Status**: ✅ Deployed on `master`
**Affects**: paper-trading history, editable portfolio, news articles + analyses
**Commits**: `99dfc3d`, `d4a1e4d`, `cd33963`, `68d498f`

---

## TL;DR

We stopped syncing **runtime data** through git. The four on-disk JSON files that previously traveled between machines via `git pull` / `scp` are gone. Everything they used to hold now lives in a single SQLite database (`apps/backend/data/optitrade.db`) that the FastAPI service reads from directly. Source code still syncs through git; runtime data does not.

---

## What changed

### Before

```
┌──────────────────────────────────┐      ┌──────────────────────────────────┐
│  Local dev machine               │      │  Production server               │
│                                  │      │                                  │
│  FastAPI                         │      │  FastAPI                         │
│   ├─ reads                       │      │   ├─ reads                       │
│   │   • paper_portfolios.json    │ ───  │   │   • paper_portfolios.json    │
│   │   • editable_portfolio.json  │ ─git→│   │   • editable_portfolio.json  │
│   │   • news_data.json           │ ───  │   │   • news_data.json           │
│   │   • news_analysis_result.json│ ───  │   │   • news_analysis_result.json│
│                                  │      │                                  │
│  ai4trade_signal_poller.py       │      │  ai4trade_signal_poller.py       │
│   └─ writes paper_portfolios.json│ ─git→│   └─ writes paper_portfolios.json│
│                                  │      │                                  │
│  news_fetcher/pipeline.py        │      │  news_fetcher/pipeline.py        │
│   └─ writes news_data.json       │ ─git→│   └─ writes news_data.json       │
│                                  │      │                                  │
│  next.js                         │      │  next.js                         │
│   └─ fs.readFileSync news_data   │ ←git─│   └─ fs.readFileSync news_data   │
└──────────────────────────────────┘      └──────────────────────────────────┘
```

### After

```
┌──────────────────────────────────┐      ┌──────────────────────────────────┐
│  Local dev machine               │      │  Production server               │
│                                  │      │                                  │
│  FastAPI ──┐                     │      │  FastAPI ──┐                     │
│            ├─ reads/writes ──────┼─ SQL ┼── reads/writes                  │
│            │                     │      │             │                    │
│  news_fetcher/pipeline.py ───────┤      │  news_fetcher/pipeline.py ───────┤
│            │                     │      │             │                    │
│  ai4trade_signal_poller.py ──────┤      │  ai4trade_signal_poller.py ──────┤
│            │                     │      │             │                    │
│            ▼                     │      │             ▼                    │
│   apps/backend/data/optitrade.db │      │   apps/backend/data/optitrade.db │
│                                  │      │  (separate file on each box)     │
│  next.js                         │      │  next.js                         │
│   └─ HTTP proxy → FastAPI ───────┼──────┼─ HTTP proxy → FastAPI            │
└──────────────────────────────────┘      └──────────────────────────────────┘

git tracks: source code only
SQLite owns: paper trades, editable portfolio, news articles + analyses
```

The two boxes no longer need to push and pull runtime data. Each one has its own `optitrade.db` that its own services write to.

---

## Why

The old design had three problems:

1. **Source-of-truth ambiguity.** Two on-disk JSON files committed to git made "what's the truth?" a question with two right answers. If you pulled mid-write, you'd see a half-written file or, worse, get a merge conflict on a file that was never meant to be edited by humans.

2. **Concurrent writers fighting.** The FastAPI server (REST writes from the editable portfolio widget), the `news_fetcher` daemon, and the `ai4trade_signal_poller` cron all wrote to the same JSON files. Last writer wins; nothing stops two writers from racing.

3. **Git as a database is a terrible database.** No indexes, no transactions, no concurrent readers, no UNIQUE constraints, no partial updates, no audit trail, no rollback. `git pull` is not a "sync my runtime state" tool — it conflates code review history with mutation history.

The user-facing symptom we hit most often was the news widget showing stale data on the server because the local pipeline wrote to JSON that wasn't picked up by the deployed copy until someone manually committed and pulled.

---

## Where things live now

| Concept | Old path | New location |
| --- | --- | --- |
| Paper-trade positions | `apps/backend/data/paper_portfolios.json` | `paper_trades` table |
| Editable portfolio | `apps/backend/data/editable_portfolio.json` | `editable_portfolio` table |
| News articles (raw) | `apps/frontend/public/news_data.json` | `news_articles` table |
| News AI analyses | `apps/backend/data/news_analysis_result.json` | `news_analyses` table |
| DB file | n/a | `apps/backend/data/optitrade.db` |

The DB file is gitignored. Each machine owns its own copy and they're allowed to diverge — there's nothing to merge.

---

## The schema

Five tables, all defined in `apps/backend/src/db.py`:

```sql
-- Paper trades (was paper_portfolios.json)
CREATE TABLE paper_trades (
    id            TEXT PRIMARY KEY,    -- e.g. paper-NVDA-2026-07-05-09
    symbol        TEXT NOT NULL,
    name          TEXT,
    side          TEXT CHECK(side IN ('LONG','SHORT')),
    status        TEXT CHECK(status IN ('open','closed')),
    entry_price   REAL NOT NULL,
    exit_price    REAL,
    target_price  REAL,
    stop_loss     REAL,
    quantity      REAL NOT NULL,
    pnl_pct       REAL,
    pnl_abs       REAL,
    strategy      TEXT,
    sector        TEXT,
    notes         TEXT,
    close_reason  TEXT,
    agent         TEXT,
    agent_score   REAL,
    market        TEXT,
    created_at    TEXT NOT NULL,
    updated_at    TEXT NOT NULL,
    closed_at     TEXT
);

-- Editable portfolio (single-row table; id=1)
CREATE TABLE editable_portfolio (
    id            INTEGER PRIMARY KEY CHECK(id = 1),
    name          TEXT NOT NULL,
    positions     TEXT NOT NULL,   -- JSON array
    history       TEXT,            -- JSON array, nullable
    updated_at    TEXT NOT NULL
);

-- News articles (raw, pre-AI-analysis)
CREATE TABLE news_articles (
    id            TEXT PRIMARY KEY,    -- e.g. yahoo_1783187438_11
    source        TEXT,               -- 'yahoo' | 'economic_times'
    published_at  TEXT,
    url           TEXT,
    headline      TEXT NOT NULL,
    summary       TEXT,
    tickers       TEXT,               -- JSON array
    raw           TEXT,               -- JSON blob of the original payload
    created_at    TEXT NOT NULL
);

-- AI analyses (1:1 with news_articles)
CREATE TABLE news_analyses (
    article_id         TEXT PRIMARY KEY REFERENCES news_articles(id) ON DELETE CASCADE,
    sentiment          REAL,
    impact             TEXT,
    highlights         TEXT,    -- JSON array
    reasoning          TEXT,
    related_symbols    TEXT,    -- JSON array
    readiness_score    REAL,
    analyzed_at        TEXT
);

-- FMP / yfinance price cache (schema defined; not yet wired in by price routes)
CREATE TABLE price_cache (
    symbol        TEXT PRIMARY KEY,
    price         REAL NOT NULL,
    source        TEXT,
    fetched_at    TEXT NOT NULL,
    expires_at    TEXT NOT NULL
);
```

Why `TEXT` for timestamps and JSON arrays? SQLite has a real datetime type and a JSON type, but `TEXT` lets us carry the exact ISO-8601 strings the rest of the system already produces and JSON-dumps JSON arrays without a custom encoding layer. KISS.

---

## How it's wired

The whole DB layer is one file: **`apps/backend/src/db.py`** (~330 lines).

```python
import sqlite3
from src import db

# One process-wide connection, WAL mode, foreign keys on
db.configure()                       # default: apps/backend/data/optitrade.db
db.init_schema()                     # idempotent CREATE TABLE IF NOT EXISTS
conn = db.get_conn()

with db.transaction() as c:          # BEGIN / COMMIT / ROLLBACK
    db.upsert_paper_trade(c, row)

trades = db.list_paper_trades(c)     # SELECT * ORDER BY created_at
```

Key properties:
- Single shared connection per process with `check_same_thread=False` so the FastAPI request worker and the `news_fetcher` daemon thread can both use it safely.
- WAL mode (`PRAGMA journal_mode = WAL`, `synchronous = NORMAL`) so the AI4Trade poller, the news daemon, and HTTP reads can all go through the DB without taking a write lock.
- All accessors are idempotent (`INSERT OR REPLACE`) so the migration script can be re-run safely.
- JSON columns round-trip through `db.json_dumps()` / `db.json_loads()` so callers don't have to think about it.

### Read/write sites

| Caller | Direction | Function |
| --- | --- | --- |
| `ai4trade_signal_poller.py` | write | `db.upsert_paper_trade()` |
| `services/portfolio_service.py` | read/write | inline SQL against `editable_portfolio` |
| `news_fetcher/pipeline.py` | read/write | `db.upsert_news_article()` + raw SQL `SELECT` for dedup history |
| `src/rest_server.py` (GET /api/news) | read | `db.list_news_with_analyses()` + `db.get_news_metadata()` |
| `api/routes/paper_trading_routes.py` | read | `db.list_paper_trades()` + price enrichment |

### Frontend impact

Only one file changed in `apps/frontend`: `app/api/news/route.ts` went from `fs.readFileSync(news_data.json)` to a thin HTTP proxy to the FastAPI service, mirroring the pattern `app/api/paper-trading/history/route.ts` already uses.

The widgets themselves didn't change — they keep reading `/api/news` and `/api/paper-trading/history` exactly like before.

---

## Migration & deployment

Run **once per machine**, after deploying the new code:

```bash
cd apps/backend
uv run python scripts/migrate_json_to_sqlite.py
```

The script is idempotent (`INSERT OR REPLACE`). It reads:

- `apps/backend/data/paper_portfolios.json`
- `apps/backend/data/editable_portfolio.json`
- `apps/frontend/public/news_data.json` *(correct path — the news pipeline writes it here for the frontend, not in `apps/backend/data/`)*
- `apps/backend/data/news_analysis_result.json` *(if present)*

…and writes into the SQLite tables. After it finishes, restart the FastAPI service (`/tmp/start-backend.sh` on the prod server, or `npx nx run @optitrade/backend:start` locally). Verify:

```bash
curl -s http://localhost:8000/api/paper-trading/history | jq '.stats'
curl -s http://localhost:8000/api/news | jq '.metadata.source'
# expect: "news_articles + news_analyses (sqlite)"
```

Once both endpoints return the expected payloads, the JSON files can be deleted. They're already untracked from git.

---

## Why SQLite, not Postgres / Redis / a real database

- **Single-process server.** The FastAPI service and the various poller threads all run inside one box. Postgres would be a second running process to babysit, an extra connection pool to tune, and a separate box to back up.
- **Workload is tiny.** A handful of paper trades, one portfolio record, a few hundred news articles. SQLite will handle a thousand× this before breaking a sweat.
- **WAL mode is enough concurrency.** Multiple readers + one writer at a time is exactly what we have, and WAL gives us non-blocking reads.
- **No new infra.** One file (`optitrade.db`) lives next to the code. `sqlite3 optitrade.db "SELECT * FROM paper_trades"` is the entire debug surface.

If we ever scale to multi-machine — which we don't need to today — Postgres becomes attractive. The schema is portable; only `apps/backend/src/db.py` would change.

---

## What stayed the same

- The REST API contract. Widget code didn't change.
- The dedup semantics in `news_fetcher/pipeline.py` (still ID + URL based, just loaded from SQLite instead of JSON).
- The git workflow for **code** — branches, PRs, code review, all unchanged.
- `.env` files, secrets handling, Firebase auth, FMP/OpenRouter caching — all untouched.

---

## What to watch out for

1. **The DB file is gitignored.** Don't `git add apps/backend/data/optitrade.db` and commit it; even a one-machine deploy regenerates the file from scratch on the next `db.init_schema()`.
2. **Consecutive deploys.** Because each machine owns its own DB file, deploys no longer carry live data. The first call to `/api/paper-trading/history` after a fresh deploy will return whatever the latest pipeline + poll writes — usually fine, but if you need last-week's history to be visible right after deploy, run the migration script on that box first.
3. **The migration script is one-shot.** It's checked in for reproducibility, but it shouldn't be wired into `nx run @optitrade/backend:install`. Re-running it on a live DB is safe (it upserts), just useless.
4. **News `news_analyses` rows are created empty-free.** The schema's `INSERT OR REPLACE` only writes a row if the source dict has actual sentiment/highlights/etc. — empty analyses (all-NULL fields) are skipped. This keeps the `LEFT JOIN news_analyses` in `/api/news` clean.

---

## Files touched

**New**
- `apps/backend/src/db.py`
- `apps/backend/scripts/migrate_json_to_sqlite.py`

**Modified**
- `apps/backend/src/rest_server.py` — `/api/news` reads from DB
- `apps/backend/news_fetcher/pipeline.py` — persists to DB; dedup history from DB
- `apps/backend/scripts/ai4trade_signal_poller.py` — writes to DB; git sync block removed
- `apps/backend/src/services/portfolio_service.py` — read/write `editable_portfolio` from DB
- `apps/backend/src/api/routes/paper_trading_routes.py` — reads from DB
- `apps/frontend/app/api/news/route.ts` — thin proxy, no file IO
- `.gitignore` — `*.db`, `*.db-wal`, `*.db-shm`, runtime JSON files

**Deleted from index** (no longer in git, still possibly on disk for migration input)
- `apps/backend/data/paper_portfolios.json`
- `apps/backend/data/editable_portfolio.json`
- `apps/backend/data/news_analysis_result.json`
- `apps/frontend/public/news_data.json`
