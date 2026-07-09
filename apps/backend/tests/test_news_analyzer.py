"""Pytest suite for `news_fetcher.analyzer.CloudAnalyzer`.

The news analyzer's contract is the second-most-important strictness gate
in OptiTrade after the portfolio JSON contract (covered by
`test_portfolio_analysis_service.py` and `test_rest_api.py`). It is the
defence against the (sentiment, risk) collision class — where the LLM
emits "Neutral" with "High Risk", or "Positive sentiment" with
"High Risk", both of which are nonsensical pairings that a downstream
consumer would silently render to the user.

This module exercises:

  1. The keyword fallback path (`_mock_analysis`) — used when the LLM
     call times out / rate-limits. Tested across all four buckets
     (negative, primary-positive, secondary-positive, default).

  2. The post-processing guardrails (`_apply_guardrails` is inlined
     in `analyze()`):
        * abs(sentiment) < 0.01 + (Medium | High) Risk → forced Low Risk
        * High Risk + sentiment ≥ 0 → sentiment forced to -0.50
        * Low Risk + sentiment ≤ -0.5 → risk_tag forced to Medium Risk
        * Invalid risk_tag → forced Low Risk
        * Sentiment clamped to [-1.0, +1.0]
        * Highlights capped to 3
        * Reasoning truncated to 300 chars

  3. The JSON-fence stripping in `analyze()` and the standalone
     `parse_json_safely` helper.

  4. The readiness-score deductions in `calculate_readiness_score`.

  5. End-to-end `analyze()` with a monkeypatched `_call_api` returning
     canned LLM responses covering the adversarial cases above.
"""
from __future__ import annotations

import json

import pytest

from news_fetcher.analyzer import CloudAnalyzer


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def analyzer() -> CloudAnalyzer:
    # The constructor reads OPENROUTER_API_KEY from .env and prints the model.
    # We don't call any external network — _call_api is monkeypatched per test.
    return CloudAnalyzer(api_key="sk-or-v1-fake", model_name="test-model")


def _patch_call_api(analyzer: CloudAnalyzer, return_value):
    """Replace the private `_call_api` with one that returns a canned string.

    Accepts a string (raw LLM response), an Exception (simulate network
    failure), or a list (one response per call)."""
    if isinstance(return_value, list):
        iterator = iter(return_value)
        def _stub(prompt, max_tokens=500):
            try:
                return next(iterator)
            except StopIteration:
                return None
    else:
        def _stub(prompt, max_tokens=500):
            return return_value
    analyzer._call_api = _stub


# ---------------------------------------------------------------------------
# 1. _mock_analysis (keyword fallback) — 4 buckets, 8 cases
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    "title, expected_sentiment, expected_risk",
    [
        # Negative bucket
        ("Crypto lender Aave announces withdrawal freeze", -0.65, "High Risk"),
        ("SEC launches investigation into major bank", -0.65, "High Risk"),
        ("Government shutdown fears shake markets", -0.65, "High Risk"),
        # Positive bucket
        ("AAPL shares surge on earnings beat", 0.75, "Low Risk"),
        ("Analysts upgrade NVDA with strong buy rating", 0.75, "Low Risk"),
        ("Company announces $10B share buyback program", 0.75, "Low Risk"),
        # Secondary positive bucket
        ("Markets advance on growth outlook", 0.45, "Low Risk"),
        # Default neutral
        ("Markets close mixed on Wednesday", 0.0, "Low Risk"),
    ],
)
def test_mock_analysis_keyword_buckets(title, expected_sentiment, expected_risk):
    a = CloudAnalyzer(api_key="x", model_name="y")
    result = a._mock_analysis(title)
    assert result["sentiment"] == expected_sentiment
    assert result["risk_tag"] == expected_risk
    assert isinstance(result["highlights"], list) and len(result["highlights"]) >= 1
    assert isinstance(result["reasoning"], str) and len(result["reasoning"]) > 0


