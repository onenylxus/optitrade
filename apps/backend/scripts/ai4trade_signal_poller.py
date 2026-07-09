#!/usr/bin/env python3
"""AI4Trade Signal Poller — Copy-Trading Decision Engine.

Runs every 30 minutes via cron. Reads signals from ai4trade.ai, decides whether
to follow them, and persists paper trades into the SQLite `paper_trades` table
(was paper_portfolios.json). Cross-machine sync now goes through the SQLite
file instead of git.
"""

import json
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

# ── Notification deduplication (only ping Discord when something happened) ──────
# Persist a state snapshot after every run. Next run diffs against it; if nothing
# material changed, poller logs silently and never publishes a reminder. This is
# what stops the 30-min "Flat, no triggers" spam during flat / closed-market hours.
STATE_FILE = Path("/root/.nanobot/workspace/logs/ai4trade_poller_state.json")
STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
PNL_ALERT_PCT = 3.0  # re-notify if any open position moves >= ±3% since last alert

# Max open paper positions (5 slots per USER.md aggressive mode)
MAX_POSITIONS = 4
# Minimum score to auto-follow (Tier 1: raised from 3 → 4; 3.5★ signals
# averaged -4.41% across 4 trades vs 4.5★ +0.84% across 9 trades)
MIN_SCORE_FOLLOW = 4
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
# ── Tier 1 follow-filters (added 2026-07-08, tightened 2026-07-09) ──────────
# Don't re-enter the same symbol within this many hours of a prior WIN/TP.
# Stops same-day whipsaw churn while still letting overnight setups through.
SAME_SYMBOL_COOLDOWN_HOURS = 24
# After a LOSS-close on a symbol, the cooldown is extended to this many hours
# — losing twice on the same ticker in 48h has historically never worked.
SAME_SYMBOL_LOSS_COOLDOWN_HOURS = 72
# Maximum open positions allowed in the same symbol at any one time
MAX_POSITIONS_PER_SYMBOL = 1
# Hard blacklist: symbols where historical win-rate is too poor to keep
# re-entering. MU has 1 win / 7 losses-or-flat across 8 attempts (12.5%).
BLACKLIST_SYMBOLS = {"MU"}
# Signal freshness — reject signals older than this many minutes. Was 6h
# which let through stale entries (2026-07-09 03:33 OKLO/HST were hours old).
SIGNAL_MAX_AGE_MINUTES = 15
# US-only scope: ignore crypto/A-share signals entirely (was relying on
# score gate, now hard filter per scope guardrail).
ALLOWED_MARKETS = {"us-stock"}
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


def _load_follow_list_cache() -> tuple[list[str], str] | None:
    """Read cached (list, refreshed_at_iso) from SQLite. None if missing."""
    try:
        with db.transaction() as conn:
            row = conn.execute(
                "SELECT list_json, refreshed_at FROM follow_list_cache WHERE id=1"
            ).fetchone()
        if not row:
            return None
        return (db.json_loads(row["list_json"]), row["refreshed_at"])
    except Exception:
        return None


def _save_follow_list_cache(names: list[str]) -> None:
    """Persist the chosen follow list + refresh timestamp."""
    with db.transaction() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO follow_list_cache (id, list_json, refreshed_at) "
            "VALUES (1, ?, ?)",
            (db.json_dumps(sorted(set(names))), hkt_now().isoformat()),
        )


def refresh_follow_list() -> list[str]:
    """Return current dynamic follow list. Hit leaderboard every
    LEADERBOARD_REFRESH_HOURS hours; otherwise return cached list.

    Selection logic:
        1. Always include PINNED_AGENTS (raftapart, etc.) — these are our
           trusted workhorses regardless of recent activity.
        2. Pull top DYNAMIC_FOLLOW_LIMIT active agents from the platform's
           /signals/grouped endpoint (sorted by signal_count).
        3. Dedupe, cache in SQLite, return.
    """
    cached = _load_follow_list_cache()
    if cached:
        names, refreshed_at = cached
        try:
            dt = datetime.fromisoformat(refreshed_at)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=HKT)
            age_hours = (hkt_now() - dt).total_seconds() / 3600
            if age_hours < LEADERBOARD_REFRESH_HOURS:
                return names
        except Exception:
            pass

    # Stale cache or first run — fetch fresh from leaderboard
    board = fetch_agent_leaderboard(limit=20, market="us-stock",
                                      min_last_signal_hours=72)
    # Filter by minimum signal count (kills one-off noise agents)
    eligible = [a for a in board if a.get("signal_count", 0) >= MIN_AGENT_SIGNAL_COUNT]
    top = eligible[:DYNAMIC_FOLLOW_LIMIT]
    top_names = [a["agent_name"] for a in top if a.get("agent_name")]
    # Merge with pinned (always include pinned, dedupe)
    combined = sorted(set(top_names) | set(PINNED_AGENTS))
    _save_follow_list_cache(combined)
    return combined


