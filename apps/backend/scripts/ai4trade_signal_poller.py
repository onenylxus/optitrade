#!/usr/bin/env python3
"""
AI4Trade Signal Poller — Copy-Trading Decision Engine
Runs every 30 mins via cron. Reports only if important (new follow, stop-loss, target).
"""

import json
import re
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

import requests

# ── Config ────────────────────────────────────────────────────────────────────
TOKEN = "9dYToQwfOLY1paF6FX6s2MhnkrG9Hypdn5LH_S1WtsA"
HEADERS = {"Authorization": f"Bearer {TOKEN}"}
BASE_URL = "https://ai4trade.ai/api"
PAPER_FILE = Path("/root/optitrade-clone/apps/backend/data/paper_portfolios.json")
HKT = timezone(timedelta(hours=8))
LOG_FILE = Path("/root/.nanobot/workspace/logs/ai4trade_poll.log")
LOG_FILE.parent.mkdir(parents=True, exist_ok=True)

# Max open paper positions
MAX_POSITIONS = 3
# Minimum score to auto-follow
MIN_SCORE_FOLLOW = 3
# Only report if score >= this
MIN_SCORE_REPORT = 2
# ─────────────────────────────────────────────────────────────────────────────

def hkt_now():
    return datetime.now(HKT)

def log(msg: str):
    ts = hkt_now().strftime("%Y-%m-%d %H:%M")
    line = f"[{ts}] {msg}"
    print(line)
    with LOG_FILE.open("a") as f:
        f.write(line + "\n")

def load_paper_portfolios():
    if not PAPER_FILE.exists():
        return []
    with PAPER_FILE.open() as f:
        data = json.load(f)
        return data if isinstance(data, list) else []

def save_paper_portfolios(records):
    with PAPER_FILE.open("w") as f:
        json.dump(records, f, indent=2)

def fetch_signals(limit=15):
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

def fetch_heartbeat():
    try:
        resp = requests.get(f"{BASE_URL}/heartbeat", headers=HEADERS, timeout=10)
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        log(f"ERROR fetching heartbeat: {e}")
        return {}

def get_live_price(symbol: str) -> float | None:
    try:
        import yfinance
        ticker = yfinance.Ticker(symbol)
        info = ticker.fast_info
        # Use attribute access (fast_info is not a plain dict)
        price = getattr(info, 'last_price', None) or getattr(info, 'previous_close', None)
        return float(price) if price else None
    except Exception:
        return None

# ── Strategy parser ────────────────────────────────────────────────────────────
# Parses content like:
#   ### AMD: **BUY** (Score: 7.9)
#   - Price: $536.75
# Returns list of {symbol, side, score, price}
def parse_strategy_content(content: str) -> list[dict]:
    recommendations = []

    # Direct regex: extract all symbol/side/score triples
    triples = re.findall(
        r'###\s+([A-Z]{1,10})\s*:\s+\*\*([A-Z_]+)\*\*\s*\(Score:\s*([-\d.]+)\)',
        content
    )

    # For each symbol, find its price from the surrounding context
    # Split content into blocks per "### SYM:" section
    sections = re.split(r'\n(?=###\s+[A-Z])', content)

    # Build a price lookup: {"AMD": 536.75, ...}
    price_lookup = {}
    for sec in sections:
        sym_m = re.search(r'###\s+([A-Z]{1,10})', sec)  # not anchored
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

# ── Evaluate a single stock recommendation ────────────────────────────────────
def evaluate_recommendation(rec: dict, agent_name: str, created_at: str, market: str) -> dict | None:
    sym = rec["symbol"]
    side = rec["side"]
    agent_score = rec["score"]
    price = rec["price"]

    if not side or not price:  # HOLD has no action
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
        return None  # Too stale to act on

    # Fetch live price
    live_price = get_live_price(sym)
    if not live_price:
        return None

    # Score based on agent score + our own verification
    score = 0
    reasons = []

    # Agent signal quality
    if agent_score >= 7:
        score += 2
        reasons.append(f"Agent score {agent_score} (strong)")
    elif agent_score >= 4:
        score += 1
        reasons.append(f"Agent score {agent_score}")

    # Price proximity — entry within 3% of current
    if price:
        diff_pct = abs(live_price - price) / price * 100
        if diff_pct <= 3:
            score += 1
            reasons.append(f"Entry price ${price:.2f} close to live ${live_price:.2f} ({diff_pct:.1f}% diff)")
        elif diff_pct <= 10:
            reasons.append(f"Entry price ${price:.2f} vs live ${live_price:.2f} ({diff_pct:.1f}% diff)")

    # Market filter — prefer US stocks for now
    if market == "us-stock":
        score += 0.5
        reasons.append(f"US stock ({market})")

    # AI/semiconductor theme bonus (aligned with Timmy's interests)
    ai_stocks = {"NVDA", "AMD", "AVGO", "MSFT", "MU", "QCOM", "TSLA", "LIN", "AXP", "BA"}
    if sym in ai_stocks:
        score += 1
        reasons.append(f"AI/tech theme match ({sym})")

    # Calculate rough stop-loss and target
    if side == "LONG":
        stop_loss = round(price * 0.92, 2)  # -8% default stop
        target = round(price * 1.15, 2)     # +15% default target
    else:
        stop_loss = round(price * 1.08, 2)
        target = round(price * 0.85, 2)

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

