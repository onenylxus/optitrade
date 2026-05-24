"""Portfolio controller."""

from __future__ import annotations

from fastapi import HTTPException, status

from src.services.portfolio_service import PortfolioService


class PortfolioController:
    """Maps portfolio HTTP requests to service calls."""

    def __init__(self, service: PortfolioService) -> None:
        self._service = service

    def get_snapshot(self) -> dict:
        try:
            return self._service.build_portfolio_snapshot()
        except RuntimeError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=str(exc),
            ) from exc

    def get_connection(self) -> dict:
        return self._service.get_broker_connection_status()

    def get_editable_portfolio(self) -> dict:
        try:
            return self._service.get_editable_portfolio()
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(exc),
            ) from exc

    def connect(self, payload: dict) -> dict:
        try:
            return self._service.validate_connection_request(payload)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(exc),
            ) from exc
        except RuntimeError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(exc),
            ) from exc

    def create_paper_portfolio(self, payload: dict) -> dict:
        try:
            return self._service.create_paper_portfolio(payload)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(exc),
            ) from exc

    def update_editable_portfolio(self, payload: dict) -> dict:
        try:
            return self._service.update_editable_portfolio(payload)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(exc),
            ) from exc
