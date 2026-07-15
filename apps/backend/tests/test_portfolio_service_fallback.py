from __future__ import annotations

import sqlite3
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from src import db as app_db
from src.services.portfolio_service import PortfolioService


def _memory_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(":memory:", check_same_thread=False, isolation_level=None)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA synchronous = NORMAL")
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA busy_timeout = 5000")
    return conn


class PortfolioServiceFallbackTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.data_dir = Path(self.temp_dir.name)
        self.conn = _memory_conn()
        self.get_conn_patch = patch.object(app_db, "get_conn", return_value=self.conn)
        self.get_db_path_patch = patch.object(
            app_db, "get_db_path", return_value=self.data_dir / "optitrade.db"
        )
        self.get_conn_patch.start()
        self.get_db_path_patch.start()
        app_db.init_schema()

    def tearDown(self) -> None:
        self.get_db_path_patch.stop()
        self.get_conn_patch.stop()
        self.conn.close()
        self.temp_dir.cleanup()

    def test_unreachable_futu_forces_paper_and_marks_disconnected(self) -> None:
        service = PortfolioService(data_dir=self.data_dir)
        service._write_broker_connection(
            {
                "id": "futu",
                "status": "connected",
                "broker": "Futu",
                "name": "Futu",
                "settings": {
                    "host": "127.0.0.1",
                    "port": 11111,
                    "market": "US",
                    "trdEnv": "SIMULATE",
                },
                "accountId": None,
                "syncedAt": "2026-07-15T00:00:00+00:00",
                "lastError": None,
            }
        )

        with patch(
            "src.services.portfolio_service.portfolio_module.fetch_futu_portfolio_snapshot",
            side_effect=RuntimeError("Unable to connect to Futu OpenAPI at 127.0.0.1:11111"),
        ):
            snapshot = service.build_portfolio_snapshot()

        self.assertEqual(snapshot["source"], "paper")
        self.assertEqual(snapshot["broker"]["id"], "futu")
        self.assertEqual(snapshot["broker"]["status"], "disconnected")
        self.assertIn("Unable to connect to Futu OpenAPI", snapshot["broker"]["lastError"])

        saved_connection = service._read_broker_connection()
        self.assertEqual(saved_connection["id"], "futu")
        self.assertEqual(saved_connection["status"], "disconnected")
        self.assertIn(
            "Unable to connect to Futu OpenAPI",
            str(saved_connection.get("lastError") or ""),
        )
