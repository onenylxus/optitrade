#!/usr/bin/env python3
"""AI4Trade Signal Poller — Copy-Trading Decision Engine.

Runs every 30 minutes via cron. Reads signals from ai4trade.ai, decides whether
to follow them, and persists paper trades into the SQLite `paper_trades` table
(was paper_portfolios.json). Cross-machine sync now goes through the SQLite
file instead of git.
"""

import re
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

import requests

# ── Make `src` importable when run as a standalone script ────────────────────
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from src import db  # noqa: E402

# ── Config ────────────────────────────────────────────────────────────────────
TOKEN = "9dYToQwfOLY1paF6FX6s2MhnkrG9Hypdn5LH_S1WtsA"
HEADERS = {"Authorization": f"Bearer {TOKEN}"}
BASE_URL = "https://ai4trade.ai/api"
HKT = timezone(timedelta(hours=8))
LOG_FILE = Path("/root/.nanobot/workspace/logs/ai4trade_poll.log")
LOG_FILE.parent.mkdir(parents=True, exist_ok=True)

# Max open paper positions (5 slots per USER.md aggressive mode)
MAX_POSITIONS = 4
# Minimum score to auto-follow
MIN_SCORE_FOLLOW = 3
# Only report if score >= this
MIN_SCORE_REPORT = 2
# ── Aggressive rotation defaults (was -8% stop / +15% target) ───────────────
DEFAULT_STOP_PCT = 5.0          # -5% stop-loss
DEFAULT_TARGET_PCT = 10.0       # +10% target
# Stagnation exit: a position flat for STAGNATION_DAYS trading days
# with PnL in [STAGNATION_LOW, STAGNATION_HIGH]% is force-closed to free slot
STAGNATION_DAYS = 3
STAGNATION_LOW = -2.0
STAGNATION_HIGH = 3.0
# Earlier partial take-profit signal at +PARTIAL_TP_PCT% — trim half & move stop
PARTIAL_TP_PCT = 5.0
# ─────────────────────────────────────────────────────────────────────────────


def hkt_now() -> datetime:
    return datetime.now(HKT)


def log(msg: str) -> None:
    ts = hkt_now().strftime("%Y-%m-%d %H:%M")
    line = f"[{ts}] {msg}"
    print(line)
    with LOG_FILE.open("a") as f:
        f.write(line + "\n")


# ── Trade persistence ─────────────────────────────────────────────────────────
def load_open_trades() -> list[dict]:
    """All trades for analysis. Open positions drive the stop/target check."""
    conn = db.get_conn()
    return db.list_paper_trades(conn)


def upsert_trade(row: dict) -> None:
    with db.transaction() as conn:
        db.upsert_paper_trade(conn, row)


# ── Signals / heartbeat ───────────────────────────────────────────────────────
def fetch_signals(limit: int = 15) -> list[dict]:
    try:
        resp = requests.get(
            f"{BASE_URL}/signals/feed",
            headers=HEADERS,
            params={"limit": limit},
            timeout=10,
        )
        resp.raise_for_status()
        return resp.json().get("signals", [])
    except Exception as e:
        log(f"ERROR fetching signals: {e}")
        return []


def fetch_heartbeat() -> dict:
    try:
        resp = requests.get(f"{BASE_URL}/heartbeat", headers=HEADERS, timeout=10)
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        log(f"ERROR fetching heartbeat: {e}")
        return {}


def get_live_price(symbol: str) -> float | None:
    """Live price — yfinance first, fallback to FMP stable/quote-v1."""
    try:
        import yfinance
        ticker = yfinance.Ticker(symbol)
        info = ticker.fast_info
        price = (
            getattr(info, "last_price", None)
            or getattr(info, "last_close", None)
            or getattr(info, "previous_close", None)
        )
        if price:
            return float(price)
    except Exception:
        pass

    # FMP fallback (stable endpoint v1 — survives legacy deprecation)
    try:
        import os, requests
        api_key = os.environ.get("FMP_API_KEY")
        if not api_key:
            return None
        url = f"https://financialmodelingprep.com/stable/quote-v1?symbol={symbol}&apikey={api_key}"
        r = requests.get(url, timeout=10)
        if r.status_code == 200:
            data = r.json()
            if isinstance(data, list) and data:
                return float(data[0].get("price"))
            if isinstance(data, dict) and "price" in data:
                return float(data["price"])
    except Exception:
        pass

    return None


