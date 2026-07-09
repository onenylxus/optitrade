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
    closed_at     TEXT,
    signal_log_id INTEGER,
    partial_tp_taken INTEGER DEFAULT 0
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

CREATE TABLE IF NOT EXISTS follow_list_cache (
    id            INTEGER PRIMARY KEY CHECK(id = 1),
    list_json     TEXT NOT NULL,         -- JSON array of agent names
    refreshed_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS signal_log (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    received_at   TEXT NOT NULL,
    agent_name    TEXT NOT NULL,
    symbol        TEXT,
    side          TEXT,
    agent_score   REAL,
    market        TEXT,
    raw_content   TEXT,
    parsed_action TEXT,             -- FOLLOW / WATCH / SKIP / (null if parse failed)
    score         REAL,             -- numeric score after enrichment
    entry_price   REAL,
    live_price    REAL,
    skip_reasons  TEXT,             -- JSON array of strings
    enrich_notes  TEXT,             -- JSON object with trend + history + regime analysis
    thesis        TEXT,             -- human-readable why-we-followed-or-not
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS ix_signal_log_received_at ON signal_log(received_at);
CREATE INDEX IF NOT EXISTS ix_signal_log_agent      ON signal_log(agent_name);
CREATE INDEX IF NOT EXISTS ix_signal_log_symbol     ON signal_log(symbol);

-- Dedup: ai4trade feed may return the same signal twice across polls within
-- the freshness window. UNIQUE on (agent, symbol, created_at, side) prevents
-- duplicate audit rows when content text varies slightly.
CREATE UNIQUE INDEX IF NOT EXISTS uq_signal_log_dedup
    ON signal_log(agent_name, symbol, created_at, COALESCE(side, ''));
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
    """Create tables/indexes if they don't exist. Also runs idempotent
    column-level migrations for changes that can't be expressed in
    CREATE TABLE IF NOT EXISTS (adding columns to existing tables)."""
    conn = get_conn()
    conn.executescript(SCHEMA)
    _run_migrations(conn)


def _run_migrations(conn) -> None:
    """Idempotent ALTER TABLE migrations for additive columns.
    SQLite supports `ALTER TABLE ... ADD COLUMN` but not drop/rename, so
    we list each addition explicitly here. Safe to run on every startup."""
    existing = {row["name"] for row in conn.execute("PRAGMA table_info(paper_trades)")}
    if "signal_log_id" not in existing:
        conn.execute("ALTER TABLE paper_trades ADD COLUMN signal_log_id INTEGER")
    if "partial_tp_taken" not in existing:
        conn.execute("ALTER TABLE paper_trades ADD COLUMN partial_tp_taken INTEGER DEFAULT 0")


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


# ── News accessors ────────────────────────────────────────────────────────────
def upsert_news_article(
    conn: sqlite3.Connection,
    article: dict[str, Any],
    analysis: dict[str, Any] | None = None,
) -> None:
    """Insert or replace a news article + its analysis (if provided)."""
    conn.execute(
        "INSERT OR REPLACE INTO news_articles "
        "(id, source, published_at, url, headline, summary, tickers, raw) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (
            article["id"],
            article.get("source"),
            article.get("published_at"),
            article.get("url") or article.get("link"),
            article.get("headline") or article.get("title") or "",
            article.get("summary"),
            json_dumps(article.get("tickers") or article.get("related_symbols") or []),
            json_dumps(article),
        ),
    )
    if analysis is not None:
        # Skip empty analyses (all fields None) so we don't pollute the table
        # with NULL rows that came from the raw article migration.
        meaningful = any(
            analysis.get(k) not in (None, "", [], {})
            for k in ("sentiment", "impact", "highlights", "reasoning",
                      "related_symbols", "readiness_score")
        )
        if meaningful:
            conn.execute(
                "INSERT OR REPLACE INTO news_analyses "
                "(article_id, sentiment, impact, highlights, reasoning, "
                " related_symbols, readiness_score, analyzed_at) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    article["id"],
                    analysis.get("sentiment"),
                    analysis.get("impact") or analysis.get("risk_tag"),
                    json_dumps(analysis.get("highlights") or []),
                    analysis.get("reasoning"),
                    json_dumps(analysis.get("related_symbols") or []),
                    analysis.get("readiness_score"),
                    analysis.get("analyzed_at") or now_iso(),
                ),
            )


