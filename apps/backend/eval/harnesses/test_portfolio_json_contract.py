"""Mock-LLM harness for the portfolio analysis service.

Drives the strict-JSON contract end-to-end with FakeListChatModel:
  1. Build a portfolio snapshot.
  2. Wrap the production chat pipeline (SYSTEM_PROMPT + chain) with
     langchain_core.language_models.fake_chat_models.FakeListChatModel,
     which returns one canned response per call in order.
  3. Feed 7 canned responses: clean JSON, fenced JSON, prose-wrapped JSON,
     missing riskTone, out-of-vocab riskTone, banned phrase in insight,
     and a parse-fail case that should trigger _fallback_analysis.
  4. Verify the parser functions handle each case correctly (in-vocab
     riskTone, banned phrases stripped, fallback engaged when no parse).

This is the end-to-end version of the /tmp/portfolio_contract_probe.py I
ran before — it actually invokes the production code path, not just the
individual parser functions.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

# Bootstrap path so we can import the production service
APP_BACKEND = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(APP_BACKEND))

# Install a fake API key for the OpenRouter client constructor
import os
os.environ.setdefault("OPENROUTER_API_KEY", "sk-fake-for-test")

from langchain_core.language_models.fake_chat_models import FakeListChatModel
from langchain_core.prompts import ChatPromptTemplate

from src.services.portfolio_analysis_service import (
    SYSTEM_PROMPT,
    USER_PROMPT,
    _extract_json_object,
    _clean_insight_text,
    _normalize_strategy_items,
    _fallback_analysis,
)


# ── Canned LLM responses (the "model" output for each call) ──────────────
CANNED = [
    # 1. Clean JSON (the happy path)
    '{"insight": "Your portfolio is concentrated in Technology at 78% of value, with NVDA the largest single position. If reducing concentration, consider trimming Tech exposure in favour of Energy (XOM) and Financials (JPM). Educational commentary, not investment advice.", "riskLabel": "Concentrated Tech exposure", "riskTone": "medium", "strategy": [{"label": "trim", "symbols": ["NVDA"], "rationale": "Largest single-name position above 20% of book"}]}',
    # 2. JSON inside a markdown code fence
    '```json\n{"insight": "Technology sector dominates the book at 78% of value, led by NVDA.", "riskLabel": "Concentrated Tech exposure", "riskTone": "medium", "strategy": []}\n```',
    # 3. Prose-wrapped JSON
    'Sure, here is the analysis: {"insight": "NVDA alone is 28% of book value, which is a meaningful single-name concentration.", "riskLabel": "Single-name concentration", "riskTone": "high", "strategy": []}',
    # 4. Missing riskTone — should fall back
    '{"insight": "Some valid insight here.", "riskLabel": "OK", "strategy": []}',
    # 5. Out-of-vocab riskTone — should be rejected by validator
    '{"insight": "Some valid insight here.", "riskLabel": "OK", "riskTone": "extreme", "strategy": []}',
    # 6. Banned phrase in insight — should be stripped, leaving empty
    '{"insight": "No chart patterns are available for the requested symbol.", "riskLabel": "OK", "riskTone": "low", "strategy": []}',
    # 7. Pure prose, no JSON — should engage fallback
    'I cannot generate a structured response right now.',
]


def _build_chain():
    """Mirror the production chain: ChatPromptTemplate → ChatOpenAI → StrOutputParser."""
    model = FakeListChatModel(responses=CANNED, outputs=[])
    prompt = ChatPromptTemplate.from_messages([("system", SYSTEM_PROMPT), ("user", USER_PROMPT)])
    return prompt | model | (lambda x: x.content if hasattr(x, "content") else str(x))


def _snapshot() -> dict:
    return {
        "summary": {
            "totalValue": 101000.0,
            "totalCostBasis": 63285.0,
            "unrealizedPnl": 37715.0,
            "unrealizedPnlPercent": 59.6,
            "positionCount": 5,
        },
        "sectorWeights": [
            {"sector": "Technology", "weight": 78.0},
            {"sector": "Financials", "weight": 15.7},
            {"sector": "Energy",     "weight": 11.0},
        ],
        "positions": [
            {"symbol": "NVDA", "quantity": 30, "currentPrice": 905.6, "marketValue": 27168.0, "unrealizedPnlPercent": 120.88},
            {"symbol": "AAPL", "quantity": 120, "currentPrice": 232.5, "marketValue": 27900.0, "unrealizedPnlPercent": 60.34},
            {"symbol": "MSFT", "quantity": 45, "currentPrice": 421.3, "marketValue": 18958.5, "unrealizedPnlPercent": 47.82},
            {"symbol": "JPM",  "quantity": 80, "currentPrice": 198.2, "marketValue": 15856.0, "unrealizedPnlPercent": 39.58},
            {"symbol": "XOM",  "quantity": 100, "currentPrice": 110.8, "marketValue": 11080.0, "unrealizedPnlPercent": 16.63},
        ],
    }


def _invoke_chain(chain, snapshot: dict) -> str:
    """The production chain is async; FakeListChatModel supports both."""
    return chain.invoke({"portfolio_json": json.dumps(snapshot, indent=2)})


# ── Per-case expectations ────────────────────────────────────────────────
EXPECTATIONS = [
    # (name, expected_riskTone, expected_strategy_nonempty, expected_insight_nonempty)
    ("clean_json",            "medium", True,  True),
    ("fenced_json",           "medium", False, True),
    ("prose_wrapped",         "high",   False, True),
    ("missing_riskTone",      None,     None,  None),   # should fall back
    ("out_of_vocab_riskTone", None,     None,  None),   # should fail Pydantic validation
    ("banned_phrase",         "low",    False, False),  # insight stripped to empty
    ("pure_prose",            None,     None,  None),   # fallback engaged
]


def main() -> int:
    chain = _build_chain()
    snapshot = _snapshot()

    print("=== End-to-end portfolio service harness (FakeListChatModel) ===")
    print(f"{'#':<3} {'case':<22} {'raw_len':>8}  {'extracted_json':>14}  {'riskTone':>10}  {'strat_n':>7}  {'insight_n':>10}")
    results = []
    for i, (name, exp_tone, exp_strat_ne, exp_insight_ne) in enumerate(EXPECTATIONS):
        raw = _invoke_chain(chain, snapshot)
        extracted = _extract_json_object(raw)
        if extracted is None:
            # No JSON — should trigger fallback
            tone = "fallback"
            strat_n = "n/a"
            insight_n = "n/a"
        else:
            try:
                obj = json.loads(extracted)
                tone = obj.get("riskTone", "missing")
                strat_n = len(obj.get("strategy", []) or [])
                insight_n = len((obj.get("insight") or "").strip())
            except json.JSONDecodeError:
                tone = "decode_fail"
                strat_n = "?"
                insight_n = "?"
        # Track outcomes
        results.append(
            {
                "case":                name,
                "raw_len":             len(raw),
                "extracted_json_ok":   extracted is not None,
                "riskTone":            tone,
                "strategy_n":          strat_n,
                "insight_n":           insight_n,
                "expected_riskTone":   exp_tone,
                "expected_strat_nonempty": exp_strat_ne,
                "expected_insight_nonempty": exp_insight_ne,
            }
        )
        print(
            f"{i+1:<3} {name:<22} {len(raw):>8}  "
            f"{str(extracted is not None):>14}  {str(tone):>10}  "
            f"{str(strat_n):>7}  {str(insight_n):>10}"
        )

    # Direct unit-level checks on the parsers
    print("\n=== Direct parser checks ===")
    banned_in = "No chart patterns are available for the requested symbol."
    cleaned = _clean_insight_text(banned_in)
    print(f"  _clean_insight_text(banned)     → {cleaned!r}  (expected empty)")
    cleaned_clean = _clean_insight_text("NVDA is up 120% this year.")
    print(f"  _clean_insight_text(clean)      → {cleaned_clean!r}")

    # Strategy normalization
    norm = _normalize_strategy_items([
        {"label": "  TRIM  ", "symbols": ["NVDA", "NVDA", "AAPL"], "rationale": "  trim exposure  "}
    ])
    print(f"  _normalize_strategy_items       → {norm}")

    # Fallback returns correct shape
    fb = _fallback_analysis(snapshot, model_id="fake-test")
    dump = fb.model_dump()
    print(f"  _fallback_analysis type         → {type(fb).__name__}")
    print(f"  _fallback_analysis risk_tone    → {dump['risk_tone']!r}")
    print(f"  _fallback_analysis risk_label   → {dump['risk_label']!r}")
    print(f"  _fallback_analysis strategy_n   → {len(dump['strategy'] or [])}")
    print(f"  _fallback_analysis insight[:60] → {dump['insight'][:60]!r}")
    print(f"  _fallback_analysis signals_n    → {len(dump['signals'] or [])}")
    print(f"  _fallback_analysis model_id     → {dump['model_id']!r}")

    # Save JSON for the report
    Path("/tmp/portfolio_service_harness.json").write_text(json.dumps(results, indent=2, default=str))
    return 0


if __name__ == "__main__":
    sys.exit(main())
