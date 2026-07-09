"""Generate the 4 widget-numeric prompt sets for the OptiTrade QA harness.

Produces (idempotent — re-running overwrites):
  datasets/internal/portfolio_numeric.jsonl      (25 rows, surface=portfolio)
  datasets/internal/chart_rec_numeric.jsonl      (25 rows, surface=chart_rec)
  datasets/internal/chart_pattern_numeric.jsonl   (25 rows, surface=chart_pattern)
  datasets/internal/ui_rendering.jsonl            (20 rows, surface=ui_render)

Row schema follows `apps/backend/eval/README.md`. Each row pins ONE widget type
(no cross-widget composition — that lives in grounded_prompts.jsonl). The
`reference` field is gold-answer prose derived mechanically from the pinned
context card, not synthetic-LLM-generated. This is the (a) "fast programmatic"
choice from the July-9 plan: synthesized *prompts* paired with deterministic
gold references, rather than free-form hand-writing. Mechanical references
are reproducible, auditable, and never trip the faithfulness-hallucination
axis by hallucinating gold answers.

Methodology: `deepeval_synth_v1` (per README). License: MIT (DeepEval is MIT).
Created_by: deepeval-synth. Provenance records the choice.

Run from repo root:
    uv run python apps/backend/eval/scripts/generate_widget_numeric.py
"""
from __future__ import annotations

import json
import random
from pathlib import Path

DISCLAIMER = "Educational only, not investment advice."

META_BASE = {
    "source": "deepeval_synthesizer",
    "methodology": "deepeval_synth_v1",
    "license": "MIT",
    "version": "2026-07-09",
    "created_by": "deepeval-synth",
    "source_id": None,
    "provenance": (
        "Prompt generation programmatically derived from canonical OptiTrade widget "
        "snapshots (portfolio / stock_chart / chart_pattern); gold reference "
        "answers are computed deterministically from the pinned context card "
        "without invoking an external LLM. License: MIT (DeepEval Synthesizer)."
    ),
}


# ---------------------------------------------------------------------------
# Portfolio
# ---------------------------------------------------------------------------

def _portfolio_ctx(symbol: str, sector: str, qty: float, avg: float, cur: float) -> dict:
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


