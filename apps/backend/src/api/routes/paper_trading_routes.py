"""Paper trading HTTP routes — reads from SQLite (paper_trades table) and
enriches each open position with a live price snapshot.

This replaces the old pattern where:
  ai4trade poller -> paper_portfolios.json -> Next.js route reads file -> widget

New flow:
  ai4trade poller -> paper_trades table -> this FastAPI route -> widget
"""

from __future__ import annotations

import asyncio
import os
from datetime import datetime, timezone
from typing import Any

import httpx
from fastapi import APIRouter, Query

from src import db

router = APIRouter()

PRICE_TIMEOUT_SECONDS = 4.0
OPENROUTER_HTTP_TIMEOUT = httpx.Timeout(connect=2.0, read=PRICE_TIMEOUT_SECONDS, write=2.0, pool=2.0)


# ── Live price enrichment ─────────────────────────────────────────────────────
# Match the lookup the old Next.js route did: only fetch prices for symbols
# that still have an open position, and only if we don't already have a
# fresh-enough cached snapshot in the price_cache table.
async def _fetch_live_price(client: httpx.AsyncClient, backend_host: str, symbol: str) -> tuple[float | None, str]:
    """Returns (price, source). Calls self /api/price/{symbol} (FMP+yfinance)."""
    try:
        resp = await client.get(f"{backend_host}/api/price/{symbol}", timeout=PRICE_TIMEOUT_SECONDS)
        if resp.status_code != 200:
            return None, "unavailable"
        data = resp.json()
        price = data.get("price")
        if isinstance(price, (int, float)) and price > 0:
            return float(price), str(data.get("source", "unknown"))
    except Exception:
        pass
    return None, "unavailable"


async def _enrich_with_prices(rows: list[dict[str, Any]]) -> dict[str, tuple[float, str]]:
    """Returns {symbol: (price, source)} for the open positions."""
    open_symbols = sorted({r["symbol"] for r in rows if r.get("status") == "open"})
    if not open_symbols:
        return {}

    # Pick the backend base URL: prefer INTERNAL_BACKEND_URL, fall back to the
    # FastAPI server's own host:port.
    backend_host = os.environ.get("INTERNAL_BACKEND_URL", "").rstrip("/")
    if not backend_host:
        # 127.0.0.1:8000 is the default Uvicorn bind.
        backend_host = "http://127.0.0.1:8000"

    out: dict[str, tuple[float, str]] = {}
    async with httpx.AsyncClient(timeout=OPENROUTER_HTTP_TIMEOUT) as client:
        results = await asyncio.gather(
            *[_fetch_live_price(client, backend_host, sym) for sym in open_symbols],
            return_exceptions=False,
        )
    for sym, (price, source) in zip(open_symbols, results):
        if price is not None:
            out[sym] = (price, source)
    return out


# ── Enrichment helpers (mirrors the old Next.js route) ───────────────────────
SECTOR_BY_SYMBOL: dict[str, str] = {
    # AI / Semiconductors
    "AMD": "AI / Semiconductors", "NVDA": "AI / Semiconductors",
    "AVGO": "AI / Semiconductors", "MU": "AI / Semiconductors",
    "INTC": "AI / Semiconductors", "SOUN": "AI / Semiconductors",
    "TSM": "AI / Semiconductors", "SMCI": "AI / Semiconductors",
    "ARM": "AI / Semiconductors",
    # AI / Software & Internet
    "GOOGL": "Tech / Internet", "META": "Tech / Internet",
    "MSFT": "Tech / Software", "AMZN": "Tech / Internet",
    "NFLX": "Tech / Media", "AAPL": "Tech / Hardware",
    # Financials
    "JPM": "Financials", "AXP": "Financials", "GS": "Financials",
    "BAC": "Financials", "V": "Financials", "MA": "Financials",
    # Consumer
    "TSLA": "Consumer / Auto", "WMT": "Consumer / Retail",
    "HD": "Consumer / Retail",
    # Crypto-adjacent
    "COIN": "Crypto / Fintech", "MSTR": "Crypto / Fintech",
    # Other
    "FIG": "Tech / SaaS", "UBER": "Tech / Mobility",
    "ABNB": "Consumer / Travel", "SHOP": "Tech / SaaS",
    "SQ": "Fintech", "PLTR": "Tech / Software",
}


def _sector_for(symbol: str) -> str:
    return SECTOR_BY_SYMBOL.get(symbol.upper(), "Equity")


def _strategy_for(row: dict[str, Any]) -> str:
    agent = row.get("agent")
    return f"AI4Trade — {agent}" if agent else "AI4Trade"


