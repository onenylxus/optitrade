"""FastAPI dependencies."""

import os
from typing import Annotated

from fastapi import Depends, HTTPException, status

from src.services.stock_chart_analysis_service import StockChartAnalysisService
from src.services.stock_chart_service import StockChartService


def get_stock_chart_service() -> StockChartService:
    """Build :class:`StockChartService` using ``FMP_API_KEY`` from the environment."""
    key = os.environ.get("FMP_API_KEY", "").strip()
    if not key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="FMP_API_KEY is not configured",
        )
    return StockChartService(api_key=key)


def get_stock_chart_analysis_service(
    chart: Annotated[StockChartService, Depends(get_stock_chart_service)],
) -> StockChartAnalysisService:
    """
    Build :class:`StockChartAnalysisService` (FMP + OpenRouter).

    Expects :func:`get_stock_chart_service` to have validated ``FMP_API_KEY``.
    """
    or_key = os.environ.get("OPENROUTER_API_KEY", "").strip()
    if not or_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OPENROUTER_API_KEY is not configured",
        )
    return StockChartAnalysisService(
        chart,
        openrouter_api_key=or_key,
    )