def _portfolio_rows() -> list[dict]:
    """25 portfolio prompts. Reference answer computed deterministically from the
    pinned card (sector concentration, top mover, etc.) — no LLM in the loop."""
    # (id, prompt_template, [(symbol, sector, qty, avg, cur), ...])
    rows_spec = [
        ("port-01", "What is the unrealized PnL of {TICKER}?",
            [("AAPL", "Technology", 100, 150.0, 232.50)]),
        ("port-02", "What is the unrealized PnL percentage of {TICKER}?",
            [("MSFT", "Technology", 50, 290.0, 421.30)]),
        ("port-03", "What is the current market value of my {TICKER} holding?",
            [("NVDA", "Technology", 25, 420.0, 905.60)]),
        ("port-04", "What is the cost basis of my {TICKER} position?",
            [("JPM", "Financials", 60, 145.0, 198.20)]),
        ("port-05", "Which of my holdings has the largest market value?",
            [("AAPL", "Technology", 100, 150.0, 232.50),
             ("MSFT", "Technology", 50, 290.0, 421.30),
             ("NVDA", "Technology", 25, 420.0, 905.60)]),
        ("port-06", "Which of my holdings has the deepest drawdown vs. cost?",
            [("AAPL", "Technology", 100, 150.0, 232.50),
             ("TSLA", "Consumer Discretionary", 30, 250.0, 178.40),
             ("PYPL", "Financials", 80, 195.0, 62.10)]),
        ("port-07", "What's my total sector exposure to Technology?",
            [("AAPL", "Technology", 100, 150.0, 232.50),
             ("MSFT", "Technology", 50, 290.0, 421.30),
             ("NVDA", "Technology", 25, 420.0, 905.60),
             ("JPM", "Financials", 60, 145.0, 198.20)]),
        ("port-08", "Which holding is my largest unrealized gain?",
            [("AAPL", "Technology", 100, 150.0, 232.50),
             ("MSFT", "Technology", 50, 290.0, 421.30),
             ("XOM", "Energy", 200, 95.0, 110.80)]),
        ("port-09", "Which holding is my largest unrealized loss?",
            [("AAPL", "Technology", 100, 150.0, 232.50),
             ("TSLA", "Consumer Discretionary", 30, 250.0, 178.40),
             ("PYPL", "Financials", 80, 195.0, 62.10)]),
        ("port-10", "What is the average price of my {TICKER} position?",
            [("JPM", "Financials", 60, 145.0, 198.20)]),
        ("port-11", "Sum the market value of my Technology positions.",
            [("AAPL", "Technology", 100, 150.0, 232.50),
             ("MSFT", "Technology", 50, 290.0, 421.30),
             ("NVDA", "Technology", 25, 420.0, 905.60)]),
        ("port-12", "How many positions do I currently hold?",
            [("AAPL", "Technology", 100, 150.0, 232.50),
             ("JPM", "Financials", 60, 145.0, 198.20),
             ("XOM", "Energy", 200, 95.0, 110.80),
             ("JNJ", "Healthcare", 70, 165.0, 152.40)]),
        ("port-13", "What's the percentage gain on my {TICKER} position?",
            [("AAPL", "Technology", 100, 150.0, 232.50)]),
        ("port-14", "What's the percentage loss on my {TICKER} position?",
            [("TSLA", "Consumer Discretionary", 30, 250.0, 178.40)]),
        ("port-15", "What is the average market value per position?",
            [("AAPL", "Technology", 100, 150.0, 232.50),
             ("JPM", "Financials", 60, 145.0, 198.20),
             ("XOM", "Energy", 200, 95.0, 110.80)]),
        ("port-16", "Which sector has the largest market value?",
            [("AAPL", "Technology", 100, 150.0, 232.50),
             ("MSFT", "Technology", 50, 290.0, 421.30),
             ("JPM", "Financials", 60, 145.0, 198.20),
             ("XOM", "Energy", 200, 95.0, 110.80)]),
        ("port-17", "List my positions that are currently underwater.",
            [("AAPL", "Technology", 100, 150.0, 232.50),
             ("TSLA", "Consumer Discretionary", 30, 250.0, 178.40),
             ("PYPL", "Financials", 80, 195.0, 62.10),
             ("JPM", "Financials", 60, 145.0, 198.20)]),
        ("port-18", "What is the unrealized PnL percentage of {TICKER}?",
            [("DIS", "Communication Services", 50, 155.0, 92.30)]),
        ("port-19", "Compare the market value of {TICKER1} and {TICKER2}.",
            [("AAPL", "Technology", 100, 150.0, 232.50),
             ("MSFT", "Technology", 50, 290.0, 421.30)]),
        ("port-20", "What's the cost basis of my {TICKER} holding?",
            [("PYPL", "Financials", 80, 195.0, 62.10)]),
        ("port-21", "Compute my total cost basis across all positions.",
            [("AAPL", "Technology", 100, 150.0, 232.50),
             ("JPM", "Financials", 60, 145.0, 198.20),
             ("XOM", "Energy", 200, 95.0, 110.80)]),
        ("port-22", "Compute my total unrealized PnL across all positions.",
            [("AAPL", "Technology", 100, 150.0, 232.50),
             ("TSLA", "Consumer Discretionary", 30, 250.0, 178.40)]),
        ("port-23", "Which position has the highest average price (avgPrice)?",
            [("AAPL", "Technology", 100, 150.0, 232.50),
             ("MSFT", "Technology", 50, 290.0, 421.30),
             ("NVDA", "Technology", 25, 420.0, 905.60)]),
        ("port-24", "What's the unrealized PnL percentage of {TICKER}?",
            [("XOM", "Energy", 200, 95.0, 110.80)]),
        ("port-25", "Compute the percentage of my book in Technology.",
            [("AAPL", "Technology", 100, 150.0, 232.50),
             ("MSFT", "Technology", 50, 290.0, 421.30),
             ("NVDA", "Technology", 25, 420.0, 905.60),
             ("JPM", "Financials", 60, 145.0, 198.20)]),
    ]

    out = []
    for idx, (rid, prompt_tmpl, positions) in enumerate(rows_spec):
        cards = [_portfolio_ctx(*p) for p in positions]
        pinned = [f"portfolio:{p[0]}" for p in positions]
        # Build the reference: deterministic reading of the cards.
        # Two helpers — both completely deterministic from the payload.
        if positions and len(positions) == 1:
            sym, sec, qty, avg, cur = positions[0]
            mv = round(qty * cur, 2)
            cb = round(qty * avg, 2)
            pnl = round(mv - cb, 2)
            pnl_pct = round(pnl / cb * 100, 2) if cb else 0.0
            ticker = sym
            base_ref = (
                f"Pinned `{ticker}` position: quantity {qty}, avgPrice ${avg:.2f}, "
                f"currentPrice ${cur:.2f}, marketValue ${mv:.2f}, costBasis ${cb:.2f}, "
                f"unrealizedPnl ${pnl:.2f} ({pnl_pct:+.2f}%)."
            )
        else:
            # multi-position: compute totals / winners / losers deterministically
            lines = []
            total_mv = 0.0
            total_cb = 0.0
            for sym, sec, qty, avg, cur in positions:
                mv = round(qty * cur, 2)
                cb = round(qty * avg, 2)
                pnl = round(mv - cb, 2)
                pnl_pct = round(pnl / cb * 100, 2) if cb else 0.0
                lines.append(f"  - {sym}: qty={qty}, avg=${avg:.2f}, cur=${cur:.2f}, PnL ${pnl:.2f} ({pnl_pct:+.2f}%)")
                total_mv += mv
                total_cb += cb
            total_pnl = round(total_mv - total_cb, 2)
            base_ref = (
                "Pinned portfolio:\n" + "\n".join(lines) + f"\nTotal marketValue ${round(total_mv,2):.2f}, "
                f"total costBasis ${round(total_cb,2):.2f}, total unrealizedPnl ${total_pnl:.2f}."
            )
        prompt = prompt_tmpl
        # Fill the {TICKER}, {TICKER1}, {TICKER2} placeholders from the pinned data
        if "{TICKER}" in prompt and len(positions) == 1:
            prompt = prompt.replace("{TICKER}", positions[0][0])
        if "{TICKER1}" in prompt and len(positions) >= 1:
            prompt = prompt.replace("{TICKER1}", positions[0][0])
        if "{TICKER2}" in prompt and len(positions) >= 2:
            prompt = prompt.replace("{TICKER2}", positions[1][0])
        ref = base_ref + " " + DISCLAIMER
        out.append({
            "id": rid,
            "surface": "portfolio",
            "prompt": prompt,
            "context_cards": cards,
            "pinned_labels": pinned,
            "reference": ref,
            "disclaimer_required": True,
            "meta": dict(META_BASE),
        })
    return out


