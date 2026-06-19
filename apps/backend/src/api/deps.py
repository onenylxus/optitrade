"""FastAPI dependencies."""

import os
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status

from src import portfolio as portfolio_module
from src.api.controllers.portfolio_ai_controller import PortfolioAIController
from src.api.controllers.stock_chart_pattern_controller import (
    StockChartPatternController,
)
from src.api.controllers.stock_support_resistance_controller import (
    StockChartSupportResistanceController,
)
from src.services.portfolio_analysis_service import PortfolioAnalysisService
from src.services.portfolio_service import PortfolioService
from src.services.stock_chart_analysis_service import StockChartAnalysisService
from src.services.stock_chart_service import StockChartService
from src.services.stock_pattern_analysis_service import StockPatternAnalysisService


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


def get_stock_chart_pattern_controller(
    request: Request,
    chart: Annotated[StockChartService, Depends(get_stock_chart_service)],
) -> StockChartPatternController:
    """Build chart-pattern controller; OpenRouter is optional for explanations."""
    http = getattr(request.app.state, "http_openrouter", None)
    return StockChartPatternController(
        chart,
        StockPatternAnalysisService(
            openrouter_api_key=os.environ.get("OPENROUTER_API_KEY", ""),
            http_async_client=http,
        ),
    )


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


def get_portfolio_service() -> PortfolioService:
    return PortfolioService(data_dir=portfolio_module.DATA_DIR)


def get_portfolio_analysis_service(
    request: Request,
    portfolio: Annotated[PortfolioService, Depends(get_portfolio_service)],
) -> PortfolioAnalysisService:
    or_key = os.environ.get("OPENROUTER_API_KEY", "").strip()
    if not or_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OPENROUTER_API_KEY is not configured",
        )
    http = getattr(request.app.state, "http_openrouter", None)
    return PortfolioAnalysisService(
        portfolio,
        openrouter_api_key=or_key,
        http_async_client=http,
    )


def get_portfolio_ai_controller(
    service: Annotated[
        PortfolioAnalysisService,
        Depends(get_portfolio_analysis_service),
    ],
) -> PortfolioAIController:
    return PortfolioAIController(service)