# ── Check existing positions ──────────────────────────────────────────────────
def check_positions(paper: list[dict]) -> tuple[list[dict], list[dict]]:
    """
    Review open positions. Returns (updated_paper, events).
    events: list of {type, symbol, details} to report if important.
    """
    updated = list(paper)
    events = []

    for i, pos in enumerate(updated):
        if pos.get("status") != "open":
            continue

        sym = pos.get("symbol")
        side = pos.get("side", "LONG")
        entry = pos.get("avgPrice") or pos.get("entry_price")
        stop = pos.get("stop_loss")
        target = pos.get("target_price")
        pid = pos.get("id")

        price = get_live_price(sym)
        if not price or not entry:
            continue

        try:
            ep = float(entry)
            sp = float(stop) if stop else None
            tp = float(target) if target else None

            if side in ("LONG", "BUY"):
                pct = (price - ep) / ep * 100
                if sp and price <= sp:
                    updated[i]["status"] = "closed"
                    updated[i]["closed_at"] = hkt_now().isoformat()
                    updated[i]["close_reason"] = "STOP_LOSS"
                    updated[i]["pnl_pct"] = round((price - ep) / ep * 100, 2)
                    events.append({
                        "type": "STOP_LOSS",
                        "symbol": sym,
                        "details": f"STOP-LOSS hit — ${price:.2f} ≤ ${sp:.2f} | PnL: {pct:.2f}%",
                    })
                elif tp and price >= tp:
                    updated[i]["status"] = "closed"
                    updated[i]["closed_at"] = hkt_now().isoformat()
                    updated[i]["close_reason"] = "TARGET_HIT"
                    updated[i]["pnl_pct"] = round((price - ep) / ep * 100, 2)
                    events.append({
                        "type": "TARGET_HIT",
                        "symbol": sym,
                        "details": f"TARGET reached — ${price:.2f} ≥ ${tp:.2f} | PnL: {pct:.2f}%",
                    })
                else:
                    updated[i]["current_price"] = round(price, 4)
                    updated[i]["currentPrice"] = round(price, 4)
                    updated[i]["pnl_pct"] = round(pct, 2)
                    if pct <= -8:
                        events.append({
                            "type": "WARNING",
                            "symbol": sym,
                            "details": f"Down {pct:.2f}% — review stop-loss (currently ${sp:.2f})",
                        })
            else:  # SHORT
                pct = (ep - price) / ep * 100
                if sp and price >= sp:
                    updated[i]["status"] = "closed"
                    updated[i]["closed_at"] = hkt_now().isoformat()
                    updated[i]["close_reason"] = "STOP_LOSS"
                    updated[i]["pnl_pct"] = round((ep - price) / ep * 100, 2)
                    events.append({
                        "type": "STOP_LOSS",
                        "symbol": sym,
                        "details": f"STOP-LOSS hit — ${price:.2f} ≥ ${sp:.2f} | PnL: {pct:.2f}%",
                    })
                elif tp and price <= tp:
                    updated[i]["status"] = "closed"
                    updated[i]["closed_at"] = hkt_now().isoformat()
                    updated[i]["close_reason"] = "TARGET_HIT"
                    updated[i]["pnl_pct"] = round((ep - price) / ep * 100, 2)
                    events.append({
                        "type": "TARGET_HIT",
                        "symbol": sym,
                        "details": f"TARGET reached — ${price:.2f} ≤ ${tp:.2f} | PnL: {pct:.2f}%",
                    })
                else:
                    updated[i]["current_price"] = round(price, 4)
                    updated[i]["currentPrice"] = round(price, 4)
                    updated[i]["pnl_pct"] = round(pct, 2)
                    if pct <= -8:
                        events.append({
                            "type": "WARNING",
                            "symbol": sym,
                            "details": f"Short down {pct:.2f}% — review stop-loss (currently ${sp:.2f})",
                        })
        except (ValueError, TypeError):
            pass

    return updated, events