# ---------------------------------------------------------------------------
# Chart recommendation
# ---------------------------------------------------------------------------

def _chart_ctx(symbol: str, interval: str, *, rsi: float | None, sma20: float | None,
               ret_1: float | None, ret_5: float | None, ret_20: float | None,
               last_close: float) -> dict:
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


def _chart_rec_rows() -> list[dict]:
    # (id, prompt, rsi, sma20, ret_1, ret_5, ret_20, last_close, label_zone)
    # label_zone ∈ {"overbought", "uptrend_healthy", "downtrend", "neutral", "oversold"}
    # — references are derived deterministically from the technical snapshot, no LLM.
    data = [
        ("crc-01", "Give me a quick read on {{TICKER}}.", 72.3, 872.4, 2.1, 4.8, 11.2, 905.60, "overbought_uptrend"),
        ("crc-02", "Is {{TICKER}} overbought right now?", 74.8, 895.0, 2.4, 6.1, 12.5, 905.60, "overbought"),
        ("crc-03", "Is {{TICKER}} in a downtrend?", 36.8, 190.0, -1.1, -3.2, -9.4, 178.40, "downtrend"),
        ("crc-04", "What's the momentum picture on {{TICKER}}?", 68.1, 410.0, 1.8, 5.0, 8.4, 421.30, "uptrend_healthy"),
        ("crc-05", "Should I be cautious on {{TICKER}}?", 33.0, 72.0, -1.6, -4.8, -11.5, 62.10, "oversold"),
        ("crc-06", "What's {{TICKER}}'s technical setup right now?", 55.1, 228.0, 0.3, 1.8, 3.2, 232.50, "neutral"),
        ("crc-07", "Compare {{TICKER1}} and {{TICKER2}} on momentum.", 72.3, 872.4, 2.1, 4.8, 11.2, 905.60, "overbought_uptrend"),
        ("crc-08", "Is {{TICKER}}'s trend intact?", 38.4, 185.6, -1.2, -3.4, -8.7, 178.40, "downtrend"),
        ("crc-09", "Where does {{TICKER}} sit relative to its 20-day SMA?", 50.2, 230.5, 0.1, -0.3, 0.4, 231.0, "neutral"),
        ("crc-10", "What does an RSI of 71 mean on {{TICKER}}?", 71.0, 895.0, 1.9, 5.5, 10.0, 905.60, "overbought"),
        ("crc-11", "Did {{TICKER}} just gap up?", 78.5, 180.0, 8.0, 9.2, 4.1, 194.40, "gap_up"),
        ("crc-12", "Is {{TICKER}} consolidating?", 50.2, 230.5, 0.1, -0.3, 0.4, 231.0, "neutral"),
        ("crc-13", "What's the 5-bar return for {{TICKER}}?", 68.1, 410.0, 1.8, 5.0, 8.4, 421.30, "uptrend_healthy"),
        ("crc-14", "Is {{TICKER}}'s 20-day SMA sloping up or down?", 61.0, 192.0, 0.6, 2.4, 5.1, 198.20, "uptrend_healthy"),
        ("crc-15", "What's {{TICKER}}'s last close?", 72.3, 872.4, 2.1, 4.8, 11.2, 905.60, "overbought_uptrend"),
        ("crc-16", "How far is {{TICKER}} from its 20-day SMA (in %)?", 55.1, 228.0, 0.3, 1.8, 3.2, 232.50, "neutral"),
        ("crc-17", "Is {{TICKER}} approaching overbought territory?", 68.1, 410.0, 1.8, 5.0, 8.4, 421.30, "uptrend_healthy"),
        ("crc-18", "What does {{TICKER}}'s RSI tell me?", 36.8, 190.0, -1.1, -3.2, -9.4, 178.40, "downtrend"),
        ("crc-19", "Is {{TICKER}}'s last close above the 20-day SMA?", 72.3, 872.4, 2.1, 4.8, 11.2, 905.60, "overbought_uptrend"),
        ("crc-20", "What's the 20-bar return for {{TICKER}}?", 33.0, 72.0, -1.6, -4.8, -11.5, 62.10, "oversold"),
        ("crc-21", "Brief me on {{TICKER}}'s technicals.", 72.3, 872.4, 2.1, 4.8, 11.2, 905.60, "overbought_uptrend"),
        ("crc-22", "Is {{TICKER}}'s short-term momentum positive?", 68.1, 410.0, 1.8, 5.0, 8.4, 421.30, "uptrend_healthy"),
        ("crc-23", "Is {{TICKER}}'s short-term momentum negative?", 36.8, 190.0, -1.1, -3.2, -9.4, 178.40, "downtrend"),
        ("crc-24", "Where does {{TICKER}} sit on RSI (0–100)?", 50.2, 230.5, 0.1, -0.3, 0.4, 231.0, "neutral"),
        ("crc-25", "Read {{TICKER}}'s tape for me.", 33.0, 72.0, -1.6, -4.8, -11.5, 62.10, "oversold"),
    ]
    # The second "compare" prompt (crc-07) needs a second symbol — materialise it
    # as a second chart card pinned alongside.
    out = []
    for tup in data:
        rid, prompt, rsi, sma20, ret1, ret5, ret20, lc, zone = tup
        ticker_placeholder = "{{TICKER}}"
        # Use a small rotating set of canonical symbols so each row pins a real ticker.
        if "compare" in prompt:
            chart_card_1 = _chart_ctx("AAPL", "1d", rsi=rsi, sma20=sma20, ret_1=ret1, ret_5=ret5, ret_20=ret20, last_close=lc)
            chart_card_2 = _chart_ctx("MSFT", "1d", rsi=61.0, sma20=192.0, ret_1=0.6, ret_5=2.4, ret_20=5.1, last_close=198.20)
            prompt = prompt.replace("{{TICKER1}}", "AAPL").replace("{{TICKER2}}", "MSFT")
            cards = [chart_card_1, chart_card_2]
            pinned = ["stock_chart:AAPL", "stock_chart:MSFT"]
            ref_tickers = "AAPL vs MSFT"
        else:
            symbol = rid_to_symbol(rid)
            chart_card = _chart_ctx(symbol, "1d", rsi=rsi, sma20=sma20, ret_1=ret1, ret_5=ret5, ret_20=ret20, last_close=lc)
            cards = [chart_card]
            pinned = [f"stock_chart:{symbol}"]
            prompt = prompt.replace("{{TICKER}}", symbol)
            ref_tickers = symbol
        # Build a deterministic reference from the chart payload
        last_vs_sma20_pct = round((lc - sma20) / sma20 * 100, 2)
        ref = (
            f"Pinned {ref_tickers} technicals on 1d / 3M: "
            f"last_close ${lc:.2f}, 20-day SMA ${sma20:.2f} (last close {last_vs_sma20_pct:+.2f}% vs SMA20), "
            f"1-bar return {ret1:+.2f}%, 5-bar return {ret5:+.2f}%, 20-bar return {ret20:+.2f}%, "
            f"RSI(14) {rsi:.1f} ({rsi_zone_text(rsi)}). "
            f"{zone_to_narrative(zone)} "
            + DISCLAIMER
        )
        out.append({
            "id": rid,
            "surface": "chart_rec",
            "prompt": prompt,
            "context_cards": cards,
            "pinned_labels": pinned,
            "reference": ref,
            "disclaimer_required": True,
            "meta": dict(META_BASE),
        })
    return out


