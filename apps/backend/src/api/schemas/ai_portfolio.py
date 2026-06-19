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
    model_id: str = Field(
        serialization_alias="modelId",
        description="OpenRouter model id used for generation.",
    )