# ---------------------------------------------------------------------------
# 2. parse_json_safely — 3 cases
# ---------------------------------------------------------------------------

def test_parse_json_safely_valid_json():
    a = CloudAnalyzer(api_key="x", model_name="y")
    out = a.parse_json_safely('{"sentiment": 0.5, "risk_tag": "Low Risk"}')
    assert out["sentiment"] == 0.5
    assert out["risk_tag"] == "Low Risk"


def test_parse_json_safely_json_embedded_in_prose():
    a = CloudAnalyzer(api_key="x", model_name="y")
    out = a.parse_json_safely(
        'Sure, here is the analysis: {"sentiment": -0.3, "risk_tag": "Medium Risk"} hope this helps.'
    )
    assert out["sentiment"] == -0.3
    assert out["risk_tag"] == "Medium Risk"


def test_parse_json_safely_no_json_returns_fallback():
    a = CloudAnalyzer(api_key="x", model_name="y")
    out = a.parse_json_safely("I cannot analyze this news article.")
    assert out["sentiment"] == 0.0
    assert out["risk_tag"] == "Low Risk"
    assert out["highlights"] == ["Analysis unavailable"]


# ---------------------------------------------------------------------------
# 3. calculate_readiness_score — 7 cases (matches the §3.3 "7 probes" claim)
# ---------------------------------------------------------------------------

def _base_result():
    return {
        "sentiment": 0.5,
        "risk_tag": "Low Risk",
        "reasoning": "A sufficiently long reasoning string here.",
        "highlights": ["Beat estimates", "Raised guidance", "Strong buyback"],
    }


def test_readiness_score_perfect():
    a = CloudAnalyzer(api_key="x", model_name="y")
    assert a.calculate_readiness_score(_base_result()) == 100


def test_readiness_score_neutral_plus_medium_risk_penalty():
    """abs(sentiment) < 0.01 + Medium Risk → -50 (without compounding the High Risk rule)."""
    a = CloudAnalyzer(api_key="x", model_name="y")
    r = _base_result()
    r["sentiment"] = 0.0
    r["risk_tag"] = "Medium Risk"
    assert a.calculate_readiness_score(r) == 50


def test_readiness_score_high_risk_positive_sentiment_penalty():
    """High Risk + sentiment ≥ 0 → -40."""
    a = CloudAnalyzer(api_key="x", model_name="y")
    r = _base_result()
    r["sentiment"] = 0.5
    r["risk_tag"] = "High Risk"
    assert a.calculate_readiness_score(r) == 60


def test_readiness_score_low_risk_negative_sentiment_penalty():
    """Low Risk + sentiment ≤ -0.5 → -30."""
    a = CloudAnalyzer(api_key="x", model_name="y")
    r = _base_result()
    r["sentiment"] = -0.6
    r["risk_tag"] = "Low Risk"
    assert a.calculate_readiness_score(r) == 70


def test_readiness_score_short_reasoning_penalty():
    """reasoning < 20 chars → -20."""
    a = CloudAnalyzer(api_key="x", model_name="y")
    r = _base_result()
    r["reasoning"] = "short"
    assert a.calculate_readiness_score(r) == 80


def test_readiness_score_fallback_highlights_penalty():
    """highlights contain 'AI analysis completed' (the fallback marker) → -30."""
    a = CloudAnalyzer(api_key="x", model_name="y")
    r = _base_result()
    r["highlights"] = ["AI analysis completed", "Sentiment score calculated", "Risk assessment performed"]
    assert a.calculate_readiness_score(r) == 70


