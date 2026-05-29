"""Schemas for AI-assisted stock chart analysis."""

from datetime import date

from pydantic import BaseModel, ConfigDict, Field

from src.api.schemas.stock_chart import ChartInterval, ChartRange


class MomentumSnapshot(BaseModel):
    """Price momentum derived from closes (not investment advice)."""

    return_pct_1_bar: float | None = Field(
        default=None,
        description="Percent change from previous bar close to last close.",
    )
    return_pct_5_bar: float | None = Field(
        default=None,
        description="Percent change over the last 5 closes when available.",
    )
    return_pct_20_bar: float | None = Field(
        default=None,
        description="Percent change over the last 20 closes when available.",
    )


class TechnicalSnapshot(BaseModel):
    """Simple technical indicators from OHLC series."""

    rsi_14: float | None = Field(
        default=None,
        description="14-period RSI (Wilder-style) when enough history exists.",
    )
    sma_20: float | None = Field(default=None, description="20-period SMA of close.")
    sma_50: float | None = Field(default=None, description="50-period SMA of close.")
    last_close_vs_sma20_pct: float | None = Field(
        default=None,
        description="Last close distance from SMA(20) in percent.",
    )


class StockChartAnalysisResponse(BaseModel):
    """LLM narrative plus transparent pre-computed metrics for the widget."""

    model_config = ConfigDict(populate_by_name=True)

    symbol: str
    interval: ChartInterval
    chart_range: ChartRange | None = Field(default=None, serialization_alias="range")
    from_: date = Field(serialization_alias="from")
    to: date
    momentum: MomentumSnapshot
    technical: TechnicalSnapshot
    analysis: str = Field(
        description="Model-generated commentary; educational, not advice.",
    )
    model_id: str = Field(description="OpenRouter model id used for generation.")


class StockChartSupportResistanceResponse(BaseModel):
    """Pivot-cluster support/resistance for the widget chart overlay."""

    model_config = ConfigDict(populate_by_name=True)

    symbol: str
    interval: ChartInterval
    chart_range: ChartRange | None = Field(default=None, serialization_alias="range")
    from_: date = Field(serialization_alias="from")
    to: date
    support: float | None = Field(default=None)
    resistance: float | None = Field(default=None)
    method: str = Field(default="pivot_clusters")
