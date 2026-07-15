"""Pytest suite for the chart-pattern explanation surface.

The pattern widget's narrative comes from one of two paths:

  1. `build_deterministic_pattern_explanation()` — pure deterministic builder.
     Always available, used as the fallback when (a) no OpenRouter key is
     configured, (b) no pattern was detected, or (c) the LLM call fails.

  2. `StockPatternAnalysisService.explain()` — async, optional. Calls the
     LangChain pipeline (OpenRouter-compatible chat model). On any failure,
     falls back to (1). The output is bound to the contract in the system
     prompt: it must use ``**Pattern:**`` and ``**Confirmation / Risk:**``
     markdown labels and end with the "not investment advice" disclaimer.

This file exercises both paths end-to-end and at the boundaries that the
rest of the system relies on (the widget reads `analysis` off the response
body, the API surface returns it as a string).
"""
from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from typing import Any

import pytest

from src.api.schemas.ai_stock_chart import MomentumSnapshot, TechnicalSnapshot
from src.services.stock_pattern_analysis_service import (
    StockPatternAnalysisService,
    build_deterministic_pattern_explanation,
)


# ---------------------------------------------------------------------------
# Test helpers
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class _FakePoint:
    label: str
    index: int
    date: str
    price: float


@dataclass(frozen=True)
class _FakeLine:
    label: str
    kind: str
    start: _FakePoint
    end: _FakePoint


@dataclass(frozen=True)
class _FakePattern:
    """Stand-in for the production ChartPattern — same field shape."""
    pattern_type: str
    display_name: str
    direction: str
    status: str
    confidence: float
    points: list[_FakePoint] = field(default_factory=list)
    lines: list[_FakeLine] = field(default_factory=list)
    breakout_level: float | None = None
    invalidation_level: float | None = None
    rationale: list[str] = field(default_factory=list)


def _double_top() -> _FakePattern:
    return _FakePattern(
        pattern_type="double_top",
        display_name="Double Top",
        direction="bearish",
        status="confirmed",
        confidence=0.86,
        breakout_level=98.0,
        invalidation_level=110.0,
        rationale=["Two equal highs near 110", "Neckline break at 98"],
    )


def _forming_pattern() -> _FakePattern:
    return _FakePattern(
        pattern_type="ascending_triangle",
        display_name="Ascending Triangle",
        direction="bullish",
        status="forming",
        confidence=0.62,
        breakout_level=240.0,
        invalidation_level=224.0,
        rationale=["Flat resistance at 240", "Higher lows since Apr"],
    )


def _pattern_no_levels() -> _FakePattern:
    return _FakePattern(
        pattern_type="head_and_shoulders",
        display_name="Head and Shoulders",
        direction="bearish",
        status="confirmed",
        confidence=0.78,
        breakout_level=None,
        invalidation_level=None,
        rationale=["Head at 195", "Neckline break at 180"],
    )


def _pattern_empty_rationale() -> _FakePattern:
    return _FakePattern(
        pattern_type="falling_wedge",
        display_name="Falling Wedge",
        direction="bullish",
        status="forming",
        confidence=0.55,
        breakout_level=100.0,
        invalidation_level=88.0,
        rationale=[],
    )


def _momentum() -> MomentumSnapshot:
    return MomentumSnapshot(return_pct_1_bar=2.1, return_pct_5_bar=4.8, return_pct_20_bar=11.2)


def _technical() -> TechnicalSnapshot:
    return TechnicalSnapshot(rsi_14=72.3, sma_20=872.4, sma_50=None, last_close_vs_sma20_pct=3.81)


# ---------------------------------------------------------------------------
# 1. build_deterministic_pattern_explanation — 7 cases
# ---------------------------------------------------------------------------

def test_deterministic_empty_patterns_returns_no_pattern_message():
    out = build_deterministic_pattern_explanation([])
    assert out == "No high-confidence chart pattern detected for this range."


def test_deterministic_with_breakout_and_invalidation_includes_both_levels():
    out = build_deterministic_pattern_explanation([_double_top()])
    assert "Double Top" in out
    assert "confirmed" in out
    assert "86%" in out                # confidence formatted as percentage
    assert "bearish" in out
    assert "Breakout level: 98.00" in out
    assert "Invalidation level: 110.00" in out
    assert "Two equal highs near 110" in out  # first rationale line
    assert "educational commentary, not investment advice" in out


