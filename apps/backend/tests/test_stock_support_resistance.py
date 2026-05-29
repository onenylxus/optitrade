"""Pivot-cluster support / resistance calculator and SR route."""

import pytest
from fastapi.testclient import TestClient

from src.api.deps import get_stock_chart_service
from src.api.schemas.stock_chart import (
    ChartCandle,
    StockChartParams,
    StockChartResponse,
)
from src.rest_server import create_app
from src.services.stock_support_resistance import compute_support_resistance


def _daily_candles(days: list[tuple[float, float, float, float]]) -> list[ChartCandle]:
    out: list[ChartCandle] = []
    for idx, (o, hi, lo, c) in enumerate(days, start=1):
        out.append(
            ChartCandle(
                date=f"2024-01-{idx + 10:02d}",
                open=o,
                high=hi,
                low=lo,
                close=c,
                volume=1000 + idx,
            )
        )
    return out


def test_compute_sr_returns_below_above_last_close_when_enough_history():
    # Choppy uptrend ending near local top
    zig = []
    price = 100.0
    for _ in range(30):
        zig.append((price, price + 3, price - 1.5, price + 2))
        price += 0.8
        zig.append((price, price + 3, price - 1.5, price + 2))
        price += -0.3
        zig.append((price, price + 3, price - 2, price + 2.5))
        price += 1.5
        zig.append((price, price + 3, price - 1, price))
        price += -0.2
    cans = _daily_candles(zig)
    last = cans[-1].close
    s, r = compute_support_resistance(cans)
    assert s is not None and r is not None
    assert s < last < r


class _SrFakeStockChartService:
    """Returns enough candles for pivot logic without calling FMP."""

    async def fetch_chart(self, params: StockChartParams):
        zig = []
        price = 200.0
        for _ in range(20):
            zig.append((price, price + 6, price - 3, price + 4))
            price += 1.8
            zig.append((price, price + 6, price - 3.5, price + 5))
            price += -0.5
        cans = [
            ChartCandle(
                date=f"2024-02-{i + 1:02d}",
                open=o,
                high=hi,
                low=lo,
                close=c,
                volume=float(i),
            )
            for i, (o, hi, lo, c) in enumerate(zig[:40])
        ]
        return StockChartResponse(
            symbol=params.symbol,
            interval=params.interval,
            chart_range=params.chart_range,
            from_=params.date_from,
            to=params.date_to,
            candles=cans,
        )


@pytest.fixture
def client_sr_override():
    app = create_app()
    app.dependency_overrides[get_stock_chart_service] = lambda: (
        _SrFakeStockChartService()
    )
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def test_sr_widget_endpoint_aliases(client_sr_override):
    r = client_sr_override.get(
        "/api/ai/widget/stock-chart/support-resistance",
        params={"symbol": "AAPL", "interval": "1day", "range": "1M"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["symbol"] == "AAPL"
    assert body["interval"] == "1day"
    assert "support" in body and "resistance" in body
    assert body["method"] == "pivot_clusters"
    assert isinstance(body["support"], (float, type(None)))
    assert isinstance(body["resistance"], (float, type(None)))