# ── Build paper position record ───────────────────────────────────────────────
def build_position(ev: dict) -> dict:
    now = hkt_now().isoformat()
    entry = ev["entry_price"]
    live = ev.get("live_price") or entry
    return {
        "id": f"paper-{ev['symbol']}-{now[:13].replace(':', '-')}",
        "name": f"AI4Trade Copy — {ev['symbol']}",
        "status": "open",
        "side": ev["side"],
        "symbol": ev["symbol"],
        # Schema for editable_portfolio.json (PortfolioWidget uses this)
        "quantity": 10,
        "avgPrice": entry,
        "currentPrice": live,
        "sector": "AI / Tech",
        # Extended fields for our own tracking
        "entry_price": entry,
        "target_price": ev["target_price"],
        "stop_loss": ev["stop_loss"],
        "live_price": live,
        "agent": ev["agent"],
        "agent_score": ev.get("score"),
        "market": ev.get("market"),
        "created_at": now,
        "updated_at": now,
    }

# ── Main ───────────────────────────────────────────────────────────────────────
def main():
    log("=" * 55)
    log("AI4Trade Poller START")
    log("=" * 55)

    signals = fetch_signals(limit=15)
    paper = load_paper_portfolios()
    events = []  # Things to report to user

    # 1. Check existing positions
    log(f"Checking {len([p for p in paper if p.get('status')=='open'])} open positions...")
    paper, pos_events = check_positions(paper)
    events.extend(pos_events)

    # 2. Parse strategy signals and evaluate recommendations
    new_follows = []
    open_symbols = {p.get("symbol") for p in paper if p.get("status") == "open"}

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
    open_count = len([p for p in paper if p.get("status") == "open"])
    for ev in new_follows:
        if open_count >= MAX_POSITIONS:
            log(f"  Max positions ({MAX_POSITIONS}) reached — skipping {ev['symbol']}")
            break
        pos = build_position(ev)
        paper.append(pos)
        open_count += 1
        events.append({
            "type": "NEW_POSITION",
            "symbol": ev["symbol"],
            "details": f"🤖 FOLLOWED {ev['symbol']} {ev['side']} @ ${ev['entry_price']:.2f} "
                       f"(live ${ev['live_price']:.2f}) | SL: ${ev['stop_loss']:.2f} | "
                       f"Target: ${ev['target_price']:.2f} | Score: {ev['score']}★ | by {ev['agent']}",
        })
        log(f"  ✅ AUTO-FOLLOW: {ev['symbol']} {ev['side']} @ ${ev['entry_price']:.2f}")

    save_paper_portfolios(paper)

    # Also write to editable_portfolio.json so PortfolioWidget sees it
    EDITABLE_FILE = Path("/root/optitrade-clone/apps/backend/data/editable_portfolio.json")
    editable = {
        "name": "AI4Trade Copy Portfolio",
        "positions": [
            {
                "id": p["id"],
                "symbol": p["symbol"],
                "quantity": p.get("quantity", 10),
                "avgPrice": p.get("avgPrice") or p.get("entry_price"),
                "currentPrice": p.get("currentPrice") or p.get("live_price") or p.get("avgPrice") or p.get("entry_price"),
                "sector": p.get("sector", "AI / Tech"),
            }
            for p in paper if p.get("status") == "open"
        ],
        "updatedAt": hkt_now().isoformat(),
    }
    with EDITABLE_FILE.open("w") as f:
        json.dump(editable, f, indent=2)

    # Sync to GitHub for cross-machine access
    try:
        import subprocess
        repo = Path("/root/optitrade-clone")
        msg = f"AI4Trade sync {hkt_now().strftime('%Y-%m-%d %H:%M')}"
        subprocess.run(["git", "add", "apps/backend/data/paper_portfolios.json",
                        "apps/backend/data/editable_portfolio.json"],
                       cwd=repo, capture_output=True)
        result = subprocess.run(["git", "commit", "-m", msg], cwd=repo, capture_output=True, text=True)
        if result.returncode == 0:
            subprocess.run(["git", "push", "origin", "master"], cwd=repo, capture_output=True)
            log("  📤 Synced to GitHub")
        # if nothing to commit, that's fine — no-op
    except Exception as e:
        log(f"  ⚠️  Git sync failed: {e}")

    # 4. Portfolio summary
    open_p = [p for p in paper if p.get("status") == "open"]
    closed = [p for p in paper if p.get("status") == "closed"]
    total_pnl = sum(p.get("pnl_pct", 0) or 0 for p in closed)

    log(f"Portfolio: {len(open_p)} open | {len(closed)} closed | Closed PnL: {total_pnl:.2f}%")
    for p in open_p:
        pnl = p.get("pnl_pct", 0)
        entry_disp = p.get("avgPrice") or p.get("entry_price") or "?"
        cur = p.get("current_price") or p.get("currentPrice") or p.get("live_price") or "?"
        log(f"  💼 {p['symbol']} {p['side']} | entry ${p['entry_price']} | cur ${cur} | {pnl:+.2f}%")

    # 5. Report important events
    if events:
        log("EVENTS:")
        for e in events:
            log(f"  [{e['type']}] {e['symbol']}: {e['details']}")

    log("AI4Trade Poller END")
    log("-" * 55)

    return events  # cron job will use this

if __name__ == "__main__":
    main()
