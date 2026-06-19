"""Chart-pattern detector and widget route tests."""

import pytest
from fastapi.testclient import TestClient

from src.api.deps import get_stock_chart_service
from src.api.schemas.stock_chart import (
    ChartCandle,
    StockChartParams,
    StockChartResponse,
)
from src.rest_server import create_app
from src.services.stock_pattern_detection import detect_chart_patterns


def _daily_candles(days: list[tuple[float, float, float, float]]) -> list[ChartCandle]:
    return [
        ChartCandle(
            date=f"2024-03-{idx + 1:02d}",
            open=o,
            high=hi,
            low=lo,
            close=c,
            volume=1000 + idx,
        )
        for idx, (o, hi, lo, c) in enumerate(days)
    ]


def _double_top_candles() -> list[ChartCandle]:
    return _daily_candles(
        [
            (100, 101, 99, 100),
            (100, 103, 99, 102),
            (102, 105, 101, 104),
            (104, 108, 103, 107),
            (107, 111, 106, 110),
            (110, 120, 111, 118),
            (118, 114, 108, 110),
            (110, 111, 104, 105),
            (105, 108, 100, 102),
            (102, 111, 103, 108),
            (108, 115, 107, 112),
            (112, 119, 111, 116),
            (116, 121, 113, 119),
            (119, 116, 108, 110),
            (110, 110, 101, 102),
            (102, 103, 96, 98),
            (98, 101, 95, 97),
        ]
    )


def _head_and_shoulders_candles() -> list[ChartCandle]:
    return _daily_candles(
        [
            (100, 102, 99, 101),
            (101, 105, 100, 104),
            (104, 112, 103, 110),
            (110, 118, 108, 116),
            (116, 115, 107, 109),
            (109, 110, 101, 103),
            (103, 112, 102, 111),
            (111, 123, 110, 121),
            (121, 127, 119, 125),
            (125, 121, 113, 116),
            (116, 114, 104, 106),
            (106, 111, 105, 110),
            (110, 117, 108, 115),
            (115, 119, 112, 116),
            (116, 113, 105, 107),
            (107, 109, 99, 101),
            (101, 104, 96, 98),
        ]
    )


def _inverse_head_and_shoulders_candles() -> list[ChartCandle]:
    return _daily_candles(
        [
            (130, 132, 128, 129),
            (129, 130, 123, 125),
            (125, 126, 116, 118),
            (118, 121, 113, 115),
            (115, 124, 114, 122),
            (122, 130, 121, 128),
            (128, 125, 114, 116),
            (116, 118, 105, 108),
            (108, 111, 99, 102),
            (102, 114, 101, 112),
            (112, 128, 111, 126),
            (126, 124, 115, 117),
            (117, 119, 111, 114),
            (114, 123, 113, 121),
            (121, 132, 120, 130),
            (130, 135, 128, 133),
            (133, 136, 131, 135),
        ]
    )


def _flag_candles() -> list[ChartCandle]:
    return _daily_candles(
        [
            (100, 102, 99, 101),
            (101, 105, 100, 104),
            (104, 109, 103, 108),
            (108, 114, 107, 113),
            (113, 121, 112, 120),
            (120, 129, 119, 128),
            (128, 136, 127, 134),
            (134, 135, 129, 131),
            (131, 133, 127, 129),
            (129, 131, 126, 128),
            (128, 130, 124, 126),
            (126, 129, 123, 125),
            (125, 128, 122, 124),
        ]
    )


def _pennant_candles() -> list[ChartCandle]:
    return _daily_candles(
        [
            (80, 82, 79, 81),
            (81, 86, 80, 85),
            (85, 92, 84, 91),
            (91, 100, 90, 99),
            (99, 111, 98, 109),
            (109, 120, 108, 118),
            (118, 119, 108, 113),
            (113, 117, 110, 114),
            (114, 116, 111, 114),
            (114, 115, 112, 114),
            (114, 114.5, 112.5, 113.5),
            (113.5, 114, 113, 113.5),
        ]
    )


def _cup_and_handle_candles() -> list[ChartCandle]:
    return _daily_candles(
        [
            (100, 105, 99, 104),
            (104, 112, 103, 110),
            (110, 121, 109, 119),
            (119, 118, 108, 110),
            (110, 112, 101, 103),
            (103, 106, 95, 97),
            (97, 102, 92, 95),
            (95, 103, 94, 101),
            (101, 111, 100, 109),
            (109, 120, 108, 118),
            (118, 122, 116, 120),
            (120, 119, 112, 114),
            (114, 117, 110, 113),
            (113, 119, 112, 118),
            (118, 124, 117, 123),
        ]
    )


def _pattern_types(candles: list[ChartCandle]) -> set[str]:
    return {p.pattern_type for p in detect_chart_patterns(candles, max_patterns=8)}


def test_detect_chart_patterns_finds_confirmed_double_top():
    patterns = detect_chart_patterns(_double_top_candles())

    assert patterns
    top = patterns[0]
    assert top.pattern_type == "double_top"
    assert top.status == "confirmed"
    assert top.direction == "bearish"
    assert top.breakout_level is not None
    assert top.invalidation_level is not None
    assert top.lines


def test_detect_chart_patterns_finds_head_and_shoulders():
    assert "head_and_shoulders" in _pattern_types(_head_and_shoulders_candles())


def test_detect_chart_patterns_finds_inverse_head_and_shoulders():
    assert (
        "inverse_head_and_shoulders"
        in _pattern_types(_inverse_head_and_shoulders_candles())
    )


def test_detect_chart_patterns_finds_flag():
    assert "flag" in _pattern_types(_flag_candles())


def test_detect_chart_patterns_finds_pennant():
    assert "pennant" in _pattern_types(_pennant_candles())


def test_detect_chart_patterns_finds_cup_and_handle():
    assert "cup_and_handle" in _pattern_types(_cup_and_handle_candles())


def test_detect_chart_patterns_rejects_short_windows():
    candles = _daily_candles([(10, 11, 9, 10.5), (10.5, 11.5, 10, 11)])

    assert detect_chart_patterns(candles) == []


class _PatternFakeStockChartService:
    async def fetch_chart(self, params: StockChartParams):
        return StockChartResponse(
            symbol=params.symbol,
            interval=params.interval,
            chart_range=params.chart_range,
            from_=params.date_from,
            to=params.date_to,
            candles=_double_top_candles(),
        )


@pytest.fixture
def client_patterns_override(monkeypatch):
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    app = create_app()
    app.dependency_overrides[get_stock_chart_service] = lambda: (
        _PatternFakeStockChartService()
    )
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def test_patterns_widget_endpoint_aliases(client_patterns_override):
    r = client_patterns_override.get(
        "/api/ai/widget/stock-chart/patterns",
        params={"symbol": "AAPL", "interval": "1day", "range": "1M"},
    )

    assert r.status_code == 200
    body = r.json()
    assert body["symbol"] == "AAPL"
    assert body["interval"] == "1day"
    assert body["range"] == "1M"
    assert body["method"] == "pivot_geometry"
    assert body["model_id"] == "deterministic-pattern-summary"
    assert body["patterns"][0]["pattern_type"] == "double_top"
    assert body["patterns"][0]["lines"]
    assert "analysis" in body
