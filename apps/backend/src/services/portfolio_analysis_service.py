"""LLM-backed portfolio widget insight generation."""

from __future__ import annotations

import asyncio
import json
import os
import time
from typing import Any

import httpx
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import Runnable
from langchain_openai import ChatOpenAI

from src.api.schemas.ai_portfolio import PortfolioAnalysisResponse
from src.api.schemas.stock_chart import ChartInterval, ChartRange
from src.services.portfolio_service import PortfolioService
from src.services.stock_chart_service import (
    StockChartService,
    resolve_stock_chart_params,
)
from src.services.stock_pattern_detection import detect_chart_patterns

OPENROUTER_BASE = "https://openrouter.ai/api/v1"
PORTFOLIO_PATTERN_INTERVAL = ChartInterval.DAY_1
PORTFOLIO_PATTERN_RANGE = ChartRange.MONTH_3


def _parse_bounded_int_env(name: str, default: int, *, minimum: int, maximum: int) -> int:
    raw = os.environ.get(name, str(default)).strip()
    try:
        value = int(raw)
    except ValueError:
        return default
    return max(minimum, min(value, maximum))


PORTFOLIO_PATTERN_CACHE_TTL_SECONDS = _parse_bounded_int_env(
    "PORTFOLIO_PATTERN_CACHE_TTL_SECONDS",
    3600,
    minimum=60,
    maximum=86400,
)
PORTFOLIO_PATTERN_ERROR_TTL_SECONDS = _parse_bounded_int_env(
    "PORTFOLIO_PATTERN_ERROR_TTL_SECONDS",
    120,
    minimum=30,
    maximum=3600,
)
PORTFOLIO_PATTERN_MAX_CONCURRENCY = _parse_bounded_int_env(
    "PORTFOLIO_PATTERN_MAX_CONCURRENCY",
    3,
    minimum=1,
    maximum=8,
)

_PATTERN_SUMMARY_CACHE: dict[tuple[str, str, str], tuple[float, dict[str, Any] | None]] = {}
_PATTERN_SUMMARY_IN_FLIGHT: dict[
    tuple[str, str, str], asyncio.Task[dict[str, Any] | None]
] = {}
_PATTERN_SUMMARY_CACHE_LOCK = asyncio.Lock()

SYSTEM_PROMPT = """You are OptiTrade's portfolio insight assistant.
You receive a portfolio snapshot with summary numbers, sector weights, positions,
and optional deterministic chart-pattern summaries for the top holdings.
Rules:
- Base every statement only on the provided portfolio data.
- Focus on concentration, diversification, unrealized performance, and obvious risk drivers.
- Avoid filler that only restates counts or profitability without interpretation.
- When a top holding includes chartPattern data, use it to refine whether that holding looks
  technically supportive or vulnerable.
- Treat chart patterns as contextual signals, not certainties or price targets.
- Do not mention a chart pattern for a symbol unless chartPattern data is present.
- Do not mention missing, unavailable, absent, or insufficient chart-pattern data.
- Do not invent market news, macro events, or price targets.
- Keep the output compact for a dashboard widget.
- Write like a strategist, not a reporter.
- Use conditional, educational phrasing such as "if reducing risk" or "if adding exposure".
- Return strict JSON only with keys: insight, riskLabel, riskTone, strategy.
- riskTone must be exactly one of: low, medium, high.
- riskLabel must be short and readable (3 to 8 words).
- strategy may be an empty array when only narrative commentary is needed.
- symbols must only contain portfolio symbols from the provided snapshot.
- insight must be 2 to 4 sentences and make clear it is educational, not advice."""

USER_PROMPT = """Portfolio snapshot JSON:
{portfolio_json}

Return strict JSON only."""


def _parse_temperature() -> float:
    raw = os.environ.get("OPENROUTER_TEMPERATURE", "0.25").strip()
    try:
        return max(0.0, min(float(raw), 2.0))
    except ValueError:
        return 0.25


def _parse_max_output_tokens() -> int | None:
    raw = os.environ.get("OPENROUTER_MAX_OUTPUT_TOKENS", "220").strip()
    if not raw:
        return 220
    try:
        value = int(raw)
    except ValueError:
        return 220
    if value <= 0:
        return None
    return max(64, min(value, 2048))