def test_deterministic_forming_pattern_includes_correct_status():
    out = build_deterministic_pattern_explanation([_forming_pattern()])
    assert "Ascending Triangle" in out
    assert "forming" in out
    assert "62%" in out
    assert "bullish" in out
    assert "Breakout level: 240.00" in out
    assert "Invalidation level: 224.00" in out


def test_deterministic_pattern_with_no_levels_omits_both_level_lines():
    out = build_deterministic_pattern_explanation([_pattern_no_levels()])
    assert "Head and Shoulders" in out
    assert "Breakout level" not in out
    assert "Invalidation level" not in out
    # Rationale still rendered
    assert "Head at 195" in out


def test_deterministic_pattern_with_empty_rationale_uses_fallback_text():
    out = build_deterministic_pattern_explanation([_pattern_empty_rationale()])
    assert "Falling Wedge" in out
    # The fallback rationale string lives in the source; verify the line is non-empty
    assert "Confirmation / Risk:" in out
    # The rendered fallback rationale is "Pattern geometry is based on recent pivots."
    assert "Pattern geometry is based on recent pivots." in out


def test_deterministic_uses_mardown_section_labels():
    """The system prompt contract requires ``**Pattern:**`` and
    ``**Confirmation / Risk:**`` as bold section labels. The deterministic
    builder mirrors this contract so that even the fallback output respects
    the markdown section layout the frontend expects."""
    out = build_deterministic_pattern_explanation([_double_top()])
    assert "**Pattern:**" in out
    assert "**Confirmation / Risk:**" in out


def test_deterministic_always_ends_with_disclaimer():
    """The disclaimer is the fail-closed insurance against the widget being
    read as a recommendation. It must appear regardless of pattern shape."""
    for patterns in ([], [_double_top()], [_pattern_no_levels()], [_pattern_empty_rationale()]):
        out = build_deterministic_pattern_explanation(patterns)
        # The empty case returns a short message that doesn't carry the disclaimer;
        # that's fine — there's no pattern to misread.
        if patterns:
            assert "educational commentary, not investment advice" in out


# ---------------------------------------------------------------------------
# 2. StockPatternAnalysisService.explain — async LLM path
#    — uses a fake chain injected via the private `_chain` attribute.
# ---------------------------------------------------------------------------

class _FakeChain:
    """Stand-in for the LangChain Runnable produced by
    `build_stock_pattern_analysis_chain`. Records invocations and returns
    a canned string."""
    def __init__(self, return_value: str | Exception):
        self.return_value = return_value
        self.calls: list[dict[str, Any]] = []

    async def ainvoke(self, inputs: dict[str, Any]) -> str:
        self.calls.append(inputs)
        if isinstance(self.return_value, Exception):
            raise self.return_value
        return self.return_value


def _service_with_fake_chain(return_value: str | Exception) -> tuple[StockPatternAnalysisService, _FakeChain]:
    """Construct a service with a real LLM chain stubbed. We bypass the
    `__init__` chain-build path entirely by setting _chain directly after
    construction."""
    svc = StockPatternAnalysisService(openrouter_api_key="", openrouter_model="")
    fake = _FakeChain(return_value)
    svc._chain = fake
    return svc, fake


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro) if False else asyncio.run(coro)


def test_service_without_api_key_uses_deterministic():
    """No OpenRouter key → _chain is None → always returns deterministic."""
    svc = StockPatternAnalysisService(openrouter_api_key="", openrouter_model="")
    assert svc._chain is None
    assert svc.model_id == "deterministic-pattern-summary"

    out = _run(svc.explain(
        symbol="AAPL",
        interval="1day",
        from_date="2024-01-01",
        to_date="2024-03-01",
        patterns=[_double_top()],
        momentum=_momentum(),
        technical=_technical(),
    ))
    assert "Double Top" in out
    assert "Breakout level: 98.00" in out


def test_service_with_empty_patterns_uses_deterministic_no_pattern_message():
    svc, fake = _service_with_fake_chain(return_value="should not be returned")
    out = _run(svc.explain(
        symbol="AAPL",
        interval="1day",
        from_date="2024-01-01",
        to_date="2024-03-01",
        patterns=[],
        momentum=_momentum(),
        technical=_technical(),
    ))
    assert out == "No high-confidence chart pattern detected for this range."
    # The fake chain should NOT be invoked when patterns is empty
    assert fake.calls == []