# ── State snapshot helpers (used to silence non-actionable runs) ──────────────
def load_state() -> dict:
    """Return last published state or empty defaults."""
    if not STATE_FILE.exists():
        return {"open_ids": [], "open_pnl": {}, "closed_ids": [], "last_published_at": None}
    try:
        return json.loads(STATE_FILE.read_text())
    except Exception:
        return {"open_ids": [], "open_pnl": {}, "closed_ids": [], "last_published_at": None}


def save_state(state: dict) -> None:
    """Atomic write so a crashed run never leaves a half-written file."""
    tmp = STATE_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(state, indent=2))
    tmp.replace(STATE_FILE)


def compute_diff(trades: list[dict], prev: dict) -> list[str]:
    """Return a list of human-readable messages worth notifying about.
    Empty list = nothing material changed → poller runs silently.

    State tracks (a) currently-open trade ids, (b) pnl per open id, and
    (c) the set of closed trade ids already notified. New in this run =
    open_ids - prev_open_ids, or closed_ids - prev_closed_ids. Big swings
    on existing opens also fire when |Δpnl| >= PNL_ALERT_PCT.
    """
    msgs: list[str] = []
    open_now = [t for t in trades if t.get("status") == "open"]
    closed_now = [t for t in trades if t.get("status") == "closed" and t.get("close_reason")]

    open_ids_now = {t.get("id") for t in open_now}
    open_ids_prev = set(prev.get("open_ids") or [])
    closed_ids_now = {t.get("id") for t in closed_now}
    closed_ids_prev = set(prev.get("closed_ids") or [])
    prev_pnl = prev.get("open_pnl") or {}

    # 1. Newly opened positions (id not seen before)
    new_open_ids = open_ids_now - open_ids_prev
    for t in open_now:
        if t.get("id") in new_open_ids:
            msgs.append(
                f"🟢 **OPENED** {t['symbol']} {t['side']} @ ${float(t['entry_price']):.2f} | "
                f"SL ${float(t['stop_loss']):.2f} → TP ${float(t['target_price']):.2f} | "
                f"score {t.get('agent_score')}/5 · {t.get('agent')}"
            )

    # 2. Newly closed positions (id not seen in prev closed_ids)
    new_closed_ids = closed_ids_now - closed_ids_prev
    for t in closed_now:
        if t.get("id") in new_closed_ids:
            msgs.append(
                f"🔒 **{t['close_reason']}** {t['symbol']} {t['side']} | "
                f"entry ${float(t['entry_price']):.2f} → exit ${float(t.get('exit_price') or 0):.2f} | "
                f"**PnL {float(t.get('pnl_pct') or 0):+.2f}%**"
            )

    # 3. Big PnL swing on still-open positions (±3% since last snapshot)
    for t in open_now:
        pid = t.get("id")
        cur_pnl = float(t.get("pnl_pct") or 0)
        old_pnl = float(prev_pnl.get(pid) or 0.0)
        if abs(cur_pnl - old_pnl) >= PNL_ALERT_PCT:
            direction = "📈" if cur_pnl > old_pnl else "📉"
            msgs.append(
                f"{direction} **{t['symbol']}** PnL moved {old_pnl:+.2f}% → {cur_pnl:+.2f}% "
                f"(entry ${float(t['entry_price']):.2f})"
            )

    return msgs


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


def get_intraday_volatility(symbol: str) -> float | None:
    """Return today's intraday range as % of opening price.
    Used to widen stops for volatile / speculative names where a 5% tight
    stop would routinely get wicked out before the move plays out.

    Returns None on failure (caller falls back to default 5% stop).
    """
    try:
        import yfinance
        ticker = yfinance.Ticker(symbol)
        hist = ticker.history(period="5d", interval="1d")
        if hist is None or len(hist) < 1:
            return None
        last = hist.iloc[-1]
        high = float(last.get("High") or 0)
        low = float(last.get("Low") or 0)
        open_ = float(last.get("Open") or 0)
        if open_ <= 0 or high <= low:
            return None
        return (high - low) / open_ * 100
    except Exception:
        return None


