"""Unified server runner for both gRPC and REST APIs."""

import logging
import threading
from concurrent import futures

import uvicorn

from src.rest_server import create_app

from news_fetcher.pipeline import NewsAnalysisPipeline

def run_rest_server(rest_port: int = 8000):
    """
    Run REST server (FastAPI with Uvicorn).

    Args:
        rest_port: The port to listen on.
    """
    app = create_app()
    config = uvicorn.Config(
        app,
        host="0.0.0.0",
        port=rest_port,
        log_level="info",
    )
    server = uvicorn.Server(config)
    print(f"REST API server started on port {rest_port}")
    print(f"  OpenAPI docs: http://localhost:{rest_port}/docs")
    import asyncio
    asyncio.run(server.serve())

def run_news_pipeline_loop(limit: int = 50):
    try:
        pipeline = NewsAnalysisPipeline(limit_per_source=limit)
        pipeline.start_automated_loop()
    except Exception as e:
        print(f"News: Pipeline daemon thread experiences critical crash: {e}")

def main():
    """Start REST server."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )

    # news_thread = threading.Thread(
    #     target=run_news_pipeline_loop,
    #     args=(50,),
    #     daemon=True,
    #     name="NewsPipelineThread"
    # )
    # news_thread.start()
    # print("Background news pipeline thread started")

    # Start REST server in main thread
    try:
        run_rest_server(8000)
    except KeyboardInterrupt:
        print("\nShutting down servers...")


if __name__ == "__main__":
    main()