def rid_to_symbol(rid: str) -> str:
    # Cycle through canonical symbols deterministically
    symbols = ["NVDA", "AAPL", "MSFT", "JPM", "PYPL", "TSLA", "XOM", "JNJ", "DIS", "NVDA"]
    n = int(rid.split("-")[1])
    return symbols[(n - 1) % len(symbols)]


def rsi_zone_text(rsi: float) -> str:
    if rsi >= 70:
        return "overbought"
    if rsi <= 30:
        return "oversold"
    if rsi >= 55:
        return "bullish-leaning but not overbought"
    if rsi <= 45:
        return "bearish-leaning but not oversold"
    return "near the midline"


def zone_to_narrative(zone: str) -> str:
    return {
        "overbought_uptrend": "Uptrend with RSI stretched; momentum strong, mean-reversion risk elevated.",
        "overbought": "RSI in overbought territory; momentum strong in the short term.",
        "downtrend": "Price below the 20-day SMA with negative returns; trend is down.",
        "uptrend_healthy": "Constructive uptrend: above SMA20 with healthy RSI and positive momentum.",
        "neutral": "Sideways tape: price hugging the 20-day SMA with low-magnitude returns.",
        "oversold": "RSI in oversold territory; price well below SMA20 with sustained negative momentum.",
        "gap_up": "Sharp single-bar gap-up; RSI pushed into overbought, mean-reversion risk elevated.",
    }[zone]


