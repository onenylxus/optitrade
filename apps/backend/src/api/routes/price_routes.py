"""Live price HTTP routes — used by the prediction widget.

Supports both path-style (``/api/price/SPY``) and query-style
(``/api/price/price?symbol=SPY``) so the front-end can hit either shape.
Primary source: FMP ``/stable/quote``. Falls back to yfinance if FMP fails.
"""

from __future__ import annotations

import asyncio
import logging
import os
import time
from typing import Optional, Tuple

import httpx
from fastapi import APIRouter, Query
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter()

_CACHE: dict[str, Tuple["PriceResponse", float]] = {}
_CACHE_TTL_S = 30.0


class PriceResponse(BaseModel):
    symbol: str
    price: float
    prev_close: Optional[float] = None
    volume: Optional[int] = None
    source: str = "unknown"


def _fmp_quote_url(symbol: str, api_key: str) -> str:
    return (
        f"https://financialmodelingprep.com/stable/quote"
        f"?symbol={symbol}&apikey={api_key}"
    )


async def _fetch_fmp(symbol: str, api_key: str) -> Optional[PriceResponse]:
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(_fmp_quote_url(symbol, api_key))
            if r.status_code != 200:
                logger.debug("FMP %s -> HTTP %s", symbol, r.status_code)
                return None
            data = r.json()
            if not isinstance(data, list) or not data:
                return None
            row = data[0]
            price = float(row.get("price") or 0)
            if price <= 0:
                return None
            return PriceResponse(
                symbol=symbol.upper(),
                price=round(price, 4),
                prev_close=(
                    round(float(row["previousClose"]), 4)
                    if row.get("previousClose") is not None
                    else None
                ),
                volume=int(row["volume"]) if row.get("volume") is not None else None,
                source="fmp",
            )
    except Exception as exc:  # noqa: BLE001
        logger.debug("FMP quote fetch failed for %s: %s", symbol, exc)
        return None


def _fetch_yfinance(symbol: str) -> Optional[PriceResponse]:
    try:
        import yfinance as yf  # type: ignore

        tk = yf.Ticker(symbol)
        info = tk.fast_info
        price = float(info.last_price) if info.last_price else 0.0
        if price <= 0:
            return None
        return PriceResponse(
            symbol=symbol,
            price=round(price, 4),
            prev_close=(
                round(float(info.previous_close), 4)
                if info.previous_close
                else None
            ),
            volume=int(info.last_volume) if info.last_volume else None,
            source="yfinance",
        )
    except Exception as exc:  # noqa: BLE001
        logger.debug("yfinance fetch failed for %s: %s", symbol, exc)
        return None


async def _resolve_price(symbol: str) -> PriceResponse:
    key = symbol.upper()
    cached = _CACHE.get(key)
    if cached and (time.time() - cached[1]) < _CACHE_TTL_S:
        return cached[0]

    fmp_key = os.environ.get("FMP_API_KEY", "").strip()
    if fmp_key:
        resp = await _fetch_fmp(key, fmp_key)
        if resp is not None:
            _CACHE[key] = (resp, time.time())
            return resp

    resp = await asyncio.to_thread(_fetch_yfinance, key)
    if resp is not None:
        _CACHE[key] = (resp, time.time())
        return resp

    empty = PriceResponse(symbol=key, price=0.0, prev_close=None, volume=None, source="none")
    _CACHE[key] = (empty, time.time())
    return empty


@router.get("/price", response_model=PriceResponse)
async def get_price_query(symbol: str = Query(min_length=1, max_length=10)):
    return await _resolve_price(symbol.upper())


@router.get("/{symbol:path}", response_model=PriceResponse)
async def get_price_path(symbol: str):
    if not symbol or len(symbol) > 12:
        return PriceResponse(
            symbol=symbol.upper(),
            price=0.0,
            prev_close=None,
            volume=None,
            source="invalid",
        )
    return await _resolve_price(symbol.upper())