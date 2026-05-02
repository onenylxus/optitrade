"""Tests for AI stock-chart widget, analytics, and route wiring."""

import pytest
from fastapi.testclient import TestClient

from src.api.deps import get_stock_chart_analysis_service
from src.api.schemas.stock_chart import ChartCandle, StockChartParams
from src.rest_server import create_app
from src.services.stock_analytics import (
    build_momentum_snapshot,
    build_technical_snapshot,
    rsi_14_wilder,
)
from src.services.stock_chart_analysis_service import StockChartAnalysisService


def test_rsi_14_known_trending_series():
    # Synthetic uptrend: RSI should stay elevated (not NaN)
    closes = [float(x) for x in range(1, 30)]
    rsi = rsi_14_wilder(closes, 14)
    assert rsi is not None
    assert 50 < rsi <= 100


def test_momentum_and_technical_from_candles():
    candles = [
        ChartCandle(
            date=f"2024-01-{i:02d}",
            open=100 + i,
            high=102 + i,
            low=99 + i,
            close=101 + i,
            volume=1e6,
        )
        for i in range(1, 25)
    ]
    m = build_momentum_snapshot(candles)
    assert m.return_pct_1_bar is not None
    t = build_technical_snapshot(candles)
    assert t.sma_20 is not None


class _FakeStockChartService:
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
                    open=10,
                    high=11,
                    low=9,
                    close=10.5,
                    volume=1000,
                ),
                ChartCandle(
                    date="2024-01-03",
                    open=10.5,
                    high=11.5,
                    low=10,
                    close=11,
                    volume=1100,
                ),
            ],
        )


class _FakeAnalysisService(StockChartAnalysisService):
    """Avoid network; return canned analysis."""

    def __init__(self) -> None:
        super().__init__(
            _FakeStockChartService(),
            openrouter_api_key="dummy",
            openrouter_model="test/model",
        )

    async def analyze(self, params: StockChartParams):
        from src.api.schemas.ai_stock_chart import StockChartAnalysisResponse
        from src.services.stock_analytics import (
            build_momentum_snapshot,
            build_technical_snapshot,
        )

        chart = await self._charts.fetch_chart(params)
        mom = build_momentum_snapshot(chart.candles)
        tech = build_technical_snapshot(chart.candles)
        return StockChartAnalysisResponse(
            symbol=chart.symbol,
            interval=chart.interval,
            chart_range=chart.chart_range,
            from_=chart.from_,
            to=chart.to,
            momentum=mom,
            technical=tech,
            analysis="Overview: synthetic. Not investment advice.",
            model_id="test/model",
        )


@pytest.fixture
def client_ai_override():
    app = create_app()
    app.dependency_overrides[get_stock_chart_analysis_service] = (
        lambda: _FakeAnalysisService()
    )
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def test_api_ai_index():
    app = create_app()
    with TestClient(app) as c:
        r = c.get("/api/ai")
    assert r.status_code == 200
    body = r.json()
    assert body["service"] == "optitrade-ai"
    assert any(w["path"] == "/widget/stock-chart" for w in body["widgets"])


def test_ai_widget_stock_chart_json_aliases(client_ai_override):
    r = client_ai_override.get(
        "/api/ai/widget/stock-chart",
        params={"symbol": "AAPL", "interval": "1day", "range": "1M"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["symbol"] == "AAPL"
    assert body["interval"] == "1day"
    assert "momentum" in body and "technical" in body
    assert "analysis" in body
    assert body["model_id"] == "test/model"


def test_ai_widget_requires_openrouter_without_override(monkeypatch):
    monkeypatch.setenv("FMP_API_KEY", "x")
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    app = create_app()
    with TestClient(app) as c:
        r = c.get(
            "/api/ai/widget/stock-chart",
            params={"symbol": "AAPL", "interval": "1day"},
        )
    assert r.status_code == 503
