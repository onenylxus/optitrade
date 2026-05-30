"""FastAPI dependencies."""

import os
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status

from src import portfolio as portfolio_module
from src.api.controllers.stock_support_resistance_controller import (
    StockChartSupportResistanceController,
)
<<<<<<< Updated upstream
from src.services.portfolio_service import PortfolioService
=======
from src.services.portfolio_analysis_service import PortfolioAnalysisService
>>>>>>> Stashed changes
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


def get_stock_support_resistance_controller(
    chart: Annotated[StockChartService, Depends(get_stock_chart_service)],
) -> StockChartSupportResistanceController:
    return StockChartSupportResistanceController(chart)


def get_stock_chart_analysis_service(
    request: Request,
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
    http = getattr(request.app.state, "http_openrouter", None)
    return StockChartAnalysisService(
        chart,
        openrouter_api_key=or_key,
        http_async_client=http,
    )


<<<<<<< Updated upstream
=======
def get_portfolio_analysis_service(request: Request) -> PortfolioAnalysisService:
    """Build :class:`PortfolioAnalysisService` using the shared OpenRouter client."""
    or_key = os.environ.get("OPENROUTER_API_KEY", "").strip()
    if not or_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OPENROUTER_API_KEY is not configured",
        )
    http = getattr(request.app.state, "http_openrouter", None)
    return PortfolioAnalysisService(
        openrouter_api_key=or_key,
        http_async_client=http,
    )


>>>>>>> Stashed changes
def get_portfolio_service() -> PortfolioService:
    return PortfolioService(data_dir=portfolio_module.DATA_DIR)
