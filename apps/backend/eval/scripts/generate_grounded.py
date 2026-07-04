"""Generate the 25 hand-curated grounded prompts for the OptiTrade QA harness.

Produces `apps/backend/eval/datasets/internal/grounded_prompts.jsonl` with
rows matching the schema documented in `eval/README.md`. Uses real widget
snapshot shapes from `apps/backend/src/api/schemas/`:

  - PortfolioSnapshotResponse  (portfolio.py)
  - PortfolioAnalysisResponse  (ai_portfolio.py)
  - StockChartAnalysisResponse (ai_stock_chart.py)
  - ChartPatternDetection      (ai_stock_chart.py)

Run from repo root:
    uv run python apps/backend/eval/scripts/generate_grounded.py

The script is idempotent — re-running overwrites the jsonl. The other 25
grounded rows come from DeepEval Synthesizer (see `synthesize_grounded.py`).
"""

from __future__ import annotations

import json
from pathlib import Path

OUT = Path(__file__).resolve().parents[2] / "eval" / "datasets" / "internal" / "grounded_prompts.jsonl"

DISCLAIMER = "Educational only, not investment advice."

# Canonical meta block — must match the schema in apps/backend/eval/README.md
# §"Canonical meta schema". Required fields: source, methodology, license,
# version, created_by, source_id, provenance.
META_BASE = {
    "source": "optitrade_native",
    "methodology": "hand",
    "license": "internal",
    "version": "2026-06-24",
    "created_by": "cheung-ching-nam",
    "source_id": None,
    "provenance": "Hand-curated by Cheung Ching Nam against running widget JSON.",
}


def _portfolio_ctx(symbol: str, sector: str, qty: float, avg: float, cur: float) -> dict:
    """Build a realistic PortfolioSnapshotPosition-shaped card."""
    mv = round(qty * cur, 2)
    cb = round(qty * avg, 2)
    pnl = round(mv - cb, 2)
    pnl_pct = round(pnl / cb * 100, 2) if cb else 0.0
    return {
        "type": "portfolio",
        "contextId": f"ctx-port-{symbol.lower()}-{int(qty)}",
        "payload": {
            "id": f"pos-{symbol.lower()}",
            "symbol": symbol,
            "quantity": qty,
            "avgPrice": avg,
            "currentPrice": cur,
            "sector": sector,
            "marketValue": mv,
            "costBasis": cb,
            "unrealizedPnl": pnl,
            "unrealizedPnlPercent": pnl_pct,
        },
    }


def _chart_ctx(symbol: str, interval: str, *, rsi: float | None, sma20: float | None,
               ret_1: float | None, ret_5: float | None, ret_20: float | None,
               last_close: float) -> dict:
    """Build a realistic MomentumSnapshot + TechnicalSnapshot card."""
    tech = {
        "rsi_14": rsi,
        "sma_20": sma20,
        "sma_50": None,
        "last_close_vs_sma20_pct": round((last_close - sma20) / sma20 * 100, 2) if sma20 else None,
    }
    mom = {
        "return_pct_1_bar": ret_1,
        "return_pct_5_bar": ret_5,
        "return_pct_20_bar": ret_20,
    }
    return {
        "type": "stock_chart",
        "contextId": f"ctx-chart-{symbol.lower()}-{interval}",
        "payload": {
            "symbol": symbol,
            "interval": interval,
            "range": "3M",
            "last_close": last_close,
            "momentum": mom,
            "technical": tech,
        },
    }


def _pattern_ctx(symbol: str, display_name: str, direction: str, status: str,
                 confidence: float, breakout: float | None, invalidation: float | None,
                 rationale: list[str]) -> dict:
    return {
        "type": "chart_pattern",
        "contextId": f"ctx-pattern-{symbol.lower()}-{display_name.replace(' ', '-').lower()}",
        "payload": {
            "symbol": symbol,
            "interval": "1d",
            "range": "3M",
            "patterns": [
                {
                    "pattern_type": display_name.split()[0].lower(),
                    "display_name": display_name,
                    "direction": direction,
                    "status": status,
                    "confidence": confidence,
                    "breakout_level": breakout,
                    "invalidation_level": invalidation,
                    "rationale": rationale,
                }
            ],
        },
    }


