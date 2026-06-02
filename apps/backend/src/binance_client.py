"""Binance spot account integration for live portfolio data."""

from __future__ import annotations

import hashlib
import hmac
from datetime import UTC, datetime
from typing import Any
from urllib.parse import urlencode

import requests

BINANCE_API_URLS = {
    True: "https://testnet.binance.vision",
    False: "https://api.binance.com",
}

STABLE_QUOTES = ("USDT", "USDC", "FDUSD", "BUSD")


def fetch_binance_portfolio_snapshot(
    *,
    api_key: str,
    api_secret: str,
    testnet: bool,
) -> dict[str, Any]:
    server_time = _binance_server_time(testnet)
    account = _signed_get(
        "/api/v3/account",
        api_key=api_key,
        api_secret=api_secret,
        testnet=testnet,
        params={"timestamp": server_time},
    )
    all_prices = _public_get("/api/v3/ticker/price", testnet=testnet)

    price_map = {
        str(item.get("symbol")): float(item.get("price", 0.0))
        for item in all_prices
        if item.get("symbol") and item.get("price") is not None
    }

    base_currency = "USD"
    positions: list[dict[str, Any]] = []

    for index, balance in enumerate(account.get("balances", []), start=1):
        asset = str(balance.get("asset", "")).upper()
        free = float(balance.get("free", 0.0))
        locked = float(balance.get("locked", 0.0))
        quantity = free + locked
        if quantity <= 0:
            continue

        current_price = _asset_price_usd(asset, price_map)
        if current_price <= 0 and asset not in STABLE_QUOTES:
            continue

        positions.append(
            _position_payload(
                index=index,
                asset=asset,
                quantity=quantity,
                current_price=current_price,
            )
        )

    total_value = sum(position["marketValue"] for position in positions)
    total_cost = sum(position["costBasis"] for position in positions)
    pnl = total_value - total_cost
    pnl_percent = (pnl / total_cost) * 100 if total_cost else 0.0

    return {
        "asOf": datetime.now(UTC).isoformat(),
        "baseCurrency": base_currency,
        "source": "backend",
        "broker": {
            "id": "binance",
            "status": "connected",
            "broker": "Binance",
            "name": "Binance",
            "testnet": testnet,
            "syncedAt": datetime.now(UTC).isoformat(),
        },
        "positions": positions,
        "summary": {
            "totalValue": round(total_value, 2),
            "totalCost": round(total_cost, 2),
            "pnl": round(pnl, 2),
            "pnlPercent": round(pnl_percent, 4),
            "dailyPnl": 0.0,
            "dailyPnlPercent": 0.0,
            "marginUsage": 0.0,
            "buyingPower": round(total_value, 2),
        },
        "sectorValues": _sector_values(positions, total_value),
        "history": _build_history(total_value),
    }


def validate_binance_connection(
    api_key: str,
    api_secret: str,
    *,
    testnet: bool,
) -> dict[str, Any]:
    account = _signed_get(
        "/api/v3/account",
        api_key=api_key,
        api_secret=api_secret,
        testnet=testnet,
        params={"timestamp": _binance_server_time(testnet)},
    )
    can_trade = bool(account.get("canTrade", False))

    return {
        "status": "connected",
        "broker": "Binance",
        "testnet": testnet,
        "accountId": str(account.get("uid") or ""),
        "canTrade": can_trade,
        "syncedAt": datetime.now(UTC).isoformat(),
    }


def _public_get(path: str, *, testnet: bool) -> list[dict[str, Any]]:
    try:
        response = requests.get(f"{BINANCE_API_URLS[testnet]}{path}", timeout=5)
        payload = response.json()
    except requests.RequestException as error:
        raise RuntimeError(f"Unable to reach Binance API: {error}") from error
    except ValueError as error:
        raise RuntimeError("Unable to parse Binance response") from error

    if response.status_code != 200:
        message = str(payload.get("msg") or payload.get("message") or response.text)
        raise RuntimeError(f"Unable to reach Binance: {message}")

    if not isinstance(payload, list):
        raise RuntimeError("Unexpected Binance market data response")
    return payload


def _signed_get(
    path: str,
    *,
    api_key: str,
    api_secret: str,
    testnet: bool,
    params: dict[str, Any],
) -> dict[str, Any]:
    encoded = urlencode(params)
    signature = hmac.new(
        api_secret.encode("utf-8"),
        encoded.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    url = f"{BINANCE_API_URLS[testnet]}{path}?{encoded}&signature={signature}"

    try:
        response = requests.get(
            url,
            headers={"X-MBX-APIKEY": api_key},
            timeout=5,
        )
        payload = response.json()
    except requests.RequestException as error:
        raise RuntimeError(f"Unable to reach Binance API: {error}") from error
    except ValueError as error:
        raise RuntimeError("Unable to parse Binance validation response") from error

    if response.status_code != 200:
        message = str(payload.get("msg") or payload.get("message") or response.text)
        raise RuntimeError(f"Unable to validate Binance API credentials: {message}")

    if not isinstance(payload, dict):
        raise RuntimeError("Unexpected Binance account response")
    return payload


def _binance_server_time(testnet: bool) -> int:
    try:
        response = requests.get(f"{BINANCE_API_URLS[testnet]}/api/v3/time", timeout=5)
        payload = response.json()
    except requests.RequestException as error:
        raise RuntimeError(f"Unable to reach Binance API: {error}") from error
    except ValueError as error:
        raise RuntimeError("Unable to parse Binance server time response") from error

    if response.status_code != 200:
        message = str(payload.get("msg") or payload.get("message") or response.text)
        raise RuntimeError(f"Unable to reach Binance: {message}")

    try:
        return int(payload["serverTime"])
    except (KeyError, TypeError, ValueError) as error:
        raise RuntimeError(
            "Binance time response did not include serverTime"
        ) from error


def _asset_price_usd(asset: str, price_map: dict[str, float]) -> float:
    if asset in STABLE_QUOTES:
        return 1.0

    for quote in STABLE_QUOTES:
        direct_symbol = f"{asset}{quote}"
        if direct_symbol in price_map:
            return float(price_map[direct_symbol])

    return 0.0


def _position_payload(
    *,
    index: int,
    asset: str,
    quantity: float,
    current_price: float,
) -> dict[str, Any]:
    market_value = quantity * current_price
    return {
        "id": str(index),
        "symbol": asset,
        "quantity": round(quantity, 8),
        "avgPrice": round(current_price, 8),
        "currentPrice": round(current_price, 8),
        "sector": "Crypto Spot",
        "marketValue": round(market_value, 2),
        "costBasis": round(market_value, 2),
        "unrealizedPnl": 0.0,
        "unrealizedPnlPercent": 0.0,
    }


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
        ("09:30", 0.996),
        ("10:30", 1.004),
        ("11:30", 1.011),
        ("12:30", 1.006),
        ("13:30", 1.009),
        ("14:30", 1.003),
        ("15:30", 1.0),
    )
    return [
        {"time": time_label, "value": round(total_value * multiplier, 2)}
        for time_label, multiplier in multipliers
    ]
