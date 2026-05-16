"""FastAPI portfolio API for the dashboard widget."""

from __future__ import annotations

import argparse
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from src.portfolio import (
    build_portfolio_snapshot,
    create_paper_portfolio,
    get_broker_connection_payload,
    validate_connection_request,
)


def create_app() -> FastAPI:
    app = FastAPI(title="OptiTrade Portfolio API", version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["*"],
    )

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/api/portfolio")
    def get_portfolio() -> dict[str, Any]:
        return build_portfolio_snapshot()

    @app.get("/api/portfolio/connection")
    def get_portfolio_connection() -> dict[str, Any]:
        return get_broker_connection_payload()

    @app.post("/api/paper-portfolio", status_code=201)
    def post_paper_portfolio(payload: dict[str, Any]) -> dict[str, Any]:
        try:
            return create_paper_portfolio(payload)
        except (ValueError, RuntimeError) as error:
            raise HTTPException(status_code=400, detail=str(error)) from error

    @app.post("/api/portfolio/connect")
    def post_portfolio_connect(payload: dict[str, Any]) -> dict[str, Any]:
        try:
            return validate_connection_request(payload)
        except (ValueError, RuntimeError) as error:
            raise HTTPException(status_code=400, detail=str(error)) from error

    return app


app = create_app()


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the OptiTrade portfolio API.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()

    uvicorn.run("src.portfolio_api:app", host=args.host, port=args.port, reload=False)


if __name__ == "__main__":
    main()
