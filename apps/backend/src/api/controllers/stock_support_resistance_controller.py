"""Support/resistance levels for chart overlay (OHLC-derived, no LLM)."""

from datetime import date

from fastapi import HTTPException, status

from src.api.schemas.ai_stock_chart import StockChartSupportResistanceResponse
from src.api.schemas.stock_chart import ChartInterval, ChartRange
from src.services.stock_chart_service import (
    StockChartService,
    resolve_stock_chart_params,
)
from src.services.stock_support_resistance import compute_support_resistance


class StockChartSupportResistanceController:
    """Loads the same OHLC series as `/api/stock/chart`, then extracts SR levels."""

    def __init__(self, charts: StockChartService) -> None:
        self._charts = charts

    async def support_resistance_levels(
        self,
        *,
        symbol: str,
        interval: ChartInterval,
        chart_range: ChartRange | None,
        from_date: date | None,
        to_date: date | None,
    ) -> StockChartSupportResistanceResponse:
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
            chart = await self._charts.fetch_chart(params)
        except RuntimeError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=str(exc),
            ) from exc

        support, resistance = compute_support_resistance(chart.candles)
        return StockChartSupportResistanceResponse(
            symbol=chart.symbol,
            interval=chart.interval,
            chart_range=chart.chart_range,
            from_=chart.from_,
            to=chart.to,
            support=support,
            resistance=resistance,
            method="pivot_clusters",
        )
