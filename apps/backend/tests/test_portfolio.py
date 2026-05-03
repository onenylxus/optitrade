import json
import tempfile
import threading
import unittest
from pathlib import Path
from urllib import request
from urllib.error import HTTPError

from src import portfolio as portfolio_module
from src.portfolio import DEFAULT_POSITIONS, build_portfolio_snapshot
from src.portfolio_api import create_server


def read_json(url: str):
    with request.urlopen(url, timeout=5) as response:
        return json.loads(response.read().decode("utf-8"))


def post_json(url: str, payload: dict):
    body = json.dumps(payload).encode("utf-8")
    req = request.Request(
        url,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with request.urlopen(req, timeout=5) as response:
        return response.status, json.loads(response.read().decode("utf-8"))


class PortfolioTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp_dir = tempfile.TemporaryDirectory()
        portfolio_module.DATA_DIR = Path(cls.temp_dir.name)
        portfolio_module.PAPER_PORTFOLIOS_PATH = (
            portfolio_module.DATA_DIR / "paper_portfolios.json"
        )
        cls.server = create_server(port=0)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.api_url = f"http://127.0.0.1:{cls.server.server_port}"

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=2)
        cls.temp_dir.cleanup()

    def test_build_portfolio_snapshot_returns_widget_contract(self):
        snapshot = build_portfolio_snapshot(DEFAULT_POSITIONS)

        self.assertEqual(snapshot["baseCurrency"], "USD")
        self.assertEqual(len(snapshot["positions"]), len(DEFAULT_POSITIONS))
        self.assertEqual(snapshot["summary"]["totalValue"], 110211.4)
        self.assertEqual(snapshot["summary"]["pnl"], 18711.4)
        self.assertAlmostEqual(snapshot["summary"]["pnlPercent"], 20.4496, places=4)
        self.assertEqual(snapshot["summary"]["dailyPnl"], 1322.54)
        self.assertEqual(snapshot["positions"][0]["avgPrice"], 120)
        self.assertEqual(snapshot["positions"][0]["currentPrice"], 145.75)
        self.assertEqual(snapshot["positions"][0]["marketValue"], 29150)
        self.assertEqual(snapshot["sectorValues"][0]["sector"], "Technology")
        self.assertEqual(
            snapshot["history"][-1]["value"],
            snapshot["summary"]["totalValue"],
        )

    def test_portfolio_endpoint_returns_snapshot(self):
        payload = read_json(f"{self.api_url}/api/portfolio")

        self.assertEqual(payload["summary"]["totalValue"], 110211.4)
        self.assertEqual(payload["positions"][1]["symbol"], "AAPL")

    def test_routes_do_not_use_v1_prefix(self):
        with self.assertRaises(HTTPError) as context:
            read_json(f"{self.api_url}/v1/api/portfolio")

        self.assertEqual(context.exception.code, 404)

    def test_non_portfolio_example_routes_are_not_owned_here(self):
        with self.assertRaises(HTTPError) as context:
            read_json(f"{self.api_url}/api/stock?symbol=aapl")

        self.assertEqual(context.exception.code, 404)

    def test_paper_portfolio_route_creates_record(self):
        paper_status, paper = post_json(
            f"{self.api_url}/api/paper-portfolio",
            {"name": "Timmy Paper Portfolio"},
        )

        self.assertEqual(paper_status, 201)
        self.assertEqual(paper["status"], "created")
        self.assertEqual(paper["name"], "Timmy Paper Portfolio")
        self.assertTrue(portfolio_module.PAPER_PORTFOLIOS_PATH.exists())

    def test_connection_endpoint_validates_and_returns_status(self):
        _, payload = post_json(
            f"{self.api_url}/api/portfolio/connect",
            {"host": "127.0.0.1", "port": 7497},
        )

        self.assertEqual(payload["status"], "connected")
        self.assertEqual(payload["broker"], "IBKR")
        self.assertEqual(payload["port"], 7497)