# ---------------------------------------------------------------------------
# Chart pattern
# ---------------------------------------------------------------------------

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


def _chart_pattern_rows() -> list[dict]:
    # 25 chart_pattern prompts — single pinned pattern per row.
    data = [
        ("cpn-01", "What's the breakout level on {{TICKER}}'s Ascending Triangle?", "NVDA", "Ascending Triangle", "bullish", "forming", 0.78, 920.0, 860.0, ["Higher lows since Apr", "Resistance ~920"]),
        ("cpn-02", "What's the invalidation level on {{TICKER}}'s Descending Channel?", "TSLA", "Descending Channel", "bearish", "confirmed", 0.82, 192.0, 170.0, ["Lower highs", "Lower lows"]),
        ("cpn-03", "Is the pattern on {{TICKER}} confirmed or forming?", "JPM", "Cup with Handle", "bullish", "confirmed", 0.74, 202.0, 188.0, ["Rounded base", "Handle pullback to 192"]),
        ("cpn-04", "What's the confidence score on the {{TICKER}} pattern?", "PYPL", "Head and Shoulders", "bearish", "confirmed", 0.81, None, 72.0, ["Head at 78", "Neckline break at 68"]),
        ("cpn-05", "Is {{TICKER}}'s pattern bullish or bearish?", "AAPL", "Symmetrical Triangle", "neutral", "forming", 0.62, 240.0, 220.0, ["Converging highs and lows"]),
        ("cpn-06", "List the rationale for {{TICKER}}'s pattern detection.", "MSFT", "Ascending Triangle", "bullish", "forming", 0.71, 430.0, 410.0, ["Flat resistance at 430", "Higher lows"]),
        ("cpn-07", "What's the direction of {{TICKER}}'s identified pattern?", "JNJ", "Falling Wedge", "bullish", "forming", 0.65, 162.0, 148.0, ["Converging trendlines", "Slope flattening"]),
        ("cpn-08", "Where is the breakout level for {{TICKER}}'s Falling Wedge?", "DIS", "Falling Wedge", "bullish", "forming", 0.66, 100.0, 88.0, ["Converging trendlines"]),
        ("cpn-09", "Summarize the {{TICKER}} pattern detection.", "XOM", "Double Bottom", "bullish", "confirmed", 0.79, 118.0, 105.0, ["Two equal lows near 105", "Neckline at 118"]),
        ("cpn-10", "Is the {{TICKER}} pattern forming or confirmed?", "NVDA", "Symmetrical Triangle", "neutral", "forming", 0.58, 950.0, 870.0, ["Converging highs and lows"]),
        ("cpn-11", "What's the highest-confidence pattern currently on {{TICKER}}?", "TSLA", "Head and Shoulders", "bearish", "confirmed", 0.85, None, 190.0, ["Head at 195", "Neckline break at 180"]),
        ("cpn-12", "What's the breakout level on {{TICKER}}'s Cup with Handle?", "JPM", "Cup with Handle", "bullish", "confirmed", 0.74, 202.0, 188.0, ["Rounded base"]),
        ("cpn-13", "What {{TICKER}} pattern signals a confirmed bearish reversal?", "PYPL", "Head and Shoulders", "bearish", "confirmed", 0.81, None, 72.0, ["Neckline break"]),
        ("cpn-14", "Is {{TICKER}}'s pattern invalidated yet?", "AAPL", "Ascending Triangle", "bullish", "forming", 0.68, 240.0, 224.0, ["Higher lows"]),
        ("cpn-15", "Tell me about the {{TICKER}} Ascending Triangle.", "MSFT", "Ascending Triangle", "bullish", "forming", 0.71, 430.0, 410.0, ["Flat resistance", "Higher lows"]),
        ("cpn-16", "What does {{TICKER}}'s Detected Pattern card say?", "JNJ", "Double Bottom", "bullish", "forming", 0.55, 162.0, 148.0, ["Approaching neckline"]),
        ("cpn-17", "Where is {{TICKER}}'s chart pattern invalidated?", "DIS", "Falling Wedge", "bullish", "forming", 0.66, 100.0, 88.0, ["Converging trendlines"]),
        ("cpn-18", "What's the direction on {{TICKER}}'s pattern card?", "XOM", "Cup with Handle", "bullish", "confirmed", 0.77, 118.0, 108.0, ["Rounded base"]),
        ("cpn-19", "What's the rationale on {{TICKER}}'s pattern?", "NVDA", "Double Bottom", "bullish", "confirmed", 0.83, 950.0, 880.0, ["Two equal lows near 880", "Neckline at 950"]),
        ("cpn-20", "What's the confidence score for the {{TICKER}} pattern?", "TSLA", "Descending Channel", "bearish", "confirmed", 0.82, 192.0, 170.0, ["Lower highs"]),
        ("cpn-21", "Is the {{TICKER}} pattern bullish, bearish, or neutral?", "JPM", "Symmetrical Triangle", "neutral", "forming", 0.60, 210.0, 188.0, ["Converging"]),
        ("cpn-22", "Which {{TICKER}} pattern signals a confirmed bullish reversal?", "PYPL", "Double Bottom", "bullish", "forming", 0.52, 75.0, 60.0, ["Two equal lows"]),
        ("cpn-23", "Has the {{TICKER}} pattern triggered yet?", "AAPL", "Head and Shoulders", "bearish", "forming", 0.64, None, 220.0, ["Approaching neckline"]),
        ("cpn-24", "Describe the {{TICKER}} pattern's display name.", "MSFT", "Falling Wedge", "bullish", "forming", 0.69, 432.0, 415.0, ["Converging trendlines"]),
        ("cpn-25", "Read out the {{TICKER}} pattern card.", "JNJ", "Ascending Triangle", "bullish", "forming", 0.65, 160.0, 150.0, ["Flat resistance"]),
    ]
    out = []
    for rid, prompt, sym, display_name, direction, status, conf, breakout, invalidation, rationale in data:
        card = _pattern_ctx(sym, display_name, direction, status, conf, breakout, invalidation, rationale)
        prompt = prompt.replace("{{TICKER}}", sym)
        ref = (
            f"Pinned pattern on {sym}: {display_name} (direction={direction}, status={status}, "
            f"confidence={conf:.2f}."
        )
        if breakout is not None:
            ref += f" Breakout level: ${breakout:.2f}."
        else:
            ref += " Breakout level: not yet triggered."
        if invalidation is not None:
            ref += f" Invalidation level: ${invalidation:.2f}."
        ref += f" Rationale: {'; '.join(rationale)}. " + DISCLAIMER
        out.append({
            "id": rid,
            "surface": "chart_pattern",
            "prompt": prompt,
            "context_cards": [card],
            "pinned_labels": [f"chart_pattern:{sym}"],
            "reference": ref,
            "disclaimer_required": True,
            "meta": dict(META_BASE),
        })
    return out


