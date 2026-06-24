"""Simple stock price HTTP routes — used by the prediction widget."""

import yfinance as yf
from fastapi import APIRouter, Query
from pydantic import BaseModel

router = APIRouter()


class PriceResponse(BaseModel):
    symbol: str
    price: float
    prev_close: float | None
    volume: int | None


@router.get("/price", response_model=PriceResponse)
async def get_price(symbol: str = Query(min_length=1, max_length=10)):
    try:
        tk = yf.Ticker(symbol)
        info = tk.fast_info
        return PriceResponse(
            symbol=symbol.upper(),
            price=round(float(info.last_price), 4),
            prev_close=round(float(info.previous_close), 4) if info.previous_close else None,
            volume=int(info.last_volume) if info.last_volume else None,
        )
    except Exception as e:
        return PriceResponse(symbol=symbol.upper(), price=0.0, prev_close=None, volume=None)
