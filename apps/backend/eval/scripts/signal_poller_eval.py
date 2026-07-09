"""Precision / recall study for `ai4trade_signal_poller.py` against the
SQLite `paper_trades` table.

Per `docs/eval-results-2026-07.md` §6, the signal poller is a 30-minute cron
that scores external signals from ai4trade.ai, decides whether to follow, and
persists paper trades. The eval report calls for "historical-precision-style
evidence" — the metrics that justify treating it as a real signal source,
not just a heuristic that happens to write rows.

This script computes the standard signal-source metrics from the
`paper_trades` table:

  - n_total, n_open, n_closed
  - win_rate  (precision analog): closed rows where pnl_abs > 0  /  n_closed
  - loss_rate
  - avg_pnl_pct   (mean pnl_pct across closed rows)
  - avg_pnl_abs   (mean pnl_abs across closed rows)
  - profit_factor = sum(positive_pnl_abs) / |sum(negative_pnl_abs)|
  - expectance_per_trade = mean(pnl_abs)
  - per-side (LONG vs SHORT): win_rate and avg_pnl_pct
  - per-strategy: win_rate and avg_pnl_pct
  - per-sector: win_rate and avg_pnl_pct

Usage
-----
    uv run python apps/backend/eval/scripts/signal_poller_eval.py
    # writes docs/signal-poller-precision-<date>.md

The script reads the SQLite DB at `apps/backend/data/optitrade.db` (path
configurable via --db-path). If the table is empty it reports the empty
state honestly — that's a useful finding too, because it shows whether
the poller has been run since the SQLite migration.
"""
from __future__ import annotations

import argparse
import json
import sqlite3
import sys
from dataclasses import dataclass, asdict, field
from datetime import datetime, timezone
from pathlib import Path
from statistics import mean
from typing import Any


DEFAULT_DB = Path(__file__).resolve().parents[2] / "data" / "optitrade.db"


@dataclass
class SliceAgg:
    label: str
    n_closed: int = 0
    n_winners: int = 0
    win_rate: float = 0.0
    avg_pnl_pct: float | None = None
    avg_pnl_abs: float | None = None


@dataclass
class OverallAgg:
    n_total: int = 0
    n_open: int = 0
    n_closed: int = 0
    n_winners: int = 0
    n_losers: int = 0
    win_rate: float = 0.0
    loss_rate: float = 0.0
    avg_pnl_pct: float | None = None
    avg_pnl_abs: float | None = None
    profit_factor: float | None = None
    sum_positive_pnl_abs: float = 0.0
    sum_negative_pnl_abs: float = 0.0
    by_side: list[SliceAgg] = field(default_factory=list)
    by_strategy: list[SliceAgg] = field(default_factory=list)
    by_sector: list[SliceAgg] = field(default_factory=list)


