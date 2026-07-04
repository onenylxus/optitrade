#!/usr/bin/env python3
"""One-shot migration: load the four runtime JSON files into SQLite.

Run once on the server after deploying the new code:

    cd apps/backend && uv run python scripts/migrate_json_to_sqlite.py

It reads paper_portfolios.json, editable_portfolio.json, news_data.json and
news_analysis_result.json (if they exist) and inserts the rows into
optitrade.db. Idempotent — re-running is safe (uses INSERT OR REPLACE /
ON CONFLICT). Leaves the JSON files on disk untouched so you can verify
before deleting them.
"""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

# Allow running as a standalone script from apps/backend/
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from src import db  # noqa: E402

DATA = ROOT / "data"


def iso(value: str | None) -> str | None:
    """Best-effort coerce to ISO-8601 with timezone. Returns None on failure."""
    if not value:
        return None
    try:
        # Treat naive timestamps as UTC.
        if value.endswith("Z"):
            value = value[:-1] + "+00:00"
        return datetime.fromisoformat(value).isoformat()
    except (TypeError, ValueError):
        return value  # leave it as-is, DB stores TEXT


def migrate_paper_trades(conn) -> int:
    src = DATA / "paper_portfolios.json"
    if not src.exists():
        print(f"  skip {src.name} (not found)")
        return 0
    rows = json.loads(src.read_text())
    if not isinstance(rows, list):
        print(f"  skip {src.name} (not a list)")
        return 0

    inserted = 0
    for r in rows:
        if not isinstance(r, dict):
            continue
        if not r.get("id") or not r.get("symbol") or r.get("entry_price") is None:
            continue
        side = (r.get("side") or "LONG").upper()
        if side not in ("LONG", "SHORT"):
            continue
        status = (r.get("status") or "open").lower()
        if status not in ("open", "closed"):
            continue
        db.upsert_paper_trade(conn, {
            "id": r["id"],
            "symbol": r["symbol"].upper(),
            "name": r.get("name"),
            "side": side,
            "status": status,
            "entry_price": float(r["entry_price"]),
            "exit_price": r.get("exit_price"),
            "target_price": r.get("target_price"),
            "stop_loss": r.get("stop_loss"),
            "quantity": float(r.get("quantity", 0) or 0),
            "pnl_pct": r.get("pnl_pct"),
            "pnl_abs": r.get("pnl_abs"),
            "strategy": r.get("strategy"),
            "sector": r.get("sector"),
            "notes": r.get("notes"),
            "close_reason": r.get("close_reason"),
            "agent": r.get("agent"),
            "agent_score": r.get("agent_score"),
            "market": r.get("market"),
            "created_at": iso(r.get("created_at")) or db.now_iso(),
            "updated_at": iso(r.get("updated_at")) or db.now_iso(),
            "closed_at": iso(r.get("closed_at")),
        })
        inserted += 1
    print(f"  ✓ paper_trades: {inserted} rows from {src.name}")
    return inserted


def migrate_editable_portfolio(conn) -> int:
    src = DATA / "editable_portfolio.json"
    if not src.exists():
        print(f"  skip {src.name} (not found)")
        return 0
    raw = json.loads(src.read_text())
    if not isinstance(raw, dict):
        print(f"  skip {src.name} (not an object)")
        return 0

    payload = {
        "id": 1,
        "name": str(raw.get("name", "Portfolio Widget Portfolio")),
        "positions": db.json_dumps(raw.get("positions", [])),
        "history": db.json_dumps(raw.get("history")) if raw.get("history") else None,
        "updated_at": iso(raw.get("updatedAt")) or db.now_iso(),
    }
    conn.execute(
        "INSERT OR REPLACE INTO editable_portfolio "
        "(id, name, positions, history, updated_at) VALUES (?, ?, ?, ?, ?)",
        (payload["id"], payload["name"], payload["positions"], payload["history"], payload["updated_at"]),
    )
    print(f"  ✓ editable_portfolio: 1 row from {src.name}")
    return 1


