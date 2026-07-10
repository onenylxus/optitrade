"""Portfolio service layer."""

from __future__ import annotations

import json
import os
import time
from dataclasses import asdict, dataclass
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Any

from src import db as app_db
from src import portfolio as portfolio_module
from src.ibkr_client import (
    IbkrConnectionSettings,
)
from src.api.schemas.stock_chart import ChartInterval, ChartRange
from src.services.stock_chart_service import StockChartService, resolve_stock_chart_params
from src.api.routes.price_routes import _fetch_yfinance


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


def _parse_bounded_int_env(name: str, default: int, *, minimum: int, maximum: int) -> int:
    raw = os.environ.get(name, str(default)).strip()
    try:
        value = int(raw)
    except ValueError:
        return default
    return max(minimum, min(value, maximum))


PAPER_PRICE_CACHE_TTL_SECONDS = _parse_bounded_int_env(
    "PAPER_PRICE_CACHE_TTL_SECONDS",
    3600,
    minimum=60,
    maximum=86400,
)
PAPER_PRICE_ERROR_TTL_SECONDS = _parse_bounded_int_env(
    "PAPER_PRICE_ERROR_TTL_SECONDS",
    120,
    minimum=30,
    maximum=3600,
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
        self._price_cache: dict[str, tuple[float, float | None]] = {}
        fmp_api_key = os.environ.get("FMP_API_KEY", "").strip()
        self._chart_service = (
            StockChartService(api_key=fmp_api_key) if fmp_api_key else None
        )

    def build_portfolio_snapshot(self) -> dict[str, Any]:
        connection = self._read_broker_connection()
        if connection["id"] == "mock":
            return self._editable_snapshot(connection)

        if connection["id"] == "ibkr" and connection["status"] == "connected":
            try:
                return portfolio_module.fetch_ibkr_portfolio_snapshot(
                    self._ibkr_settings(connection)
                )
            except Exception as error:
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
                    trd_env=str(connection["settings"].get("trdEnv", "SIMULATE")),
                )
            except Exception as error:
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
            except Exception as error:
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

        return self._editable_snapshot(connection)

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
            client_id = (
                int(payload["clientId"])
                if payload.get("clientId") is not None
                else None
            )
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
                    "clientId": validated.get("clientId"),
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
            trd_env = (
                str(payload.get("trdEnv", "SIMULATE")).strip().upper() or "SIMULATE"
            )
            portfolio_module._validate_futu_socket(host, port)
            validated = portfolio_module.validate_futu_connection(
                host, port, market, trd_env
            )
            connection = self._broker_connection(
                id="futu",
                status=str(validated.get("status", "connected")),
                broker="Futu",
                settings={
                    "host": host,
                    "port": port,
                    "market": market,
                    "trdEnv": trd_env,
                },
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
        total_value = sum(position.market_value for position in positions)
        history = self._normalize_history_payload(
            payload.get("history"), default_total_value=total_value
        )

        records = self._read_paper_portfolios()
        record = {
            "id": f"paper-{len(records) + 1}",
            "name": name,
            "status": "created",
            "positions": [self._position_payload(position) for position in positions],
            "history": history,
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
                "history": history,
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
        total_value = sum(position.market_value for position in positions)
        existing = self._read_editable_portfolio()
        history = (
            self._normalize_history_payload(
                payload.get("history") or existing.get("history"),
                default_total_value=total_value,
            )
            if positions
            else self._build_history(0)
        )
        record = {
            "name": name,
            "positions": [self._position_payload(position) for position in positions],
            "history": history,
            "updatedAt": datetime.now(UTC).isoformat(),
        }
        self._write_editable_portfolio(record)
        return record

    def _editable_snapshot(self, connection: dict[str, Any]) -> dict[str, Any]:
        editable_record = self._read_editable_portfolio()
        positions = self._normalize_positions_payload(
            editable_record.get("positions", [])
        )
        positions = self._refresh_paper_prices(positions)
        total_value = sum(position.market_value for position in positions)
        total_cost = sum(position.cost_basis for position in positions)
        pnl = total_value - total_cost
        pnl_percent = (pnl / total_cost) * 100 if total_cost else 0.0
        history = self._normalize_history_payload(
            editable_record.get("history"), default_total_value=total_value
        )
        opening_value = history[0]["value"] if history else total_value
        daily_pnl = total_value - opening_value
        daily_pnl_percent = (
            (daily_pnl / opening_value) * 100 if opening_value else 0.0
        )

        return {
            "asOf": datetime.now(UTC).isoformat(),
            "baseCurrency": "USD",
            "source": "paper",
            "broker": self._broker_connection_payload_dict(connection),
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
            "history": history,
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
        for key in ("host", "port", "clientId", "market", "trdEnv", "testnet"):
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
        """Read the editable portfolio from the SQLite `editable_portfolio` table.

        On first read, seeds the table either from the legacy JSON file (if it
        exists) or from the default positions. After that, every read goes to
        the DB.
        """
        app_db.init_schema()
        conn = app_db.get_conn()
        row = conn.execute(
            "SELECT name, positions, history, updated_at FROM editable_portfolio WHERE id = 1"
        ).fetchone()

        if row is not None:
            positions = self._normalize_positions_payload(
                app_db.json_loads(row["positions"], default=[])
            )
            total_value = sum(position.market_value for position in positions)
            history_raw = app_db.json_loads(row["history"])
            return {
                "name": str(row["name"] or "Portfolio Widget Portfolio").strip()
                or "Portfolio Widget Portfolio",
                "positions": [
                    self._position_payload(position) for position in positions
                ],
                "history": (
                    self._normalize_history_payload(
                        history_raw, default_total_value=total_value
                    )
                    if positions
                    else self._build_history(0)
                ),
                "updatedAt": str(row["updated_at"] or datetime.now(UTC).isoformat()),
            }

        # Seed: try the legacy JSON first, then fall back to defaults.
        seeded_payload: dict[str, Any]
        if self.editable_portfolio_path.exists():
            try:
                legacy = json.loads(self.editable_portfolio_path.read_text())
                if isinstance(legacy, dict):
                    seeded_payload = {
                        "name": str(legacy.get("name", "Portfolio Widget Portfolio")),
                        "positions": legacy.get("positions", []),
                        "history": legacy.get("history"),
                    }
                else:
                    seeded_payload = {}
            except (OSError, json.JSONDecodeError):
                seeded_payload = {}
        else:
            seeded_payload = {}

        if not seeded_payload or "positions" not in seeded_payload:
            seeded_payload = {
                "name": "Portfolio Widget Portfolio",
                "positions": [
                    self._position_payload(position) for position in self.positions
                ],
                "history": None,
            }

        positions = self._normalize_positions_payload(seeded_payload.get("positions", []))
        total_value = sum(position.market_value for position in positions)
        history = (
            self._normalize_history_payload(
                seeded_payload.get("history"), default_total_value=total_value
            )
            if positions
            else self._build_history(0)
        )
        updated_at = datetime.now(UTC).isoformat()

        self._write_editable_portfolio(
            {
                "name": seeded_payload.get("name", "Portfolio Widget Portfolio"),
                "positions": [self._position_payload(position) for position in positions],
                "history": history,
                "updatedAt": updated_at,
            }
        )
        return {
            "name": str(seeded_payload.get("name", "Portfolio Widget Portfolio")).strip()
            or "Portfolio Widget Portfolio",
            "positions": [self._position_payload(position) for position in positions],
            "history": history,
            "updatedAt": updated_at,
        }

    def _read_editable_positions(self) -> tuple[Position, ...]:
        record = self._read_editable_portfolio()
        return self._normalize_positions_payload(record.get("positions", []))

    def _refresh_paper_prices(self, positions: tuple[Position, ...]) -> tuple[Position, ...]:
        if not positions or self._chart_service is None:
            return positions

        refreshed: list[Position] = []
        for position in positions:
            latest_price = self._get_cached_paper_price(position.symbol)
            if latest_price is None:
                refreshed.append(position)
                continue
            refreshed.append(
                Position(
                    id=position.id,
                    symbol=position.symbol,
                    quantity=position.quantity,
                    avg_price=position.avg_price,
                    current_price=latest_price,
                    sector=position.sector,
                )
            )
        return tuple(refreshed)

    def _get_cached_paper_price(self, symbol: str) -> float | None:
        now = time.monotonic()
        cached = self._price_cache.get(symbol)
        if cached is not None and cached[0] > now:
            return cached[1]

        ttl_seconds = PAPER_PRICE_CACHE_TTL_SECONDS
        try:
            price = self._fetch_latest_close(symbol)
        except Exception:
            price = None
            ttl_seconds = PAPER_PRICE_ERROR_TTL_SECONDS

        self._price_cache[symbol] = (time.monotonic() + ttl_seconds, price)
        return price

    def _fetch_latest_close(self, symbol: str) -> float | None:
        quote = _fetch_yfinance(symbol)
        if quote is not None and quote.price > 0:
            return float(quote.price)

        if self._chart_service is None:
            return None

        end_date = date.today()
        params = resolve_stock_chart_params(
            symbol=symbol,
            interval=ChartInterval.DAY_1,
            chart_range=ChartRange.MONTH_1,
            from_date=None,
            to_date=end_date,
        )
        chart = self._run_chart_fetch(params)
        if not chart.candles:
            return None
        return float(chart.candles[-1].close)

    def _run_chart_fetch(self, params: Any):
        import asyncio

        try:
            asyncio.get_running_loop()
        except RuntimeError:
            return asyncio.run(self._chart_service.fetch_chart(params))
        raise RuntimeError("Unable to refresh paper prices from a running event loop.")

    def _write_editable_portfolio(self, record: dict[str, Any]) -> None:
        """Persist the editable portfolio to SQLite. JSON file is no longer used."""
        app_db.init_schema()
        conn = app_db.get_conn()
        conn.execute(
            "INSERT OR REPLACE INTO editable_portfolio "
            "(id, name, positions, history, updated_at) VALUES (1, ?, ?, ?, ?)",
            (
                str(record.get("name", "Portfolio Widget Portfolio")),
                app_db.json_dumps(record.get("positions", [])),
                app_db.json_dumps(record.get("history")) if record.get("history") else None,
                str(record.get("updatedAt") or datetime.now(UTC).isoformat()),
            ),
        )

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

    def _normalize_history_payload(
        self, raw_history: Any, *, default_total_value: float
    ) -> list[dict[str, float | str]]:
        if raw_history is None:
            return self._build_history(default_total_value)
        if not isinstance(raw_history, list):
            raise ValueError("history must be a list")

        history: list[dict[str, float | str]] = []
        for item in raw_history:
            if not isinstance(item, dict):
                raise ValueError("each history point must be an object")
            time_label = str(item.get("time", "")).strip()
            if not time_label:
                raise ValueError("history time is required")
            history.append(
                {
                    "time": time_label,
                    "value": round(
                        self._safe_float(item.get("value"), "history.value"), 2
                    ),
                }
            )
        return history

    def _ibkr_settings(self, connection: dict[str, Any]) -> IbkrConnectionSettings:
        settings = connection.get("settings", {})
        return IbkrConnectionSettings(
            host=str(settings.get("host", "127.0.0.1")),
            port=self._safe_int(settings.get("port"), 7497),
            client_id=None,
            account_id=str(connection.get("accountId", "")).strip() or None,
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
