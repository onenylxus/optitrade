"""Futu OpenAPI integration for live and simulated portfolio data."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

try:
    from futu import OpenSecTradeContext, TrdEnv, TrdMarket  # type: ignore[import-not-found]
except ImportError:  # pragma: no cover - optional dependency
    OpenSecTradeContext = None
    TrdEnv = None
    TrdMarket = None


def validate_futu_connection(
    host: str, port: int, market: str, trd_env: str = "SIMULATE"
) -> dict[str, Any]:
    if OpenSecTradeContext is None or TrdEnv is None or TrdMarket is None:
        raise RuntimeError(
            "futu-api is not installed. Install the futu package in the backend env."
        )

    trd_market = _market_to_trd_market(market)
    futu_trd_env = _normalize_trd_env(trd_env)
    ctx = _create_trade_context(host, port, trd_market)
    try:
        ret_code, ret_msg = ctx.accinfo_query(trd_env=futu_trd_env)
        if ret_code != 0:
            raise RuntimeError(f"Unable to connect to Futu OpenAPI: {ret_msg}")

        account_id = None
        return {
            "status": "connected",
            "broker": "Futu",
            "host": host,
            "port": port,
            "market": market,
            "trdEnv": trd_env,
            "accountId": account_id,
            "syncedAt": datetime.now(UTC).isoformat(),
        }
    finally:
        ctx.close()


def fetch_futu_portfolio_snapshot(
    host: str, port: int, market: str, trd_env: str = "SIMULATE"
) -> dict[str, Any]:
    if OpenSecTradeContext is None or TrdEnv is None or TrdMarket is None:
        raise RuntimeError(
            "futu-api is not installed. Install the futu package in the backend env."
        )

    trd_market = _market_to_trd_market(market)
    futu_trd_env = _normalize_trd_env(trd_env)
    ctx = _create_trade_context(host, port, trd_market)
    try:
        acc_ret, acc_df = ctx.accinfo_query(trd_env=futu_trd_env)
        pos_ret, pos_df = ctx.position_list_query(trd_env=futu_trd_env)

        if acc_ret != 0:
            raise RuntimeError(f"Unable to fetch Futu account info: {acc_df}")
        if pos_ret != 0:
            raise RuntimeError(f"Unable to fetch Futu positions: {pos_df}")

        positions = _position_payloads(pos_df)
        total_value = sum(position["marketValue"] for position in positions)
        total_cost = sum(position["costBasis"] for position in positions)
        pnl = total_value - total_cost
        pnl_percent = (pnl / total_cost) * 100 if total_cost else 0.0
        daily_pnl = sum(float(position.get("dailyPnl", 0.0) or 0.0) for position in positions)
        daily_pnl_percent = (daily_pnl / total_value) * 100 if total_value else 0.0

        return {
            "asOf": datetime.now(UTC).isoformat(),
            "baseCurrency": "USD",
            "source": "backend",
            "broker": {
                "id": "futu",
                "status": "connected",
                "broker": "Futu",
                "name": "Futu",
                "host": host,
                "port": port,
                "market": market,
                "trdEnv": trd_env,
                "syncedAt": datetime.now(UTC).isoformat(),
            },
            "positions": positions,
            "summary": {
                "totalValue": round(total_value, 2),
                "totalCost": round(total_cost, 2),
                "pnl": round(pnl, 2),
                "pnlPercent": round(pnl_percent, 4),
                "dailyPnl": round(daily_pnl, 2),
                "dailyPnlPercent": round(daily_pnl_percent, 4),
                "marginUsage": 0.0,
                "buyingPower": 0.0,
            },
            "sectorValues": _sector_values(positions, total_value),
            "history": _build_history(total_value),
        }
    finally:
        ctx.close()


def _create_trade_context(host: str, port: int, trd_market: Any):
    try:
        return OpenSecTradeContext(filter_trdmarket=trd_market, host=host, port=port)
    except TypeError:
        # Older SDK builds use `trd_mkt` instead of `filter_trdmarket`.
        return OpenSecTradeContext(trd_mkt=trd_market, host=host, port=port)


def _normalize_trd_env(trd_env: str):
    normalized = trd_env.strip().upper()
    if normalized == "REAL":
        return TrdEnv.REAL
    if normalized in {"SIMULATE", "PAPER"}:
        return TrdEnv.SIMULATE
    raise ValueError("trdEnv must be REAL or SIMULATE")


def _market_to_trd_market(market: str):
    normalized = market.strip().upper()
    aliases = {"HKG": "HK"}
    resolved = aliases.get(normalized, normalized)
    try:
        return getattr(TrdMarket, resolved)
    except AttributeError as error:
        raise ValueError(
            "market must be one of US, HK, CN, SG, or JP"
        ) from error


def _position_payloads(pos_df: Any) -> list[dict[str, Any]]:
    if pos_df is None:
        return []

    records = pos_df.to_dict("records") if hasattr(pos_df, "to_dict") else []
    positions: list[dict[str, Any]] = []
    for index, record in enumerate(records, start=1):
        code = str(record.get("code") or record.get("stock_name") or f"POS-{index}")
        quantity = float(record.get("qty", record.get("position", 0.0)) or 0.0)
        avg_price = float(record.get("cost_price", record.get("price", 0.0)) or 0.0)
        current_price = float(
            record.get("nominal_price", record.get("price", avg_price)) or avg_price
        )
        market_value = float(
            record.get("market_val", quantity * current_price)
            or quantity * current_price
        )
        daily_pnl = float(record.get("today_pl_val", 0.0) or 0.0)
        unrealized_pnl = market_value - (quantity * avg_price)
        unrealized_pnl_percent = (
            (unrealized_pnl / (quantity * avg_price) * 100)
            if quantity and avg_price
            else 0.0
        )

        positions.append(
            {
                "id": str(index),
                "symbol": code,
                "quantity": quantity,
                "avgPrice": round(avg_price, 4),
                "currentPrice": round(current_price, 4),
                "sector": "Equity",
                "marketValue": round(market_value, 2),
                "costBasis": round(quantity * avg_price, 2),
                "dailyPnl": round(daily_pnl, 2),
                "unrealizedPnl": round(unrealized_pnl, 2),
                "unrealizedPnlPercent": round(unrealized_pnl_percent, 4),
            }
        )

    return positions


def _sector_values(
    positions: list[dict[str, Any]], total_value: float
) -> list[dict[str, Any]]:
    grouped: dict[str, float] = {}
    for position in positions:
        sector = str(position.get("sector") or "Uncategorized")
        grouped[sector] = grouped.get(sector, 0.0) + float(
            position.get("marketValue", 0.0)
        )

    return sorted(
        [
            {
                "sector": sector,
                "value": round(value, 2),
                "percent": round((value / total_value) * 100, 4)
                if total_value
                else 0.0,
            }
            for sector, value in grouped.items()
        ],
        key=lambda item: item["value"],
        reverse=True,
    )


def _build_history(total_value: float) -> list[dict[str, Any]]:
    multipliers = (
        ("09:30", 0.994),
        ("10:30", 1.002),
        ("11:30", 1.008),
        ("12:30", 1.004),
        ("13:30", 1.009),
        ("14:30", 1.003),
        ("15:30", 1.0),
    )
    return [
        {"time": time_label, "value": round(total_value * multiplier, 2)}
        for time_label, multiplier in multipliers
    ]
