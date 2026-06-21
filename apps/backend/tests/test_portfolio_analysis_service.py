from src.services.portfolio_analysis_service import _fallback_analysis


def _snapshot() -> dict:
    return {
        "positions": [
            {
                "symbol": "NVDA",
                "marketValue": 50000,
                "currentPrice": 150,
                "avgPrice": 120,
            },
            {
                "symbol": "AAPL",
                "marketValue": 30000,
                "currentPrice": 190,
                "avgPrice": 175,
            },
            {
                "symbol": "AMZN",
                "marketValue": 20000,
                "currentPrice": 180,
                "avgPrice": 145,
            },
        ],
        "sectorValues": [
            {"sector": "Technology", "percent": 80.0},
            {"sector": "Consumer", "percent": 20.0},
        ],
        "summary": {
            "totalValue": 100000,
            "pnlPercent": 18.0,
        },
    }


def test_fallback_analysis_mentions_top_holding_pattern_context():
    response = _fallback_analysis(
        _snapshot(),
        "test-model",
        {
            "NVDA": {
                "displayName": "Double Top",
                "direction": "bearish",
                "status": "confirmed",
                "confidencePct": 86,
                "breakoutLevel": 307.15,
                "invalidationLevel": 322.18,
            },
            "AAPL": {
                "displayName": "Double Bottom",
                "direction": "bullish",
                "status": "forming",
                "confidencePct": 62,
                "breakoutLevel": 180.0,
                "invalidationLevel": 168.0,
            },
        },
    )

    assert response.risk_label == "High concentration in NVDA"
    assert "confirmed bearish Double Top" in response.insight
    assert response.strategy[0].label == "trim"
    assert "confirmed bearish Double Top" in response.strategy[0].reason
    assert response.strategy[1].label == "add candidate"
    assert response.strategy[1].symbols == ["AAPL", "AMZN"]