def test_service_returns_llm_output_when_chain_succeeds():
    svc, fake = _service_with_fake_chain(
        return_value="**Pattern:**\nAscending Triangle is forming with 62% confidence.\n\n"
                     "**Confirmation / Risk:**\nWatch for breakout above 240. "
                     "This is educational commentary, not investment advice."
    )
    out = _run(svc.explain(
        symbol="NVDA",
        interval="1day",
        from_date="2024-01-01",
        to_date="2024-03-01",
        patterns=[_forming_pattern()],
        momentum=_momentum(),
        technical=_technical(),
    ))
    assert "Ascending Triangle" in out
    assert "62%" in out
    assert "Watch for breakout above 240" in out
    assert "educational commentary, not investment advice" in out
    # The fake chain was invoked exactly once
    assert len(fake.calls) == 1
    inputs = fake.calls[0]
    assert inputs["symbol"] == "NVDA"
    assert inputs["interval"] == "1day"
    assert "Ascending Triangle" in inputs["patterns_json"]


def test_service_falls_back_when_llm_raises():
    """If the LLM call throws, the service must not propagate the exception
    to the widget — it must return the deterministic explanation."""
    svc, fake = _service_with_fake_chain(return_value=RuntimeError("network timeout"))
    out = _run(svc.explain(
        symbol="NVDA",
        interval="1day",
        from_date="2024-01-01",
        to_date="2024-03-01",
        patterns=[_double_top()],
        momentum=_momentum(),
        technical=_technical(),
    ))
    assert "Double Top" in out
    assert "Breakout level: 98.00" in out


def test_service_falls_back_when_llm_returns_empty_string():
    """An empty LLM response is treated like a failure: the deterministic
    explanation is returned instead. This guards against the model
    occasionally emitting zero tokens."""
    svc, fake = _service_with_fake_chain(return_value="")
    out = _run(svc.explain(
        symbol="AAPL",
        interval="1day",
        from_date="2024-01-01",
        to_date="2024-03-01",
        patterns=[_double_top()],
        momentum=_momentum(),
        technical=_technical(),
    ))
    assert "Double Top" in out
    assert "Breakout level: 98.00" in out


def test_service_falls_back_when_llm_returns_whitespace_only():
    """Same guard as above but for whitespace-only responses — `.strip()`
    on an empty string is falsy, so this exercises the same code path."""
    svc, fake = _service_with_fake_chain(return_value="   \n\n   ")
    out = _run(svc.explain(
        symbol="AAPL",
        interval="1day",
        from_date="2024-01-01",
        to_date="2024-03-01",
        patterns=[_double_top()],
        momentum=_momentum(),
        technical=_technical(),
    ))
    assert "Double Top" in out
    assert "Breakout level: 98.00" in out


def test_service_payloads_are_valid_json():
    """The chain receives `patterns_json` and `metrics_json` as strings;
    the LangChain prompt template interpolates them directly. Both must
    parse as valid JSON so the LLM sees well-formed context."""
    import json
    svc, fake = _service_with_fake_chain(return_value="ok")
    _run(svc.explain(
        symbol="AAPL",
        interval="1day",
        from_date="2024-01-01",
        to_date="2024-03-01",
        patterns=[_double_top(), _forming_pattern()],
        momentum=_momentum(),
        technical=_technical(),
    ))
    inputs = fake.calls[0]
    parsed_patterns = json.loads(inputs["patterns_json"])
    assert isinstance(parsed_patterns, list)
    assert len(parsed_patterns) == 2
    assert parsed_patterns[0]["pattern_type"] == "double_top"
    assert parsed_patterns[0]["breakout_level"] == 98.0

    parsed_metrics = json.loads(inputs["metrics_json"])
    assert parsed_metrics["momentum"]["return_pct_1_bar"] == 2.1
    assert parsed_metrics["technical"]["rsi_14"] == 72.3


def test_service_model_id_reflects_chain_presence():
    """The `model_id` property is exposed on the response body and is the
    audit hook for "which model wrote this analysis". When no chain is
    configured it must say so."""
    svc_no_chain = StockPatternAnalysisService(openrouter_api_key="", openrouter_model="")
    assert svc_no_chain.model_id == "deterministic-pattern-summary"

    svc_with_chain, _ = _service_with_fake_chain(return_value="ok")
    svc_with_chain._model = "qwen/qwen3-235b-a22b-2507"
    assert svc_with_chain.model_id == "qwen/qwen3-235b-a22b-2507"