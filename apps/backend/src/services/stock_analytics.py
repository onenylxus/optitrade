"""Deterministic momentum and indicator math from OHLC closes."""

from __future__ import annotations

from src.api.schemas.ai_stock_chart import MomentumSnapshot, TechnicalSnapshot
from src.api.schemas.stock_chart import ChartCandle


def _closes(candles: list[ChartCandle]) -> list[float]:
    return [float(c.close) for c in candles]


def _sma_last(values: list[float], period: int) -> float | None:
    if len(values) < period:
        return None
    window = values[-period:]
    return sum(window) / period


def rsi_14_wilder(closes: list[float], period: int = 14) -> float | None:
    """
    Wilder-smoothed RSI on ``closes`` (last value).

    Requires at least ``period + 1`` closes.
    """
    if len(closes) < period + 1:
        return None
    deltas: list[float] = []
    for i in range(1, len(closes)):
        deltas.append(closes[i] - closes[i - 1])
    gains = [d if d > 0 else 0.0 for d in deltas]
    losses = [-d if d < 0 else 0.0 for d in deltas]
    avg_gain = sum(gains[:period]) / period
    avg_loss = sum(losses[:period]) / period
    for i in range(period, len(gains)):
        avg_gain = (avg_gain * (period - 1) + gains[i]) / period
        avg_loss = (avg_loss * (period - 1) + losses[i]) / period
    if avg_loss == 0:
        return 100.0 if avg_gain > 0 else 50.0
    rs = avg_gain / avg_loss
    return 100.0 - (100.0 / (1.0 + rs))


def pct_change_last_n(closes: list[float], n: int) -> float | None:
    """Percent change from close ``n`` bars ago to last close."""
    if len(closes) < n + 1 or n < 1:
        return None
    old = closes[-(n + 1)]
    if old == 0:
        return None
    new = closes[-1]
    return (new - old) / old * 100.0


def build_momentum_snapshot(candles: list[ChartCandle]) -> MomentumSnapshot:
    closes = _closes(candles)
    if len(closes) < 2:
        return MomentumSnapshot()
    one = closes[-2]
    last = closes[-1]
    r1 = None if one == 0 else (last - one) / one * 100.0
    return MomentumSnapshot(
        return_pct_1_bar=r1,
        return_pct_5_bar=pct_change_last_n(closes, 5),
        return_pct_20_bar=pct_change_last_n(closes, 20),
    )


def build_technical_snapshot(candles: list[ChartCandle]) -> TechnicalSnapshot:
    closes = _closes(candles)
    sma20 = _sma_last(closes, 20)
    sma50 = _sma_last(closes, 50)
    rsi = rsi_14_wilder(closes, 14)
    last = closes[-1] if closes else None
    vs20 = None
    if last is not None and sma20 not in (None, 0):
        vs20 = (last - sma20) / sma20 * 100.0
    return TechnicalSnapshot(
        rsi_14=rsi,
        sma_20=sma20,
        sma_50=sma50,
        last_close_vs_sma20_pct=vs20,
    )
