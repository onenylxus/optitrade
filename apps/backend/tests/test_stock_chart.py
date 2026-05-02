"""Tests for stock chart routing, resolution, and FMP service wiring."""

from datetime import date

import pytest
from fastapi.testclient import TestClient

from src.api.deps import get_stock_chart_service
from src.api.schemas.stock_chart import (
    ChartCandle,
    ChartInterval,
    ChartRange,
    StockChartParams,
)
from src.rest_server import create_app
from src.services.stock_chart_service import (
    StockChartService,
    resolve_stock_chart_params,
)


def test_resolve_explicit_from_to_ignores_range():
    p = resolve_stock_chart_params(
        symbol="aapl",
        interval=ChartInterval.DAY_1,
        chart_range=ChartRange.YEAR_5,
        from_date=date(2024, 1, 2),
        to_date=date(2024, 2, 1),
    )
    assert p.symbol == "AAPL"
    assert p.date_from == date(2024, 1, 2)
    assert p.date_to == date(2024, 2, 1)
    assert p.chart_range is None


def test_resolve_ytd():
    p = resolve_stock_chart_params(
        symbol="MSFT",
        interval=ChartInterval.MIN_1,
        chart_range=ChartRange.YTD,
        from_date=None,
        to_date=date(2026, 5, 2),
    )
    assert p.date_from == date(2026, 1, 1)
    assert p.date_to == date(2026, 5, 2)
    assert p.chart_range == ChartRange.YTD


def test_resolve_from_without_to():
    p = resolve_stock_chart_params(
        symbol="x",
        interval=ChartInterval.DAY_1,
        chart_range=None,
        from_date=date(2024, 6, 1),
        to_date=None,
    )
    assert p.date_from == date(2024, 6, 1)
    assert p.date_to == date.today()


def test_resolve_rejects_inverted_range():
    with pytest.raises(ValueError, match="from"):
        resolve_stock_chart_params(
            symbol="x",
            interval=ChartInterval.DAY_1,
            chart_range=None,
            from_date=date(2025, 1, 2),
            to_date=date(2025, 1, 1),
        )


class _FakeStockChartService:
    """Returns a canned response; mimics :meth:`StockChartService.fetch_chart`."""

    async def fetch_chart(self, params: StockChartParams):
        from src.api.schemas.stock_chart import StockChartResponse

        return StockChartResponse(
            symbol=params.symbol,
            interval=params.interval,
            chart_range=params.chart_range,
            from_=params.date_from,
            to=params.date_to,
            candles=[
                ChartCandle(
                    date="2024-01-02",
                    open=1,
                    high=2,
                    low=0.5,
                    close=1.5,
                    volume=100,
                )
            ],
        )


@pytest.fixture
def client_stock_override():
    app = create_app()
    app.dependency_overrides[get_stock_chart_service] = lambda: _FakeStockChartService()
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def test_stock_chart_endpoint_json_aliases(client_stock_override):
    r = client_stock_override.get(
        "/api/stock/chart",
        params={"symbol": "AAPL", "interval": "1day", "range": "1M"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["symbol"] == "AAPL"
    assert body["interval"] == "1day"
    assert body["range"] == "1M"
    assert "from" in body and "to" in body
    assert len(body["candles"]) == 1
    assert body["candles"][0]["close"] == 1.5


def test_stock_chart_requires_fmp_key_without_override(monkeypatch):
    monkeypatch.delenv("FMP_API_KEY", raising=False)
    app = create_app()
    with TestClient(app) as c:
        r = c.get("/api/stock/chart", params={"symbol": "AAPL", "interval": "1day"})
    assert r.status_code == 503


@pytest.mark.asyncio
async def test_stock_chart_service_parses_fmp_list(monkeypatch):
    captured: dict[str, str] = {}

    class _Resp:
        def raise_for_status(self) -> None:
            return None

        def json(self):
            return [
                {
                    "date": "2024-01-03",
                    "open": 10,
                    "high": 11,
                    "low": 9,
                    "close": 10.5,
                    "volume": 1000,
                },
                {
                    "date": "2024-01-02",
                    "open": 9,
                    "high": 10,
                    "low": 8,
                    "close": 9.5,
                    "volume": 900,
                },
            ]

    class _Client:
        async def get(self, url: str):
            captured["url"] = url
            return _Resp()

    class _CM:
        def __init__(self, *a, **k):
            pass

        async def __aenter__(self):
            return _Client()

        async def __aexit__(self, *exc):
            return None

    monkeypatch.setattr("src.services.stock_chart_service.httpx.AsyncClient", _CM)

    svc = StockChartService(api_key="test-key")
    params = StockChartParams(
        symbol="AAPL",
        interval=ChartInterval.DAY_1,
        date_from=date(2024, 1, 1),
        date_to=date(2024, 1, 31),
        chart_range=ChartRange.MONTH_1,
    )
    out = await svc.fetch_chart(params)
    assert "historical-price-eod/full" in captured["url"]
    assert "apikey=test-key" in captured["url"]
    assert [c.date for c in out.candles] == ["2024-01-02", "2024-01-03"]
    assert out.candles[0].open == 9.0
