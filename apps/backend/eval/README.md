# `apps/backend/eval/` — OptiTrade QA evaluation harness

Reference harness for the COMP7705 final report (Jul 17, 2026). Runs the
11-axis metric set defined in `docs/qa-evaluation-plan.md` §4.3 against the
chatbot and the AI widgets.

> **Status (24 Jun 2026):** WIP scaffold. `datasets/internal/grounded_prompts.jsonl`
> (25 rows) and `datasets/public/failsafeqa_bait.jsonl` (30 rows) are present
> and schema-valid. The remaining internal datasets, `harnesses/`, `judges/`,
> `ws_backend/`, `conftest.py`, and `run_eval.py` are scaffolded as empty
> directories / placeholder filenames; the README below describes the
> intended final layout. Run `python apps/backend/eval/scripts/validate_datasets.py`
> to see which files are present vs. WIP.

## Layout (target — current vs. done)

```
apps/backend/eval/
├── README.md                       [DONE] this file
├── conftest.py                     [WIP]  pytest fixtures
├── datasets/
│   ├── internal/
│   │   ├── grounded_prompts.jsonl  [DONE] 25 hand-curated + (WIP) 25 Synthesizer = 50
│   │   ├── ui_rendering.jsonl      [WIP]  20 openui card prompts
│   │   ├── portfolio_numeric.jsonl [WIP]  25 portfolio strict-JSON rows
│   │   ├── chart_rec_numeric.jsonl [WIP]  25 (20 hand + 5 FAITH-style)
│   │   └── chart_pattern_numeric.jsonl  [WIP]  25
│   └── public/
│       ├── failsafeqa_bait.jsonl       [DONE] 30 OptiTrade-native, FailSafeQA-methodology
│       ├── failsafeqa_robustness.jsonl [WIP]  ~60 rows from FailSafeQA 6-variant suite
│       └── README.md                   [DONE] public attribution
├── harnesses/                      [WIP]  pytest test modules
├── judges/                         [WIP]  LLM judges (a, b, c = OmniEval)
├── ws_backend/                     [WIP]  fake Nanobot WebSocket server
├── scripts/                        [DONE] generators + validator
└── run_eval.py                     [WIP]  nightly driver
```

## Row schema (every jsonl file)

Every row is one prompt. The schema is stable across all jsonl files; only
the fields used differ.

```jsonc
{
  "id": "grounded-A01",                                          // unique within file
  "surface": "chatbot" | "portfolio" | "chart_rec" | "chart_pattern" | "ui_render",
  "prompt": "What's NVDA's momentum vs. its 20-day SMA?",
  "context_cards": [                                            // pinned widget snapshots
    { "type": "stock_chart", "contextId": "ctx-...", "payload": { ... } }
  ],
  "pinned_labels": ["stock_chart:NVDA"],                        // for multi-widget coverage
  "reference": "NVDA's last close is ~5% above its 20-day SMA and ...",  // gold answer
  "expected_preamble": null,                                    // for ui_rendering only
  "expected_openui_root": null,                                // for ui_rendering only
  "disclaimer_required": true,                                  // non-negotiable hard rule
  "meta": { ... }                                               // see canonical schema below
}
```

`pinned_labels` powers the multi-widget-coverage axis: the metric is
`mean(|labels_referenced_in_answer| / |pinned_labels|)`.

## Canonical meta schema (enforced by `validate_datasets.py`)

All seven fields below are **required** on every row across every jsonl.
Extras are allowed (e.g. `variant`, `failsafeqa_variant_index`).

```jsonc
"meta": {
  "source":       "optitrade_native" | "hf_failsafeqa" | "deepeval_synthesizer" | "hf_omnieval",
  "methodology":  "hand" | "failsafeqa_v1" | "deepeval_synth_v1" | "faith_v1" | "ragas_v1" | "hf_pull",
  "license":      "internal" | "CC-BY-4.0" | "MIT" | "Apache-2.0",
  "version":      "ISO date string",
  "created_by":   "cheung-ching-nam" | "mavis" | "deepeval-synth" | "hf-pull",
  "source_id":    null | "<HF row id or paper citation>",
  "provenance":   "free-text explanation of how the row was made"
}
```

Critical rule: **`source` describes content origin**, **`methodology` describes
generation technique**. A row can be `source: optitrade_native` (content we wrote)
but `methodology: failsafeqa_v1` (perturbation pattern borrowed). This avoids
the misleading "tagging our synthetic rows with someone else's license" trap
that the bait file got wrong in the v1 review.

## Variant-index canonical order

Shared by `scripts/generate_bait.py` and `scripts/pull_failsafeqa.py`:

```
0=clean           (baseline; not a failure variant)
1=typo
2=incomplete
3=out_of_domain
4=ocr_corrupt
5=missing_doc
6=irrelevant_doc
```

## Public source attribution

See `datasets/public/README.md` for license / version pinning of every
external row. Internal rows have `meta.license = "internal"`; never include
them in system-prompt dev logs.

## Running

```bash
cd apps/backend
uv run pytest eval/ -v                 # [WIP] mock LLM (fake_nanobot)
uv run python eval/run_eval.py         # [WIP] nightly driver; writes docs/eval-results-2026-07.md
uv run python eval/scripts/validate_datasets.py   # schema validator (always works)
```

Owner: Cheung Ching Nam (M4 deliverable, due Jul 8).