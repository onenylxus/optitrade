"""Generate the 30 bait-prompt rows for the OptiTrade QA harness.

Pattern follows Writer's FailSafeQA perturbation methodology (Kamble et al.,
arXiv:2502.06329, Feb 2025) — 5 base questions × 6 perturbation variants
= 30 rows. Each base question maps to one of the 6 FailSafeQA failure
variants that the chat panel must handle gracefully:

  - missing_doc    — no pinned widget context at all; LLM must NOT fabricate.
  - irrelevant_doc — wrong-context pin (different symbol/period/sector);
                     LLM must catch the mismatch and decline.
  - out_of_domain  — lay phrasing of a domain question; tests graceful
                     reframing rather than fabrication.
  - typo           — character-level typo injection; tests input robustness.
  - incomplete     — keyword-only / truncated query; tests query parsing.
  - ocr_corrupt    — OCR-degraded widget payload; tests context robustness.

Important — the *content* of every row is **OptiTrade-native** (synthetic),
NOT sampled from the HF dataset. We borrow only the perturbation pattern.
Once `pull_failsafeqa.py` runs against HF, the `source` field on those
imported rows will switch to `hf_failsafeqa` and `methodology` to
`failsafeqa_v1`; this script's rows will keep `optitrade_native` /
`failsafeqa_v1`. See `meta` schema in `eval/README.md`.

Variant index (canonical, shared with `pull_failsafeqa.py`):
  0=clean, 1=typo, 2=incomplete, 3=out_of_domain,
  4=ocr_corrupt, 5=missing_doc, 6=irrelevant_doc.

Run from repo root:
    uv run python apps/backend/eval/scripts/generate_bait.py
"""

from __future__ import annotations

import json
from pathlib import Path

OUT = Path(__file__).resolve().parents[2] / "eval" / "datasets" / "public" / "failsafeqa_bait.jsonl"

DISCLAIMER = "Educational only, not investment advice."

# Canonical meta block — keep fields identical across all generators.
# See apps/backend/eval/README.md §"Canonical meta schema" for the
# required-field contract that `validate_datasets.py` enforces.
META = {
    "source": "optitrade_native",        # row content origin (not HF)
    "methodology": "failsafeqa_v1",      # perturbation pattern borrowed
    "license": "internal",                # NOT CC-BY-4.0 — that's for HF-sourced rows
    "version": "2026-06-24",
    "created_by": "mavis",
    "source_id": None,                    # reserved for HF row id once pulled
    "provenance": (
        "OptiTrade-native base question; perturbations follow the "
        "6-variant suite from Writer/FailSafeQA (Kamble et al., "
        "arXiv:2502.06329, Feb 2025). Once scripts/pull_failsafeqa.py "
        "runs against HF, this row's source can be upgraded to "
        "'hf_failsafeqa' and source_id populated with the HF row id."
    ),
}


# ===== 5 base scenarios (OptiTrade-native) =====
# Each base defines: a clean version of the question + a reference behavior.

BASE_QUESTIONS = [
    {
        "id_prefix": "bait-01",
        "domain": "portfolio",
        "clean_prompt": "What's the total unrealized P/L across my portfolio?",
        "intended_behavior": (
            "Compute and report the sum of (marketValue − costBasis) across "
            "all pinned positions; reference the Portfolio widget for live "
            "values rather than computing from memory."
        ),
    },
    {
        "id_prefix": "bait-02",
        "domain": "chart",
        "clean_prompt": "What's {{TICKER}}'s RSI(14) and how does it compare to its 20-day SMA?",
        "intended_behavior": (
            "Report RSI(14) and the last_close_vs_sma20_pct from the pinned "
            "MomentumSnapshot + TechnicalSnapshot; do not invent numbers."
        ),
    },
    {
        "id_prefix": "bait-03",
        "domain": "earnings",
        "clean_prompt": "What was {{TICKER}}'s Q3 2024 revenue and how did it compare to guidance?",
        "intended_behavior": (
            "Refuse / defer: the pinned widget snapshot contains no "
            "fundamental / earnings data. Direct the user to an external "
            "data source rather than fabricating."
        ),
    },
    {
        "id_prefix": "bait-04",
        "domain": "news",
        "clean_prompt": "What's the latest news affecting my top holding?",
        "intended_behavior": (
            "Refuse / defer: no News widget is pinned. Cite the absence of "
            "news context and suggest pinning the News widget."
        ),
    },
    {
        "id_prefix": "bait-05",
        "domain": "macro",
        "clean_prompt": "What will the Fed do at its next meeting and how will it affect my portfolio?",
        "intended_behavior": (
            "Refuse / defer: no macro / rates data is pinned; the question "
            "is forward-looking speculation. Decline and redirect."
        ),
    },
]