def _news_meta_for(article: dict) -> dict:
    """Pull fields common to news_data.json / news_analysis_result.json shapes."""
    return {
        "id": article.get("id"),
        "source": article.get("source"),
        "published_at": article.get("published_at"),
        "url": article.get("link") or article.get("url"),
        "headline": article.get("headline") or article.get("title") or "",
        "summary": article.get("summary"),
        "tickers": article.get("related_symbols") or article.get("tickers") or [],
    }


def migrate_news(conn) -> int:
    """Merge news_data.json + news_analysis_result.json into one set of rows.

    Articles and analyses are kept in separate tables. We prefer news_analysis
    rows (the AI-analyzed output) and fall back to raw news_data rows for the
    headline/source/published_at, deduping by id.
    """
    by_id: dict[str, dict] = {}
    analyses: dict[str, dict] = {}

    news_data_path = DATA / "news_data.json"
    if news_data_path.exists():
        try:
            data = json.loads(news_data_path.read_text())
        except json.JSONDecodeError:
            data = {}
        for art in data.get("news", []) or []:
            meta = _news_meta_for(art)
            if meta["id"]:
                by_id[meta["id"]] = meta

    analysis_path = DATA / "news_analysis_result.json"
    if analysis_path.exists():
        try:
            data = json.loads(analysis_path.read_text())
        except json.JSONDecodeError:
            data = {}
        for art in data.get("news", []) or []:
            meta = _news_meta_for(art)
            if not meta["id"]:
                continue
            # Prefer the analyzed article's metadata for headline/summary
            existing = by_id.get(meta["id"], {})
            by_id[meta["id"]] = {**existing, **meta}
            analyses[meta["id"]] = {
                "sentiment": art.get("sentiment"),
                "impact": art.get("risk_tag") or art.get("impact"),
                "highlights": art.get("highlights") or [],
                "reasoning": art.get("reasoning"),
                "related_symbols": art.get("related_symbols") or [],
                "readiness_score": art.get("readiness_score"),
                "analyzed_at": iso(art.get("analyzed_at")) or db.now_iso(),
            }

    if not by_id:
        print("  skip news_* (no articles found)")
        return 0

    inserted_articles = 0
    inserted_analyses = 0
    for art_id, a in by_id.items():
        if not a.get("headline"):
            continue
        conn.execute(
            "INSERT OR REPLACE INTO news_articles "
            "(id, source, published_at, url, headline, summary, tickers, raw) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (
                art_id,
                a.get("source"),
                a.get("published_at"),
                a.get("url"),
                a["headline"],
                a.get("summary"),
                db.json_dumps(a.get("tickers") or []),
                db.json_dumps(a),
            ),
        )
        inserted_articles += 1

        ana = analyses.get(art_id)
        if ana:
            conn.execute(
                "INSERT OR REPLACE INTO news_analyses "
                "(article_id, sentiment, impact, highlights, reasoning, "
                " related_symbols, readiness_score, analyzed_at) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    art_id,
                    ana["sentiment"],
                    ana["impact"],
                    db.json_dumps(ana["highlights"]),
                    ana["reasoning"],
                    db.json_dumps(ana["related_symbols"]),
                    ana["readiness_score"],
                    ana["analyzed_at"],
                ),
            )
            inserted_analyses += 1

    print(f"  ✓ news_articles: {inserted_articles} rows")
    print(f"  ✓ news_analyses: {inserted_analyses} rows")
    return inserted_articles


def main() -> int:
    db_path = db.configure()
    db.init_schema()
    conn = db.get_conn()
    print(f"Migrating into {db_path}\n")

    with db.transaction():
        n_paper = migrate_paper_trades(conn)
        n_editable = migrate_editable_portfolio(conn)
        n_news = migrate_news(conn)

    print(f"\nDone. paper={n_paper} editable={n_editable} news={n_news}")
    print("\nNext steps:")
    print("  1. Restart the backend: systemctl restart optitrade-backend (or kill+respawn)")
    print("  2. curl http://localhost:8000/api/paper-trading/history and compare to old response")
    print("  3. If everything looks good: git rm apps/backend/data/*.json")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())