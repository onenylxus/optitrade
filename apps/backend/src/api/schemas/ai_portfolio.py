"""Schemas for AI-assisted portfolio analysis."""

from pydantic import BaseModel, ConfigDict, Field


class PortfolioStrategyAction(BaseModel):
    """Structured portfolio action for strategy guidance."""

    label: str = Field(description="Short action label such as trim, add, or hold.")
    symbols: list[str] = Field(
        default_factory=list,
        description="Relevant portfolio symbols for the action.",
    )
    reason: str = Field(description="Short explanation grounded in the portfolio data.")


class PortfolioPositionSignal(BaseModel):
    """Compact technical sentiment badge for a portfolio symbol."""

    symbol: str = Field(description="Portfolio symbol.")
    bias: str = Field(description="Short bias label such as bullish, bearish, or neutral.")
    confidence: int | None = Field(
        default=None,
        description="Approximate pattern confidence percentage when available.",
    )
    pattern: str | None = Field(
        default=None,
        description="Detected pattern display name when available.",
    )
    status: str | None = Field(
        default=None,
        description="Pattern status such as forming or confirmed.",
    )
    explanation: str | None = Field(
        default=None,
        description="Short hover explanation for the technical sentiment badge.",
    )


class PortfolioAnalysisResponse(BaseModel):
    """Portfolio insight response for the dashboard widget."""

    model_config = ConfigDict(populate_by_name=True)

    insight: str = Field(
        description="Model-generated portfolio commentary; educational, not advice."
    )
    risk_label: str = Field(
        serialization_alias="riskLabel",
        description="Short risk label for the widget badge.",
    )
    risk_tone: str = Field(
        serialization_alias="riskTone",
        description="One of low, medium, or high.",
    )
    strategy: list[PortfolioStrategyAction] = Field(
        default_factory=list,
        description="Structured strategic actions for the large widget.",
    )
    signals: list[PortfolioPositionSignal] = Field(
        default_factory=list,
        description="Per-symbol technical sentiment badges for portfolio holdings.",
    )
    model_id: str = Field(
        serialization_alias="modelId",
        description="OpenRouter model id used for generation.",
    )