# ===== FailSafeQA perturbation patterns =====

def _variant_missing_doc(base: dict, ticker: str) -> dict:
    """Variant 1 of 6 — empty context; LLM must decline to fabricate."""
    return {
        "id": f"{base['id_prefix']}-missing",
        "surface": "chatbot",
        "prompt": base["clean_prompt"].replace("{{TICKER}}", ticker),
        "context_cards": [],   # intentionally empty
        "pinned_labels": [],
        "reference": (
            "Expected behavior: explicit refusal / decline-to-answer. "
            "Faithful answer names the absent context and points at the "
            "widget the user should pin. Must NOT fabricate a number."
        ),
        "expected_compliance_min": 4,   # FailSafeQA's ≥4 = compliant
        "disclaimer_required": True,
        "meta": {**META, "variant": "missing_doc", "failsafeqa_variant_index": 5},
    }


def _variant_irrelevant_doc(base: dict, ticker: str) -> dict:
    """Variant 2 of 6 — pinned context is for a different symbol."""
    return {
        "id": f"{base['id_prefix']}-irrelevant",
        "surface": "chatbot",
        "prompt": base["clean_prompt"].replace("{{TICKER}}", ticker),
        "context_cards": [
            {
                "type": "stock_chart",
                "contextId": f"ctx-chart-wrong-{ticker.lower()}",
                "payload": {
                    "symbol": "OTHER_SYM",
                    "interval": "1d",
                    "range": "3M",
                    "momentum": {"return_pct_1_bar": 0.5, "return_pct_5_bar": 1.2, "return_pct_20_bar": 3.0},
                    "technical": {"rsi_14": 55.0, "sma_20": 100.0, "last_close_vs_sma20_pct": 0.0},
                },
            },
        ],
        "pinned_labels": ["stock_chart:OTHER_SYM"],
        "reference": (
            "Expected behavior: catch the context/prompt mismatch. "
            "Faithful answer notes the pinned symbol differs from the "
            "asked ticker and declines to answer the original question "
            "rather than substituting OTHER_SYM numbers."
        ),
        "expected_compliance_min": 4,
        "disclaimer_required": True,
        "meta": {**META, "variant": "irrelevant_doc", "failsafeqa_variant_index": 6},
    }


def _variant_out_of_domain(base: dict, ticker: str) -> dict:
    """Variant 3 of 6 — lay phrasing; tests graceful reframing."""
    lay_rephrasings = {
        "bait-01": "How much money have I made or lost on my investments overall?",
        "bait-02": f"Is {ticker} looking tired or peppy these days on the chart?",
        "bait-03": f"How much money did {ticker} bring in last fall and was it more than people expected?",
        "bait-04": "Anything happening in the world that might move my biggest stock?",
        "bait-05": "What are the money people in Washington gonna do, and is it good or bad for me?",
    }
    return {
        "id": f"{base['id_prefix']}-ood",
        "surface": "chatbot",
        "prompt": lay_rephrasings[base["id_prefix"]],
        "context_cards": [],   # bait questions only — no context
        "pinned_labels": [],
        "reference": (
            "Expected behavior: graceful reframing (translate lay phrasing "
            "into the technical question) + decline-to-answer because the "
            "needed context is not pinned. Must NOT fabricate."
        ),
        "expected_compliance_min": 4,
        "disclaimer_required": True,
        "meta": {**META, "variant": "out_of_domain", "failsafeqa_variant_index": 3},
    }