def _closed_rows(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    cur = conn.execute(
        "SELECT symbol, side, status, entry_price, exit_price, pnl_pct, pnl_abs, "
        "       strategy, sector, agent_score, closed_at "
        "FROM paper_trades WHERE status='closed' AND pnl_abs IS NOT NULL "
        "ORDER BY closed_at ASC"
    )
    cols = [d[0] for d in cur.description]
    return [dict(zip(cols, row)) for row in cur.fetchall()]


def _open_rows(conn: sqlite3.Connection) -> int:
    cur = conn.execute("SELECT COUNT(*) FROM paper_trades WHERE status='open'")
    return int(cur.fetchone()[0])


def _compute_overall(rows: list[dict[str, Any]], n_open: int) -> OverallAgg:
    a = OverallAgg()
    a.n_total = len(rows) + n_open
    a.n_open = n_open
    a.n_closed = len(rows)
    if not rows:
        return a
    pnls_abs = [float(r["pnl_abs"]) for r in rows]
    pnls_pct = [float(r["pnl_pct"]) for r in rows if r["pnl_pct"] is not None]
    a.n_winners = sum(1 for p in pnls_abs if p > 0)
    a.n_losers = sum(1 for p in pnls_abs if p <= 0)
    a.win_rate = a.n_winners / a.n_closed
    a.loss_rate = a.n_losers / a.n_closed
    a.avg_pnl_pct = mean(pnls_pct) if pnls_pct else None
    a.avg_pnl_abs = mean(pnls_abs)
    pos = [p for p in pnls_abs if p > 0]
    neg = [p for p in pnls_abs if p < 0]
    a.sum_positive_pnl_abs = sum(pos)
    a.sum_negative_pnl_abs = sum(neg)
    if neg:
        a.profit_factor = a.sum_positive_pnl_abs / abs(a.sum_negative_pnl_abs)
    elif pos:
        a.profit_factor = float("inf")
    else:
        a.profit_factor = None

    # Slice by side / strategy / sector
    for slice_key, slice_label in [
        ("side", "side"),
        ("strategy", "strategy"),
        ("sector", "sector"),
    ]:
        buckets: dict[str, list[dict[str, Any]]] = {}
        for r in rows:
            k = r.get(slice_key) or "(unspecified)"
            buckets.setdefault(k, []).append(r)
        aggs: list[SliceAgg] = []
        for k in sorted(buckets):
            rs = buckets[k]
            abs_pnls = [float(x["pnl_abs"]) for x in rs]
            pct_pnls = [float(x["pnl_pct"]) for x in rs if x["pnl_pct"] is not None]
            agg = SliceAgg(
                label=f"{slice_label}={k}",
                n_closed=len(rs),
                n_winners=sum(1 for p in abs_pnls if p > 0),
                win_rate=sum(1 for p in abs_pnls if p > 0) / len(rs),
                avg_pnl_pct=mean(pct_pnls) if pct_pnls else None,
                avg_pnl_abs=mean(abs_pnls),
            )
            aggs.append(agg)
        if slice_key == "side":
            a.by_side = aggs
        elif slice_key == "strategy":
            a.by_strategy = aggs
        elif slice_key == "sector":
            a.by_sector = aggs
    return a


def _render_markdown(a: OverallAgg, db_path: Path) -> str:
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    if a.n_closed == 0:
        return (
            f"# Signal-poller precision study — {today}\n\n"
            f"- db: `{db_path}`\n"
            f"- n_total: {a.n_total}\n"
            f"- n_open: {a.n_open}\n"
            f"- n_closed: {a.n_closed}\n\n"
            f"## Status: no closed paper trades yet\n\n"
            f"The SQLite `paper_trades` table is empty of closed trades. "
            f"Either the poller has not yet been run since the SQLite "
            f"migration, or no signals have hit the entry thresholds in "
            f"this dataset. Re-run this script after the next cron cycle "
            f"on the live droplet to populate the metrics.\n\n"
            f"This is an honest empty-state report — not a fabricated zero.\n"
        )
    lines = [
        f"# Signal-poller precision study — {today}",
        "",
        f"- db: `{db_path}`",
        f"- n_total: {a.n_total}  (n_open={a.n_open}, n_closed={a.n_closed})",
        f"- win_rate: {a.win_rate:.1%}  ({a.n_winners}/{a.n_closed})",
        f"- avg_pnl_pct: {a.avg_pnl_pct:+.2f}%" if a.avg_pnl_pct is not None else "- avg_pnl_pct: (none)",
        f"- avg_pnl_abs: {a.avg_pnl_abs:+.2f}" if a.avg_pnl_abs is not None else "- avg_pnl_abs: (none)",
        f"- profit_factor: {a.profit_factor:.2f}" if a.profit_factor is not None and a.profit_factor != float('inf') else
            (f"- profit_factor: ∞ (no losing trades)" if a.profit_factor == float('inf') else "- profit_factor: (undefined — no losing trades)"),
        "",
        "## By side",
        "",
        "| side | n_closed | win_rate | avg_pnl_pct | avg_pnl_abs |",
        "| --- | --- | --- | --- | --- |",
    ]
    for s in a.by_side:
        lines.append(
            f"| {s.label.split('=',1)[1]} | {s.n_closed} | {s.win_rate:.1%} "
            f"| {s.avg_pnl_pct:+.2f}% | {s.avg_pnl_abs:+.2f} |"
            if s.avg_pnl_pct is not None
            else f"| {s.label.split('=',1)[1]} | {s.n_closed} | {s.win_rate:.1%} | — | {s.avg_pnl_abs:+.2f} |"
        )
    if a.by_strategy:
        lines += ["", "## By strategy", "",
                  "| strategy | n_closed | win_rate | avg_pnl_pct | avg_pnl_abs |",
                  "| --- | --- | --- | --- | --- |"]
        for s in a.by_strategy:
            lines.append(
                f"| {s.label.split('=',1)[1]} | {s.n_closed} | {s.win_rate:.1%} "
                f"| {s.avg_pnl_pct:+.2f}% | {s.avg_pnl_abs:+.2f} |"
                if s.avg_pnl_pct is not None
                else f"| {s.label.split('=',1)[1]} | {s.n_closed} | {s.win_rate:.1%} | — | {s.avg_pnl_abs:+.2f} |"
            )
    if a.by_sector:
        lines += ["", "## By sector", "",
                  "| sector | n_closed | win_rate | avg_pnl_pct | avg_pnl_abs |",
                  "| --- | --- | --- | --- | --- |"]
        for s in a.by_sector:
            lines.append(
                f"| {s.label.split('=',1)[1]} | {s.n_closed} | {s.win_rate:.1%} "
                f"| {s.avg_pnl_pct:+.2f}% | {s.avg_pnl_abs:+.2f} |"
                if s.avg_pnl_pct is not None
                else f"| {s.label.split('=',1)[1]} | {s.n_closed} | {s.win_rate:.1%} | — | {s.avg_pnl_abs:+.2f} |"
            )
    return "\n".join(lines) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--db-path", type=Path, default=DEFAULT_DB)
    parser.add_argument("--json", action="store_true", help="emit JSON to stdout too")
    args = parser.parse_args()

    if not args.db_path.exists():
        print(f"ERROR: db {args.db_path} does not exist", file=sys.stderr)
        return 1

    conn = sqlite3.connect(args.db_path)
    try:
        n_open = _open_rows(conn)
        rows = _closed_rows(conn)
    finally:
        conn.close()

    agg = _compute_overall(rows, n_open)
    md = _render_markdown(agg, args.db_path)
    print(md)

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    # apps/backend/eval/scripts/<this>.py → parents[4] = repo root
    out_path = Path(__file__).resolve().parents[4] / "docs" / f"signal-poller-precision-{today}.md"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(md)

    if args.json:
        print("---JSON---")
        print(json.dumps(asdict(agg), indent=2, default=str))

    print(f"\nWrote {out_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())