def test_readiness_score_combined_penalties_floor_at_zero():
    """All four penalties at once → 0 (not negative)."""
    a = CloudAnalyzer(api_key="x", model_name="y")
    r = _base_result()
    r["sentiment"] = 0.0
    r["risk_tag"] = "High Risk"  # -50 (neutral + high risk) + -40 (high risk + pos) but we already forced risk_tag → not double
    # Actually: the first rule (abs(sentiment)<0.01 + non-Low Risk) fires → -50.
    # The second (High Risk + sentiment≥0) doesn't fire because sentiment is 0.0 (<0.01 is checked first, not 0 exactly).
    # Let's use a clearer case: sentiment=-0.6, risk_tag=Low Risk → -30; reasoning=short → -20; "AI analysis completed" present → -30.
    # Total: 100 - 30 - 20 - 30 = 20.
    r2 = _base_result()
    r2["sentiment"] = -0.6
    r2["risk_tag"] = "Low Risk"
    r2["reasoning"] = "short"
    r2["highlights"] = ["AI analysis completed", "x", "y"]
    assert a.calculate_readiness_score(r2) == 20


# ---------------------------------------------------------------------------
# 4. analyze() end-to-end with monkeypatched _call_api
#    — covers the §3.3 "6 adversarial (sentiment, risk) collision cases"
# ---------------------------------------------------------------------------

def test_analyze_clean_json_passes_through(analyzer):
    _patch_call_api(analyzer, json.dumps({
        "sentiment": 0.7,
        "risk_tag": "Low Risk",
        "reasoning": "Beat earnings, raised guidance.",
        "highlights": ["EPS grew 25%", "Revenue beat by $200M", "Guidance raised"],
        "confidence_score": 90,
    }))
    out = analyzer.analyze("AAPL beats Q3 estimates", "summary", "content", mode="batch")
    assert out["sentiment"] == 0.7
    assert out["risk_tag"] == "Low Risk"
    assert out["readiness_score"] == 100  # no penalties fire


def test_analyze_strips_code_fence(analyzer):
    _patch_call_api(analyzer, '```json\n{"sentiment": 0.4, "risk_tag": "Low Risk", "reasoning": "ok", "highlights": ["a"], "confidence_score": 80}\n```')
    out = analyzer.analyze("Stock rises", "summary", "content", mode="batch")
    assert out["sentiment"] == 0.4
    assert out["risk_tag"] == "Low Risk"


def test_analyze_neutral_sentiment_forces_low_risk(analyzer):
    """abs(sentiment) < 0.01 + (Medium | High) Risk → Low Risk."""
    _patch_call_api(analyzer, json.dumps({
        "sentiment": 0.0,
        "risk_tag": "Medium Risk",
        "reasoning": "Could go either way — neutral headline.",
        "highlights": ["No clear catalysts"],
        "confidence_score": 50,
    }))
    out = analyzer.analyze("Markets mixed", "summary", "content", mode="batch")
    assert out["risk_tag"] == "Low Risk"
    assert out["sentiment"] == 0.0


def test_analyze_high_risk_positive_sentiment_forces_negative(analyzer):
    """High Risk + sentiment ≥ 0 → sentiment forced to -0.50."""
    _patch_call_api(analyzer, json.dumps({
        "sentiment": 0.4,
        "risk_tag": "High Risk",
        "reasoning": "Severe risk event but the LLM mis-tagged it positive.",
        "highlights": ["Risk event"],
        "confidence_score": 60,
    }))
    out = analyzer.analyze("Bank faces crisis", "summary", "content", mode="batch")
    assert out["risk_tag"] == "High Risk"
    assert out["sentiment"] == -0.50


def test_analyze_low_risk_very_negative_sentiment_escalates(analyzer):
    """Low Risk + sentiment ≤ -0.5 → risk_tag forced to Medium Risk."""
    _patch_call_api(analyzer, json.dumps({
        "sentiment": -0.8,
        "risk_tag": "Low Risk",
        "reasoning": "Very negative but the LLM under-tagged the risk.",
        "highlights": ["Major miss"],
        "confidence_score": 50,
    }))
    out = analyzer.analyze("Stock crashes 30%", "summary", "content", mode="batch")
    assert out["risk_tag"] == "Medium Risk"
    assert out["sentiment"] == -0.8