def _parse_request_timeout() -> float:
    raw = os.environ.get("OPENROUTER_REQUEST_TIMEOUT", "60").strip()
    try:
        value = float(raw)
    except ValueError:
        return 60.0
    return max(5.0, min(value, 300.0))


def _strip_code_fences(text: str) -> str:
    stripped = text.strip()
    if stripped.startswith("```"):
        lines = stripped.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        return "\n".join(lines).strip()
    return stripped


def _extract_json_object(text: str) -> str | None:
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return None
    return text[start : end + 1]


def _clean_insight_text(insight: str) -> str:
    cleaned = " ".join(insight.split())
    banned_phrases = (
        "no chart patterns are available",
        "no chart pattern is available",
        "chart patterns are unavailable",
        "chart pattern is unavailable",
        "technical momentum is unavailable",
        "to assess technical momentum",
    )
    sentences = [sentence.strip() for sentence in cleaned.split(".") if sentence.strip()]
    kept: list[str] = []
    for sentence in sentences:
        normalized = sentence.lower()
        if any(phrase in normalized for phrase in banned_phrases):
            continue
        kept.append(sentence)

    if not kept:
        return ""
    return ". ".join(kept) + "."


def _normalize_strategy_items(strategy: Any) -> list[dict[str, Any]]:
    if not isinstance(strategy, list):
        return []

    normalized: list[dict[str, Any]] = []
    for item in strategy:
        if isinstance(item, str):
            continue
        if not isinstance(item, dict):
            continue

        label = str(item.get("label") or item.get("action") or "").strip()
        if not label:
            continue

        symbols_raw = item.get("symbols")
        if isinstance(symbols_raw, list):
            symbols = [str(symbol).strip() for symbol in symbols_raw if str(symbol).strip()]
        elif symbols_raw is None:
            symbol_value = str(item.get("symbol") or "").strip()
            symbols = [symbol_value] if symbol_value else []
        else:
            symbol_value = str(symbols_raw).strip()
            symbols = [symbol_value] if symbol_value else []

        reason = str(item.get("reason") or item.get("rationale") or "").strip()
        if not reason:
            continue

        normalized.append(
            {
                "label": label,
                "symbols": symbols,
                "reason": reason,
            }
        )

    return normalized


def build_portfolio_analysis_chain(
    *,
    api_key: str,
    model: str,
    temperature: float = 0.25,
    max_tokens: int | None = 220,
    request_timeout: float = 60.0,
    http_async_client: httpx.AsyncClient | None = None,
    app_title: str = "OptiTrade",
) -> Runnable:
    llm_kwargs: dict[str, Any] = {
        "model": model,
        "temperature": temperature,
        "api_key": api_key,
        "base_url": OPENROUTER_BASE,
        "default_headers": {"X-Title": app_title},
        "request_timeout": request_timeout,
        "max_retries": 1,
    }
    if max_tokens is not None:
        llm_kwargs["max_tokens"] = max_tokens
    if http_async_client is not None:
        llm_kwargs["http_async_client"] = http_async_client

    llm = ChatOpenAI(**llm_kwargs)
    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", SYSTEM_PROMPT),
            ("human", USER_PROMPT),
        ]
    )
    return prompt | llm | StrOutputParser()


def _ranked_positions(snapshot: dict[str, Any]) -> list[dict[str, Any]]:
    positions = snapshot.get("positions", [])
    return sorted(
        positions,
        key=lambda position: float(position.get("marketValue", 0.0) or 0.0),
        reverse=True,
    )


def _position_symbol(position: dict[str, Any]) -> str:
    return str(position.get("symbol", "")).strip().upper()


def _pattern_label(summary: dict[str, Any] | None) -> str | None:
    if not summary:
        return None
    display_name = str(summary.get("displayName", "")).strip()
    direction = str(summary.get("direction", "")).strip().lower()
    status = str(summary.get("status", "")).strip().lower()
    parts = [part for part in (status, direction, display_name) if part]
    return " ".join(parts) if parts else None