def list_news_with_analyses(
    conn: sqlite3.Connection,
    *,
    limit: int = 100,
    symbols: list[str] | None = None,
) -> list[dict[str, Any]]:
    """Return news articles joined with their analyses.

    Shape matches what /api/news used to return out of the JSON file, so the
    frontend widget can consume it unchanged.

    COALESCE fills in safe defaults for articles that haven't been analyzed
    yet (LEFT JOIN on news_analyses returns NULL fields). Without this the
    NewsWidget crashes on `news.sentiment.toFixed(2)` for raw articles.
    """
    base_sql = (
        "SELECT a.id, a.source, a.published_at, a.url, a.headline, a.summary, "
        "       a.tickers, a.raw, "
        "       COALESCE(n.sentiment, 0.0) AS sentiment, "
        "       COALESCE(n.impact, 'Low Risk') AS impact, "
        "       COALESCE(n.highlights, '[]') AS highlights, "
        "       COALESCE(n.reasoning, '') AS reasoning, "
        "       COALESCE(n.related_symbols, '[]') AS related_symbols, "
        "       COALESCE(n.readiness_score, 0) AS readiness_score, "
        "       COALESCE(n.analyzed_at, a.created_at) AS analyzed_at "
        "FROM news_articles a "
        "LEFT JOIN news_analyses n ON n.article_id = a.id "
        "ORDER BY a.published_at DESC "
        "LIMIT ?"
    )
    rows = conn.execute(base_sql, (limit,)).fetchall()

    out: list[dict[str, Any]] = []
    for r in rows:
        item = dict(r)
        # Restore the JSON arrays / objects
        item["tickers"] = json_loads(item.get("tickers"), default=[])
        item["highlights"] = json_loads(item.get("highlights"), default=[])
        item["related_symbols"] = json_loads(item.get("related_symbols"), default=[])
        # The frontend expects the `link` field, not `url`
        item["link"] = item.get("url")
        # The frontend widget reads `risk_tag`, not `impact`
        item["risk_tag"] = item.get("impact") or "Low Risk"
        # Ensure sentiment is a real number, not None
        if item.get("sentiment") is None:
            item["sentiment"] = 0.0
        out.append(item)

    if symbols:
        syms = {s.upper() for s in symbols if s}
        if syms:
            def matches(it: dict[str, Any]) -> bool:
                if any((s.upper() in syms) for s in it.get("related_symbols", []) or []):
                    return True
                if any((s.upper() in syms) for s in it.get("tickers", []) or []):
                    return True
                haystack = f"{it.get('headline', '')} {it.get('summary', '')}".upper()
                return any(s.upper() in haystack for s in syms)

            out = [it for it in out if matches(it)]

    return out


def get_news_metadata(conn: sqlite3.Connection) -> dict[str, Any]:
    """Top-of-payload metadata for the news response."""
    total = conn.execute("SELECT COUNT(*) FROM news_articles").fetchone()[0]
    yahoo = conn.execute(
        "SELECT COUNT(*) FROM news_articles WHERE source = 'yahoo'"
    ).fetchone()[0]
    et = conn.execute(
        "SELECT COUNT(*) FROM news_articles WHERE source = 'economic_times'"
    ).fetchone()[0]
    last_analyzed = conn.execute(
        "SELECT MAX(analyzed_at) FROM news_analyses"
    ).fetchone()[0]
    return {
        "total_news": total,
        "yahoo_count": yahoo,
        "et_count": et,
        "analyzed_at": last_analyzed,
        "model": "openrouter/free",
        "source": "news_articles + news_analyses (sqlite)",
    }


# ── Self-test ─────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    init_schema()
    print(f"DB initialized at {get_db_path()}")