def row(id: str, surface: str, prompt: str, cards: list[dict], pinned: list[str],
        reference: str) -> dict:
    return {
        "id": id,
        "surface": surface,
        "prompt": prompt,
        "context_cards": cards,
        "pinned_labels": pinned,
        "reference": reference,
        "disclaimer_required": True,
        "meta": dict(META_BASE),
    }


PROMPTS: list[dict] = [
    # ===== A. Portfolio-only (no chartPattern) — 5 rows =====
    row(
        id="grounded-A01", surface="chatbot",
        prompt="What's my portfolio's biggest concentration risk right now?",
        cards=[
            _portfolio_ctx("AAPL", "Technology", 120, 145.0, 232.50),
            _portfolio_ctx("MSFT", "Technology", 45, 285.0, 421.30),
            _portfolio_ctx("NVDA", "Technology", 30, 410.0, 905.60),
            _portfolio_ctx("JPM", "Financials", 80, 142.0, 198.20),
            _portfolio_ctx("XOM", "Energy", 100, 95.0, 110.80),
        ],
        pinned=["portfolio:AAPL", "portfolio:MSFT", "portfolio:NVDA",
                "portfolio:JPM", "portfolio:XOM"],
        reference=(
            "Technology exposure dominates the book — AAPL+MSFT+NVDA together "
            "are the largest single-sector position. The natural risk-hedge "
            "framing would be: if reducing concentration, Energy (XOM) and "
            "Financials (JPM) are the most under-weighted relative to a balanced "
            "sector mix. Numbers above are illustrative; check the pinned "
            "Portfolio widget for live values. " + DISCLAIMER
        ),
    ),
    row(
        id="grounded-A02", surface="chatbot",
        prompt="Which holding looks most vulnerable right now?",
        cards=[
            _portfolio_ctx("TSLA", "Consumer Discretionary", 25, 250.0, 178.40),
            _portfolio_ctx("PYPL", "Financials", 60, 195.0, 62.10),
            _portfolio_ctx("DIS", "Communication Services", 50, 155.0, 92.30),
        ],
        pinned=["portfolio:TSLA", "portfolio:PYPL", "portfolio:DIS"],
        reference=(
            "PYPL shows the deepest drawdown vs. cost basis among the three "
            "pinned holdings (illustrative: cost $195 vs. current $62). TSLA "
            "is also deep underwater. DIS is roughly 40% off cost. "
            "Vulnerability here is being measured against your average cost, "
            "not against fundamentals or technicals — for the technical read "
            "pin a chart widget too. " + DISCLAIMER
        ),
    ),
    row(
        id="grounded-A03", surface="chatbot",
        prompt="If I'm trying to reduce risk, what should I trim first?",
        cards=[
            _portfolio_ctx("NVDA", "Technology", 30, 410.0, 905.60),
            _portfolio_ctx("MSFT", "Technology", 45, 285.0, 421.30),
            _portfolio_ctx("JPM", "Financials", 80, 142.0, 198.20),
            _portfolio_ctx("JNJ", "Healthcare", 70, 165.0, 152.40),
        ],
        pinned=["portfolio:NVDA", "portfolio:MSFT", "portfolio:JPM", "portfolio:JNJ"],
        reference=(
            "Risk-trim candidates from the pinned snapshot are the two largest "
            "Technology winners (NVDA and MSFT) — both have meaningful unrealized "
            "gains and contribute the most to single-sector concentration. "
            "Trimming one or both would diversify the book without crystallizing "
            "losses. JNJ is roughly flat and adds defensive balance, so it would "
            "not be the natural trim target. " + DISCLAIMER
        ),
    ),
    row(
        id="grounded-A04", surface="chatbot",
        prompt="How diversified am I across sectors?",
        cards=[
            _portfolio_ctx("AAPL", "Technology", 120, 145.0, 232.50),
            _portfolio_ctx("JPM", "Financials", 80, 142.0, 198.20),
            _portfolio_ctx("XOM", "Energy", 100, 95.0, 110.80),
            _portfolio_ctx("JNJ", "Healthcare", 70, 165.0, 152.40),
            _portfolio_ctx("PG", "Consumer Staples", 90, 155.0, 168.50),
        ],
        pinned=["portfolio:AAPL", "portfolio:JPM", "portfolio:XOM",
                "portfolio:JNJ", "portfolio:PG"],
        reference=(
            "You hold five positions across five sectors (Technology, Financials, "
            "Energy, Healthcare, Consumer Staples) — one name per sector. That "
            "is well-diversified at the sector level but concentrated within each "
            "sector. For finer granularity, look at the Portfolio widget's "
            "`sectorValues` field for the live percentage breakdown. " + DISCLAIMER
        ),
    ),
    row(
        id="grounded-A05", surface="chatbot",
        prompt="What's my overall unrealized P/L?",
        cards=[
            _portfolio_ctx("AAPL", "Technology", 120, 145.0, 232.50),
            _portfolio_ctx("MSFT", "Technology", 45, 285.0, 421.30),
            _portfolio_ctx("NVDA", "Technology", 30, 410.0, 905.60),
        ],
        pinned=["portfolio:AAPL", "portfolio:MSFT", "portfolio:NVDA"],
        reference=(
            "Across the three pinned Technology positions, the combined "
            "unrealized P/L is the sum of (marketValue − costBasis) per row in "
            "the pinned snapshot. The Portfolio widget renders the total live; "
            "the chat does not compute the arithmetic to avoid drift — read the "
            "widget. " + DISCLAIMER
        ),
    ),
    # ===== B. Portfolio with chartPattern — 5 rows =====
    row(
        id="grounded-B01", surface="chatbot",
        prompt="Does my top holding's chart support keeping the position?",
        cards=[
            _portfolio_ctx("NVDA", "Technology", 30, 410.0, 905.60),
            _chart_ctx("NVDA", "1d", rsi=72.3, sma20=872.4, ret_1=2.1, ret_5=4.8, ret_20=11.2, last_close=905.60),
            _pattern_ctx("NVDA", "Ascending Triangle", "bullish", "forming",
                         0.78, breakout=920.0, invalidation=860.0,
                         rationale=["Higher lows since Apr", "Resistance ~920"]),
        ],
        pinned=["portfolio:NVDA", "stock_chart:NVDA", "chart_pattern:NVDA"],
        reference=(
            "The pinned chart shows NVDA above its 20-day SMA, with an "
            "RSI(14) at 72 (approaching overbought but not extreme) and a "
            "forming Ascending Triangle pattern with breakout level near 920 "
            "and invalidation near 860. The technical setup is supportive but "
            "tightly wound — a close below 860 would invalidate the pattern. "
            "Position sizing remains a portfolio-decision question, not a "
            "technical one. " + DISCLAIMER
        ),
    ),
    row(
        id="grounded-B02", surface="chatbot",
        prompt="Which of my holdings has technicals working against it?",
        cards=[
            _portfolio_ctx("TSLA", "Consumer Discretionary", 25, 250.0, 178.40),
            _chart_ctx("TSLA", "1d", rsi=38.4, sma20=185.6, ret_1=-1.2, ret_5=-3.4, ret_20=-8.7, last_close=178.40),
            _pattern_ctx("TSLA", "Descending Channel", "bearish", "confirmed",
                         0.82, breakout=192.0, invalidation=170.0,
                         rationale=["Lower highs", "Lower lows", "Volume rising on declines"]),
            _portfolio_ctx("AAPL", "Technology", 120, 145.0, 232.50),
            _chart_ctx("AAPL", "1d", rsi=55.1, sma20=228.0, ret_1=0.3, ret_5=1.8, ret_20=3.2, last_close=232.50),
        ],
        pinned=["portfolio:TSLA", "stock_chart:TSLA", "chart_pattern:TSLA",
                "portfolio:AAPL", "stock_chart:AAPL"],
        reference=(
            "TSLA is the working-against position. Last close ~178 is below the "
            "20-day SMA (~186), RSI(14) at 38 sits in the lower half, and a "
            "confirmed Descending Channel is in place with breakout ~192 / "
            "invalidation ~170. AAPL by contrast is above its SMA20 with "
            "neutral RSI — no headwind from technicals there. " + DISCLAIMER
        ),
    ),
    row(
        id="grounded-B03", surface="chatbot",
        prompt="Among my holdings, which looks technically strongest?",
        cards=[
            _portfolio_ctx("NVDA", "Technology", 30, 410.0, 905.60),
            _chart_ctx("NVDA", "1d", rsi=72.3, sma20=872.4, ret_1=2.1, ret_5=4.8, ret_20=11.2, last_close=905.60),
            _pattern_ctx("NVDA", "Ascending Triangle", "bullish", "forming",
                         0.78, breakout=920.0, invalidation=860.0,
                         rationale=["Higher lows since Apr", "Resistance ~920"]),
            _portfolio_ctx("JPM", "Financials", 80, 142.0, 198.20),
            _chart_ctx("JPM", "1d", rsi=61.0, sma20=192.0, ret_1=0.6, ret_5=2.4, ret_20=5.1, last_close=198.20),
            _pattern_ctx("JPM", "Cup with Handle", "bullish", "confirmed",
                         0.74, breakout=202.0, invalidation=188.0,
                         rationale=["Rounded base", "Handle pullback to 192"]),
        ],
        pinned=["portfolio:NVDA", "stock_chart:NVDA", "chart_pattern:NVDA",
                "portfolio:JPM", "stock_chart:JPM", "chart_pattern:JPM"],
        reference=(
            "Both NVDA and JPM show constructive technicals. NVDA leads on "
            "magnitude (20-bar return +11.2%) but sits at overbought-adjacent "
            "RSI(14)=72 with a forming pattern. JPM is in a confirmed Cup "
            "with Handle, RSI(14)=61 in healthy territory, 20-bar return +5.1%. "
            "If 'strongest' means highest conviction with the least stretched "
            "entry, JPM is the cleaner read; if it means strongest trend, NVDA. "
            + DISCLAIMER
        ),
    ),
    row(
        id="grounded-B04", surface="chatbot",
        prompt="Are any of my holdings in a confirmed bearish pattern?",
        cards=[
            _portfolio_ctx("PYPL", "Financials", 60, 195.0, 62.10),
            _chart_ctx("PYPL", "1d", rsi=29.5, sma20=68.0, ret_1=-2.0, ret_5=-5.6, ret_20=-12.3, last_close=62.10),
            _pattern_ctx("PYPL", "Head and Shoulders", "bearish", "confirmed",
                         0.81, breakout=None, invalidation=72.0,
                         rationale=["Head at 78", "Neckline break at 68"]),
            _portfolio_ctx("AAPL", "Technology", 120, 145.0, 232.50),
            _chart_ctx("AAPL", "1d", rsi=55.1, sma20=228.0, ret_1=0.3, ret_5=1.8, ret_20=3.2, last_close=232.50),
        ],
        pinned=["portfolio:PYPL", "stock_chart:PYPL", "chart_pattern:PYPL",
                "portfolio:AAPL", "stock_chart:AAPL"],
        reference=(
            "Yes — PYPL has a confirmed Head and Shoulders top pattern with "
            "neckline break at 68 (last close 62.10, now below the neckline) "
            "and invalidation level 72. RSI(14)=29.5 sits in oversold territory, "
            "which can accompany but does not contradict a confirmed bearish "
            "structure. AAPL has no bearish pattern pinned. " + DISCLAIMER
        ),
    ),
    row(
        id="grounded-B05", surface="chatbot",
        prompt="If I wanted to add exposure, which holding's chart supports it?",
        cards=[
            _portfolio_ctx("JPM", "Financials", 80, 142.0, 198.20),
            _chart_ctx("JPM", "1d", rsi=61.0, sma20=192.0, ret_1=0.6, ret_5=2.4, ret_20=5.1, last_close=198.20),
            _pattern_ctx("JPM", "Cup with Handle", "bullish", "confirmed",
                         0.74, breakout=202.0, invalidation=188.0,
                         rationale=["Rounded base", "Handle pullback to 192"]),
            _portfolio_ctx("XOM", "Energy", 100, 95.0, 110.80),
            _chart_ctx("XOM", "1d", rsi=49.2, sma20=112.5, ret_1=-0.4, ret_5=-1.8, ret_20=-2.1, last_close=110.80),
        ],
        pinned=["portfolio:JPM", "stock_chart:JPM", "chart_pattern:JPM",
                "portfolio:XOM", "stock_chart:XOM"],
        reference=(
            "JPM's chart supports adding more — confirmed Cup with Handle "
            "(breakout 202, invalidation 188), price above the 20-day SMA, "
            "RSI(14)=61 (constructive, not overbought). XOM is the opposite: "
            "below SMA20, mild negative 20-bar return, no bullish pattern "
            "pinned. Adding is a sizing decision; the chart only supports "
            "which direction is technically cleaner. " + DISCLAIMER
        ),
    ),
    # ===== C. Chart recommendation (single-widget) — 5 rows =====
    row(
        id="grounded-C01", surface="chatbot",
        prompt="What's {{TICKER}}'s technical setup right now?",
        cards=[
            _chart_ctx("{{TICKER}}", "1d", rsi=74.8, sma20=895.0, ret_1=2.4, ret_5=6.1, ret_20=12.5, last_close=905.60),
        ],
        pinned=["stock_chart:{{TICKER}}"],
        reference=(
            "**Overview:** Pinned last close ~906 sits above the 20-day SMA "
            "(~895), with positive momentum across 1/5/20-bar windows.\n"
            "**Momentum:** 1-bar +2.4%, 5-bar +6.1%, 20-bar +12.5% — trend is up.\n"
            "**Indicators:** RSI(14)=74.8 is in overbought territory; mean-reversion "
            "risk elevated; SMA20 slope positive.\n"
            "**Levels / Risks:** Overbought RSI is the main short-term risk; "
            "any sustained close back below SMA20 would weaken the trend read. "
            + DISCLAIMER
        ),
    ),
    row(
        id="grounded-C02", surface="chatbot",
        prompt="Is {{TICKER}} in a downtrend?",
        cards=[
            _chart_ctx("{{TICKER}}", "1d", rsi=36.8, sma20=190.0, ret_1=-1.1, ret_5=-3.2, ret_20=-9.4, last_close=178.40),
        ],
        pinned=["stock_chart:{{TICKER}}"],
        reference=(
            "**Overview:** Pinned price below the 20-day SMA with negative "
            "returns across all three windows.\n"
            "**Momentum:** 1-bar −1.1%, 5-bar −3.2%, 20-bar −9.4% — all negative.\n"
            "**Indicators:** RSI(14)=36.8 in the lower half (approaching oversold "
            "but not extreme); SMA20 slope negative.\n"
            "**Levels / Risks:** Structure is consistent with a downtrend. A "
            "sustained reclaim of SMA20 would be the first sign of trend change. "
            + DISCLAIMER
        ),
    ),
    row(
        id="grounded-C03", surface="chatbot",
        prompt="Give me a quick read on {{TICKER}}.",
        cards=[
            _chart_ctx("{{TICKER}}", "1d", rsi=52.4, sma20=230.0, ret_1=0.4, ret_5=1.6, ret_20=3.0, last_close=232.50),
        ],
        pinned=["stock_chart:{{TICKER}}"],
        reference=(
            "**Overview:** Price marginally above the 20-day SMA, with mildly "
            "positive momentum — neutral-to-mildly-bullish setup.\n"
            "**Momentum:** 1-bar +0.4%, 5-bar +1.6%, 20-bar +3.0% — all positive but "
            "small in magnitude.\n"
            "**Indicators:** RSI(14)=52.4 sits near the midline — no overbought/"
            "oversold signal.\n"
            "**Levels / Risks:** Trend is constructive but not strong; risk is a "
            "choppy, range-bound tape rather than a directional move. " + DISCLAIMER
        ),
    ),
    row(
        id="grounded-C04", surface="chatbot",
        prompt="What's the momentum picture on {{TICKER}}?",
        cards=[
            _chart_ctx("{{TICKER}}", "1d", rsi=68.1, sma20=410.0, ret_1=1.8, ret_5=5.0, ret_20=8.4, last_close=421.30),
        ],
        pinned=["stock_chart:{{TICKER}}"],
        reference=(
            "**Overview:** Uptrend with above-trend momentum.\n"
            "**Momentum:** 1-bar +1.8%, 5-bar +5.0%, 20-bar +8.4% — consistent "
            "upward slope, no deceleration yet.\n"
            "**Indicators:** RSI(14)=68.1 — bullish but below the conventional "
            "70 overbought threshold.\n"
            "**Levels / Risks:** Watch for RSI crossing 70 (overbought) or a "
            "1-bar reversal that breaks the recent rhythm. " + DISCLAIMER
        ),
    ),
    row(
        id="grounded-C05", surface="chatbot",
        prompt="Should I be cautious on {{TICKER}}?",
        cards=[
            _chart_ctx("{{TICKER}}", "1d", rsi=33.0, sma20=72.0, ret_1=-1.6, ret_5=-4.8, ret_20=-11.5, last_close=62.10),
        ],
        pinned=["stock_chart:{{TICKER}}"],
        reference=(
            "**Overview:** Price well below the 20-day SMA with negative momentum "
            "across all windows.\n"
            "**Momentum:** 1-bar −1.6%, 5-bar −4.8%, 20-bar −11.5% — sustained "
            "decline.\n"
            "**Indicators:** RSI(14)=33.0 in oversold territory; SMA20 slope "
            "negative.\n"
            "**Levels / Risks:** Cautious is the natural posture — oversold RSI "
            "sometimes marks short-term bounces, but does not by itself reverse "
            "a downtrend. Risk is asymmetric to the downside until price reclaims "
            "SMA20. " + DISCLAIMER
        ),
    ),
    # ===== D. Multi-widget (cross-context) — 5 rows =====
    row(
        id="grounded-D01", surface="chatbot",
        prompt="Which of my positions has both weak technicals AND high portfolio weight?",
        cards=[
            _portfolio_ctx("TSLA", "Consumer Discretionary", 25, 250.0, 178.40),
            _chart_ctx("TSLA", "1d", rsi=38.4, sma20=185.6, ret_1=-1.2, ret_5=-3.4, ret_20=-8.7, last_close=178.40),
            _pattern_ctx("TSLA", "Descending Channel", "bearish", "confirmed",
                         0.82, breakout=192.0, invalidation=170.0,
                         rationale=["Lower highs", "Lower lows"]),
            _portfolio_ctx("AAPL", "Technology", 120, 145.0, 232.50),
            _chart_ctx("AAPL", "1d", rsi=55.1, sma20=228.0, ret_1=0.3, ret_5=1.8, ret_20=3.2, last_close=232.50),
            _portfolio_ctx("NVDA", "Technology", 30, 410.0, 905.60),
            _chart_ctx("NVDA", "1d", rsi=72.3, sma20=872.4, ret_1=2.1, ret_5=4.8, ret_20=11.2, last_close=905.60),
        ],
        pinned=["portfolio:TSLA", "stock_chart:TSLA", "chart_pattern:TSLA",
                "portfolio:AAPL", "stock_chart:AAPL",
                "portfolio:NVDA", "stock_chart:NVDA"],
        reference=(
            "TSLA is the cleanest match — the descending channel with invalidation "
            "170, RSI(14)=38.4 below 50, and a 20-bar return of −8.7% all read as "
            "weak technicals, and the position is meaningful in size. NVDA has "
            "the largest weight but its technicals are strong (RSI 72, +11.2% "
            "20-bar). AAPL is mid-weight with neutral technicals. " + DISCLAIMER
        ),
    ),
    row(
        id="grounded-D02", surface="chatbot",
        prompt="Is there a conflict between my portfolio's top holding and its chart?",
        cards=[
            _portfolio_ctx("NVDA", "Technology", 30, 410.0, 905.60),
            _chart_ctx("NVDA", "1d", rsi=78.4, sma20=872.4, ret_1=-3.2, ret_5=-1.5, ret_20=11.2, last_close=905.60),
        ],
        pinned=["portfolio:NVDA", "stock_chart:NVDA"],
        reference=(
            "There is a tension, not a hard conflict. Your top holding is NVDA "
            "with strong +11.2% 20-bar momentum (supportive), but the 1-bar "
            "return is now −3.2% and RSI(14)=78.4 is overbought. The chart is "
            "telling you the trend is intact but momentum is stretched in the "
            "short term — different signals, not contradictory. " + DISCLAIMER
        ),
    ),
    row(
        id="grounded-D03", surface="chatbot",
        prompt="Across my whole portfolio, what's the technical picture?",
        cards=[
            _portfolio_ctx("NVDA", "Technology", 30, 410.0, 905.60),
            _chart_ctx("NVDA", "1d", rsi=72.3, sma20=872.4, ret_1=2.1, ret_5=4.8, ret_20=11.2, last_close=905.60),
            _portfolio_ctx("JPM", "Financials", 80, 142.0, 198.20),
            _chart_ctx("JPM", "1d", rsi=61.0, sma20=192.0, ret_1=0.6, ret_5=2.4, ret_20=5.1, last_close=198.20),
            _portfolio_ctx("TSLA", "Consumer Discretionary", 25, 250.0, 178.40),
            _chart_ctx("TSLA", "1d", rsi=38.4, sma20=185.6, ret_1=-1.2, ret_5=-3.4, ret_20=-8.7, last_close=178.40),
            _portfolio_ctx("JNJ", "Healthcare", 70, 165.0, 152.40),
            _chart_ctx("JNJ", "1d", rsi=48.0, sma20=153.0, ret_1=0.0, ret_5=-0.2, ret_20=-0.5, last_close=152.40),
        ],
        pinned=["portfolio:NVDA", "stock_chart:NVDA",
                "portfolio:JPM", "stock_chart:JPM",
                "portfolio:TSLA", "stock_chart:TSLA",
                "portfolio:JNJ", "stock_chart:JNJ"],
        reference=(
            "Mixed. NVDA: uptrend, RSI overbought-adjacent (72). JPM: uptrend, "
            "healthy RSI (61). TSLA: downtrend, RSI 38. JNJ: sideways, RSI ~48. "
            "Two of four names lean bullish on technicals, one bearish, one "
            "neutral — the book is not uniformly exposed to one direction. "
            + DISCLAIMER
        ),
    ),
    row(
        id="grounded-D04", surface="chatbot",
        prompt="Where in my book does position sizing disagree with technical conviction?",
        cards=[
            _portfolio_ctx("TSLA", "Consumer Discretionary", 25, 250.0, 178.40),
            _chart_ctx("TSLA", "1d", rsi=38.4, sma20=185.6, ret_1=-1.2, ret_5=-3.4, ret_20=-8.7, last_close=178.40),
            _pattern_ctx("TSLA", "Descending Channel", "bearish", "confirmed",
                         0.82, breakout=192.0, invalidation=170.0,
                         rationale=["Lower highs"]),
            _portfolio_ctx("JPM", "Financials", 80, 142.0, 198.20),
            _chart_ctx("JPM", "1d", rsi=61.0, sma20=192.0, ret_1=0.6, ret_5=2.4, ret_20=5.1, last_close=198.20),
            _pattern_ctx("JPM", "Cup with Handle", "bullish", "confirmed",
                         0.74, breakout=202.0, invalidation=188.0,
                         rationale=["Rounded base"]),
        ],
        pinned=["portfolio:TSLA", "stock_chart:TSLA", "chart_pattern:TSLA",
                "portfolio:JPM", "stock_chart:JPM", "chart_pattern:JPM"],
        reference=(
            "If 'conviction' follows technicals: TSLA is your largest disagreement "
            "— bearish confirmed channel, RSI 38, deep underwater. JPM is your "
            "largest agreement — bullish confirmed Cup with Handle, RSI 61, "
            "modest unrealized gain. Rebalancing toward JPM (or trimming TSLA) "
            "would align sizing with technical conviction. " + DISCLAIMER
        ),
    ),
    row(
        id="grounded-D05", surface="chatbot",
        prompt="Give me a one-paragraph portfolio + technicals summary.",
        cards=[
            _portfolio_ctx("NVDA", "Technology", 30, 410.0, 905.60),
            _chart_ctx("NVDA", "1d", rsi=72.3, sma20=872.4, ret_1=2.1, ret_5=4.8, ret_20=11.2, last_close=905.60),
            _portfolio_ctx("TSLA", "Consumer Discretionary", 25, 250.0, 178.40),
            _chart_ctx("TSLA", "1d", rsi=38.4, sma20=185.6, ret_1=-1.2, ret_5=-3.4, ret_20=-8.7, last_close=178.40),
        ],
        pinned=["portfolio:NVDA", "stock_chart:NVDA",
                "portfolio:TSLA", "stock_chart:TSLA"],
        reference=(
            "Two-name read: NVDA is a strong technical setup (above SMA20, "
            "RSI 72, +11.2% 20-bar) with a meaningful unrealized gain. TSLA "
            "is the opposite (below SMA20, RSI 38, −8.7% 20-bar, descending "
            "channel). The portfolio's beta to Tech is dominated by NVDA's "
            "strength; the book's drag comes from TSLA's drawdown. Sizing "
            "decisions are yours — this is the read, not the prescription. "
            + DISCLAIMER
        ),
    ),
    # ===== E. Edge-case / methodology — 5 rows =====
    row(
        id="grounded-E01", surface="chatbot",
        prompt="What does the chart say about a stock that has been sideways for a month?",
        cards=[
            _chart_ctx("{{TICKER}}", "1d", rsi=50.2, sma20=230.5, ret_1=0.1, ret_5=-0.3, ret_20=0.4, last_close=231.0),
        ],
        pinned=["stock_chart:{{TICKER}}"],
        reference=(
            "**Overview:** Price hugging the 20-day SMA — consolidation.\n"
            "**Momentum:** All three returns within ±0.5% — no trend.\n"
            "**Indicators:** RSI(14)=50.2 sitting on the midline — neutral.\n"
            "**Levels / Risks:** Sideways tape means volatility is compressed; "
            "expect a directional move eventually, direction unknown until SMA20 "
            "breaks one way. " + DISCLAIMER
        ),
    ),
    row(
        id="grounded-E02", surface="chatbot",
        prompt="How should I read a stock that just gapped up 8%?",
        cards=[
            _chart_ctx("{{TICKER}}", "1d", rsi=78.5, sma20=180.0, ret_1=8.0, ret_5=9.2, ret_20=4.1, last_close=194.40),
        ],
        pinned=["stock_chart:{{TICKER}}"],
        reference=(
            "**Overview:** Sharp single-bar gap-up; last close well above SMA20.\n"
            "**Momentum:** 1-bar +8.0% is dominant; 5-bar +9.2%, 20-bar +4.1%.\n"
            "**Indicators:** RSI(14)=78.5 in overbought territory immediately "
            "after a gap.\n"
            "**Levels / Risks:** Gaps often fill partially; the natural risk is "
            "mean reversion toward SMA20 (180). Without seeing volume and the "
            "fundamental catalyst, the chart alone says momentum strong but "
            "stretched. " + DISCLAIMER
        ),
    ),
    row(
        id="grounded-E03", surface="chatbot",
        prompt="What does RSI > 70 actually mean here?",
        cards=[
            _chart_ctx("{{TICKER}}", "1d", rsi=74.2, sma20=895.0, ret_1=2.4, ret_5=6.1, ret_20=12.5, last_close=905.60),
        ],
        pinned=["stock_chart:{{TICKER}}"],
        reference=(
            "RSI(14) > 70 is the conventional overbought threshold. It signals "
            "that the recent up-move has been strong relative to the prior 14 "
            "bars; it does NOT by itself mean price will fall. In strong trends "
            "RSI can stay above 70 for weeks. Practical read: momentum is "
            "stretched, mean-reversion risk is elevated, but trend-following "
            "remains valid until price action breaks. " + DISCLAIMER
        ),
    ),
    row(
        id="grounded-E04", surface="chatbot",
        prompt="What if a position is up 40% — what does the chart add?",
        cards=[
            _portfolio_ctx("{{TICKER}}", "Technology", 50, 100.0, 140.0),
            _chart_ctx("{{TICKER}}", "1d", rsi=68.4, sma20=128.0, ret_1=0.8, ret_5=2.5, ret_20=14.0, last_close=140.0),
        ],
        pinned=["portfolio:{{TICKER}}", "stock_chart:{{TICKER}}"],
        reference=(
            "The 40% gain is a portfolio-side fact (cost basis vs. current price). "
            "The chart adds the *technical condition* of that gain: is it in a "
            "healthy trend (above SMA20, RSI in 50–70 zone) or stretched (RSI > 75, "
            "long upper wicks)? Here RSI(14)=68.4 is constructive but not "
            "extreme; trend intact. The chart doesn't tell you whether to take "
            "profits — that's a sizing/plan decision, not a technical one. "
            + DISCLAIMER
        ),
    ),
    row(
        id="grounded-E05", surface="chatbot",
        prompt="What's the difference between momentum and trend on this chart?",
        cards=[
            _chart_ctx("{{TICKER}}", "1d", rsi=55.1, sma20=228.0, ret_1=-0.4, ret_5=1.2, ret_20=3.0, last_close=231.0),
        ],
        pinned=["stock_chart:{{TICKER}}"],
        reference=(
            "**Momentum** here is the recent rate of change (1/5/20-bar returns: "
            "−0.4% / +1.2% / +3.0%). **Trend** is the direction of the moving "
            "average — price above SMA20 with a positive slope = uptrend. "
            "Momentum can be positive while trend is still turning (early uptrend), "
            "or negative while trend is intact (pullback within uptrend). They "
            "answer different questions. " + DISCLAIMER
        ),
    ),
]


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", encoding="utf-8") as f:
        for p in PROMPTS:
            f.write(json.dumps(p, ensure_ascii=False) + "\n")
    print(f"Wrote {len(PROMPTS)} rows → {OUT}")


if __name__ == "__main__":
    main()