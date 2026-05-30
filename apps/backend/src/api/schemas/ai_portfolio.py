"""Schemas for AI-assisted portfolio health commentary."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict

from src.api.schemas.portfolio import (
    PortfolioSectorValue,
    PortfolioSnapshotPosition,
    PortfolioSummary,
)


class PortfolioHealthAnalysisRequest(BaseModel):
    """Portfolio payload used to generate concise health commentary."""

    model_config = ConfigDict(extra="ignore")

    asOf: str | None = None
    baseCurrency: str | None = None
    source: str | None = None
    positions: list[PortfolioSnapshotPosition]
    summary: PortfolioSummary
    sectorValues: list[PortfolioSectorValue]


class PortfolioHealthAnalysisResponse(BaseModel):
    """Short model-backed portfolio health insight for the dashboard widget."""

    label: Literal["Healthy", "Watch", "Concentrated"]
    diversification: str
    topContributor: str
    concentrationRisk: str
    model_id: str