def _pattern_bias_label(summary: dict[str, Any] | None) -> str:
    if not summary:
        return "Neutral"
    direction = str(summary.get("direction", "")).strip().lower()
    status = str(summary.get("status", "")).strip().lower()
    if direction == "bullish":
        return "Strong Bullish" if status == "confirmed" else "Possible Bullish"
    if direction == "bearish":
        return "Strong Bearish" if status == "confirmed" else "Possible Bearish"
    return "Neutral"


def _pattern_explanation(summary: dict[str, Any] | None) -> str | None:
    if not summary:
        return "No clear chart pattern was detected in the scanned window."
    display_name = str(summary.get("displayName", "")).strip()
    direction = str(summary.get("direction", "")).strip().lower()
    status = str(summary.get("status", "")).strip().lower()
    confidence = summary.get("confidencePct")
    direction_text = direction if direction else "directional"
    status_text = status if status else "detected"
    confidence_text = (
        f" with about {int(confidence)}% confidence"
        if isinstance(confidence, int | float)
        else ""
    )
    if display_name:
        return (
            f"{display_name} is currently {status_text} and leans {direction_text}"
            f"{confidence_text}."
        )
    return None


def _as_float(value: Any) -> float | None:
    try:
        if value is None or value == "":
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _signal_bias(direction: str | None, *, strong: bool = False) -> str:
    normalized = (direction or "").strip().lower()
    if normalized == "bullish":
        return "Strong Bullish" if strong else "Possible Bullish"
    if normalized == "bearish":
        return "Strong Bearish" if strong else "Possible Bearish"
    return "Neutral"


def _lens_signal(bias: str, explanation: str) -> dict[str, Any]:
    return {
        "bias": bias,
        "explanation": explanation,
    }


