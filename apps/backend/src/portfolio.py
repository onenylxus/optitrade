"""Portfolio snapshot domain logic for the dashboard widget."""

from __future__ import annotations

import json
import socket
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

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

DATA_DIR = Path(__file__).resolve().parents[1] / "data"
PAPER_PORTFOLIOS_PATH = DATA_DIR / "paper_portfolios.json"
BROKER_CONNECTION_PATH = DATA_DIR / "broker_connection.json"
IBKR_CONNECTION_PATH = BROKER_CONNECTION_PATH

BROKER_LABELS = {
    "ibkr": "IBKR",
    "futu": "Futu",
    "binance": "Binance",
    "mock": "Mock Data",
}


@dataclass(frozen=True)
class BrokerConnection:
    id: str
    status: str
    broker: str
    settings: dict[str, Any]
    account_id: str | None = None
    synced_at: str | None = None
    last_error: str | None = None


def _round_money(value: float) -> float:
    return round(value, 2)


def _round_percent(value: float) -> float:
    return round(value, 4)


def _utc_now() -> str:
    return datetime.now(UTC).isoformat()


def _normalize_broker_id(raw_value: Any) -> str:
    value = str(raw_value or "mock").strip().lower()
    aliases = {
        "interactive brokers": "ibkr",
        "ibkr": "ibkr",
        "futu": "futu",
        "binance": "binance",
        "mock": "mock",
        "mock data": "mock",
    }
    value = aliases.get(value, value)
    if value not in BROKER_LABELS:
        raise ValueError(f"unsupported broker `{value}`")
    return value


def _broker_label(broker_id: str) -> str:
    return BROKER_LABELS.get(broker_id, "Mock Data")


def _safe_int(value: Any, default: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _safe_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "on"}
    return bool(value)


def _default_broker_connection() -> BrokerConnection:
    return BrokerConnection(
        id="mock",
        status="disconnected",
        broker=_broker_label("mock"),
        settings={},
    )


def _legacy_settings(payload: dict[str, Any]) -> dict[str, Any]:
    settings = payload.get("settings")
    if isinstance(settings, dict):
        return settings

    legacy: dict[str, Any] = {}
    for key in ("host", "port", "clientId", "market", "apiKey", "testnet"):
        if key in payload and payload.get(key) is not None:
            legacy[key] = payload[key]
    return legacy


def _public_broker_settings(connection: BrokerConnection) -> dict[str, Any]:
    settings = dict(connection.settings)
    if connection.id == "binance":
        api_key = str(settings.get("apiKey", ""))
        api_secret = str(settings.get("apiSecret", ""))
        if api_key:
            settings["apiKeyPreview"] = (
                api_key if len(api_key) <= 8 else f"{api_key[:4]}...{api_key[-4:]}"
            )
        settings["hasSecret"] = bool(api_secret)
        settings.pop("apiKey", None)
        settings.pop("apiSecret", None)
    return settings


def _ibkr_settings(connection: BrokerConnection):
    from src.ibkr_client import IbkrConnectionSettings

    host = str(connection.settings.get("host", "127.0.0.1")).strip() or "127.0.0.1"
    port = _safe_int(connection.settings.get("port"), 7497)
    client_id = _safe_int(connection.settings.get("clientId"), 1)
    return IbkrConnectionSettings(host=host, port=port, client_id=client_id)


def _validate_futu_socket(host: str, port: int) -> None:
    try:
        with socket.create_connection((host, port), timeout=5):
            return
    except OSError as error:
        raise RuntimeError(
            f"Unable to connect to Futu OpenAPI at {host}:{port}: {error}"
        ) from error


def _configured_broker_connection(
    broker_id: str,
    settings: dict[str, Any],
    *,
    account_id: str | None = None,
    last_error: str | None = None,
    status: str = "configured",
) -> BrokerConnection:
    return BrokerConnection(
        id=broker_id,
        status=status,
        broker=_broker_label(broker_id),
        settings=settings,
        account_id=account_id,
        synced_at=_utc_now(),
        last_error=last_error,
    )


def _position_payload(position: Position) -> dict[str, Any]:
    payload = asdict(position)
    payload["avgPrice"] = payload.pop("avg_price")
    payload["currentPrice"] = payload.pop("current_price")
    payload["marketValue"] = _round_money(position.market_value)
    payload["costBasis"] = _round_money(position.cost_basis)
    payload["unrealizedPnl"] = _round_money(position.unrealized_pnl)
    payload["unrealizedPnlPercent"] = _round_percent(position.unrealized_pnl_percent)
    return payload


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
        {"time": time, "value": _round_money(total_value * multiplier)}
        for time, multiplier in multipliers
    ]


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
                "value": _round_money(value),
                "percent": _round_percent((value / total_value) * 100)
                if total_value
                else 0.0,
            }
            for sector, value in grouped.items()
        ),
        key=lambda item: item["value"],
        reverse=True,
    )


def build_portfolio_snapshot(
    positions: tuple[Position, ...] = DEFAULT_POSITIONS,
) -> dict[str, Any]:
    connection = _default_broker_connection()
    if connection.id == "ibkr" and connection.status == "connected":
        from src.ibkr_client import fetch_ibkr_portfolio_snapshot

        try:
            return fetch_ibkr_portfolio_snapshot(_ibkr_settings(connection))
        except RuntimeError as error:
            configured = BrokerConnection(
                id="ibkr",
                status="configured",
                broker=_broker_label("ibkr"),
                settings=dict(connection.settings),
                account_id=connection.account_id,
                synced_at=connection.synced_at,
                last_error=str(error),
            )
            _write_broker_connection(configured)
            connection = configured
    elif connection.id == "futu" and connection.status == "connected":
        from src.futu_client import fetch_futu_portfolio_snapshot

        try:
            return fetch_futu_portfolio_snapshot(
                host=str(connection.settings.get("host", "127.0.0.1")),
                port=_safe_int(connection.settings.get("port"), 11111),
                market=str(connection.settings.get("market", "US")),
            )
        except RuntimeError as error:
            configured = BrokerConnection(
                id="futu",
                status="configured",
                broker=_broker_label("futu"),
                settings=dict(connection.settings),
                account_id=connection.account_id,
                synced_at=connection.synced_at,
                last_error=str(error),
            )
            _write_broker_connection(configured)
            connection = configured
    elif connection.id == "binance" and connection.status == "connected":
        from src.binance_client import fetch_binance_portfolio_snapshot

        try:
            return fetch_binance_portfolio_snapshot(
                api_key=str(connection.settings.get("apiKey", "")),
                api_secret=str(connection.settings.get("apiSecret", "")),
                testnet=_safe_bool(connection.settings.get("testnet", True)),
            )
        except RuntimeError as error:
            configured = BrokerConnection(
                id="binance",
                status="configured",
                broker=_broker_label("binance"),
                settings=dict(connection.settings),
                account_id=connection.account_id,
                synced_at=connection.synced_at,
                last_error=str(error),
            )
            _write_broker_connection(configured)
            connection = configured

    total_value = sum(position.market_value for position in positions)
    total_cost = sum(position.cost_basis for position in positions)
    pnl = total_value - total_cost
    pnl_percent = (pnl / total_cost) * 100 if total_cost else 0.0

    daily_pnl_percent = 1.2
    daily_pnl = total_value * daily_pnl_percent / 100

    return {
        "asOf": _utc_now(),
        "baseCurrency": "USD",
        "source": "backend",
        "broker": _broker_connection_payload(connection),
        "positions": [_position_payload(position) for position in positions],
        "summary": {
            "totalValue": _round_money(total_value),
            "totalCost": _round_money(total_cost),
            "pnl": _round_money(pnl),
            "pnlPercent": _round_percent(pnl_percent),
            "dailyPnl": _round_money(daily_pnl),
            "dailyPnlPercent": _round_percent(daily_pnl_percent),
            "marginUsage": _round_money(total_value * 0.25),
            "buyingPower": _round_money(total_value * 0.15),
        },
        "sectorValues": _build_sector_values(positions),
        "history": _build_history(total_value),
    }


def validate_connection_request(payload: dict[str, Any]) -> dict[str, Any]:
    broker_id = _normalize_broker_id(payload.get("broker", "ibkr"))

    if broker_id == "mock":
        connection = _default_broker_connection()
        _write_broker_connection(connection)
        return _broker_connection_payload(connection)

    if broker_id == "ibkr":
        from src.ibkr_client import IbkrConnectionSettings, validate_ibkr_connection

        host = str(payload.get("host", "127.0.0.1")).strip() or "127.0.0.1"
        port = int(payload.get("port", 7497))
        client_id = int(payload.get("clientId", 1))

        if not 1 <= port <= 65535:
            raise ValueError("port must be between 1 and 65535")
        if client_id < 0:
            raise ValueError("clientId must be zero or greater")

        validated = validate_ibkr_connection(
            IbkrConnectionSettings(host=host, port=port, client_id=client_id)
        )
        connection = BrokerConnection(
            id="ibkr",
            status=str(validated["status"]),
            broker=_broker_label("ibkr"),
            settings={
                "host": validated.get("host", host),
                "port": validated.get("port", port),
                "clientId": validated.get("clientId", client_id),
            },
            account_id=validated.get("accountId"),
            synced_at=validated.get("syncedAt"),
            last_error=validated.get("lastError"),
        )
        _write_broker_connection(connection)
        return _broker_connection_payload(connection)

    if broker_id == "futu":
        from src.futu_client import validate_futu_connection

        host = str(payload.get("host", "127.0.0.1")).strip() or "127.0.0.1"
        port = int(payload.get("port", 11111))
        market = str(payload.get("market", "US")).strip().upper() or "US"

        if not 1 <= port <= 65535:
            raise ValueError("port must be between 1 and 65535")
        if market not in {"US", "HK", "CN", "SG", "JP"}:
            raise ValueError("market must be one of US, HK, CN, SG, or JP")

        _validate_futu_socket(host, port)
        validated = validate_futu_connection(host, port, market)
        connection = _configured_broker_connection(
            "futu",
            {"host": host, "port": port, "market": market},
            account_id=validated.get("accountId"),
            status=str(validated.get("status", "connected")),
        )
        _write_broker_connection(connection)
        return _broker_connection_payload(connection)

    current_connection = get_broker_connection_status()
    existing_secret = ""
    if current_connection.id == "binance":
        existing_secret = str(current_connection.settings.get("apiSecret", ""))

    api_key = str(payload.get("apiKey", "")).strip()
    api_secret = str(payload.get("apiSecret", "")).strip() or existing_secret
    testnet = _safe_bool(payload.get("testnet", True))

    if not api_key:
        raise ValueError("apiKey is required for Binance")
    if not api_secret:
        raise ValueError("apiSecret is required for Binance")

    from src.binance_client import validate_binance_connection

    validated = validate_binance_connection(api_key, api_secret, testnet=testnet)
    connection = _configured_broker_connection(
        "binance",
        {
            "apiKey": api_key,
            "apiSecret": api_secret,
            "testnet": testnet,
        },
        account_id=validated.get("accountId"),
        status=str(validated.get("status", "connected")),
    )
    _write_broker_connection(connection)
    return _broker_connection_payload(connection)


