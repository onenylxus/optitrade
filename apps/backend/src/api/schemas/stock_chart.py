"""Stock chart query/response models and enums."""

from datetime import date
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field


class ChartInterval(StrEnum):
    """Bar size for chart series (maps to FMP intraday or EOD endpoints)."""

    MIN_1 = "1min"
    MIN_5 = "5min"
    MIN_30 = "30min"
    HOUR_1 = "1hour"
    DAY_1 = "1day"
    MONTH_1 = "1month"


class ChartRange(StrEnum):
    """
    Lookback window when explicit from/to are not both provided.

    Values are compact to distinguish interval ``1month`` (bar size) from
    ``1M`` (one-month range).
    """

    DAY_1 = "1D"
    WEEK_1 = "1W"
    MONTH_1 = "1M"
    MONTH_3 = "3M"
    MONTH_6 = "6M"
    YTD = "YTD"
    YEAR_1 = "1Y"
    YEAR_3 = "3Y"
    YEAR_5 = "5Y"


class StockChartParams(BaseModel):
    """Resolved parameters for a chart request."""

    symbol: str
    interval: ChartInterval
    date_from: date
    date_to: date
    chart_range: ChartRange | None = Field(
        default=None,
        description="Preset range used when from/to were not both supplied.",
    )


class ChartCandle(BaseModel):
    """Single OHLCV bar; additional FMP fields are passed through."""

    model_config = ConfigDict(extra="allow")

    date: str
    open: float
    high: float
    low: float
    close: float
    volume: float | None = None


class StockChartResponse(BaseModel):
    """Chart payload returned to clients."""

    model_config = ConfigDict(populate_by_name=True)

    symbol: str
    interval: ChartInterval
    chart_range: ChartRange | None = Field(
        default=None,
        serialization_alias="range",
    )
    from_: date = Field(serialization_alias="from")
    to: date
    candles: list[ChartCandle]