# ── Strategy parser ───────────────────────────────────────────────────────────
def parse_strategy_content(content: str) -> list[dict]:
    """Parse markdown blocks like `### AMD: **BUY** (Score: 7.9)` into recs."""
    recommendations: list[dict] = []

    triples = re.findall(
        r'###\s+([A-Z]{1,10})\s*:\s+\*\*([A-Z_]+)\*\*\s*\(Score:\s*([-\d.]+)\)',
        content,
    )

    sections = re.split(r'\n(?=###\s+[A-Z])', content)
    price_lookup: dict[str, float] = {}
    for sec in sections:
        sym_m = re.search(r'###\s+([A-Z]{1,10})', sec)
        price_m = re.search(r'Price:\s*\$?([\d,]+(?:\.\d+)?)', sec)
        if sym_m and price_m:
            price_lookup[sym_m.group(1)] = float(price_m.group(1).replace(",", ""))

    side_map = {
        "BUY": "LONG", "LIGHT_BUY": "LONG",
        "SELL": "SHORT", "LIGHT_SELL": "SHORT",
        "HOLD": None,
    }

    for sym, side_str, score_str in triples:
        side = side_map.get(side_str.upper())
        recommendations.append({
            "symbol": sym,
            "side": side,
            "score": float(score_str),
            "price": price_lookup.get(sym),
            "agent_recommendation": side_str,
        })

    return recommendations


# ── Evaluate one recommendation ───────────────────────────────────────────────
def evaluate_recommendation(rec: dict, agent_name: str, created_at: str, market: str) -> dict | None:
    sym = rec["symbol"]
    side = rec["side"]
    agent_score = rec["score"]
    price = rec["price"]

    if not side or not price:
        return None

    # Time decay: only act on fresh strategies (<6h old)
    age_hours = 999
    if created_at:
        try:
            dt = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
            age_hours = (datetime.now(timezone.utc) - dt).total_seconds() / 3600
        except Exception:
            pass

    if age_hours > 6:
        return None

    live_price = get_live_price(sym)
    if not live_price:
        return None

    score = 0.0
    reasons: list[str] = []

    if agent_score >= 7:
        score += 2
        reasons.append(f"Agent score {agent_score} (strong)")
    elif agent_score >= 4:
        score += 1
        reasons.append(f"Agent score {agent_score}")

    if price:
        diff_pct = abs(live_price - price) / price * 100
        if diff_pct <= 3:
            score += 1
            reasons.append(f"Entry price ${price:.2f} close to live ${live_price:.2f} ({diff_pct:.1f}% diff)")
        elif diff_pct <= 10:
            reasons.append(f"Entry price ${price:.2f} vs live ${live_price:.2f} ({diff_pct:.1f}% diff)")

    if market == "us-stock":
        score += 0.5
        reasons.append(f"US stock ({market})")

    ai_stocks = {"NVDA", "AMD", "AVGO", "MSFT", "MU", "QCOM", "TSLA", "LIN", "AXP", "BA"}
    if sym in ai_stocks:
        score += 1
        reasons.append(f"AI/tech theme match ({sym})")

    if side == "LONG":
        stop_loss = round(price * (1 - DEFAULT_STOP_PCT / 100), 2)
        target = round(price * (1 + DEFAULT_TARGET_PCT / 100), 2)
    else:
        stop_loss = round(price * (1 + DEFAULT_STOP_PCT / 100), 2)
        target = round(price * (1 - DEFAULT_TARGET_PCT / 100), 2)

    action = "SKIP"
    if score >= MIN_SCORE_FOLLOW:
        action = "FOLLOW"
    elif score >= MIN_SCORE_REPORT:
        action = "WATCH"

    return {
        "skip": action == "SKIP",
        "score": round(score, 1),
        "action": action,
        "symbol": sym,
        "side": side,
        "entry_price": price,
        "stop_loss": stop_loss,
        "target_price": target,
        "live_price": live_price,
        "agent": agent_name,
        "reasons": reasons,
        "market": market,
        "created_at": created_at,
    }


