"""AI-related HTTP routes (OpenRouter-backed widgets)."""

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status

from src.api.controllers.ai_recommendation_controller import AIRecommendationController
from src.api.controllers.stock_support_resistance_controller import (
    StockChartSupportResistanceController,
)
from src.api.deps import (
    get_portfolio_analysis_service,
    get_stock_chart_analysis_service,
    get_stock_support_resistance_controller,
)
from src.api.schemas.ai_portfolio import (
    PortfolioHealthAnalysisRequest,
    PortfolioHealthAnalysisResponse,
)
from src.api.schemas.ai_stock_chart import (
    StockChartAnalysisResponse,
    StockChartSupportResistanceResponse,
)
from src.api.schemas.stock_chart import ChartInterval, ChartRange
from src.services.portfolio_analysis_service import PortfolioAnalysisService
from src.services.stock_chart_analysis_service import StockChartAnalysisService

router = APIRouter()


@router.get(
    "/widget/stock-chart/support-resistance",
    response_model=StockChartSupportResistanceResponse,
    response_model_by_alias=True,
)
async def ai_widget_stock_chart_support_resistance(
    controller: Annotated[
        StockChartSupportResistanceController,
        Depends(get_stock_support_resistance_controller),
    ],
    symbol: Annotated[str, Query(min_length=1, max_length=32)],
    interval: ChartInterval,
    chart_range: Annotated[
        ChartRange | None,
        Query(
            alias="range",
            description="Lookback when ``from``/``to`` are not both set.",
        ),
    ] = None,
    from_date: Annotated[
        date | None,
        Query(alias="from", description="Inclusive range start (ISO date)."),
    ] = None,
    to_date: Annotated[
        date | None,
        Query(alias="to", description="Inclusive range end (ISO date)."),
    ] = None,
) -> StockChartSupportResistanceResponse:
    """
    Support / resistance from the OHLC window (same query shape as chart + LLM widget).

    Requires ``FMP_API_KEY`` only; uses pivot clustering rather than an LLM.
    """
    return await controller.support_resistance_levels(
        symbol=symbol,
        interval=interval,
        chart_range=chart_range,
        from_date=from_date,
        to_date=to_date,
    )


def get_ai_recommendation_controller(
    service: Annotated[
        StockChartAnalysisService,
        Depends(get_stock_chart_analysis_service),
    ],
) -> AIRecommendationController:
    return AIRecommendationController(service)


@router.get("", summary="AI API capability index")
async def ai_index() -> dict:
    """Lightweight index so ``/api/ai`` is discoverable without invoking models."""
    return {
        "service": "optitrade-ai",
        "widgets": [
            {
                "path": "/widget/stock-chart",
                "method": "GET",
                "description": "OHLC-driven momentum, indicators, and LLM commentary.",
            },
            {
                "path": "/widget/stock-chart/support-resistance",
                "method": "GET",
                "description": (
                    "OHLC-derived support/resistance for chart overlays "
                    "(pivot clusters; deterministic, no LLM)."
                ),
            },
            {
                "path": "/widget/portfolio-health",
                "method": "POST",
                "description": (
                    "Portfolio health commentary from summary, holdings, and "
                    "allocation data using the OpenRouter widget model."
                ),
            },
        ],
    }


@router.get(
    "/widget/stock-chart",
    response_model=StockChartAnalysisResponse,
    response_model_by_alias=True,
)
async def ai_widget_stock_chart(
    controller: Annotated[
        AIRecommendationController,
        Depends(get_ai_recommendation_controller),
    ],
    symbol: Annotated[str, Query(min_length=1, max_length=32)],
    interval: ChartInterval,
    chart_range: Annotated[
        ChartRange | None,
        Query(
            alias="range",
            description="Lookback when ``from``/``to`` are not both set.",
        ),
    ] = None,
    from_date: Annotated[
        date | None,
        Query(alias="from", description="Inclusive range start (ISO date)."),
    ] = None,
    to_date: Annotated[
        date | None,
        Query(alias="to", description="Inclusive range end (ISO date)."),
    ] = None,
) -> StockChartAnalysisResponse:
    """
    Stock chart AI recommendation: FMP OHLC, momentum, RSI/SMA context, OpenRouter.

    Requires ``FMP_API_KEY``, ``OPENROUTER_API_KEY``, and optionally
    ``OPENROUTER_MODEL``.
    """
    return await controller.analyze_stock_chart(
        symbol=symbol,
        interval=interval,
        chart_range=chart_range,
        from_date=from_date,
        to_date=to_date,
    )


@router.post(
    "/widget/portfolio-health",
    response_model=PortfolioHealthAnalysisResponse,
)
async def ai_widget_portfolio_health(
    payload: PortfolioHealthAnalysisRequest,
    service: Annotated[
        PortfolioAnalysisService,
        Depends(get_portfolio_analysis_service),
    ],
) -> PortfolioHealthAnalysisResponse:
    """Portfolio health commentary using the same OpenRouter model path as chart AI."""
    try:
        return await service.analyze(payload)
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc
