"""Portfolio snapshot domain logic for the dashboard widget."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import UTC, datetime
import json
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


def _round_money(value: float) -> float:
    return round(value, 2)


def _round_percent(value: float) -> float:
    return round(value, 4)


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
    total_value = sum(position.market_value for position in positions)
    total_cost = sum(position.cost_basis for position in positions)
    pnl = total_value - total_cost
    pnl_percent = (pnl / total_cost) * 100 if total_cost else 0.0

    daily_pnl_percent = 1.2
    daily_pnl = total_value * daily_pnl_percent / 100

    return {
        "asOf": datetime.now(UTC).isoformat(),
        "baseCurrency": "USD",
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
    host = str(payload.get("host", "127.0.0.1")).strip() or "127.0.0.1"
    port = int(payload.get("port", 7497))

    if not 1 <= port <= 65535:
        raise ValueError("port must be between 1 and 65535")

    return {
        "status": "connected",
        "broker": "IBKR",
        "host": host,
        "port": port,
        "accountId": "DU1234567",
        "syncedAt": datetime.now(UTC).isoformat(),
    }


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
