"""Portfolio-related HTTP routes."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from src.api.controllers.portfolio_controller import PortfolioController
from src.api.deps import get_portfolio_service
from src.api.schemas.portfolio import (
    PortfolioConnectRequest,
    PortfolioEditableRequest,
    PortfolioEditableResponse,
    PortfolioConnectionResponse,
    PortfolioPaperRequest,
    PortfolioPaperResponse,
    PortfolioSnapshotResponse,
)
from src.services.portfolio_service import PortfolioService

router = APIRouter()


def get_portfolio_controller(
    service: Annotated[PortfolioService, Depends(get_portfolio_service)],
) -> PortfolioController:
    return PortfolioController(service)


@router.get("", response_model=PortfolioSnapshotResponse, response_model_by_alias=True)
def portfolio_snapshot(
    controller: Annotated[PortfolioController, Depends(get_portfolio_controller)],
) -> PortfolioSnapshotResponse:
    return controller.get_snapshot()


@router.get("/editable", response_model=PortfolioEditableResponse, response_model_by_alias=True)
def editable_portfolio(
    controller: Annotated[PortfolioController, Depends(get_portfolio_controller)],
) -> PortfolioEditableResponse:
    return controller.get_editable_portfolio()


@router.get("/connection", response_model=PortfolioConnectionResponse, response_model_by_alias=True)
def portfolio_connection(
    controller: Annotated[PortfolioController, Depends(get_portfolio_controller)],
) -> PortfolioConnectionResponse:
    return controller.get_connection()


@router.post("/connect", response_model=PortfolioConnectionResponse, response_model_by_alias=True)
def portfolio_connect(
    payload: PortfolioConnectRequest,
    controller: Annotated[PortfolioController, Depends(get_portfolio_controller)],
) -> PortfolioConnectionResponse:
    return controller.connect(payload.model_dump(exclude_none=True))


@router.put("/editable", response_model=PortfolioEditableResponse, response_model_by_alias=True)
def update_editable_portfolio(
    payload: PortfolioEditableRequest,
    controller: Annotated[PortfolioController, Depends(get_portfolio_controller)],
) -> PortfolioEditableResponse:
    return controller.update_editable_portfolio(payload.model_dump(exclude_none=True))


@router.post("/paper-portfolio", response_model=PortfolioPaperResponse, status_code=201)
def paper_portfolio(
    payload: PortfolioPaperRequest,
    controller: Annotated[PortfolioController, Depends(get_portfolio_controller)],
) -> PortfolioPaperResponse:
    return controller.create_paper_portfolio(payload.model_dump(exclude_none=True))