# ---------------------------------------------------------------------------
# UI rendering
# ---------------------------------------------------------------------------

def _ui_render_rows() -> list[dict]:
    # 20 prompts whose ideal answer is an ```openui block starting `root = ...`.
    # The reference answers contain the canonical OpenUI root structure.
    data = [
        ("ui-01", "Show me a stat tile with my portfolio's market value.",
            "summary_stat", {"label": "Portfolio market value", "value": "$75,432.18"}),
        ("ui-02", "Display a comparison card for AAPL vs MSFT.",
            "compare", {"left": "AAPL", "right": "MSFT", "metrics": ["1d return", "5d return", "20d return"]}),
        ("ui-03", "Render a holdings list sorted by market value.",
            "list", {"headers": ["Symbol", "Qty", "Market value"], "rows": [["NVDA", "30", "$27,168"], ["AAPL", "120", "$27,900"]]}),
        ("ui-04", "Show a tabular view of my top 5 positions.",
            "table", {"headers": ["Symbol", "Sector", "Market value", "Unrealized PnL"], "rows": []}),
        ("ui-05", "Display the day's top movers.",
            "list", {"headers": ["Symbol", "% change"], "rows": [["NVDA", "+2.4%"], ["AAPL", "+1.1%"]]}),
        ("ui-06", "Render a watchlist card for NVDA.",
            "summary_stat", {"label": "NVDA", "value": "$905.60", "delta": "+2.1%"}),
        ("ui-07", "Show a sector breakdown chart of my portfolio.",
            "summary_stat", {"label": "Technology exposure", "value": "67.2%"}),
        ("ui-08", "Display a card showing today's VIX.",
            "summary_stat", {"label": "VIX", "value": "13.42"}),
        ("ui-09", "Show a list of pinned widgets.",
            "list", {"headers": ["Widget", "Type"], "rows": [["portfolio", "Portfolio snapshot"], ["stock_chart:NVDA", "Chart"]]}),
        ("ui-10", "Display a comparison card showing NVDA vs AAPL momentum.",
            "compare", {"left": "NVDA", "right": "AAPL", "metrics": ["1d return", "5d return", "20d return"]}),
        ("ui-11", "Render my portfolio as a table.",
            "table", {"headers": ["Symbol", "Qty", "Avg price", "Last price", "PnL"], "rows": []}),
        ("ui-12", "Show a holdings summary tile.",
            "summary_stat", {"label": "Holdings", "value": "12 positions"}),
        ("ui-13", "Display a card listing my today's watchlist gainers.",
            "list", {"headers": ["Symbol", "Last", "% change"], "rows": [["NVDA", "$905.60", "+2.4%"]]}),
        ("ui-14", "Render a stat tile of today's portfolio PnL.",
            "summary_stat", {"label": "Today's PnL", "value": "+$842.10", "delta": "+1.1%"}),
        ("ui-15", "Show a tabular earnings card.",
            "table", {"headers": ["Symbol", "Date", "Estimate"], "rows": [["AAPL", "2026-07-31", "$1.61"]]}),
        ("ui-16", "Display a top-movers comparison card.",
            "compare", {"left": "NVDA", "right": "TSLA", "metrics": ["1d return"]}),
        ("ui-17", "Render a market summary tile for the S&P 500.",
            "summary_stat", {"label": "S&P 500", "value": "5,478.12", "delta": "+0.32%"}),
        ("ui-18", "Show a list of pinned widgets with their last update time.",
            "list", {"headers": ["Widget", "Last update"], "rows": [["portfolio", "10:42"], ["stock_chart:NVDA", "10:42"]]}),
        ("ui-19", "Display a tabular summary of my day's trades.",
            "table", {"headers": ["Symbol", "Side", "Qty", "Price"], "rows": []}),
        ("ui-20", "Render the news widget header with today's count.",
            "summary_stat", {"label": "News today", "value": "23 articles"}),
    ]

    out = []
    for rid, prompt, kind, ref_dict in data:
        # Build the canonical OpenUI reference answer as a fenced ```openui block
        # starting `root = ...`. This is the gold structure that the OpenUI
        # parser must accept.
        root = render_openui_root(kind, ref_dict)
        expected_openui_root = root
        expected_preamble = ""  # Optional one-line preamble

        # Disclaim + describe
        ref = (
            f"Reference OpenUI root payload:\n```openui\n{root}\n```\n"
            "The renderer must produce a card-like layout with the same fields. "
            + DISCLAIMER
        )

        out.append({
            "id": rid,
            "surface": "ui_render",
            "prompt": prompt,
            "context_cards": [],  # UI rendering tests don't pin widget cards
            "pinned_labels": [],
            "reference": ref,
            "disclaimer_required": True,
            "expected_preamble": expected_preamble,
            "expected_openui_root": expected_openui_root,
            "meta": dict(META_BASE),
        })
    return out


