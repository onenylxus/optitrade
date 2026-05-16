"""Dependency providers for FastAPI routes."""

from __future__ import annotations

from src.services.portfolio_service import PortfolioService


def get_portfolio_service() -> PortfolioService:
    return PortfolioService()
