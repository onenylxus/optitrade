"""Compatibility entrypoint for the structured FastAPI portfolio app."""

from __future__ import annotations

import uvicorn

from src.rest_server import create_app

app = create_app()


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(description="Run the OptiTrade portfolio API.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()

    uvicorn.run("src.portfolio_api:app", host=args.host, port=args.port, reload=False)


if __name__ == "__main__":
    main()