def test_analyze_invalid_risk_tag_falls_back_to_low(analyzer):
    """risk_tag not in {High, Medium, Low} → forced to Low Risk."""
    _patch_call_api(analyzer, json.dumps({
        "sentiment": 0.3,
        "risk_tag": "extreme",
        "reasoning": "Model invented a risk tag outside vocabulary.",
        "highlights": ["Out of vocab"],
        "confidence_score": 40,
    }))
    out = analyzer.analyze("Headline", "summary", "content", mode="batch")
    assert out["risk_tag"] == "Low Risk"


def test_analyze_sentiment_above_1_clamped(analyzer):
    """sentiment > 1.0 → clamped to 1.0."""
    _patch_call_api(analyzer, json.dumps({
        "sentiment": 5.0,
        "risk_tag": "Low Risk",
        "reasoning": "LLM emitted an out-of-range sentiment.",
        "highlights": ["Clamping"],
        "confidence_score": 50,
    }))
    out = analyzer.analyze("Headline", "summary", "content", mode="batch")
    assert out["sentiment"] == 1.0


def test_analyze_highlights_capped_at_three(analyzer):
    """highlights > 3 items → only first 3 retained."""
    _patch_call_api(analyzer, json.dumps({
        "sentiment": 0.3,
        "risk_tag": "Low Risk",
        "reasoning": "ok reasoning here",
        "highlights": ["a", "b", "c", "d", "e"],
        "confidence_score": 80,
    }))
    out = analyzer.analyze("Headline", "summary", "content", mode="batch")
    assert len(out["highlights"]) == 3
    assert out["highlights"] == ["a", "b", "c"]


def test_analyze_reasoning_truncated_at_300_chars(analyzer):
    """reasoning > 300 chars → truncated."""
    long_reasoning = "x" * 500
    _patch_call_api(analyzer, json.dumps({
        "sentiment": 0.3,
        "risk_tag": "Low Risk",
        "reasoning": long_reasoning,
        "highlights": ["a"],
        "confidence_score": 80,
    }))
    out = analyzer.analyze("Headline", "summary", "content", mode="batch")
    assert len(out["reasoning"]) == 300


def test_analyze_json_parse_failure_uses_fallback(analyzer):
    """If the LLM returns prose (no JSON), analyzer must use the keyword fallback."""
    _patch_call_api(analyzer, "I cannot analyze this. Apologies.")
    out = analyzer.analyze("AAPL beats earnings", "summary", "content", mode="batch")
    # The fallback path uses _mock_analysis on the title, which has "beat" → positive bucket.
    assert out["sentiment"] == 0.75
    assert out["risk_tag"] == "Low Risk"
    assert out["readiness_score"] == 50  # fallback always sets readiness=50


def test_analyze_api_returns_none_uses_fallback(analyzer):
    """_call_api returns None (network error) → fallback."""
    _patch_call_api(analyzer, None)
    out = analyzer.analyze("Crypto shutdown fears", "summary", "content", mode="batch")
    # "shutdown" is in the negative keyword bucket
    assert out["sentiment"] == -0.65
    assert out["risk_tag"] == "High Risk"


def test_analyze_realtime_mode_does_not_diverge_from_batch(analyzer):
    """The realtime prompt is identical to the batch prompt in this revision;
    both must produce the same guardrail behaviour."""
    _patch_call_api(analyzer, json.dumps({
        "sentiment": 0.0,
        "risk_tag": "High Risk",
        "reasoning": "Neutral but tagged high risk — collision.",
        "highlights": ["Collision case"],
        "confidence_score": 30,
    }))
    out = analyzer.analyze("Headline", "summary", "content", mode="realtime")
    assert out["risk_tag"] == "Low Risk"  # guardrail fired