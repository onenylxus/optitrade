"""OpenRouter-backed portfolio health analysis."""

from __future__ import annotations

import json
import os
from typing import Any

import httpx
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import Runnable
from langchain_openai import ChatOpenAI

from src.api.schemas.ai_portfolio import (
    PortfolioHealthAnalysisRequest,
    PortfolioHealthAnalysisResponse,
)
from src.services.stock_chart_analysis_service import (
    OPENROUTER_BASE,
    _parse_max_output_tokens,
    _parse_request_timeout,
    _parse_temperature,
)

SYSTEM_PROMPT = """You are OptiTrade's portfolio health assistant.
- Base every statement only on the provided portfolio snapshot.
- Keep each field concise and dashboard-friendly.
- Respond with valid JSON only, no markdown or code fences.
- Use exactly these keys: label, diversification, topContributor, concentrationRisk.
- Label must be one of: Healthy, Watch, Concentrated.
- Each text field should be one sentence and stay under 160 characters.
- Mention uncertainty rather than inventing missing context.
- This is educational commentary, not investment advice."""

USER_PROMPT = """Portfolio snapshot (JSON):
{portfolio_json}
"""


def _sanitize_json_text(text: str) -> str:
    stripped = text.strip()
    if stripped.startswith("```"):
        lines = stripped.splitlines()
        stripped = "\n".join(lines[1:-1]).strip()
    return stripped


def _portfolio_prompt_json(payload: PortfolioHealthAnalysisRequest) -> str:
    summary = payload.summary.model_dump()
    positions = payload.positions
    top_positions = sorted(
        positions,
        key=lambda position: position.marketValue
        if position.marketValue is not None
        else position.currentPrice * position.quantity,
        reverse=True,
    )[:8]
    return json.dumps(
        {
            "asOf": payload.asOf,
            "baseCurrency": payload.baseCurrency or "USD",
            "source": payload.source,
            "summary": summary,
            "positions": [position.model_dump() for position in top_positions],
            "sectorValues": [sector.model_dump() for sector in payload.sectorValues[:8]],
        },
        separators=(",", ":"),
    )


def build_portfolio_health_chain(
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
            ("system", SYSTEM_PROMPT),
            ("human", USER_PROMPT),
        ]
    )
    return prompt | llm | StrOutputParser()


class PortfolioAnalysisService:
    """Generates a short portfolio health summary using OpenRouter."""

    def __init__(
        self,
        *,
        openrouter_api_key: str,
        openrouter_model: str | None = None,
        http_async_client: httpx.AsyncClient | None = None,
    ) -> None:
        self._api_key = openrouter_api_key
        env_model = os.environ.get("OPENROUTER_MODEL") or ""
        self._model = (openrouter_model or env_model).strip()
        if not self._model:
            self._model = "minimax/minimax-m2.7"
        self._chain = build_portfolio_health_chain(
            api_key=self._api_key,
            model=self._model,
            temperature=_parse_temperature(),
            max_tokens=_parse_max_output_tokens(),
            request_timeout=_parse_request_timeout(),
            http_async_client=http_async_client,
        )

    async def analyze(
        self,
        payload: PortfolioHealthAnalysisRequest,
    ) -> PortfolioHealthAnalysisResponse:
        try:
            raw = await self._chain.ainvoke(
                {
                    "portfolio_json": _portfolio_prompt_json(payload),
                }
            )
        except Exception as exc:
            raise RuntimeError(f"OpenRouter portfolio analysis failed: {exc}") from exc

        try:
            parsed = json.loads(_sanitize_json_text(raw))
        except json.JSONDecodeError as exc:
            raise RuntimeError("OpenRouter portfolio analysis returned invalid JSON") from exc

        try:
            return PortfolioHealthAnalysisResponse(
                label=str(parsed["label"]),
                diversification=str(parsed["diversification"]).strip(),
                topContributor=str(parsed["topContributor"]).strip(),
                concentrationRisk=str(parsed["concentrationRisk"]).strip(),
                model_id=self._model,
            )
        except (KeyError, TypeError, ValueError) as exc:
            raise RuntimeError("OpenRouter portfolio analysis returned an incomplete payload") from exc