# ── Enrichment layer (Phase 4 — analytical pre-execution gate) ────────────────
_TREND_CACHE: dict[str, dict] = {}
_TREND_CACHE_TTL_SECONDS = 300  # 5 min
_SPY_TREND_CACHE: dict | None = None


def _trend_cache_key(sym: str) -> str:
    return sym


def get_trend(sym: str) -> dict | None:
    """Return {price, sma20, sma50, sma200, trend} for a symbol.
    trend ∈ {'strong_up', 'up', 'sideways', 'down', 'strong_down'}.
    Cached 5 min to keep cron snappy.
    """
    import time as _time
    cached = _TREND_CACHE.get(_trend_cache_key(sym))
    if cached and _time.time() - cached["ts"] < _TREND_CACHE_TTL_SECONDS:
        return cached["data"]
    try:
        import yfinance
        hist = yfinance.Ticker(sym).history(period="6mo", interval="1d")
        if hist is None or len(hist) < 50:
            return None
        closes = hist["Close"].astype(float)
        price = float(closes.iloc[-1])
        sma20 = float(closes.tail(20).mean())
        sma50 = float(closes.tail(50).mean())
        sma200 = float(closes.tail(min(200, len(closes))).mean())
        # Trend classification (simple but works):
        if price > sma20 > sma50 > sma200:
            trend = "strong_up"
        elif price > sma20 > sma50:
            trend = "up"
        elif price < sma20 < sma50 < sma200:
            trend = "strong_down"
        elif price < sma20 < sma50:
            trend = "down"
        else:
            trend = "sideways"
        data = {"price": price, "sma20": sma20, "sma50": sma50,
                "sma200": sma200, "trend": trend}
        _TREND_CACHE[_trend_cache_key(sym)] = {"ts": _time.time(), "data": data}
        return data
    except Exception:
        return None


def get_spy_trend() -> str:
    """Return SPY regime: 'up' / 'sideways' / 'down'."""
    global _SPY_TREND_CACHE
    import time as _time
    if _SPY_TREND_CACHE and _time.time() - _SPY_TREND_CACHE["ts"] < 600:
        return _SPY_TREND_CACHE["regime"]
    t = get_trend("SPY")
    if t is None:
        return "unknown"
    if t["trend"] in ("strong_up", "up"):
        regime = "up"
    elif t["trend"] in ("strong_down", "down"):
        regime = "down"
    else:
        regime = "sideways"
    _SPY_TREND_CACHE = {"ts": _time.time(), "regime": regime}
    return regime


def our_history_on_symbol(sym: str) -> dict:
    """Query SQLite for our track record on this ticker.
    Returns {count, wins, losses, avg_pnl, total_pnl}.
    """
    try:
        with db.transaction() as conn:
            row = conn.execute(
                """SELECT
                       COUNT(*) AS count,
                       SUM(CASE WHEN pnl_pct > 0 THEN 1 ELSE 0 END) AS wins,
                       SUM(CASE WHEN pnl_pct < 0 THEN 1 ELSE 0 END) AS losses,
                       ROUND(AVG(pnl_pct), 2) AS avg_pnl,
                       ROUND(SUM(pnl_pct), 2) AS total_pnl
                   FROM paper_trades
                   WHERE symbol = ? AND status = 'closed'""",
                (sym,),
            ).fetchone()
        if not row or row["count"] == 0:
            return {"count": 0}
        return dict(row)
    except Exception:
        return {"count": 0}


def parse_catalyst(signal_text: str) -> str:
    """Classify catalyst strength from signal text — returns short label."""
    t = (signal_text or "").lower()
    # Quantitative beats first (most actionable)
    import re
    beat = re.search(r"(beat|miss|raise|raised).*?(\d+(\.\d+)?)\s*%", t)
    if beat:
        return f"{beat.group(1).upper()} {beat.group(2)}%"
    for kw in ("earnings beat", "earnings miss", "fda approval", "merger",
              "acquisition", "short squeeze", "activist", "guidance raise"):
        if kw in t:
            return kw.upper()
    if any(k in t for k in ("earnings", "guidance", "fda", "approval",
                              "merger", "acquisition", "buyback", "dividend",
                              "split", "squeeze", "activist", "lawsuit",
                              "contract", "partnership", "launch", "product")):
        return "THEMED"
    return "NONE"


