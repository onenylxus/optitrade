"""FastAPI portfolio API for the dashboard widget."""

from __future__ import annotations

import argparse
from contextlib import asynccontextmanager
from typing import Any

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from src.portfolio import (
    build_portfolio_snapshot,
    create_paper_portfolio,
    get_ibkr_connection_status,
    validate_connection_request,
)


@asynccontextmanager
async def lifespan(_: FastAPI):
    yield


app = FastAPI(title="OptiTrade Portfolio API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/portfolio")
async def get_portfolio() -> dict[str, Any]:
    return build_portfolio_snapshot()


@app.get("/api/portfolio/connection")
async def get_portfolio_connection() -> dict[str, Any]:
    connection = get_ibkr_connection_status()
    return {
        "status": connection.status,
        "broker": connection.broker,
        "host": connection.host,
        "port": connection.port,
        "clientId": connection.client_id,
        "accountId": connection.account_id,
        "syncedAt": connection.synced_at,
        "lastError": connection.last_error,
    }


@app.post("/api/paper-portfolio", status_code=201)
async def post_paper_portfolio(payload: dict[str, Any]) -> dict[str, Any]:
    try:
        return create_paper_portfolio(payload)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@app.post("/api/portfolio/connect")
async def post_portfolio_connect(payload: dict[str, Any]) -> dict[str, Any]:
    try:
        return validate_connection_request(payload)
    except (ValueError, RuntimeError) as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the OptiTrade portfolio API.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()

    uvicorn.run("src.portfolio_api:app", host=args.host, port=args.port, reload=False)


if __name__ == "__main__":
    main()
