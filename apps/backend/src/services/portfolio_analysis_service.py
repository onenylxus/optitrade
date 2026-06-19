"""LLM-backed portfolio widget insight generation."""

from __future__ import annotations

import json
import os
from typing import Any

import httpx
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import Runnable
from langchain_openai import ChatOpenAI

from src.api.schemas.ai_portfolio import PortfolioAnalysisResponse
from src.services.portfolio_service import PortfolioService

OPENROUTER_BASE = "https://openrouter.ai/api/v1"

SYSTEM_PROMPT = """You are OptiTrade's portfolio insight assistant.
You receive a portfolio snapshot with summary numbers, sector weights, and positions.
Rules:
- Base every statement only on the provided portfolio data.
- Focus on concentration, diversification, unrealized performance, and obvious risk drivers.
- Do not invent market news, macro events, or price targets.
- Keep the output compact for a dashboard widget.
- Write like a strategist, not a reporter.
- If concentration is high, identify which symbol is the likely trim candidate.
- If the portfolio needs better breadth, identify 1 to 2 smaller holdings that are better add candidates than the dominant name.
- Use conditional, educational phrasing such as "if reducing risk" or "if adding exposure".
- Return strict JSON only with keys: insight, riskLabel, riskTone, strategy.
- riskTone must be exactly one of: low, medium, high.
- riskLabel must be short and readable (3 to 8 words).
- strategy must be an array of 2 to 4 objects with keys: label, symbols, reason.
- strategy labels should be concise, such as trim, add candidate, hold, or reduce risk.
- symbols must only contain portfolio symbols from the provided snapshot.
- insight must be 1 to 2 sentences and make clear it is educational, not advice."""

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


def _portfolio_payload(snapshot: dict[str, Any]) -> str:
    positions = snapshot.get("positions", [])
    sector_values = snapshot.get("sectorValues", [])
    summary = snapshot.get("summary", {})
    total_value = float(summary.get("totalValue", 0.0) or 0.0)
    ranked_positions = sorted(
        positions,
        key=lambda position: float(position.get("marketValue", 0.0) or 0.0),
        reverse=True,
    )
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


def _fallback_analysis(snapshot: dict[str, Any], model_id: str) -> PortfolioAnalysisResponse:
    positions = snapshot.get("positions", [])
    sector_values = snapshot.get("sectorValues", [])
    summary = snapshot.get("summary", {})
    total_value = float(summary.get("totalValue", 0.0) or 0.0)

    if not positions or total_value <= 0:
        return PortfolioAnalysisResponse(
            insight=(
                "No active positions are loaded yet, so there is no meaningful concentration "
                "or diversification signal. This is educational commentary, not investment advice."
            ),
            risk_label="No active exposure",
            risk_tone="low",
            model_id=model_id,
        )

    ranked = sorted(
        positions,
        key=lambda position: float(position.get("marketValue", 0.0) or 0.0),
        reverse=True,
    )
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
    profitable_count = sum(
        1
        for position in positions
        if float(position.get("currentPrice", 0.0) or 0.0)
        >= float(position.get("avgPrice", 0.0) or 0.0)
    )

    risk_tone = "low"
    risk_label = "Risk is balanced"
    if largest_weight >= 35:
        risk_tone = "high"
        risk_label = f"High concentration in {largest.get('symbol', 'top holding')}"
    elif top_two_weight >= 55 or len(positions) <= 3:
        risk_tone = "medium"
        risk_label = "Concentration is elevated"

    top_symbol = str(largest.get("symbol", "N/A"))
    secondary_symbols = [
        str(position.get("symbol", "")).strip()
        for position in ranked[1:3]
        if str(position.get("symbol", "")).strip()
    ]
    strategy: list[dict[str, Any]] = []

    insight = (
        f"Top holding {top_symbol} represents {largest_weight:.1f}% of value, "
        f"while {top_sector.get('sector', 'N/A')} is the largest sector at "
        f"{float(top_sector.get('percent', 0.0) or 0.0):.1f}%. "
    )
    if pnl_percent < 0:
        insight += (
            f"The portfolio is currently {abs(pnl_percent):.1f}% below cost basis, so weaker "
            "positions are outweighing winners. "
        )
    else:
        insight += (
            f"{profitable_count} of {len(positions)} holdings are above cost basis, which suggests "
            "the current snapshot still has supportive breadth. "
        )
    insight += "This is educational commentary, not investment advice."

    if largest_weight >= 35:
        strategy = [
            {
                "label": "trim",
                "symbols": [top_symbol],
                "reason": "Single-name concentration is driving too much of total portfolio risk.",
            },
            {
                "label": "add candidate",
                "symbols": secondary_symbols,
                "reason": "Smaller holdings can improve breadth more effectively than adding to the dominant name.",
            },
        ]
    elif top_two_weight >= 55:
        strategy = [
            {
                "label": "reduce risk",
                "symbols": [top_symbol],
                "reason": "The top of the portfolio is carrying an outsized share of total exposure.",
            },
            {
                "label": "add candidate",
                "symbols": secondary_symbols,
                "reason": "Incremental adds to smaller holdings can balance the portfolio.",
            },
        ]
    else:
        strategy = [
            {
                "label": "hold",
                "symbols": [top_symbol],
                "reason": "The leading position is not yet forcing an urgent rebalance.",
            },
            {
                "label": "add candidate",
                "symbols": secondary_symbols,
                "reason": "Selective adds to smaller holdings can improve diversification.",
            },
        ]

    return PortfolioAnalysisResponse(
        insight=insight,
        risk_label=risk_label,
        risk_tone=risk_tone,
        strategy=strategy,
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
        http_async_client: httpx.AsyncClient | None = None,
    ) -> None:
        self._portfolio = portfolio_service
        self._api_key = openrouter_api_key
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

    async def analyze(self) -> PortfolioAnalysisResponse:
        snapshot = self._portfolio.build_portfolio_snapshot()
        raw = await self._chain.ainvoke(
            {"portfolio_json": _portfolio_payload(snapshot)}
        )
        raw_text = _strip_code_fences(str(raw))
        if not raw_text:
            return _fallback_analysis(snapshot, self._model)

        json_text = _extract_json_object(raw_text) or raw_text
        try:
            payload = json.loads(json_text)
        except json.JSONDecodeError:
            return _fallback_analysis(snapshot, self._model)

        insight = str(payload.get("insight", "")).strip()
        risk_label = str(payload.get("riskLabel", "")).strip()
        risk_tone = str(payload.get("riskTone", "")).strip().lower()
        strategy = payload.get("strategy")

        if (
            not insight
            or risk_tone not in {"low", "medium", "high"}
            or not risk_label
            or not isinstance(strategy, list)
        ):
            return _fallback_analysis(snapshot, self._model)

        return PortfolioAnalysisResponse(
            insight=insight,
            risk_label=risk_label,
            risk_tone=risk_tone,
            strategy=strategy,
            model_id=self._model,
        )
