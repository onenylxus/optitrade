"""Portfolio service layer."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import UTC, datetime
import json
from pathlib import Path
from typing import Any

from src.binance_client import fetch_binance_portfolio_snapshot, validate_binance_connection
from src.futu_client import fetch_futu_portfolio_snapshot, validate_futu_connection
from src.ibkr_client import (
    IbkrConnectionSettings,
    fetch_ibkr_portfolio_snapshot,
    validate_ibkr_connection,
)


@dataclass(frozen=True)
class Position:
    id: str
    symbol: str
    quantity: float
    avg_price: float
    current_price: float
    sector: str

    @property
    def market_value(self) -> float:
        return self.quantity * self.current_price

    @property
    def cost_basis(self) -> float:
        return self.quantity * self.avg_price

    @property
    def unrealized_pnl(self) -> float:
        return self.market_value - self.cost_basis

    @property
    def unrealized_pnl_percent(self) -> float:
        if self.cost_basis == 0:
            return 0.0
        return (self.unrealized_pnl / self.cost_basis) * 100


DEFAULT_POSITIONS: tuple[Position, ...] = (
    Position("1", "NVDA", 200, 120, 145.75, "Technology"),
    Position("2", "AAPL", 100, 175, 189.50, "Technology"),
    Position("4", "MSFT", 40, 380, 420.15, "Technology"),
    Position("5", "AMZN", 120, 145, 178.22, "Consumer"),
    Position("9", "JPM", 60, 140, 195.30, "Financial"),
    Position("12", "NFLX", 20, 450, 610.05, "Communication"),
)


class PortfolioService:
    def __init__(
        self,
        *,
        data_dir: Path | None = None,
        positions: tuple[Position, ...] = DEFAULT_POSITIONS,
    ) -> None:
        self.data_dir = data_dir or Path(__file__).resolve().parents[2] / "data"
        self.positions = positions
        self.paper_portfolios_path = self.data_dir / "paper_portfolios.json"
        self.broker_connection_path = self.data_dir / "broker_connection.json"

    def build_portfolio_snapshot(self) -> dict[str, Any]:
        connection = self.get_broker_connection_status()
        if connection["id"] == "ibkr" and connection["status"] == "connected":
            try:
                return fetch_ibkr_portfolio_snapshot(self._ibkr_settings(connection))
            except RuntimeError as error:
                self._write_broker_connection(
                    self._broker_connection(
                        id="ibkr",
                        status="configured",
                        broker="IBKR",
                        settings=dict(connection["settings"]),
                        account_id=connection.get("accountId"),
                        synced_at=connection.get("syncedAt"),
                        last_error=str(error),
                    )
                )
                connection = self.get_broker_connection_status()
        elif connection["id"] == "futu" and connection["status"] == "connected":
            try:
                return fetch_futu_portfolio_snapshot(
                    host=str(connection["settings"].get("host", "127.0.0.1")),
                    port=self._safe_int(connection["settings"].get("port"), 11111),
                    market=str(connection["settings"].get("market", "US")),
                )
            except RuntimeError as error:
                self._write_broker_connection(
                    self._broker_connection(
                        id="futu",
                        status="configured",
                        broker="Futu",
                        settings=dict(connection["settings"]),
                        account_id=connection.get("accountId"),
                        synced_at=connection.get("syncedAt"),
                        last_error=str(error),
                    )
                )
                connection = self.get_broker_connection_status()
        elif connection["id"] == "binance" and connection["status"] == "connected":
            try:
                return fetch_binance_portfolio_snapshot(
                    api_key=str(connection["settings"].get("apiKey", "")),
                    api_secret=str(connection["settings"].get("apiSecret", "")),
                    testnet=self._safe_bool(connection["settings"].get("testnet", True)),
                )
            except RuntimeError as error:
                self._write_broker_connection(
                    self._broker_connection(
                        id="binance",
                        status="configured",
                        broker="Binance",
                        settings=dict(connection["settings"]),
                        account_id=connection.get("accountId"),
                        synced_at=connection.get("syncedAt"),
                        last_error=str(error),
                    )
                )
                connection = self.get_broker_connection_status()

        return self._demo_snapshot(connection)

    def validate_connection_request(self, payload: dict[str, Any]) -> dict[str, Any]:
        broker = str(payload.get("broker", "mock")).lower().strip()

        if broker == "mock":
            connection = self._broker_connection(
                id="mock",
                status="disconnected",
                broker="Mock Data",
                settings={},
            )
            self._write_broker_connection(connection)
            return self._broker_connection_payload(connection)

        if broker == "ibkr":
            host = str(payload.get("host", "127.0.0.1")).strip() or "127.0.0.1"
            port = int(payload.get("port", 7497))
            client_id = int(payload.get("clientId", 1))
            validated = validate_ibkr_connection(
                IbkrConnectionSettings(host=host, port=port, client_id=client_id)
            )
            connection = self._broker_connection(
                id="ibkr",
                status=str(validated["status"]),
                broker="IBKR",
                settings={
                    "host": validated.get("host", host),
                    "port": validated.get("port", port),
                    "clientId": validated.get("clientId", client_id),
                },
                account_id=validated.get("accountId"),
                synced_at=validated.get("syncedAt"),
                last_error=validated.get("lastError"),
            )
            self._write_broker_connection(connection)
            return self._broker_connection_payload(connection)

        if broker == "futu":
            host = str(payload.get("host", "127.0.0.1")).strip() or "127.0.0.1"
            port = int(payload.get("port", 11111))
            market = str(payload.get("market", "US")).strip().upper() or "US"
            self._validate_socket(host, port)
            validated = validate_futu_connection(host, port, market)
            connection = self._broker_connection(
                id="futu",
                status=str(validated.get("status", "connected")),
                broker="Futu",
                settings={"host": host, "port": port, "market": market},
                account_id=validated.get("accountId"),
                synced_at=validated.get("syncedAt"),
            )
            self._write_broker_connection(connection)
            return self._broker_connection_payload(connection)

        api_key = str(payload.get("apiKey", "")).strip()
        api_secret = str(payload.get("apiSecret", "")).strip()
        testnet = self._safe_bool(payload.get("testnet", True))
        validated = validate_binance_connection(api_key, api_secret, testnet=testnet)
        connection = self._broker_connection(
            id="binance",
            status=str(validated.get("status", "connected")),
            broker="Binance",
            settings={"apiKey": api_key, "apiSecret": api_secret, "testnet": testnet},
            account_id=validated.get("accountId"),
            synced_at=validated.get("syncedAt"),
        )
        self._write_broker_connection(connection)
        return self._broker_connection_payload(connection)

    def get_broker_connection_status(self) -> dict[str, Any]:
        if not self.broker_connection_path.exists():
            return self._default_broker_connection()

        with self.broker_connection_path.open("r", encoding="utf-8") as file:
            payload = json.load(file)
        if not isinstance(payload, dict):
            return self._default_broker_connection()
        settings = payload.get("settings")
        if not isinstance(settings, dict):
            settings = {}
        return self._broker_connection(
            id=str(payload.get("id") or payload.get("broker") or "mock"),
            status=str(payload.get("status", "disconnected")),
            broker=str(payload.get("name") or payload.get("broker") or "Mock Data"),
            settings=settings,
            account_id=payload.get("accountId"),
            synced_at=payload.get("syncedAt"),
            last_error=payload.get("lastError"),
        )

    def create_paper_portfolio(self, payload: dict[str, Any]) -> dict[str, Any]:
        name = str(payload.get("name", "Paper Portfolio")).strip() or "Paper Portfolio"
        positions = payload.get("positions", [])
        if not isinstance(positions, list):
            raise ValueError("positions must be a list")

        records = self._read_paper_portfolios()
        record = {
            "id": f"paper-{len(records) + 1}",
            "name": name,
            "status": "created",
            "positions": positions,
            "createdAt": datetime.now(UTC).isoformat(),
        }
        records.append(record)
        self._write_paper_portfolios(records)
        return record

    def _demo_snapshot(self, connection: dict[str, Any]) -> dict[str, Any]:
        total_value = sum(position.market_value for position in self.positions)
        total_cost = sum(position.cost_basis for position in self.positions)
        pnl = total_value - total_cost
        pnl_percent = (pnl / total_cost) * 100 if total_cost else 0.0
        daily_pnl = total_value * 0.012

        return {
            "asOf": datetime.now(UTC).isoformat(),
            "baseCurrency": "USD",
            "source": "backend" if connection["status"] == "connected" else "demo",
            "broker": self._broker_connection_payload_dict(connection),
            "positions": [self._position_payload(position) for position in self.positions],
            "summary": {
                "totalValue": round(total_value, 2),
                "totalCost": round(total_cost, 2),
                "pnl": round(pnl, 2),
                "pnlPercent": round(pnl_percent, 4),
                "dailyPnl": round(daily_pnl, 2),
                "dailyPnlPercent": 1.2,
                "marginUsage": round(total_value * 0.25, 2),
                "buyingPower": round(total_value * 0.15, 2),
            },
            "sectorValues": self._build_sector_values(self.positions),
            "history": self._build_history(total_value),
        }

    def _position_payload(self, position: Position) -> dict[str, Any]:
        payload = asdict(position)
        payload["avgPrice"] = payload.pop("avg_price")
        payload["currentPrice"] = payload.pop("current_price")
        payload["marketValue"] = round(position.market_value, 2)
        payload["costBasis"] = round(position.cost_basis, 2)
        payload["unrealizedPnl"] = round(position.unrealized_pnl, 2)
        payload["unrealizedPnlPercent"] = round(position.unrealized_pnl_percent, 4)
        return payload

    def _broker_connection(
        self,
        *,
        id: str,
        status: str,
        broker: str,
        settings: dict[str, Any],
        account_id: str | None = None,
        synced_at: str | None = None,
        last_error: str | None = None,
    ) -> dict[str, Any]:
        return {
            "id": id,
            "status": status,
            "broker": broker,
            "name": broker,
            "settings": settings,
            "accountId": account_id,
            "syncedAt": synced_at or datetime.now(UTC).isoformat(),
            "lastError": last_error,
        }

    def _broker_connection_payload(self, connection: dict[str, Any]) -> dict[str, Any]:
        payload = {
            "id": connection["id"],
            "status": connection["status"],
            "broker": connection["broker"],
            "name": connection["name"],
            "settings": connection["settings"],
            "accountId": connection.get("accountId"),
            "syncedAt": connection.get("syncedAt"),
            "lastError": connection.get("lastError"),
        }
        for key in ("host", "port", "clientId", "market", "testnet"):
            if key in connection["settings"]:
                payload[key] = connection["settings"][key]
        if connection["id"] == "binance":
            api_key = str(connection["settings"].get("apiKey", ""))
            payload["apiKeyPreview"] = api_key if len(api_key) <= 8 else f"{api_key[:4]}...{api_key[-4:]}"
            payload["hasSecret"] = bool(connection["settings"].get("apiSecret"))
        return payload

    def _broker_connection_payload_dict(self, connection: dict[str, Any]) -> dict[str, Any]:
        return self._broker_connection_payload(connection)

    def _read_paper_portfolios(self) -> list[dict[str, Any]]:
        if not self.paper_portfolios_path.exists():
            return []
        with self.paper_portfolios_path.open("r", encoding="utf-8") as file:
            data = json.load(file)
        if not isinstance(data, list):
            raise ValueError("paper portfolio store must contain a list")
        return data

    def _write_paper_portfolios(self, records: list[dict[str, Any]]) -> None:
        self.data_dir.mkdir(parents=True, exist_ok=True)
        with self.paper_portfolios_path.open("w", encoding="utf-8") as file:
            json.dump(records, file, indent=2)
            file.write("\n")

    def _write_broker_connection(self, connection: dict[str, Any]) -> None:
        self.data_dir.mkdir(parents=True, exist_ok=True)
        with self.broker_connection_path.open("w", encoding="utf-8") as file:
            json.dump(connection, file, indent=2)
            file.write("\n")

    def _default_broker_connection(self) -> dict[str, Any]:
        return self._broker_connection(
            id="mock",
            status="disconnected",
            broker="Mock Data",
            settings={},
        )

    @staticmethod
    def _safe_int(value: Any, default: int) -> int:
        try:
            return int(value)
        except (TypeError, ValueError):
            return default

    @staticmethod
    def _safe_bool(value: Any) -> bool:
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            return value.strip().lower() in {"1", "true", "yes", "on"}
        return bool(value)

    @staticmethod
    def _validate_socket(host: str, port: int) -> None:
        import socket

        try:
            with socket.create_connection((host, port), timeout=5):
                return
        except OSError as error:
            raise RuntimeError(f"Unable to connect to Futu OpenAPI at {host}:{port}: {error}") from error

    @staticmethod
    def _build_sector_values(positions: tuple[Position, ...]) -> list[dict[str, Any]]:
        total_value = sum(position.market_value for position in positions)
        grouped: dict[str, float] = {}
        for position in positions:
            sector = position.sector or "Uncategorized"
            grouped[sector] = grouped.get(sector, 0.0) + position.market_value

        return sorted(
            (
                {
                    "sector": sector,
                    "value": round(value, 2),
                    "percent": round((value / total_value) * 100, 4) if total_value else 0.0,
                }
                for sector, value in grouped.items()
            ),
            key=lambda item: item["value"],
            reverse=True,
        )

    @staticmethod
    def _build_history(total_value: float) -> list[dict[str, Any]]:
        multipliers = (
            ("09:30", 0.985),
            ("10:30", 0.992),
            ("11:30", 1.012),
            ("12:30", 1.005),
            ("13:30", 1.018),
            ("14:30", 1.011),
            ("15:30", 1.0),
        )
        return [
            {"time": time_label, "value": round(total_value * multiplier, 2)}
            for time_label, multiplier in multipliers
        ]

    def _ibkr_settings(self, connection: dict[str, Any]) -> IbkrConnectionSettings:
        settings = connection.get("settings", {})
        return IbkrConnectionSettings(
            host=str(settings.get("host", "127.0.0.1")),
            port=self._safe_int(settings.get("port"), 7497),
            client_id=self._safe_int(settings.get("clientId"), 1),
        )
