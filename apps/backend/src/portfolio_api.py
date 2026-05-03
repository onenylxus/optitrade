"""Small HTTP API for portfolio widget data."""

from __future__ import annotations

import argparse
import json
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any
from urllib.parse import urlparse

from src.portfolio import (
    build_portfolio_snapshot,
    create_paper_portfolio,
    validate_connection_request,
)


class PortfolioRequestHandler(BaseHTTPRequestHandler):
    server_version = "OptiTradePortfolioHTTP/0.1"

    def do_OPTIONS(self) -> None:
        self._send_empty(HTTPStatus.NO_CONTENT)

    def do_GET(self) -> None:
        path = urlparse(self.path).path

        if path == "/health":
            self._send_json({"status": "ok"})
            return

        if path == "/api/portfolio":
            self._send_json(build_portfolio_snapshot())
            return

        self._send_json({"error": "not found"}, HTTPStatus.NOT_FOUND)

    def do_POST(self) -> None:
        path = urlparse(self.path).path

        try:
            if path == "/api/paper-portfolio":
                payload = self._read_json_body()
                record = create_paper_portfolio(payload)
                self._send_json(record, HTTPStatus.CREATED)
                return

            if path == "/api/portfolio/connect":
                payload = self._read_json_body()
                self._send_json(validate_connection_request(payload))
                return
        except (json.JSONDecodeError, ValueError) as error:
            self._send_json({"error": str(error)}, HTTPStatus.BAD_REQUEST)
            return

        self._send_json({"error": "not found"}, HTTPStatus.NOT_FOUND)

    def log_message(self, format: str, *args: Any) -> None:
        return

    def _read_json_body(self) -> dict[str, Any]:
        content_length = int(self.headers.get("Content-Length", "0"))
        if content_length == 0:
            return {}

        body = self.rfile.read(content_length)
        payload = json.loads(body.decode("utf-8"))
        if not isinstance(payload, dict):
            raise ValueError("request body must be a JSON object")
        return payload

    def _send_empty(self, status: HTTPStatus) -> None:
        self.send_response(status)
        self._send_common_headers()
        self.end_headers()

    def _send_json(
        self,
        payload: dict[str, Any],
        status: HTTPStatus = HTTPStatus.OK,
    ) -> None:
        response = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self._send_common_headers()
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(response)))
        self.end_headers()
        self.wfile.write(response)

    def _send_common_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")


def create_server(host: str = "127.0.0.1", port: int = 8000) -> ThreadingHTTPServer:
    return ThreadingHTTPServer((host, port), PortfolioRequestHandler)


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the OptiTrade portfolio API.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()

    server = create_server(args.host, args.port)
    print(f"Portfolio API listening on http://{args.host}:{args.port}")
    server.serve_forever()


if __name__ == "__main__":
    main()