def _notes_for(row: dict[str, Any]) -> str:
    agent = row.get("agent") or "AI4Trade"
    score = row.get("agent_score")
    score_s = f"{score:.1f}" if isinstance(score, (int, float)) else "?"
    opened = row.get("created_at") or ""
    try:
        opened_disp = datetime.fromisoformat(opened.replace("Z", "+00:00")).strftime("%b %d")
    except (TypeError, ValueError):
        opened_disp = "unknown"
    side = row.get("side") or "LONG"
    entry = row.get("entry_price") or 0
    target = row.get("target_price")
    stop = row.get("stop_loss")
    target_pct = f"{((target / entry) - 1) * 100:.1f}" if target and entry else "?"
    stop_pct = f"{((stop / entry) - 1) * 100:.1f}" if stop and entry else "?"
    return (
        f"{agent} entry on {opened_disp} (score {score_s}/5). "
        f"{side} @ ${entry:.2f} → target +{target_pct}% / stop {stop_pct}%."
    )


def _pnl_pct(entry: float, current: float, side: str) -> float:
    if side == "SHORT":
        return ((entry - current) / entry) * 100 if entry else 0.0
    return ((current - entry) / entry) * 100 if entry else 0.0


def _build_enriched(rows: list[dict[str, Any]], live_prices: dict[str, tuple[float, str]]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for r in rows:
        is_open = r.get("status") == "open"
        if is_open:
            lp = live_prices.get(r["symbol"])
            if lp is not None:
                current_price, price_source = lp
                price_stale = False
            else:
                current_price = (
                    r.get("current_price")
                    or r.get("live_price")
                    or r.get("entry_price")
                    or 0
                )
                price_source = "snapshot"
                price_stale = True
        else:
            current_price = r.get("exit_price") or r.get("entry_price") or 0
            price_source = "snapshot"
            price_stale = False

        entry = r.get("entry_price") or 0
        qty = r.get("quantity") or 0
        side = r.get("side") or "LONG"
        pnl_pct = _pnl_pct(entry, current_price, side) if entry else 0.0
        pnl_abs = (current_price - entry) * qty * (1 if side == "LONG" else -1)

        out.append({
            "id": r["id"],
            "symbol": r["symbol"],
            "name": r.get("name") or f"AI4Trade Copy — {r['symbol']}",
            "status": r["status"],
            "side": side,
            "entry_price": entry,
            "exit_price": None if is_open else current_price,
            "current_price": current_price,
            "live_price": current_price if is_open else (r.get("live_price") or current_price),
            "target_price": r.get("target_price"),
            "stop_loss": r.get("stop_loss"),
            "quantity": qty,
            "pnl_pct": round(pnl_pct, 2),
            "pnl_abs": round(pnl_abs, 2) if pnl_abs is not None else None,
            "strategy": _strategy_for(r),
            "sector": r.get("sector") or _sector_for(r["symbol"]),
            "notes": r.get("notes") or _notes_for(r),
            "close_reason": r.get("close_reason"),
            "closed_at": r.get("closed_at"),
            "created_at": r.get("created_at"),
            "updated_at": r.get("updated_at"),
            "agent": r.get("agent"),
            "agent_score": r.get("agent_score"),
            "price_source": price_source,
            "price_stale": price_stale,
        })
    return out


def _build_stats(enriched: list[dict[str, Any]]) -> dict[str, Any] | None:
    closed = [p for p in enriched if p["status"] == "closed"]
    if not closed:
        return None
    wins = [p for p in closed if p["pnl_pct"] >= 0]
    losses = [p for p in closed if p["pnl_pct"] < 0]
    avg_win = sum(p["pnl_pct"] for p in wins) / len(wins) if wins else 0.0
    avg_loss = sum(p["pnl_pct"] for p in losses) / len(losses) if losses else 0.0
    total_pnl = sum(p["pnl_pct"] for p in closed)
    return {
        "totalTrades": len(closed),
        "wins": len(wins),
        "losses": len(losses),
        "winRate": (len(wins) / len(closed)) * 100,
        "avgWinPct": round(avg_win, 2),
        "avgLossPct": round(avg_loss, 2),
        "totalPnlPct": round(total_pnl, 2),
    }


# ── Routes ────────────────────────────────────────────────────────────────────
@router.get("/history")
async def get_paper_trading_history(
    enrich: bool = Query(default=True, description="Set false to skip live price lookup"),
) -> dict[str, Any]:
    """List every paper trade with live-price enrichment for open positions."""
    conn = db.get_conn()
    rows = db.list_paper_trades(conn)

    live_prices = await _enrich_with_prices(rows) if enrich else {}
    enriched = _build_enriched(rows, live_prices)
    open_pos = [p for p in enriched if p["status"] == "open"]
    closed_pos = [p for p in enriched if p["status"] == "closed"]
    stats = _build_stats(enriched)

    return {
        "positions": enriched,
        "open": open_pos,
        "closed": closed_pos,
        "stats": stats,
        "asOf": datetime.now(timezone.utc).isoformat(),
        "source": "paper_trades (sqlite) + live price enrichment",
    }