"""Orchestrate chart fetch, deterministic metrics, and OpenRouter via LangChain."""

from __future__ import annotations

import json
import os
from typing import Any

from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI

from src.api.schemas.ai_stock_chart import (
    MomentumSnapshot,
    StockChartAnalysisResponse,
    TechnicalSnapshot,
)
from src.api.schemas.stock_chart import StockChartParams
from src.services.stock_analytics import (
    build_momentum_snapshot,
    build_technical_snapshot,
)
from src.services.stock_chart_service import StockChartService

OPENROUTER_BASE = "https://openrouter.ai/api/v1"

SYSTEM_PROMPT = """You are OptiTrade's technical market assistant. You receive \
pre-computed metrics and a small recent OHLC sample. Rules:
- Base conclusions only on the provided numbers and candles; do not invent prices.
- Interpret trend, momentum, and indicator context (RSI, moving averages) concisely.
- Call out uncertainty when the window is short or indicators are missing.
- Use clear sections on their own lines, exactly as markdown bold labels so the UI can \
collapse the report: ``**Overview:**``, ``**Momentum:**``, ``**Indicators:**``, \
``**Levels / Risks:**`` (each on its own line, then the paragraph(s) for that section).
- End with one sentence: this is educational commentary, not investment advice."""

USER_PROMPT = """Symbol: {symbol}
Interval: {interval}
Range metadata: {range_note}
Date window: {from_date} to {to_date}

Pre-computed metrics (JSON):
{metrics_json}

Recent candles (oldest first, OHLC; last {n_recent} bars):
{recent_candles_json}

Write a concise analysis for a trader dashboard widget (under ~100 words)."""


def _recent_candles_json(candles: list[Any], max_bars: int) -> str:
    tail = candles[-max_bars:] if len(candles) > max_bars else candles
    rows = [
        {
            "date": c.date,
            "open": float(c.open),
            "high": float(c.high),
            "low": float(c.low),
            "close": float(c.close),
            "volume": float(c.volume) if c.volume is not None else None,
        }
        for c in tail
    ]
    return json.dumps(rows, indent=2)


def _metrics_payload(
    momentum: MomentumSnapshot,
    technical: TechnicalSnapshot,
) -> str:
    return json.dumps(
        {
            "momentum": momentum.model_dump(),
            "technical": technical.model_dump(),
        },
        indent=2,
    )


def build_stock_chart_analysis_chain(
    *,
    api_key: str,
    model: str,
    temperature: float = 0.35,
    referer: str | None = None,
    app_title: str = "OptiTrade",
):
    """
    LCEL chain: prompt -> ChatOpenAI (OpenRouter-compatible) -> string output.

    LangGraph is unnecessary for a single LLM pass; this chain stays easy to
    extend later (e.g. tool-calling or a LangGraph router) without changing HTTP.
    """
    referer = (referer or os.environ.get("OPENROUTER_HTTP_REFERER") or "").strip()
    headers: dict[str, str] = {"X-Title": app_title}
    if referer:
        headers["HTTP-Referer"] = referer

    llm = ChatOpenAI(
        model=model,
        temperature=temperature,
        api_key=api_key,
        base_url=OPENROUTER_BASE,
        default_headers=headers,
    )
    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", SYSTEM_PROMPT),
            ("human", USER_PROMPT),
        ]
    )
    return prompt | llm | StrOutputParser()


class StockChartAnalysisService:
    """Fetches OHLC, derives momentum/indicators, runs the LangChain analysis chain."""

    def __init__(
        self,
        stock_chart_service: StockChartService,
        *,
        openrouter_api_key: str,
        openrouter_model: str | None = None,
        recent_bars_for_prompt: int = 48,
    ) -> None:
        self._charts = stock_chart_service
        self._api_key = openrouter_api_key
        env_model = os.environ.get("OPENROUTER_MODEL") or ""
        self._model = (openrouter_model or env_model).strip()
        if not self._model:
            self._model = "minimax/minimax-m2.7"
        self._recent_bars = max(8, min(recent_bars_for_prompt, 120))

    async def analyze(self, params: StockChartParams) -> StockChartAnalysisResponse:
        chart = await self._charts.fetch_chart(params)
        candles = chart.candles
        momentum = build_momentum_snapshot(candles)
        technical = build_technical_snapshot(candles)
        metrics_json = _metrics_payload(momentum, technical)
        range_note = (
            str(chart.chart_range)
            if chart.chart_range is not None
            else "explicit from/to"
        )
        recent_json = _recent_candles_json(candles, self._recent_bars)
        chain = build_stock_chart_analysis_chain(
            api_key=self._api_key,
            model=self._model,
        )
        try:
            analysis = await chain.ainvoke(
                {
                    "symbol": chart.symbol,
                    "interval": chart.interval.value,
                    "range_note": range_note,
                    "from_date": str(chart.from_),
                    "to_date": str(chart.to),
                    "metrics_json": metrics_json,
                    "n_recent": min(len(candles), self._recent_bars),
                    "recent_candles_json": recent_json,
                }
            )
        except Exception as exc:
            raise RuntimeError(f"OpenRouter analysis failed: {exc}") from exc
        return StockChartAnalysisResponse(
            symbol=chart.symbol,
            interval=chart.interval,
            chart_range=chart.chart_range,
            from_=chart.from_,
            to=chart.to,
            momentum=momentum,
            technical=technical,
            analysis=str(analysis).strip(),
            model_id=self._model,
        )
