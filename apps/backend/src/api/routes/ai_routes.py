"""AI-related HTTP routes (OpenRouter-backed widgets)."""

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query

from src.api.controllers.ai_recommendation_controller import AIRecommendationController
from src.api.deps import get_stock_chart_analysis_service
from src.api.schemas.ai_stock_chart import StockChartAnalysisResponse
from src.api.schemas.stock_chart import ChartInterval, ChartRange
from src.services.stock_chart_analysis_service import StockChartAnalysisService

router = APIRouter()


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
            }
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