def enrich_signal(sym: str, side: str, agent_score: float, price: float,
                   market: str, raw_content: str) -> dict:
    """Pre-execution analytical layer.

    Returns {score_bonus, reasons, risks, enrich_notes, thesis}.
    The thesis string captures WHY we follow or reject — written into
    paper_trades.notes so the paper-trading-history widget's "Why I
    entered" section can show it later.
    """
    score_bonus = 0
    reasons: list[str] = []
    risks: list[str] = []
    notes: dict = {}

    # 1. Trend alignment
    trend = get_trend(sym)
    if trend:
        notes["trend"] = trend["trend"]
        notes["price_vs_sma20_pct"] = round(
            (trend["price"] - trend["sma20"]) / trend["sma20"] * 100, 2
        )
        notes["price_vs_sma50_pct"] = round(
            (trend["price"] - trend["sma50"]) / trend["sma50"] * 100, 2
        )
        if side == "LONG":
            if trend["trend"] in ("strong_up", "up"):
                score_bonus += 1
                reasons.append(
                    f"Trend: {trend['trend']} (price {trend['price']:.2f} > "
                    f"SMA20 {trend['sma20']:.2f} > SMA50 {trend['sma50']:.2f})"
                )
            elif trend["trend"] in ("strong_down", "down"):
                risks.append(
                    f"Trend: {trend['trend']} (LONG against SMA20/SMA50 downtrend)"
                )
        else:  # SHORT
            if trend["trend"] in ("strong_down", "down"):
                score_bonus += 1
                reasons.append(f"Trend: {trend['trend']} (supports SHORT)")
            elif trend["trend"] in ("strong_up", "up"):
                risks.append(f"Trend: {trend['trend']} (SHORT against uptrend)")

    # 2. Our historical track record on this ticker
    history = our_history_on_symbol(sym)
    notes["our_history"] = history
    if history.get("count", 0) >= 2:
        avg = history.get("avg_pnl", 0) or 0
        cnt = history["count"]
        if avg > 1.0:
            score_bonus += 1
            reasons.append(f"Our history: {cnt} trades avg +{avg:.2f}% on {sym}")
        elif avg < -3.0:
            score_bonus -= 1
            risks.append(f"Our history: {cnt} trades avg {avg:.2f}% on {sym} (poor)")

    # 3. Market regime (SPY)
    regime = get_spy_trend()
    notes["spy_regime"] = regime
    if regime == "down" and side == "LONG":
        score_bonus -= 1
        risks.append(f"Market regime: SPY down — tailwind against LONG")
    elif regime == "up" and side == "LONG":
        reasons.append(f"Market regime: SPY up — supportive for LONG")

    # 4. Catalyst classification (qualitative)
    catalyst = parse_catalyst(raw_content)
    notes["catalyst"] = catalyst
    if catalyst not in ("NONE", "THEMED"):
        reasons.append(f"Catalyst strength: {catalyst}")
    elif catalyst == "THEMED":
        reasons.append(f"Catalyst: themed (qualitative)")
    else:
        risks.append("Catalyst: none detected in signal text")

    # 5. Build thesis — captured in paper_trades.notes for later review
    thesis = (
        f"Entry: {side} {sym} @ ${price:.2f}\n"
        f"Trend: {trend['trend'] if trend else 'unknown'} "
        f"(vs SMA20 {trend['sma20']:.2f} / SMA50 {trend['sma50']:.2f})\n"
        if trend else
        f"Entry: {side} {sym} @ ${price:.2f}\n"
    )
    if history.get("count", 0):
        thesis += f"Our history: {history['count']} trades avg {history.get('avg_pnl', 0):+.2f}% on {sym}\n"
    thesis += f"Catalyst: {catalyst}\n"
    thesis += f"Market: {market} | Regime: {regime}\n"
    thesis += f"Agent: signal score {agent_score}★\n"

    return {
        "score_bonus": score_bonus,
        "reasons": reasons,
        "risks": risks,
        "enrich_notes": notes,
        "thesis": thesis.strip(),
    }