def get_broker_connection_status() -> BrokerConnection:
    if not BROKER_CONNECTION_PATH.exists():
        return _default_broker_connection()

    with BROKER_CONNECTION_PATH.open("r", encoding="utf-8") as file:
        payload = json.load(file)

    if not isinstance(payload, dict):
        return _default_broker_connection()

    broker_id = _normalize_broker_id(payload.get("id") or payload.get("broker"))
    return BrokerConnection(
        id=broker_id,
        status=str(payload.get("status", "disconnected")),
        broker=str(
            payload.get("name") or payload.get("broker") or _broker_label(broker_id)
        ),
        settings=_legacy_settings(payload),
        account_id=payload.get("accountId"),
        synced_at=payload.get("syncedAt"),
        last_error=payload.get("lastError"),
    )


def get_ibkr_connection_status() -> BrokerConnection:
    connection = get_broker_connection_status()
    if connection.id == "ibkr":
        return connection
    return BrokerConnection(
        id="ibkr",
        status="disconnected",
        broker=_broker_label("ibkr"),
        settings={},
    )


def get_broker_connection_payload() -> dict[str, Any]:
    return _broker_connection_payload(get_broker_connection_status())


def create_paper_portfolio(payload: dict[str, Any]) -> dict[str, Any]:
    name = str(payload.get("name", "Paper Portfolio")).strip() or "Paper Portfolio"
    positions = payload.get("positions", [])
    if not isinstance(positions, list):
        raise ValueError("positions must be a list")

    records = _read_paper_portfolios()
    record = {
        "id": f"paper-{len(records) + 1}",
        "name": name,
        "status": "created",
        "positions": positions,
        "createdAt": datetime.now(UTC).isoformat(),
    }
    records.append(record)
    _write_paper_portfolios(records)
    return record


def _read_paper_portfolios() -> list[dict[str, Any]]:
    if not PAPER_PORTFOLIOS_PATH.exists():
        return []

    with PAPER_PORTFOLIOS_PATH.open("r", encoding="utf-8") as file:
        data = json.load(file)

    if not isinstance(data, list):
        raise ValueError("paper portfolio store must contain a list")
    return data


def _write_paper_portfolios(records: list[dict[str, Any]]) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with PAPER_PORTFOLIOS_PATH.open("w", encoding="utf-8") as file:
        json.dump(records, file, indent=2)
        file.write("\n")


def _broker_connection_payload(connection: BrokerConnection) -> dict[str, Any]:
    settings = _public_broker_settings(connection)
    payload = {
        "id": connection.id,
        "status": connection.status,
        "broker": connection.broker,
        "name": connection.broker,
        "settings": settings,
        "accountId": connection.account_id,
        "syncedAt": connection.synced_at,
        "lastError": connection.last_error,
    }
    for key in (
        "host",
        "port",
        "clientId",
        "market",
        "apiKey",
        "apiKeyPreview",
        "hasSecret",
        "testnet",
    ):
        if key in settings:
            payload[key] = settings[key]
    return payload


def _write_broker_connection(connection: BrokerConnection) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with BROKER_CONNECTION_PATH.open("w", encoding="utf-8") as file:
        json.dump(
            {
                "id": connection.id,
                "status": connection.status,
                "broker": connection.broker,
                "name": connection.broker,
                "settings": connection.settings,
                "accountId": connection.account_id,
                "syncedAt": connection.synced_at,
                "lastError": connection.last_error,
            },
            file,
            indent=2,
        )
        file.write("\n")


def _write_ibkr_connection(connection: BrokerConnection) -> None:
    _write_broker_connection(connection)