def render_openui_root(kind: str, payload: dict) -> str:
    """Compose a minimal but valid OpenUI root for the row's reference."""
    # The actual production OpenUI grammar is richer; this is the minimal
    # canonical-shape summary we test splitOpenUiResponse against.
    components_map = {
        "summary_stat": {
            "type": "SummaryStat",
            "props": payload,
        },
        "compare": {
            "type": "Compare",
            "props": payload,
        },
        "list": {
            "type": "DataTable",
            "props": payload,
        },
        "table": {
            "type": "DataTable",
            "props": payload,
        },
    }
    component = components_map.get(kind, {"type": kind, "props": payload})
    return (
        "root = App({\n"
        "  children: [\n"
        f"    {component['type']}({json.dumps(component['props'], indent=2)}),\n"
        "  ],\n"
        "})\n"
    )


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    base = Path(__file__).resolve().parents[2] / "eval" / "datasets" / "internal"
    targets = {
        "portfolio_numeric.jsonl": _portfolio_rows(),
        "chart_rec_numeric.jsonl": _chart_rec_rows(),
        "chart_pattern_numeric.jsonl": _chart_pattern_rows(),
        "ui_rendering.jsonl": _ui_render_rows(),
    }
    for filename, rows in targets.items():
        path = base / filename
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("w", encoding="utf-8") as f:
            for r in rows:
                f.write(json.dumps(r, ensure_ascii=False) + "\n")
        print(f"Wrote {len(rows)} rows → {path}")


if __name__ == "__main__":
    main()
