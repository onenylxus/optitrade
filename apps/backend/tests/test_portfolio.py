import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from src import portfolio as portfolio_module
from src.portfolio import DEFAULT_POSITIONS, build_portfolio_snapshot
from src.portfolio_api import create_app


class PortfolioTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp_dir = tempfile.TemporaryDirectory()
        portfolio_module.DATA_DIR = Path(cls.temp_dir.name)
        portfolio_module.PAPER_PORTFOLIOS_PATH = (
            portfolio_module.DATA_DIR / "paper_portfolios.json"
        )
        portfolio_module.BROKER_CONNECTION_PATH = (
            portfolio_module.DATA_DIR / "broker_connection.json"
        )
        portfolio_module.IBKR_CONNECTION_PATH = portfolio_module.BROKER_CONNECTION_PATH
        cls.client = TestClient(create_app())

    @classmethod
    def tearDownClass(cls):
        cls.client.close()
        cls.temp_dir.cleanup()

    def test_build_portfolio_snapshot_returns_widget_contract(self):
        snapshot = build_portfolio_snapshot(DEFAULT_POSITIONS)

        self.assertEqual(snapshot["baseCurrency"], "USD")
        self.assertEqual(snapshot["source"], "backend")
        self.assertEqual(snapshot["broker"]["status"], "disconnected")
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
        response = self.client.get("/api/portfolio")
        payload = response.json()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload["summary"]["totalValue"], 110211.4)
        self.assertEqual(payload["positions"][1]["symbol"], "AAPL")

    def test_routes_do_not_use_v1_prefix(self):
        response = self.client.get("/v1/api/portfolio")
        self.assertEqual(response.status_code, 404)

    def test_non_portfolio_example_routes_are_not_owned_here(self):
        response = self.client.get("/api/stock?symbol=aapl")
        self.assertEqual(response.status_code, 404)

    def test_paper_portfolio_route_creates_record(self):
        response = self.client.post(
            "/api/paper-portfolio",
            json={"name": "Timmy Paper Portfolio"},
        )
        paper = response.json()

        self.assertEqual(response.status_code, 201)
        self.assertEqual(paper["status"], "created")
        self.assertEqual(paper["name"], "Timmy Paper Portfolio")
        self.assertTrue(portfolio_module.PAPER_PORTFOLIOS_PATH.exists())

    def test_connection_endpoint_validates_and_returns_status(self):
        with patch(
            "src.portfolio.validate_ibkr_connection",
            return_value={
                "status": "connected",
                "broker": "IBKR",
                "host": "127.0.0.1",
                "port": 7497,
                "clientId": 1,
                "accountId": "DU1234567",
                "syncedAt": "2026-05-10T00:00:00+00:00",
            },
        ):
            response = self.client.post(
                "/api/portfolio/connect",
                json={"host": "127.0.0.1", "port": 7497},
            )
            payload = response.json()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload["status"], "connected")
        self.assertEqual(payload["id"], "ibkr")
        self.assertEqual(payload["broker"], "IBKR")
        self.assertEqual(payload["port"], 7497)
        self.assertEqual(payload["clientId"], 1)

    def test_connection_status_is_exposed_by_api(self):
        with patch(
            "src.portfolio.validate_ibkr_connection",
            return_value={
                "status": "connected",
                "broker": "IBKR",
                "host": "127.0.0.1",
                "port": 4002,
                "clientId": 7,
                "accountId": "DU7654321",
                "syncedAt": "2026-05-10T00:00:00+00:00",
            },
        ):
            self.client.post(
                "/api/portfolio/connect",
                json={"host": "127.0.0.1", "port": 4002, "accountId": "DU7654321", "clientId": 7},
            )

        payload = self.client.get("/api/portfolio/connection").json()

        self.assertEqual(payload["status"], "connected")
        self.assertEqual(payload["id"], "ibkr")
        self.assertEqual(payload["port"], 4002)
        self.assertEqual(payload["accountId"], "DU7654321")
        self.assertEqual(payload["clientId"], 7)

    def test_futu_connection_is_persisted(self):
        with patch("src.portfolio._validate_futu_socket") as validate_futu_socket, patch(
            "src.portfolio.validate_futu_connection",
            return_value={
                "status": "connected",
                "broker": "Futu",
                "host": "127.0.0.1",
                "port": 11111,
                "market": "HK",
                "syncedAt": "2026-05-10T00:00:00+00:00",
            },
        ) as validate_futu_connection:
            response = self.client.post(
                "/api/portfolio/connect",
                json={"broker": "futu", "host": "127.0.0.1", "port": 11111, "market": "HK"},
            )
            payload = response.json()

        self.assertEqual(response.status_code, 200)
        validate_futu_socket.assert_called_once_with("127.0.0.1", 11111)
        validate_futu_connection.assert_called_once_with("127.0.0.1", 11111, "HK")
        self.assertEqual(payload["id"], "futu")
        self.assertEqual(payload["status"], "connected")
        self.assertEqual(payload["host"], "127.0.0.1")
        self.assertEqual(payload["market"], "HK")

        status_payload = self.client.get("/api/portfolio/connection").json()
        self.assertEqual(status_payload["id"], "futu")
        self.assertEqual(status_payload["settings"]["market"], "HK")

    def test_futu_connection_rejects_unreachable_host(self):
        with patch(
            "src.portfolio._validate_futu_socket",
            side_effect=RuntimeError("Unable to connect to Futu OpenAPI"),
        ):
            response = self.client.post(
                "/api/portfolio/connect",
                json={"broker": "futu", "host": "127.0.0.1", "port": 11111, "market": "HK"},
            )

        self.assertEqual(response.status_code, 400)
        self.assertIn("Unable to connect to Futu OpenAPI", response.json()["detail"])

    def test_binance_connection_masks_secret_in_response(self):
        with patch(
            "src.portfolio.validate_binance_connection",
            return_value={
                "status": "connected",
                "broker": "Binance",
                "accountId": "123456",
                "testnet": True,
                "syncedAt": "2026-05-10T00:00:00+00:00",
            },
        ) as validate_binance_connection:
            response = self.client.post(
                "/api/portfolio/connect",
                json={
                    "broker": "binance",
                    "apiKey": "abcd1234efgh5678",
                    "apiSecret": "super-secret-key",
                    "testnet": True,
                },
            )
            payload = response.json()

        self.assertEqual(response.status_code, 200)
        validate_binance_connection.assert_called_once_with(
            "abcd1234efgh5678",
            "super-secret-key",
            testnet=True,
        )
        self.assertEqual(payload["id"], "binance")
        self.assertEqual(payload["status"], "connected")
        self.assertEqual(payload["apiKeyPreview"], "abcd...5678")
        self.assertTrue(payload["hasSecret"])
        self.assertNotIn("apiSecret", payload)

    def test_binance_connection_rejects_invalid_credentials(self):
        with patch(
            "src.portfolio.validate_binance_connection",
            side_effect=RuntimeError("Unable to validate Binance API credentials: Invalid API-key"),
        ):
            response = self.client.post(
                "/api/portfolio/connect",
                json={
                    "broker": "binance",
                    "apiKey": "bad-key",
                    "apiSecret": "bad-secret",
                    "testnet": True,
                },
            )

        self.assertEqual(response.status_code, 400)
        self.assertIn("Invalid API-key", response.json()["detail"])