# ── Check existing positions against stop / target ────────────────────────────
def check_positions(trades: list[dict]) -> tuple[list[dict], list[dict]]:
    """Returns (updated_trades, events)."""
    updated = [dict(t) for t in trades]
    events: list[dict] = []

    for i, pos in enumerate(updated):
        if pos.get("status") != "open":
            continue

        sym = pos.get("symbol")
        side = pos.get("side", "LONG")
        entry = pos.get("entry_price")
        stop = pos.get("stop_loss")
        target = pos.get("target_price")
        pid = pos.get("id")

        if not sym or entry is None:
            continue

        price = get_live_price(sym)
        if not price:
            continue

        try:
            ep = float(entry)
            sp = float(stop) if stop else None
            tp = float(target) if target else None
        except (TypeError, ValueError):
            continue

        now_iso = hkt_now().isoformat()
        pct = ((price - ep) / ep * 100) if side in ("LONG", "BUY") else ((ep - price) / ep * 100)

        triggered_stop = sp is not None and ((side in ("LONG", "BUY") and price <= sp) or (side == "SHORT" and price >= sp))
        triggered_target = tp is not None and ((side in ("LONG", "BUY") and price >= tp) or (side == "SHORT" and price <= tp))

        if triggered_stop:
            updated[i]["status"] = "closed"
            updated[i]["closed_at"] = now_iso
            updated[i]["updated_at"] = now_iso
            updated[i]["close_reason"] = "STOP_LOSS"
            updated[i]["pnl_pct"] = round(pct, 2)
            updated[i]["exit_price"] = round(price, 4)
            events.append({
                "type": "STOP_LOSS",
                "symbol": sym,
                "details": f"STOP-LOSS hit — ${price:.2f} | PnL: {pct:.2f}%",
            })
        elif triggered_target:
            updated[i]["status"] = "closed"
            updated[i]["closed_at"] = now_iso
            updated[i]["updated_at"] = now_iso
            updated[i]["close_reason"] = "TARGET_HIT"
            updated[i]["pnl_pct"] = round(pct, 2)
            updated[i]["exit_price"] = round(price, 4)
            events.append({
                "type": "TARGET_HIT",
                "symbol": sym,
                "details": f"TARGET reached — ${price:.2f} | PnL: {pct:.2f}%",
            })
        else:
            updated[i]["current_price"] = round(price, 4)
            updated[i]["updated_at"] = now_iso
            updated[i]["pnl_pct"] = round(pct, 2)
            updated[i]["_dirty"] = True  # mark for SQLite flush
            if pct <= -8:
                events.append({
                    "type": "WARNING",
                    "symbol": sym,
                    "details": f"Down {pct:.2f}% — review stop-loss (currently ${sp:.2f})",
                })

            # ── Stagnation exit (rotate out of dead money) ──────────────
            created = pos.get("created_at")
            if created and STAGNATION_LOW < pct < STAGNATION_HIGH:
                try:
                    opened = datetime.fromisoformat(created)
                    days_held = (hkt_now() - opened).total_seconds() / 86400
                except Exception:
                    days_held = 0
                if days_held >= STAGNATION_DAYS:
                    updated[i]["status"] = "closed"
                    updated[i]["closed_at"] = now_iso
                    updated[i]["updated_at"] = now_iso
                    updated[i]["close_reason"] = "STAGNATION_EXIT"
                    updated[i]["pnl_pct"] = round(pct, 2)
                    updated[i]["exit_price"] = round(price, 4)
                    events.append({
                        "type": "STAGNATION_EXIT",
                        "symbol": sym,
                        "details": (
                            f"Stagnation exit — {days_held:.1f}d flat @ {pct:+.2f}% "
                            f"(range [{STAGNATION_LOW}, {STAGNATION_HIGH}]%). Free slot."
                        ),
                    })
                    continue

            # ── Partial TP signal at +PARTIAL_TP_PCT% ────────────────────
            if pct >= PARTIAL_TP_PCT and not pos.get("partial_tp_taken"):
                updated[i]["partial_tp_taken"] = True
                updated[i]["_dirty"] = True
                events.append({
                    "type": "PARTIAL_TP",
                    "symbol": sym,
                    "details": (
                        f"Partial TP level hit @ +{pct:.2f}% — consider trimming half. "
                        f"Move stop to breakeven ${ep:.2f}."
                    ),
                })

    return updated, events


