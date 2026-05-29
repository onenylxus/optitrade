"""Portfolio service layer."""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from src import portfolio as portfolio_module
from src.ibkr_client import (
    IbkrConnectionSettings,
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
        self.editable_portfolio_path = self.data_dir / "editable_portfolio.json"
        self.broker_connection_path = self.data_dir / "broker_connection.json"

    def build_portfolio_snapshot(self) -> dict[str, Any]:
        connection = self._default_broker_connection()
        if connection["id"] == "ibkr" and connection["status"] == "connected":
            try:
                return portfolio_module.fetch_ibkr_portfolio_snapshot(
                    self._ibkr_settings(connection)
                )
            except (RuntimeError, TypeError) as error:
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
                connection = self._read_broker_connection()
        elif connection["id"] == "futu" and connection["status"] == "connected":
            try:
                return portfolio_module.fetch_futu_portfolio_snapshot(
                    host=str(connection["settings"].get("host", "127.0.0.1")),
                    port=self._safe_int(connection["settings"].get("port"), 11111),
                    market=str(connection["settings"].get("market", "US")),
                )
            except (RuntimeError, TypeError) as error:
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
                connection = self._read_broker_connection()
        elif connection["id"] == "binance" and connection["status"] == "connected":
            try:
                return portfolio_module.fetch_binance_portfolio_snapshot(
                    api_key=str(connection["settings"].get("apiKey", "")),
                    api_secret=str(connection["settings"].get("apiSecret", "")),
                    testnet=self._safe_bool(
                        connection["settings"].get("testnet", True)
                    ),
                )
            except (RuntimeError, TypeError) as error:
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
                connection = self._read_broker_connection()

        positions = self.positions
        total_value = sum(position.market_value for position in positions)
        total_cost = sum(position.cost_basis for position in positions)
        pnl = total_value - total_cost
        pnl_percent = (pnl / total_cost) * 100 if total_cost else 0.0

        daily_pnl_percent = 1.2
        daily_pnl = total_value * daily_pnl_percent / 100

        return {
            "asOf": datetime.now(UTC).isoformat(),
            "baseCurrency": "USD",
            "source": "backend",
            "broker": self._broker_connection_payload(connection),
            "positions": [self._position_payload(position) for position in positions],
            "summary": {
                "totalValue": round(total_value, 2),
                "totalCost": round(total_cost, 2),
                "pnl": round(pnl, 2),
                "pnlPercent": round(pnl_percent, 4),
                "dailyPnl": round(daily_pnl, 2),
                "dailyPnlPercent": round(daily_pnl_percent, 4),
                "marginUsage": round(total_value * 0.25, 2),
                "buyingPower": round(total_value * 0.15, 2),
            },
            "sectorValues": self._build_sector_values(positions),
            "history": self._build_history(total_value),
        }

    def validate_connection_request(self, payload: dict[str, Any]) -> dict[str, Any]:
        broker = str(payload.get("broker", "ibkr")).lower().strip()

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
            validated = portfolio_module.validate_ibkr_connection(
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
            portfolio_module._validate_futu_socket(host, port)
            validated = portfolio_module.validate_futu_connection(host, port, market)
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
        validated = portfolio_module.validate_binance_connection(
            api_key, api_secret, testnet=testnet
        )
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
        return self._broker_connection_payload(self._read_broker_connection())

    def _read_broker_connection(self) -> dict[str, Any]:
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
        positions = self._normalize_positions_payload(payload.get("positions", []))

        records = self._read_paper_portfolios()
        record = {
            "id": f"paper-{len(records) + 1}",
            "name": name,
            "status": "created",
            "positions": [self._position_payload(position) for position in positions],
            "createdAt": datetime.now(UTC).isoformat(),
        }
        records.append(record)
        self._write_paper_portfolios(records)
        self._write_editable_portfolio(
            {
                "name": name,
                "positions": [
                    self._position_payload(position) for position in positions
                ],
                "updatedAt": datetime.now(UTC).isoformat(),
            }
        )
        return record

    def get_editable_portfolio(self) -> dict[str, Any]:
        return self._read_editable_portfolio()

    def update_editable_portfolio(self, payload: dict[str, Any]) -> dict[str, Any]:
        name = (
            str(payload.get("name", "Portfolio Widget Portfolio")).strip()
            or "Portfolio Widget Portfolio"
        )
        positions = self._normalize_positions_payload(payload.get("positions", []))
        record = {
            "name": name,
            "positions": [self._position_payload(position) for position in positions],
            "updatedAt": datetime.now(UTC).isoformat(),
        }
        self._write_editable_portfolio(record)
        return record

    def _editable_snapshot(self, connection: dict[str, Any]) -> dict[str, Any]:
        positions = self._read_editable_positions()
        total_value = sum(position.market_value for position in positions)
        total_cost = sum(position.cost_basis for position in positions)
        pnl = total_value - total_cost
        pnl_percent = (pnl / total_cost) * 100 if total_cost else 0.0
        daily_pnl = total_value * 0.012

        return {
            "asOf": datetime.now(UTC).isoformat(),
            "baseCurrency": "USD",
            "source": "backend",
            "broker": self._broker_connection_payload_dict(connection),
            "positions": [self._position_payload(position) for position in positions],
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
            "sectorValues": self._build_sector_values(positions),
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
            payload["apiKeyPreview"] = (
                api_key if len(api_key) <= 8 else f"{api_key[:4]}...{api_key[-4:]}"
            )
            payload["hasSecret"] = bool(connection["settings"].get("apiSecret"))
        return payload

    def _broker_connection_payload_dict(
        self, connection: dict[str, Any]
    ) -> dict[str, Any]:
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

    def _read_editable_portfolio(self) -> dict[str, Any]:
        if self.editable_portfolio_path.exists():
            with self.editable_portfolio_path.open("r", encoding="utf-8") as file:
                payload = json.load(file)
            if not isinstance(payload, dict):
                raise ValueError("editable portfolio store must contain an object")
            positions = self._normalize_positions_payload(payload.get("positions", []))
            return {
                "name": str(payload.get("name", "Portfolio Widget Portfolio")).strip()
                or "Portfolio Widget Portfolio",
                "positions": [
                    self._position_payload(position) for position in positions
                ],
                "updatedAt": str(
                    payload.get("updatedAt") or datetime.now(UTC).isoformat()
                ),
            }

        records = self._read_paper_portfolios()
        if records:
            latest = records[-1]
            positions = self._normalize_positions_payload(latest.get("positions", []))
            migrated = {
                "name": str(latest.get("name", "Portfolio Widget Portfolio")).strip()
                or "Portfolio Widget Portfolio",
                "positions": [
                    self._position_payload(position) for position in positions
                ],
                "updatedAt": str(
                    latest.get("createdAt")
                    or latest.get("updatedAt")
                    or datetime.now(UTC).isoformat()
                ),
            }
            self._write_editable_portfolio(migrated)
            return migrated

        seeded = {
            "name": "Portfolio Widget Portfolio",
            "positions": [
                self._position_payload(position) for position in self.positions
            ],
            "updatedAt": datetime.now(UTC).isoformat(),
        }
        self._write_editable_portfolio(seeded)
        return seeded

    def _read_editable_positions(self) -> tuple[Position, ...]:
        record = self._read_editable_portfolio()
        return self._normalize_positions_payload(record.get("positions", []))

    def _write_editable_portfolio(self, record: dict[str, Any]) -> None:
        self.data_dir.mkdir(parents=True, exist_ok=True)
        with self.editable_portfolio_path.open("w", encoding="utf-8") as file:
            json.dump(record, file, indent=2)
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
            raise RuntimeError(
                f"Unable to connect to Futu OpenAPI at {host}:{port}: {error}"
            ) from error

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
                    "percent": round((value / total_value) * 100, 4)
                    if total_value
                    else 0.0,
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

    def _normalize_positions_payload(self, raw_positions: Any) -> tuple[Position, ...]:
        if raw_positions is None:
            return ()
        if not isinstance(raw_positions, list):
            raise ValueError("positions must be a list")

        positions: list[Position] = []
        for index, raw_position in enumerate(raw_positions, start=1):
            if not isinstance(raw_position, dict):
                raise ValueError("each position must be an object")

            symbol = str(raw_position.get("symbol", "")).strip().upper()
            if not symbol:
                raise ValueError("symbol is required for each position")

            position_id = str(raw_position.get("id", "")).strip() or f"position-{index}"
            sector = (
                str(raw_position.get("sector", "Uncategorized")).strip()
                or "Uncategorized"
            )
            positions.append(
                Position(
                    id=position_id,
                    symbol=symbol,
                    quantity=self._safe_float(raw_position.get("quantity"), "quantity"),
                    avg_price=self._safe_float(
                        raw_position.get("avgPrice"), "avgPrice"
                    ),
                    current_price=self._safe_float(
                        raw_position.get("currentPrice"), "currentPrice"
                    ),
                    sector=sector,
                )
            )

        return tuple(positions)

    @staticmethod
    def _safe_float(value: Any, field_name: str) -> float:
        try:
            return float(value)
        except (TypeError, ValueError) as error:
            raise ValueError(f"{field_name} must be a number") from error
