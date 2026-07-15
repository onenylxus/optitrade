"""AI controller for portfolio widget insights."""

from __future__ import annotations

from fastapi import HTTPException, status

from src.api.schemas.ai_portfolio import PortfolioAnalysisResponse
from src.services.portfolio_analysis_service import PortfolioAnalysisService


class PortfolioAIController:
    """Coordinates portfolio snapshot analysis through the LLM service."""

    def __init__(self, analysis_service: PortfolioAnalysisService) -> None:
        self._analysis = analysis_service

    async def analyze_portfolio(
        self,
        snapshot: dict | None = None,
    ) -> PortfolioAnalysisResponse:
        try:
            return await self._analysis.analyze(snapshot)
        except RuntimeError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=str(exc),
            ) from exc