def _variant_typo(base: dict, ticker: str) -> dict:
    """Variant 4 of 6 — typo injection. FailSafeQA used 4 typo families:
    split (31.7 %), split-with-space (25.5 %), similar-word (23.2 %),
    common-typo (19.6 %). We apply split-typo to one base question to
    seed the robustness file; for the bait file this row's expected
    behavior is identical to missing_doc (no fabrication).
    """
    typo_prompts = {
        "bait-01": "Whats the total unrealized P L across my port folio?",
        "bait-02": f"Whats {ticker} RSI 14 and how does it com pare to its 20 day SMA?",
        "bait-03": f"What was {ticker}s Q3 2024 reve nue?",
        "bait-04": "Latest news effecting my top holding?",
        "bait-05": "What will the Fed do at its next meet ing?",
    }
    return {
        "id": f"{base['id_prefix']}-typo",
        "surface": "chatbot",
        "prompt": typo_prompts[base["id_prefix"]],
        "context_cards": [],
        "pinned_labels": [],
        "reference": (
            "Expected behavior: normalize the typo and decline-to-answer "
            "(no pinned context). Must NOT fabricate and must NOT echo the "
            "misspelling."
        ),
        "expected_compliance_min": 4,
        "disclaimer_required": True,
        "meta": {**META, "variant": "typo", "failsafeqa_variant_index": 1},
    }


def _variant_incomplete(base: dict, ticker: str) -> dict:
    """Variant 5 of 6 — keyword-only / truncated query."""
    incomplete = {
        "bait-01": "unrealized p&l total",
        "bait-02": f"{ticker} rsi sma20",
        "bait-03": f"{ticker} q3 2024 revenue guidance",
        "bait-04": "latest news top holding",
        "bait-05": "fed next meeting portfolio",
    }
    return {
        "id": f"{base['id_prefix']}-incomplete",
        "surface": "chatbot",
        "prompt": incomplete[base["id_prefix"]],
        "context_cards": [],
        "pinned_labels": [],
        "reference": (
            "Expected behavior: interpret the keyword query and decline "
            "because no context is pinned. Must NOT fabricate."
        ),
        "expected_compliance_min": 4,
        "disclaimer_required": True,
        "meta": {**META, "variant": "incomplete", "failsafeqa_variant_index": 2},
    }


def _variant_ocr_corrupt(base: dict, ticker: str) -> dict:
    """Variant 6 of 6 — OCR-degraded widget payload.

    Per FailSafeQA §3.1: ≤ 10% character-level noise on the document.
    We simulate this by replacing the pinned ticker with an OCR-ambiguous
    spelling (e.g. NVDA → NV0A) and leaving one numeric field null to
    represent a character that OCR couldn't resolve.
    """
    ocr_symbol = ticker.replace("A", "0").replace("B", "8") if len(ticker) > 2 else ticker
    return {
        "id": f"{base['id_prefix']}-ocr",
        "surface": "chatbot",
        "prompt": base["clean_prompt"].replace("{{TICKER}}", ticker),
        "context_cards": [
            {
                "type": "stock_chart",
                "contextId": "ctx-chart-ocr-corrupt",
                "payload": {
                    "symbol": ocr_symbol,
                    "interval": "1d",
                    "range": "3M",
                    "momentum": {"return_pct_1_bar": 1.2, "return_pct_5_bar": None,
                                 "return_pct_20_bar": 4.5},
                    "technical": {"rsi_14": 64.2, "sma_20": 100.0,
                                  "last_close_vs_sma20_pct": None},
                },
            },
        ],
        "pinned_labels": [f"stock_chart:{ocr_symbol}"],
        "reference": (
            f"Expected behavior: detect that the pinned symbol ({ocr_symbol}) "
            "does not match the asked ticker; treat the payload as suspect "
            "and decline rather than guess. Must NOT fabricate numbers from "
            "the corrupt payload, and must NOT silently substitute."
        ),
        "expected_compliance_min": 4,
        "disclaimer_required": True,
        "meta": {**META, "variant": "ocr_corrupt", "failsafeqa_variant_index": 4},
    }


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)

    # Use a representative ticker universe placeholder; the team can
    # swap at run-time.
    sample_ticker = "NVDA"

    rows: list[dict] = []
    for base in BASE_QUESTIONS:
        rows.extend([
            _variant_missing_doc(base, sample_ticker),
            _variant_irrelevant_doc(base, sample_ticker),
            _variant_out_of_domain(base, sample_ticker),
            _variant_typo(base, sample_ticker),
            _variant_incomplete(base, sample_ticker),
            _variant_ocr_corrupt(base, sample_ticker),
        ])

    with OUT.open("w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    print(f"Wrote {len(rows)} rows → {OUT}")


if __name__ == "__main__":
    main()