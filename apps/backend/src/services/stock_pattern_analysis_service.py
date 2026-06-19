"""LLM explanation for deterministic chart-pattern detections."""

from __future__ import annotations

import json
import os
from typing import Any

import httpx
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import Runnable
from langchain_openai import ChatOpenAI

from src.api.schemas.ai_stock_chart import MomentumSnapshot, TechnicalSnapshot
from src.services.stock_chart_analysis_service import (
    OPENROUTER_BASE,
    _parse_max_output_tokens,
    _parse_request_timeout,
    _parse_temperature,
)
from src.services.stock_pattern_detection import ChartPattern

PATTERN_SYSTEM_PROMPT = """You are OptiTrade's chart-pattern assistant.
You receive deterministic pattern geometry and technical metrics. Rules:
- Explain only the returned pattern data; do not invent prices, targets, or patterns.
- Treat confidence as uncertainty, not a trading signal.
- Be concise and practical for a trader dashboard.
- Use markdown bold section labels exactly:
  ``**Pattern:**`` and ``**Confirmation / Risk:**``.
- End with one sentence: this is educational commentary, not investment advice."""

PATTERN_USER_PROMPT = """Symbol: {symbol}
Interval: {interval}
Date window: {from_date} to {to_date}

Detected patterns (JSON):
{patterns_json}

Pre-computed metrics (JSON):
{metrics_json}

Write a concise chart-pattern explanation under ~90 words."""


def _patterns_payload(patterns: list[ChartPattern]) -> str:
    rows = [
        {
            "pattern_type": p.pattern_type,
            "display_name": p.display_name,
            "direction": p.direction,
            "status": p.status,
            "confidence": p.confidence,
            "breakout_level": p.breakout_level,
            "invalidation_level": p.invalidation_level,
            "rationale": p.rationale,
        }
        for p in patterns
    ]
    return json.dumps(rows, separators=(",", ":"))


def _metrics_payload(
    momentum: MomentumSnapshot,
    technical: TechnicalSnapshot,
) -> str:
    return json.dumps(
        {
            "momentum": momentum.model_dump(),
            "technical": technical.model_dump(),
        },
        separators=(",", ":"),
    )


def build_stock_pattern_analysis_chain(
    *,
    api_key: str,
    model: str,
    temperature: float = 0.35,
    max_tokens: int | None = 400,
    request_timeout: float = 90.0,
    http_async_client: httpx.AsyncClient | None = None,
    referer: str | None = None,
    app_title: str = "OptiTrade",
) -> Runnable:
    """LCEL chain: pattern prompt -> OpenRouter-compatible chat model -> string."""
    referer = (referer or os.environ.get("OPENROUTER_HTTP_REFERER") or "").strip()
    headers: dict[str, str] = {"X-Title": app_title}
    if referer:
        headers["HTTP-Referer"] = referer

    llm_kwargs: dict[str, Any] = {
        "model": model,
        "temperature": temperature,
        "api_key": api_key,
        "base_url": OPENROUTER_BASE,
        "default_headers": headers,
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
            ("system", PATTERN_SYSTEM_PROMPT),
            ("human", PATTERN_USER_PROMPT),
        ]
    )
    return prompt | llm | StrOutputParser()


def build_deterministic_pattern_explanation(patterns: list[ChartPattern]) -> str:
    """Fallback explanation when OpenRouter is not configured or detects no pattern."""
    if not patterns:
        return "No high-confidence chart pattern detected for this range."
    top = patterns[0]
    level = (
        f" Breakout level: {top.breakout_level:.2f}."
        if top.breakout_level is not None
        else ""
    )
    invalidation = (
        f" Invalidation level: {top.invalidation_level:.2f}."
        if top.invalidation_level is not None
        else ""
    )
    rationale = (
        top.rationale[0]
        if top.rationale
        else "Pattern geometry is based on recent pivots."
    )
    return (
        f"**Pattern:**\n{top.display_name} is {top.status} with "
        f"{top.confidence:.0%} confidence and a {top.direction} bias.{level}\n\n"
        f"**Confirmation / Risk:**\n{rationale}"
        f"{invalidation} This is educational commentary, not investment advice."
    )


class StockPatternAnalysisService:
    """Explains deterministic pattern detections with an optional LLM pass."""

    def __init__(
        self,
        *,
        openrouter_api_key: str | None = None,
        openrouter_model: str | None = None,
        http_async_client: httpx.AsyncClient | None = None,
    ) -> None:
        self._api_key = (openrouter_api_key or "").strip()
        env_model = os.environ.get("OPENROUTER_MODEL") or ""
        self._model = (openrouter_model or env_model).strip() or "minimax/minimax-m2.7"
        self._chain = (
            build_stock_pattern_analysis_chain(
                api_key=self._api_key,
                model=self._model,
                temperature=_parse_temperature(),
                max_tokens=_parse_max_output_tokens(),
                request_timeout=_parse_request_timeout(),
                http_async_client=http_async_client,
            )
            if self._api_key
            else None
        )

    @property
    def model_id(self) -> str:
        if self._chain is not None:
            return self._model
        return "deterministic-pattern-summary"

    async def explain(
        self,
        *,
        symbol: str,
        interval: str,
        from_date: str,
        to_date: str,
        patterns: list[ChartPattern],
        momentum: MomentumSnapshot,
        technical: TechnicalSnapshot,
    ) -> str:
        if self._chain is None or not patterns:
            return build_deterministic_pattern_explanation(patterns)
        try:
            analysis = await self._chain.ainvoke(
                {
                    "symbol": symbol,
                    "interval": interval,
                    "from_date": from_date,
                    "to_date": to_date,
                    "patterns_json": _patterns_payload(patterns),
                    "metrics_json": _metrics_payload(momentum, technical),
                }
            )
        except Exception:
            return build_deterministic_pattern_explanation(patterns)
        fallback = build_deterministic_pattern_explanation(patterns)
        return str(analysis).strip() or fallback
