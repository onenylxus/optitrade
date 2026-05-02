"""AI recommendation controller for chart widgets."""

from datetime import date

from fastapi import HTTPException, status

from src.api.schemas.ai_stock_chart import StockChartAnalysisResponse
from src.api.schemas.stock_chart import ChartInterval, ChartRange
from src.services.stock_chart_analysis_service import StockChartAnalysisService
from src.services.stock_chart_service import resolve_stock_chart_params


class AIRecommendationController:
    """Coordinates chart resolution, OHLC fetch, analytics, and LLM analysis."""

    def __init__(self, analysis_service: StockChartAnalysisService) -> None:
        self._analysis = analysis_service

    async def analyze_stock_chart(
        self,
        *,
        symbol: str,
        interval: ChartInterval,
        chart_range: ChartRange | None,
        from_date: date | None,
        to_date: date | None,
    ) -> StockChartAnalysisResponse:
        try:
            params = resolve_stock_chart_params(
                symbol=symbol,
                interval=interval,
                chart_range=chart_range,
                from_date=from_date,
                to_date=to_date,
            )
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(exc),
            ) from exc

        try:
            return await self._analysis.analyze(params)
        except RuntimeError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=str(exc),
            ) from exc