# ── Signal log persistence (audit trail) ──────────────────────────────────────
def log_signal(received_at: str, agent_name: str, symbol: str | None,
                side: str | None, agent_score: float | None,
                market: str | None, raw_content: str | None,
                parsed_action: str | None, score: float | None,
                entry_price: float | None, live_price: float | None,
                skip_reasons: list[str] | None, enrich_notes: dict | None,
                thesis: str | None) -> None:
    """Persist every evaluated signal to signal_log — regardless of follow /
    watch / skip outcome. Captures audit trail for later review."""
    try:
        with db.transaction() as conn:
            conn.execute(
                """INSERT INTO signal_log
                   (received_at, agent_name, symbol, side, agent_score,
                    market, raw_content, parsed_action, score,
                    entry_price, live_price, skip_reasons, enrich_notes, thesis)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    received_at, agent_name, symbol, side, agent_score,
                    market, raw_content, parsed_action, score,
                    entry_price, live_price,
                    db.json_dumps(skip_reasons or []),
                    db.json_dumps(enrich_notes or {}),
                    thesis,
                ),
            )
    except Exception as e:
        log(f"WARNING: signal_log insert failed: {e}")


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


def fetch_agent_leaderboard(limit: int = 20, market: str = "us-stock",
                             min_last_signal_hours: int = 72) -> list[dict]:
    """Fetch /api/signals/grouped and return active agents sorted by recent signal
    activity. The platform's grouped endpoint already aggregates per-agent
    signal_count + last_signal_at — we just rank by activity.

    Args:
        limit: How many agents to inspect from the leaderboard.
        market: us-stock / crypto / forex. Hard-filter at the API layer.
        min_last_signal_hours: Agents inactive for longer than this are dropped
            (avoid auto-following dead traders).

    Returns: list of agent dicts with at least {agent_id, agent_name,
        signal_count, last_signal_at}.
    """
    try:
        resp = requests.get(
            f"{BASE_URL}/signals/grouped",
            headers=HEADERS,
            params={"limit": limit, "market": market},
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        agents = data.get("agents", [])
        # Filter by activity (skip dead traders — no signal in N hours)
        from datetime import datetime, timezone
        cutoff = datetime.now(timezone.utc) - timedelta(hours=min_last_signal_hours)
        active = []
        for a in agents:
            ts = a.get("last_signal_at")
            if not ts:
                continue
            try:
                dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                if dt < cutoff:
                    continue
                a["_last_signal_dt"] = dt
                active.append(a)
            except Exception:
                continue
        # Sort by signal_count desc (more active = higher signal flow)
        active.sort(key=lambda a: a.get("signal_count", 0), reverse=True)
        return active
    except Exception as e:
        log(f"ERROR fetching leaderboard: {e}")
        return []


# Dynamic follow-list cache. Refreshed from leaderboard every
# LEADERBOARD_REFRESH_HOURS hours, persisted in SQLite so restarts reuse it.
LEADERBOARD_REFRESH_HOURS = 4
DYNAMIC_FOLLOW_LIMIT = 5  # how many top agents to auto-follow
# Minimum signals (lifetime) required before we trust an agent's activity
# signal — keeps one-off lucky / brand-new accounts out.
MIN_AGENT_SIGNAL_COUNT = 50

# Manual override list — agents we always follow regardless of leaderboard
# ranking (e.g. raftapart has been our primary workhorse even when activity
# dips). Listed by name; resolved against the leaderboard.
PINNED_AGENTS: list[str] = ["raftapart"]
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
def evaluate_recommendation(rec: dict, agent_name: str, created_at: str, market: str, recent_closed: list[dict] | None = None) -> dict | None:
    sym = rec["symbol"]
    side = rec["side"]
    agent_score = rec["score"]
    price = rec["price"]

    if not side or not price:
        return None

    # ── Tier 1: Hard blacklist (MU historically 1 win / 7 losses-or-flat) ──
    if sym in BLACKLIST_SYMBOLS:
        return {
            "skip": True,
            "action": "SKIP",
            "symbol": sym,
            "score": 0,
            "reasons": [f"Symbol {sym} is blacklisted (poor historical win-rate)"],
            "risks": [],
            "enrich_notes": {},
            "thesis": "",
        }

    # ── Tier 1: Same-symbol cooldown (avoid same-day whipsaw re-entries) ──
    # Loss-closes extend the cooldown to 72h; normal closes use 24h. This
    # lets overnight winners through while protecting against repeated losses
    # on the same ticker (e.g. AVGO 3-loss streak in June 2026).
    if recent_closed:
        now = hkt_now()
        for c in recent_closed:
            if c.get("symbol") != sym:
                continue
            closed_at = c.get("closed_at")
            if not closed_at:
                continue
            try:
                closed_dt = datetime.fromisoformat(closed_at.replace("Z", "+00:00").replace("+00:00", ""))
                if closed_dt.tzinfo is None:
                    closed_dt = closed_dt.replace(tzinfo=HKT)
                hours_since = (now - closed_dt).total_seconds() / 3600
                pnl = float(c.get("pnl_pct") or 0)
                cooldown = SAME_SYMBOL_LOSS_COOLDOWN_HOURS if pnl < 0 else SAME_SYMBOL_COOLDOWN_HOURS
                if hours_since < cooldown:
                    return {
                        "skip": True,
                        "action": "SKIP",
                        "symbol": sym,
                        "score": 0,
                        "reasons": [
                            f"Same-symbol cooldown: {sym} closed {hours_since:.1f}h ago "
                            f"({'loss' if pnl < 0 else 'win'}, {cooldown}h lockout)"
                        ],
                        "risks": [],
                        "enrich_notes": {},
                        "thesis": "",
                    }
            except Exception:
                pass

    # Time decay: only act on FRESH signals (tightened from 6h → 15min).
    # Stale entries were responsible for 50% of skip-reasons on 2026-07-09.
    age_minutes = 9999
    if created_at:
        try:
            dt = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
            age_minutes = (datetime.now(timezone.utc) - dt).total_seconds() / 60
        except Exception:
            pass

    if age_minutes > SIGNAL_MAX_AGE_MINUTES:
        return {
            "skip": True,
            "action": "SKIP",
            "symbol": sym,
            "score": 0,
            "reasons": [
                f"Signal stale: {age_minutes:.0f}m old "
                f"(max {SIGNAL_MAX_AGE_MINUTES}m)"
            ],
            "risks": [],
            "enrich_notes": {},
            "thesis": "",
        }

    # US-only scope: hard filter on market field (Tier 3)
    if market and market not in ALLOWED_MARKETS:
        return {
            "skip": True,
            "action": "SKIP",
            "symbol": sym,
            "score": 0,
            "reasons": [f"Market '{market}' outside allowed {ALLOWED_MARKETS}"],
            "risks": [],
            "enrich_notes": {},
            "thesis": "",
        }

    live_price = get_live_price(sym)
    if not live_price:
        return None

    # Price-drift gate: if the live price has moved more than 1.5% from the
    # signal's quoted entry, the setup is no longer valid — too much slippage.
    # Was silently absorbed into the score; now a hard skip.
    if price:
        diff_pct = abs(live_price - price) / price * 100
        if diff_pct > 1.5:
            return {
                "skip": True,
                "action": "SKIP",
                "symbol": sym,
                "score": 0,
                "reasons": [
                    f"Price drift: signal ${price:.2f} vs live ${live_price:.2f} "
                    f"({diff_pct:.1f}%, max 1.5%)"
                ],
            }

    score = 0.0
    reasons: list[str] = []

    if agent_score >= 7:
        score += 3
        reasons.append(f"Agent score {agent_score} (strong)")
    elif agent_score >= 5:
        score += 2
        reasons.append(f"Agent score {agent_score} (high)")
    elif agent_score >= 4:
        score += 1
        reasons.append(f"Agent score {agent_score}")

    if price:
        diff_pct = abs(live_price - price) / price * 100
        if diff_pct <= 0.5:
            score += 2
            reasons.append(f"Entry price ${price:.2f} very close to live ${live_price:.2f} ({diff_pct:.1f}% diff)")
        elif diff_pct <= 1.5:
            score += 1
            reasons.append(f"Entry price ${price:.2f} close to live ${live_price:.2f} ({diff_pct:.1f}% diff)")

    if market == "us-stock":
        score += 1
        reasons.append(f"US stock ({market})")

    # Theme-aware bonus: any signal with a named catalyst — earnings surprise,
    # FDA approval, M&A rumor, product launch, activist, short squeeze, etc —
    # gets +1. Was previously restricted to AI/tech whitelist; expanded 2026-07-09
    # so speculative / momentum names (GME, DJT, SMCI, emerging biotech) score
    # equally when the signal carries a real catalyst.
    THEMED_CATALYST_KEYWORDS = (
        "earnings", "guidance", "beat", "miss", "fda", "approval", "merger",
        "acquisition", "buyback", "dividend", "split", "squeeze", "activist",
        "lawsuit", "contract", "partnership", "launch", "product",
    )
    sig_text = (rec.get("raw_content") or "").lower()
    if any(k in sig_text for k in THEMED_CATALYST_KEYWORDS):
        score += 1
        reasons.append(f"Catalyst-driven signal (theme/keyword match)")

    # ── Phase 4: Pre-execution analytical enrichment ─────────────────────────
    # Pulls trend + our history + market regime + catalyst classification.
    # Adds bonus to score if trend/history agree, and ALWAYS records a thesis
    # in paper_trades.notes for later review (whether we follow or not).
    enrichment = enrich_signal(sym, side, agent_score, price, market, rec.get("raw_content") or "")
    score += enrichment["score_bonus"]
    reasons.extend(enrichment["reasons"])
    risks = enrichment["risks"]

    # Decide whether to apply analytical veto: a strongly negative
    # enrichment score or 2+ risk flags without compensating reasons should
    # drop us to WATCH even if base score ≥ 4. (Preserves the gate, doesn't
    # silently re-promote SKIPs.)
    if score >= MIN_SCORE_FOLLOW and len(risks) >= 2 and enrichment["score_bonus"] <= -1:
        # Demote FOLLOW → WATCH
        reasons.append(
            f"Analytical veto: {len(risks)} risk flags + score_bonus {enrichment['score_bonus']}, "
            f"demoted FOLLOW → WATCH"
        )
        for r in risks:
            reasons.append(f"  risk: {r}")
        risks = []
        score = max(score - 2, MIN_SCORE_REPORT)  # push below 4 but ≥ 2

    if side == "LONG":
        stop_loss = round(price * (1 - DEFAULT_STOP_PCT / 100), 2)
        target = round(price * (1 + DEFAULT_TARGET_PCT / 100), 2)
    else:
        stop_loss = round(price * (1 + DEFAULT_STOP_PCT / 100), 2)
        target = round(price * (1 - DEFAULT_TARGET_PCT / 100), 2)

    # Wider stops for high-vol / speculative names — the 5%/-5% default assumes
    # an S&P 500 member. GME / DJT / small-cap biotech routinely gap 10-15%
    # on catalyst days; a 5% stop would routinely get wicked out before the
    # setup played out.
    vol = get_intraday_volatility(sym)
    if vol is not None and vol >= 8.0:
        # 8%+ intraday range = volatile name. Widen stop/target to 1.5x.
        widened_stop = round(price * (1 - (DEFAULT_STOP_PCT * 1.5) / 100), 2) if side == "LONG" \
            else round(price * (1 + (DEFAULT_STOP_PCT * 1.5) / 100), 2)
        widened_target = round(price * (1 + (DEFAULT_TARGET_PCT * 1.5) / 100), 2) if side == "LONG" \
            else round(price * (1 - (DEFAULT_TARGET_PCT * 1.5) / 100), 2)
        reasons.append(f"Wide intraday range ({vol:.1f}%) → stop/target widened to {DEFAULT_STOP_PCT*1.5:.1f}%/{DEFAULT_TARGET_PCT*1.5:.1f}%")
        stop_loss = widened_stop
        target = widened_target

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
        "risks": risks,
        "enrich_notes": enrichment["enrich_notes"],
        "thesis": enrichment["thesis"],
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

    # Compose notes — include thesis (why we entered), risks identified at
    # entry, and the strategy playbook. This is what shows in the
    # paper-trading-history widget's "Why I entered" section.
    thesis = ev.get("thesis") or ""
    risks = ev.get("risks") or []
    risk_block = ""
    if risks:
        risk_block = "\n\nRisks at entry:\n" + "\n".join(f"  • {r}" for r in risks)

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
            f"{thesis}{risk_block}\n\n"
            f"Strategy: target +{DEFAULT_TARGET_PCT}% / stop -{DEFAULT_STOP_PCT}%. "
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
    prev_state = load_state()
    new_events: list[dict] = []

    # 1. Check existing positions
    open_count = sum(1 for t in trades if t.get("status") == "open")
    log(f"Checking {open_count} open positions...")
    trades, pos_events = check_positions(trades)
    new_events.extend(pos_events)

    # 2. Parse strategy signals and evaluate recommendations
    signals = fetch_signals(limit=15)
    new_follows: list[dict] = []
    open_symbols = {t.get("symbol") for t in trades if t.get("status") == "open"}
    # Pass recent closed positions (within last 7 days) so cooldown logic has data
    recent_closed = [
        t for t in trades
        if t.get("status") == "closed" and t.get("closed_at")
    ]

    # 2a. Refresh dynamic follow-list from /api/signals/grouped leaderboard.
    # Picks the most active US-stock traders + our pinned workhorse (raftapart).
    follow_list = refresh_follow_list()
    log(f"Follow list ({len(follow_list)} agents): {', '.join(follow_list)}")

    for sig in signals:
        msg_type = sig.get("message_type", "")
        mkt = sig.get("market", "")
        agent = sig.get("agent_name", "Unknown")
        created = sig.get("created_at", "")
        content = sig.get("content", "")
        received_at = hkt_now().isoformat()

        if msg_type == "strategy" and content:
            recs = parse_strategy_content(content)
            log(f"  [{agent}] {mkt} — {len(recs)} recommendations parsed")
            for rec in recs:
                ev = evaluate_recommendation(rec, agent, created, mkt, recent_closed=recent_closed)
                if ev is None:
                    continue
                # Persist every evaluated signal to signal_log — including skips.
                # Audit trail lets us later answer "why didn't we trade X?"
                log_signal(
                    received_at=received_at,
                    agent_name=agent,
                    symbol=rec.get("symbol"),
                    side=rec.get("side"),
                    agent_score=rec.get("score"),
                    market=mkt,
                    raw_content=rec.get("raw_content"),
                    parsed_action=ev["action"],
                    score=ev.get("score"),
                    entry_price=rec.get("price"),
                    live_price=ev.get("live_price"),
                    skip_reasons=ev.get("reasons") if ev.get("skip") else [],
                    enrich_notes=ev.get("enrich_notes"),
                    thesis=ev.get("thesis"),
                )
                # Log every skip reason so we can audit blacklist / cooldown hits
                if ev.get("skip"):
                    log(f"    SKIP {rec['symbol']}: {' | '.join(ev.get('reasons', []))}")
                    continue
                if ev["action"] == "FOLLOW":
                    # Enforce single-position-per-symbol cap
                    sym_count = sum(1 for s in open_symbols if s == ev["symbol"])
                    if sym_count >= MAX_POSITIONS_PER_SYMBOL:
                        log(f"    SKIP {ev['symbol']}: already {sym_count} open position(s) (max {MAX_POSITIONS_PER_SYMBOL})")
                        continue
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
        new_events.append({
            "type": "NEW_POSITION",
            "symbol": ev["symbol"],
            "details": (
                f"FOLLOWED {ev['symbol']} {ev['side']} @ ${ev['entry_price']:.2f} "
                f"(live ${ev['live_price']:.2f}) | SL: ${ev['stop_loss']:.2f} | "
                f"Target: ${ev['target_price']:.2f} | Score: {ev['score']}* | by {ev['agent']}"
            ),
        })
        log(f"  AUTO-FOLLOW: {ev['symbol']} {ev['side']} @ ${ev['entry_price']:.2f}")

    # 4. Persist every dirty row (closed trades AND live-price updates for
    # open trades). Without this, current_price / pnl_pct / updated_at for open
    # positions stay frozen at entry values in SQLite.
    for t in trades:
        if t.get("_dirty"):
            upsert_trade(t)

    # 5. Portfolio summary (log-only)
    open_p = [t for t in trades if t.get("status") == "open"]
    closed = [t for t in trades if t.get("status") == "closed"]
    total_pnl = sum(t.get("pnl_pct", 0) or 0 for t in closed)
    log(f"Portfolio: {len(open_p)} open | {len(closed)} closed | Closed PnL: {total_pnl:.2f}%")
    for t in open_p:
        pnl = t.get("pnl_pct", 0)
        cur = t.get("current_price") or t.get("live_price") or "?"
        log(f"  {t['symbol']} {t['side']} | entry ${t['entry_price']} | cur ${cur} | {pnl:+.2f}%")

    # 6. Diff against last published state — only return events that are NEW
    # or represent a material change. Cron uses this list to decide whether
    # to push a Discord reminder.
    diff_msgs = compute_diff(trades, prev_state)
    if diff_msgs:
        log("NOTIFY (diff):")
        for m in diff_msgs:
            log(f"  {m}")
    else:
        log("No material change since last run — silent.")

    # 7. Persist new state snapshot (covers both new opens and big swings so
    # the next run's diff returns empty until something actually happens)
    closed_all = [t for t in trades if t.get("status") == "closed"]
    new_state = {
        "open_ids": [t.get("id") for t in open_p],
        "open_pnl": {t.get("id"): float(t.get("pnl_pct") or 0) for t in open_p},
        "closed_ids": [t.get("id") for t in closed_all],
        "last_published_at": hkt_now().isoformat(),
    }
    save_state(new_state)

    log("AI4Trade Poller END")
    log("-" * 55)
    return [{"type": "DIFF", "details": m} for m in diff_msgs]


if __name__ == "__main__":
    main()