def _build_lens_signals(
    position: dict[str, Any],
    summary: dict[str, Any] | None,
) -> dict[str, Any]:
    technical_bias = _pattern_bias_label(summary)
    technical_explanation = (
        _pattern_explanation(summary)
        or "No clear chart pattern was detected in the scanned window."
    )

    if not summary:
        neutral = _lens_signal(
            "Neutral",
            "No lens-specific trigger was derived because no chart pattern was detected.",
        )
        return {
            "technical": _lens_signal(technical_bias, technical_explanation),
            "day_trade": neutral,
            "buy_and_hold": _lens_signal(
                "Neutral",
                "No longer-horizon tilt stands out without a clearer technical pattern.",
            ),
        }

    direction = str(summary.get("direction", "")).strip().lower()
    status = str(summary.get("status", "")).strip().lower()
    confidence = _as_float(summary.get("confidencePct"))
    breakout_level = _as_float(summary.get("breakoutLevel"))
    invalidation_level = _as_float(summary.get("invalidationLevel"))
    current_price = _as_float(position.get("currentPrice")) or 0.0
    pnl_percent = _as_float(position.get("unrealizedPnlPercent")) or 0.0
    display_name = str(summary.get("displayName", "")).strip() or "pattern setup"
    confirmed = status == "confirmed"
    near_breakout = (
        breakout_level is not None
        and abs(current_price - breakout_level) / max(abs(breakout_level), 1.0) <= 0.02
    )

    day_trade_bias = "Neutral"
    day_trade_explanation = (
        f"Intraday conviction is muted because {display_name} has not produced a clean trigger yet."
    )
    if direction == "bullish":
        if breakout_level is not None and current_price >= breakout_level:
            day_trade_bias = _signal_bias(
                "bullish",
                strong=confirmed and (confidence or 0) >= 75,
            )
            day_trade_explanation = (
                f"Price is trading through the {display_name} trigger, so day-trade momentum still leans long."
            )
        elif near_breakout or confirmed:
            day_trade_bias = "Possible Bullish"
            day_trade_explanation = (
                f"{display_name} is close enough to its trigger to keep an intraday long setup in play."
            )
        elif invalidation_level is not None and current_price <= invalidation_level:
            day_trade_bias = "Possible Bearish"
            day_trade_explanation = (
                f"Price is leaning back toward invalidation, so intraday traders would stay defensive for now."
            )
    elif direction == "bearish":
        if breakout_level is not None and current_price <= breakout_level:
            day_trade_bias = _signal_bias(
                "bearish",
                strong=confirmed and (confidence or 0) >= 75,
            )
            day_trade_explanation = (
                f"Price is trading through the {display_name} breakdown area, so day-trade pressure still leans short."
            )
        elif near_breakout or confirmed:
            day_trade_bias = "Possible Bearish"
            day_trade_explanation = (
                f"{display_name} keeps a short setup active for intraday traders even before a cleaner extension."
            )
        elif invalidation_level is not None and current_price >= invalidation_level:
            day_trade_bias = "Possible Bullish"
            day_trade_explanation = (
                f"Price is pressing the invalidation zone, so shorts lose conviction on a day-trade basis."
            )

    buy_and_hold_bias = "Neutral"
    buy_and_hold_explanation = (
        "The longer-horizon read stays balanced until the technical setup and holding P/L line up more clearly."
    )
    if direction == "bullish":
        if confirmed and pnl_percent >= 10:
            buy_and_hold_bias = "Strong Bullish"
            buy_and_hold_explanation = (
                f"The bullish {display_name} aligns with an existing gain, which supports a stronger hold or accumulate posture."
            )
        elif pnl_percent >= 0:
            buy_and_hold_bias = "Possible Bullish"
            buy_and_hold_explanation = (
                f"The longer-horizon posture still leans constructive because the position is holding above cost with a bullish setup."
            )
        else:
            buy_and_hold_bias = "Neutral"
            buy_and_hold_explanation = (
                f"The bullish pattern is constructive, but the position is still below cost basis, so a buy-and-hold view stays patient."
            )
    elif direction == "bearish":
        if confirmed and pnl_percent < 0:
            buy_and_hold_bias = "Strong Bearish"
            buy_and_hold_explanation = (
                f"The bearish {display_name} is confirmed while the position is underwater, which weakens the longer-horizon case."
            )
        elif pnl_percent < 0:
            buy_and_hold_bias = "Possible Bearish"
            buy_and_hold_explanation = (
                f"The longer-horizon read stays cautious because the position is below cost and the pattern is not supportive."
            )
        else:
            buy_and_hold_bias = "Possible Bearish"
            buy_and_hold_explanation = (
                f"The position is still profitable, but the bearish pattern argues more for review than fresh accumulation."
            )

    return {
        "technical": _lens_signal(technical_bias, technical_explanation),
        "day_trade": _lens_signal(day_trade_bias, day_trade_explanation),
        "buy_and_hold": _lens_signal(buy_and_hold_bias, buy_and_hold_explanation),
    }


def _pattern_bias(summary: dict[str, Any] | None) -> int:
    if not summary:
        return 0
    direction = str(summary.get("direction", "")).strip().lower()
    status = str(summary.get("status", "")).strip().lower()
    confirmed_bonus = 1 if status == "confirmed" else 0
    if direction == "bullish":
        return 1 + confirmed_bonus
    if direction == "bearish":
        return -1 - confirmed_bonus
    return 0


def _summarize_patterns(patterns: list[Any]) -> dict[str, Any] | None:
    if not patterns:
        return None
    top = patterns[0]
    return {
        "displayName": top.display_name,
        "direction": top.direction,
        "status": top.status,
        "confidencePct": int(round(top.confidence * 100)),
        "breakoutLevel": top.breakout_level,
        "invalidationLevel": top.invalidation_level,
    }


def _symbols_for_pattern_scan(snapshot: dict[str, Any]) -> list[str]:
    symbols: list[str] = []
    for position in _ranked_positions(snapshot):
        symbol = _position_symbol(position)
        if symbol and symbol not in symbols:
            symbols.append(symbol)
    return symbols


def _rank_add_candidates(
    ranked_positions: list[dict[str, Any]],
    pattern_summaries: dict[str, dict[str, Any]],
) -> list[str]:
    candidates = ranked_positions[1:5]
    scored = sorted(
        candidates,
        key=lambda position: (
            _pattern_bias(pattern_summaries.get(_position_symbol(position))),
            -float(position.get("marketValue", 0.0) or 0.0),
        ),
        reverse=True,
    )
    return [
        symbol
        for symbol in (_position_symbol(position) for position in scored)
        if symbol
    ][:2]


