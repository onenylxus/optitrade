"""SQLite database layer for OptiTrade runtime data.

Replaces the four JSON files (paper_portfolios.json, editable_portfolio.json,
news_data.json, news_analysis_result.json) that previously lived on disk and
got synced through git. The DB is the single source of truth for everything
that isn't authored code.

A single shared connection per process is sufficient for this workload
(single FastAPI process, low write volume). SQLite is configured in WAL mode
so the AI4Trade poller can write concurrently with route reads.
"""

from __future__ import annotations

import json
import sqlite3
import threading
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable, Iterator, Sequence

# ── Paths ─────────────────────────────────────────────────────────────────────
# apps/backend/src/db.py → apps/backend/data/optitrade.db
DEFAULT_DB_PATH = Path(__file__).resolve().parents[1] / "data" / "optitrade.db"


# ── Schema ────────────────────────────────────────────────────────────────────
SCHEMA = """
CREATE TABLE IF NOT EXISTS paper_trades (
    id            TEXT PRIMARY KEY,
    symbol        TEXT NOT NULL,
    name          TEXT,
    side          TEXT NOT NULL CHECK(side IN ('LONG','SHORT')),
    status        TEXT NOT NULL CHECK(status IN ('open','closed')),
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
CREATE INDEX IF NOT EXISTS ix_paper_trades_symbol ON paper_trades(symbol);
CREATE INDEX IF NOT EXISTS ix_paper_trades_status ON paper_trades(status);
CREATE INDEX IF NOT EXISTS ix_paper_trades_created ON paper_trades(created_at DESC);

CREATE TABLE IF NOT EXISTS editable_portfolio (
    id            INTEGER PRIMARY KEY CHECK(id = 1),
    name          TEXT NOT NULL,
    positions     TEXT NOT NULL,        -- JSON array
    history       TEXT,                  -- JSON array, nullable
    updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS news_articles (
    id            TEXT PRIMARY KEY,
    source        TEXT,
    published_at  TEXT,
    url           TEXT,
    headline      TEXT NOT NULL,
    summary       TEXT,
    tickers       TEXT,                 -- JSON array
    raw           TEXT,                 -- JSON blob of the original payload
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS ix_news_articles_published ON news_articles(published_at DESC);

CREATE TABLE IF NOT EXISTS news_analyses (
    article_id    TEXT PRIMARY KEY REFERENCES news_articles(id) ON DELETE CASCADE,
    sentiment     REAL,
    impact        TEXT,
    highlights    TEXT,                  -- JSON array
    reasoning     TEXT,
    related_symbols TEXT,                -- JSON array
    readiness_score REAL,
    analyzed_at   TEXT
);

CREATE TABLE IF NOT EXISTS price_cache (
    symbol        TEXT PRIMARY KEY,
    price         REAL NOT NULL,
    source        TEXT,
    fetched_at    TEXT NOT NULL,
    expires_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_price_cache_expires ON price_cache(expires_at);
"""


# ── Connection management ─────────────────────────────────────────────────────
_lock = threading.Lock()
_conn: sqlite3.Connection | None = None
_db_path: Path | None = None


def configure(db_path: str | Path | None = None) -> Path:
    """Set the on-disk DB path. Idempotent. Returns the resolved path."""
    global _db_path
    resolved = Path(db_path).resolve() if db_path else DEFAULT_DB_PATH
    resolved.parent.mkdir(parents=True, exist_ok=True)
    _db_path = resolved
    return resolved


def get_db_path() -> Path:
    return _db_path or configure()


def get_conn() -> sqlite3.Connection:
    """Return a process-wide connection. Created on first call."""
    global _conn
    if _conn is not None:
        return _conn
    with _lock:
        if _conn is not None:
            return _conn
        path = get_db_path()
        conn = sqlite3.connect(
            str(path),
            check_same_thread=False,
            isolation_level=None,           # autocommit; we manage transactions explicitly
            timeout=10.0,
        )
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode = WAL")
        conn.execute("PRAGMA synchronous = NORMAL")
        conn.execute("PRAGMA foreign_keys = ON")
        conn.execute("PRAGMA busy_timeout = 5000")
        _conn = conn
        return _conn


@contextmanager
def transaction() -> Iterator[sqlite3.Connection]:
    """Context manager that wraps work in an explicit transaction."""
    conn = get_conn()
    conn.execute("BEGIN")
    try:
        yield conn
    except Exception:
        conn.execute("ROLLBACK")
        raise
    else:
        conn.execute("COMMIT")


def init_schema() -> None:
    """Create tables/indexes if they don't exist."""
    conn = get_conn()
    conn.executescript(SCHEMA)


# ── Helpers ───────────────────────────────────────────────────────────────────
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def json_dumps(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def json_loads(value: str | None, default: Any = None) -> Any:
    if value is None or value == "":
        return default
    return json.loads(value)


def upsert_paper_trade(conn: sqlite3.Connection, row: dict[str, Any]) -> None:
    """Insert or replace a paper trade keyed by id."""
    cols = (
        "id", "symbol", "name", "side", "status",
        "entry_price", "exit_price", "target_price", "stop_loss", "quantity",
        "pnl_pct", "pnl_abs", "strategy", "sector", "notes",
        "close_reason", "agent", "agent_score", "market",
        "created_at", "updated_at", "closed_at",
    )
    values = tuple(row.get(c) for c in cols)
    placeholders = ",".join("?" for _ in cols)
    conflict_cols = ",".join(cols)
    update_cols = ",".join(f"{c}=excluded.{c}" for c in cols if c != "id")
    conn.execute(
        f"INSERT INTO paper_trades ({conflict_cols}) VALUES ({placeholders}) "
        f"ON CONFLICT(id) DO UPDATE SET {update_cols}",
        values,
    )


def list_paper_trades(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    rows = conn.execute(
        "SELECT * FROM paper_trades ORDER BY created_at ASC"
    ).fetchall()
    return [dict(r) for r in rows]


# ── Self-test ─────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    init_schema()
    print(f"DB initialized at {get_db_path()}")