# `datasets/public/` — public 2025–2026 sources used by the harness

Every row in this folder carries `meta.source` + `meta.methodology` +
`meta.source_id` so we can cite the right paper, filter before the LLM run,
and distinguish **content origin** from **generation technique**.

> **Status (24 Jun 2026):** WIP. `failsafeqa_bait.jsonl` (30 rows) is
> present and schema-valid; `failsafeqa_robustness.jsonl` is not yet
> generated. Run `python apps/backend/eval/scripts/validate_datasets.py`
> to see the current state.

## What lives in this folder (planned vs. present)

| File                       | Status | What it is                                                                                   |
| -------------------------- | ------ | -------------------------------------------------------------------------------------------- |
| `failsafeqa_bait.jsonl`    | DONE   | 30 **OptiTrade-native** base questions × 6 FailSafeQA perturbation variants (see below)     |
| `failsafeqa_robustness.jsonl` | WIP | ~60 rows from real Writer/FailSafeQA base questions × 6 variants, context swapped to widget  |

The bait file is **synthetic** (our content, their pattern); the robustness
file is **HF-sourced** (their content + variants, our context swap).

## FailSafeQA — `Writer/FailSafeQA`

| Item               | Value                                                                                  |
| ------------------ | -------------------------------------------------------------------------------------- |
| Paper              | Kamble, Russak, Mozolevskyi, Ali, Russak, AlShikh. *FailSafe Long Context QA for Finance.* Writer Inc., arXiv:2502.06329, Feb 2025. |
| HuggingFace id     | `huggingface.co/datasets/Writer/FailSafeQA`                                           |
| License            | Public (CC-BY-4.0 per dataset card)                                                    |
| Base size          | 220 base questions × 6 query/context failure variants = ~1320 rows                    |
| Compliance scale   | 1–6 (Writer's own scale; ≥ 4 = compliant)                                              |
| What we use        | **Methodology** (perturbation patterns) for the 30 OptiTrade-native bait rows + (planned) **base questions** for the 60-row robustness file once `pull_failsafeqa.py` runs. |
| How we adapt       | When HF-sourced: swap the original SEC 10-K context for an OptiTrade widget snapshot (`PortfolioSnapshotResponse` / `MomentumSnapshot` / `ChartPatternDetection`). Keep the original question + variant verbatim. |

Variants we sample from:

| Variant tag       | Original source field                | What it tests                           |
| ----------------- | ------------------------------------ | --------------------------------------- |
| `clean`           | base query                           | Baseline                                |
| `typo`            | `perturbed_query` (4 typo families)  | Robustness to spelling errors           |
| `incomplete`      | `perturbed_query` (truncated)        | Robustness to keyword-only queries      |
| `out_of_domain`   | `perturbed_query` (lay phrasing)     | Robustness to non-expert phrasing       |
| `ocr_corrupt`     | `perturbed_context` (≤ 10 % OCR)     | Robustness to degraded document scans   |
| `missing_doc`     | empty context                        | Hallucination when info is absent       |
| `irrelevant_doc`  | context from wrong company/period    | Robustness to mis-pinned contexts       |

## FAITH — arXiv 2508.05201

| Item               | Value                                                                                  |
| ------------------ | -------------------------------------------------------------------------------------- |
| Paper              | Zhang, Fu, Warrier, Wang, Tan, Huang. *FAITH: A Framework for Assessing Intrinsic Tabular Hallucinations in Finance.* ACM ICAIF'25. |
| License            | Public; dataset released with the paper                                                |
| What we use        | **Methodology only** — masked-span tabular hallucination check. We re-create the masking locally over our chart JSON; we do **not** re-distribute the S&P 500 raw data. |
| Where it lives     | `internal/chart_rec_numeric.jsonl` — 5 rows marked `meta.source = "faith"`            |

## OmniEval — `RUC-NLPIR/OmniEval-HallucinationEvaluator`

| Item               | Value                                                                                  |
| ------------------ | -------------------------------------------------------------------------------------- |
| Paper              | Wang, Tan, Dou, Wen. *OmniEval: An Omnidirectional and Automatic RAG Evaluation Benchmark in Financial Domain.* RUC-NLPIR, arXiv:2412.13018, Dec 2024. |
| HuggingFace id     | `huggingface.co/RUC-NLPIR/OmniEval-HallucinationEvaluator`                            |
| License            | Public (research use)                                                                  |
| What we use        | **Cross-judge only** — `judges/judge_c_omnieval.py` runs the same 50 grounded + 30 bait answers and reports pairwise κ against `judge_a` / `judge_b`. We do **not** ship the OmniEval AutoGen dataset. |

## RAGEval — github.com/gomate-community/rageval

| Item               | Value                                                                                  |
| ------------------ | -------------------------------------------------------------------------------------- |
| Paper              | Zhu et al. *RAGEval: Scenario Specific RAG Evaluation Dataset Generation Framework.* arXiv:2408.01262, Aug 2024. |
| License            | MIT                                                                                    |
| What we use        | **Methodology only** — `scripts/synthesize_grounded.py` runs the schema → config → doc → Q/A loop locally to generate 25 of the 50 grounded prompts. |

## DeepEval Synthesizer

| Item               | Value                                                                                  |
| ------------------ | -------------------------------------------------------------------------------------- |
| Source             | `pip install deepeval` → `deepeval.synthesizer.Synthesizer`                            |
| License            | MIT                                                                                    |
| What we use        | Auto-generates the 25 synthesizer rows in `internal/grounded_prompts.jsonl`. Driven by `scripts/synthesize_grounded.py`. |

## Version pinning (reproducibility)

Before demo day, run:

```bash
uv run python -m eval.scripts.pin_versions > datasets/public/VERSIONS.txt
```

This captures the exact HuggingFace commit hash for FailSafeQA + OmniEval and
the exact pip version of deepeval + ragas so the result table is reproducible.