def _candidate_reason_from_patterns(
    symbols: list[str],
    pattern_summaries: dict[str, dict[str, Any]],
) -> str:
    for symbol in symbols:
        label = _pattern_label(pattern_summaries.get(symbol))
        if label:
            return f"Pattern context is firmer in {symbol} with a {label} setup."
    return "Pattern context does not show a stronger bearish setup in these smaller holdings."


def _build_position_signals(
    ranked_positions: list[dict[str, Any]],
    pattern_summaries: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    signals: list[dict[str, Any]] = []
    for position in ranked_positions:
        symbol = _position_symbol(position)
        if not symbol:
            continue
        summary = pattern_summaries.get(symbol)
        signals.append(
            {
                "symbol": symbol,
                "bias": _pattern_bias_label(summary),
                "confidence": summary.get("confidencePct") if summary else None,
                "pattern": summary.get("displayName") if summary else None,
                "status": summary.get("status") if summary else None,
                "explanation": _pattern_explanation(summary),
                "lenses": _build_lens_signals(position, summary),
            }
        )
    return signals


def _portfolio_payload(
    snapshot: dict[str, Any],
    pattern_summaries: dict[str, dict[str, Any]] | None = None,
) -> str:
    positions = snapshot.get("positions", [])
    sector_values = snapshot.get("sectorValues", [])
    summary = snapshot.get("summary", {})
    total_value = float(summary.get("totalValue", 0.0) or 0.0)
    ranked_positions = _ranked_positions(snapshot)
    pattern_summaries = pattern_summaries or {}
    top_positions = [
        {
            "symbol": position.get("symbol"),
            "sector": position.get("sector"),
            "marketValue": round(float(position.get("marketValue", 0.0) or 0.0), 2),
            "weightPercent": round(
                (
                    float(position.get("marketValue", 0.0) or 0.0) / total_value * 100
                    if total_value
                    else 0.0
                ),
                2,
            ),
            "unrealizedPnlPercent": round(
                float(position.get("unrealizedPnlPercent", 0.0) or 0.0), 2
            ),
            "chartPattern": pattern_summaries.get(_position_symbol(position)),
        }
        for position in ranked_positions[:5]
    ]
    payload = {
        "asOf": snapshot.get("asOf"),
        "source": snapshot.get("source"),
        "broker": snapshot.get("broker", {}).get("name"),
        "summary": {
            "totalValue": round(float(summary.get("totalValue", 0.0) or 0.0), 2),
            "pnl": round(float(summary.get("pnl", 0.0) or 0.0), 2),
            "pnlPercent": round(float(summary.get("pnlPercent", 0.0) or 0.0), 2),
            "dailyPnl": round(float(summary.get("dailyPnl", 0.0) or 0.0), 2),
            "marginUsage": round(float(summary.get("marginUsage", 0.0) or 0.0), 2),
        },
        "sectorValues": [
            {
                "sector": sector.get("sector"),
                "percent": round(float(sector.get("percent", 0.0) or 0.0), 2),
            }
            for sector in sector_values[:6]
        ],
        "topPositions": top_positions,
        "positionCount": len(positions),
        "profitableCount": sum(
            1
            for position in positions
            if float(position.get("currentPrice", 0.0) or 0.0)
            >= float(position.get("avgPrice", 0.0) or 0.0)
        ),
    }
    return json.dumps(payload, separators=(",", ":"))


def _fallback_analysis(
    snapshot: dict[str, Any],
    model_id: str,
    pattern_summaries: dict[str, dict[str, Any]] | None = None,
) -> PortfolioAnalysisResponse:
    positions = snapshot.get("positions", [])
    sector_values = snapshot.get("sectorValues", [])
    summary = snapshot.get("summary", {})
    total_value = float(summary.get("totalValue", 0.0) or 0.0)
    pattern_summaries = pattern_summaries or {}

    if not positions or total_value <= 0:
        return PortfolioAnalysisResponse(
            insight=(
                "No active positions are loaded yet, so there is no meaningful concentration "
                "or diversification signal. This is educational commentary, not investment advice."
            ),
            risk_label="No active exposure",
            risk_tone="low",
            strategy=[],
            signals=[],
            model_id=model_id,
        )

    ranked = _ranked_positions(snapshot)
    largest = ranked[0]
    largest_weight = (
        float(largest.get("marketValue", 0.0) or 0.0) / total_value * 100 if total_value else 0.0
    )
    top_two_weight = sum(
        float(position.get("marketValue", 0.0) or 0.0) for position in ranked[:2]
    )
    top_two_weight = top_two_weight / total_value * 100 if total_value else 0.0
    top_sector = sector_values[0] if sector_values else {"sector": "N/A", "percent": 0.0}
    pnl_percent = float(summary.get("pnlPercent", 0.0) or 0.0)
    risk_tone = "low"
    risk_label = "Risk is balanced"
    if largest_weight >= 35:
        risk_tone = "high"
        risk_label = f"High concentration in {largest.get('symbol', 'top holding')}"
    elif top_two_weight >= 55 or len(positions) <= 3:
        risk_tone = "medium"
        risk_label = "Concentration is elevated"

    top_symbol = _position_symbol(largest) or "N/A"
    top_pattern = pattern_summaries.get(top_symbol)
    secondary_symbols = _rank_add_candidates(ranked, pattern_summaries)
    top_two_symbols = [
        _position_symbol(position) for position in ranked[:2] if _position_symbol(position)
    ]

    insight = (
        f"Top holding {top_symbol} represents {largest_weight:.1f}% of value, "
        f"and {top_sector.get('sector', 'N/A')} accounts for "
        f"{float(top_sector.get('percent', 0.0) or 0.0):.1f}% of sector exposure, "
        "so portfolio risk is still being driven by a relatively narrow leadership group. "
    )
    if pnl_percent < 0:
        insight += (
            f"With the book still {abs(pnl_percent):.1f}% below cost basis, weakness in the largest "
            "positions is still weighing on the overall snapshot. "
        )
    elif top_two_weight >= 45 and top_two_symbols:
        insight += (
            f"{', '.join(top_two_symbols)} together control {top_two_weight:.1f}% of value, so near-term "
            "portfolio behavior will mostly follow whether those leaders continue to hold up. "
        )
    else:
        insight += (
            f"The book remains up {pnl_percent:.1f}% versus cost basis, although that result is still "
            "being shaped mainly by the portfolio leaders rather than evenly across the book. "
        )
    top_pattern_label = _pattern_label(top_pattern)
    if top_pattern_label:
        insight += (
            f"Pattern context shows {top_symbol} in a {top_pattern_label} setup, which makes that concentration "
            "less comfortable than the headline P/L alone would suggest. "
        )
    insight += "This is educational commentary, not investment advice."

    return PortfolioAnalysisResponse(
        insight=insight,
        risk_label=risk_label,
        risk_tone=risk_tone,
        strategy=[],
        signals=_build_position_signals(ranked, pattern_summaries),
        model_id=model_id,
    )


class PortfolioAnalysisService:
    """Builds LLM-backed portfolio insight text for the widget."""

    def __init__(
        self,
        portfolio_service: PortfolioService,
        *,
        openrouter_api_key: str,
        openrouter_model: str | None = None,
        stock_chart_service: StockChartService | None = None,
        http_async_client: httpx.AsyncClient | None = None,
    ) -> None:
        self._portfolio = portfolio_service
        self._api_key = openrouter_api_key
        self._charts = stock_chart_service
        env_model = os.environ.get("OPENROUTER_MODEL") or ""
        self._model = (openrouter_model or env_model).strip() or "minimax/minimax-m2.7"
        self._chain = build_portfolio_analysis_chain(
            api_key=self._api_key,
            model=self._model,
            temperature=_parse_temperature(),
            max_tokens=_parse_max_output_tokens(),
            request_timeout=_parse_request_timeout(),
            http_async_client=http_async_client,
        )

    async def _build_pattern_summaries(
        self, snapshot: dict[str, Any]
    ) -> dict[str, dict[str, Any]]:
        if self._charts is None or not self._charts.api_key_configured:
            return {}

        symbols = _symbols_for_pattern_scan(snapshot)
        if not symbols:
            return {}

        semaphore = asyncio.Semaphore(PORTFOLIO_PATTERN_MAX_CONCURRENCY)

        async def load_summary(symbol: str) -> tuple[str, dict[str, Any] | None]:
            async with semaphore:
                return symbol, await self._fetch_pattern_summary_cached(symbol)

        results = await asyncio.gather(*(load_summary(symbol) for symbol in symbols))
        summaries: dict[str, dict[str, Any]] = {}
        for symbol, result in results:
            if result:
                summaries[symbol] = result
        return summaries

    async def _fetch_pattern_summary_cached(self, symbol: str) -> dict[str, Any] | None:
        cache_key = (
            symbol,
            PORTFOLIO_PATTERN_INTERVAL.value,
            PORTFOLIO_PATTERN_RANGE.value,
        )
        now = time.monotonic()

        async with _PATTERN_SUMMARY_CACHE_LOCK:
            cached = _PATTERN_SUMMARY_CACHE.get(cache_key)
            if cached is not None and cached[0] > now:
                return cached[1]
            task = _PATTERN_SUMMARY_IN_FLIGHT.get(cache_key)
            if task is None:
                task = asyncio.create_task(self._fetch_pattern_summary_uncached(symbol))
                _PATTERN_SUMMARY_IN_FLIGHT[cache_key] = task

        ttl_seconds = PORTFOLIO_PATTERN_CACHE_TTL_SECONDS
        try:
            summary = await task
        except Exception:
            summary = None
            ttl_seconds = PORTFOLIO_PATTERN_ERROR_TTL_SECONDS

        async with _PATTERN_SUMMARY_CACHE_LOCK:
            _PATTERN_SUMMARY_CACHE[cache_key] = (
                time.monotonic() + ttl_seconds,
                summary,
            )
            if _PATTERN_SUMMARY_IN_FLIGHT.get(cache_key) is task:
                _PATTERN_SUMMARY_IN_FLIGHT.pop(cache_key, None)

        return summary

    async def _fetch_pattern_summary_uncached(
        self, symbol: str
    ) -> dict[str, Any] | None:
        if self._charts is None:
            return None
        params = resolve_stock_chart_params(
            symbol=symbol,
            interval=PORTFOLIO_PATTERN_INTERVAL,
            chart_range=PORTFOLIO_PATTERN_RANGE,
            from_date=None,
            to_date=None,
        )
        chart = await self._charts.fetch_chart(params)
        return _summarize_patterns(detect_chart_patterns(chart.candles))

    async def analyze(self) -> PortfolioAnalysisResponse:
        snapshot = self._portfolio.build_portfolio_snapshot()
        pattern_summaries = await self._build_pattern_summaries(snapshot)
        raw = await self._chain.ainvoke(
            {"portfolio_json": _portfolio_payload(snapshot, pattern_summaries)}
        )
        raw_text = _strip_code_fences(str(raw))
        if not raw_text:
            return _fallback_analysis(snapshot, self._model, pattern_summaries)

        json_text = _extract_json_object(raw_text) or raw_text
        try:
            payload = json.loads(json_text)
        except json.JSONDecodeError:
            return _fallback_analysis(snapshot, self._model, pattern_summaries)

        insight = _clean_insight_text(str(payload.get("insight", "")).strip())
        risk_label = str(payload.get("riskLabel", "")).strip()
        risk_tone = str(payload.get("riskTone", "")).strip().lower()
        strategy = _normalize_strategy_items(payload.get("strategy"))

        if (
            not insight
            or risk_tone not in {"low", "medium", "high"}
            or not risk_label
        ):
            return _fallback_analysis(snapshot, self._model, pattern_summaries)

        return PortfolioAnalysisResponse(
            insight=insight,
            risk_label=risk_label,
            risk_tone=risk_tone,
            strategy=strategy,
            signals=_build_position_signals(_ranked_positions(snapshot), pattern_summaries),
            model_id=self._model,
        )
