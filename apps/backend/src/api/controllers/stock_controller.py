"""Stock chart controller."""

from datetime import date

from fastapi import HTTPException, status

from src.api.schemas.stock_chart import ChartInterval, ChartRange, StockChartResponse
from src.services.stock_chart_service import (
    StockChartService,
    resolve_stock_chart_params,
)


class StockChartController:
    """Maps chart HTTP parameters to :class:`StockChartService` calls."""

    def __init__(self, service: StockChartService) -> None:
        self._service = service

    async def get_chart(
        self,
        *,
        symbol: str,
        interval: ChartInterval,
        chart_range: ChartRange | None,
        from_date: date | None,
        to_date: date | None,
    ) -> StockChartResponse:
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
            return await self._service.fetch_chart(params)
        except RuntimeError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=str(exc),
            ) from exc