# ── Build a new trade row ─────────────────────────────────────────────────────
def build_trade_row(ev: dict) -> dict:
    now = hkt_now().isoformat()
    entry = ev["entry_price"]
    live = ev.get("live_price") or entry
    sym = ev["symbol"]
    return {
        "id": f"paper-{sym}-{now[:13].replace(':', '-')}",
        "symbol": sym,
        "name": f"AI4Trade Copy — {sym}",
        "status": "open",
        "side": ev["side"],
        "entry_price": entry,
        "exit_price": None,
        "current_price": live,
        "live_price": live,
        "target_price": ev["target_price"],
        "stop_loss": ev["stop_loss"],
        "quantity": 10,
        "pnl_pct": 0.0,
        "pnl_abs": 0.0,
        "strategy": f"AI4Trade — {ev['agent']}",
        "sector": "AI / Tech",
        "notes": (
            f"{ev['agent']} entry on "
            f"{hkt_now().strftime('%b %d')} (score {ev.get('score')}/5). "
            f"{ev['side']} @ ${entry:.2f} → target +{DEFAULT_TARGET_PCT}% / stop -{DEFAULT_STOP_PCT}%. "
            f"Aggressive mode — stagnation exit after {STAGNATION_DAYS}d in "
            f"[{STAGNATION_LOW}%, {STAGNATION_HIGH}%], partial TP at +{PARTIAL_TP_PCT}%."
        ),
        "close_reason": None,
        "agent": ev["agent"],
        "agent_score": ev.get("score"),
        "market": ev.get("market"),
        "created_at": now,
        "updated_at": now,
        "closed_at": None,
    }


# ── Main ──────────────────────────────────────────────────────────────────────
def main() -> list[dict]:
    db.init_schema()  # no-op if already initialized

    log("=" * 55)
    log("AI4Trade Poller START")
    log("=" * 55)

    trades = load_open_trades()
    events: list[dict] = []

    # 1. Check existing positions
    open_count = sum(1 for t in trades if t.get("status") == "open")
    log(f"Checking {open_count} open positions...")
    trades, pos_events = check_positions(trades)
    events.extend(pos_events)

    # 2. Parse strategy signals and evaluate recommendations
    signals = fetch_signals(limit=15)
    new_follows: list[dict] = []
    open_symbols = {t.get("symbol") for t in trades if t.get("status") == "open"}

    for sig in signals:
        msg_type = sig.get("message_type", "")
        mkt = sig.get("market", "")
        agent = sig.get("agent_name", "Unknown")
        created = sig.get("created_at", "")
        content = sig.get("content", "")

        if msg_type == "strategy" and content:
            recs = parse_strategy_content(content)
            log(f"  [{agent}] {mkt} — {len(recs)} recommendations parsed")
            for rec in recs:
                ev = evaluate_recommendation(rec, agent, created, mkt)
                if ev and not ev.get("skip") and ev["action"] == "FOLLOW":
                    if ev["symbol"] not in open_symbols:
                        new_follows.append(ev)
                        open_symbols.add(ev["symbol"])

    # 3. Auto-follow (up to MAX_POSITIONS)
    open_count = sum(1 for t in trades if t.get("status") == "open")
    for ev in new_follows:
        if open_count >= MAX_POSITIONS:
            log(f"  Max positions ({MAX_POSITIONS}) reached — skipping {ev['symbol']}")
            break
        row = build_trade_row(ev)
        upsert_trade(row)
        trades.append(row)
        open_count += 1
        events.append({
            "type": "NEW_POSITION",
            "symbol": ev["symbol"],
            "details": (
                f"🤖 FOLLOWED {ev['symbol']} {ev['side']} @ ${ev['entry_price']:.2f} "
                f"(live ${ev['live_price']:.2f}) | SL: ${ev['stop_loss']:.2f} | "
                f"Target: ${ev['target_price']:.2f} | Score: {ev['score']}★ | by {ev['agent']}"
            ),
        })
        log(f"  ✅ AUTO-FOLLOW: {ev['symbol']} {ev['side']} @ ${ev['entry_price']:.2f}")

    # 4. Persist every dirty row (closed trades AND live-price updates for
    # open trades). Without this, current_price / pnl_pct / updated_at for open
    # positions stay frozen at entry values in SQLite.
    for t in trades:
        if t.get("_dirty"):
            upsert_trade(t)

    # 5. Portfolio summary
    open_p = [t for t in trades if t.get("status") == "open"]
    closed = [t for t in trades if t.get("status") == "closed"]
    total_pnl = sum(t.get("pnl_pct", 0) or 0 for t in closed)
    log(f"Portfolio: {len(open_p)} open | {len(closed)} closed | Closed PnL: {total_pnl:.2f}%")
    for t in open_p:
        pnl = t.get("pnl_pct", 0)
        cur = t.get("current_price") or t.get("live_price") or "?"
        log(f"  💼 {t['symbol']} {t['side']} | entry ${t['entry_price']} | cur ${cur} | {pnl:+.2f}%")

    # 6. Report important events
    if events:
        log("EVENTS:")
        for e in events:
            log(f"  [{e['type']}] {e['symbol']}: {e['details']}")

    log("AI4Trade Poller END")
    log("-" * 55)
    return events


if __name__ == "__main__":
    main()