"""Structured FastAPI REST server."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.api.controllers.portfolio_controller import PortfolioController
from src.api.deps import get_portfolio_service
from src.api.routes.portfolio_routes import router as portfolio_router


def create_app() -> FastAPI:
    app = FastAPI(
        title="OptiTrade API",
        description="RESTful API for OptiTrade services",
        version="0.1.0",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health")
    async def health_check() -> dict[str, str]:
        return {"status": "ok"}

    app.include_router(portfolio_router, prefix="/api/portfolio", tags=["portfolio"])

    @app.post("/api/paper-portfolio", status_code=201, tags=["portfolio"])
    def paper_portfolio_compat(payload: dict) -> dict:
        controller = PortfolioController(get_portfolio_service())
        return controller.create_paper_portfolio(payload)

    return app
