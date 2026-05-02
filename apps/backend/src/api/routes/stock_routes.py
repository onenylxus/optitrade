"""Stock-related HTTP routes."""

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query

from src.api.controllers.stock_controller import StockChartController
from src.api.deps import get_stock_chart_service
from src.api.schemas.stock_chart import ChartInterval, ChartRange, StockChartResponse
from src.services.stock_chart_service import StockChartService

router = APIRouter()


def get_stock_chart_controller(
    service: Annotated[StockChartService, Depends(get_stock_chart_service)],
) -> StockChartController:
    return StockChartController(service)


@router.get(
    "/chart",
    response_model=StockChartResponse,
    response_model_by_alias=True,
)
async def stock_chart(
    controller: Annotated[
        StockChartController,
        Depends(get_stock_chart_controller),
    ],
    symbol: Annotated[str, Query(min_length=1, max_length=32)],
    interval: ChartInterval,
    chart_range: Annotated[
        ChartRange | None,
        Query(
            alias="range",
            description=(
                "Lookback when ``from``/``to`` are not both set: "
                "1D, 1W, 1M, 3M, 6M, YTD, 1Y, 3Y, 5Y."
            ),
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
) -> StockChartResponse:
    """
    OHLCV series for charting via FMP.

    - **Intraday** (``1min``, ``5min``, ``30min``, ``1hour``): stable
      ``/historical-chart/{interval}`` with optional FMP ``from``/``to``.
    - **Daily** (``1day``): stable ``/historical-price-eod/full``.
    - **Monthly bars** (``1month``): stable ``/historical-chart/1month`` when
      available for the symbol.
    """
    return await controller.get_chart(
        symbol=symbol,
        interval=interval,
        chart_range=chart_range,
        from_date=from_date,
        to_date=to_date,
    )
