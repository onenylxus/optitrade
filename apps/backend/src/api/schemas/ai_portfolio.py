"""Schemas for AI-assisted portfolio analysis."""

from pydantic import BaseModel, ConfigDict, Field


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
    model_id: str = Field(
        serialization_alias="modelId",
        description="OpenRouter model id used for generation.",
    )
