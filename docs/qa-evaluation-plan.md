# QA Evaluation Plan & Expected Results — Final Report (Jul 17, 2026)

> Companion to `ai-usage-analysis.md` and `evaluation-research.md`. This
> document is the QA-session playbook: which evaluation harness runs, what
> evidence is produced, and what numbers the team should expect to show
> the panel on demo day.
>
> Audience: COMP7705 final-report panel + project team.

---

## 1. Scope & timing

| Item                                  | Value                                                                                  |
| ------------------------------------- | -------------------------------------------------------------------------------------- |
| Final report submission               | 17 Jul 2026                                                                           |
| Oral examination                      | late Jul 2026                                                                          |
| Today (T₀)                            | 24 Jun 2026 — ≈ 3 weeks to final report, ≈ 4 weeks to oral exam.                        |
| Phase-3 deadline for the eval harness | 8 Jul 2026 (M4 in interim §5.2 — "Hallucination-rate benchmark scored")                |
| Slack vs. the deadline                | 9 days for harness hardening, result write-up, and one round of QA dry run.            |
| Owner                                 | Cheung Ching Nam (interim §5.1) — this plan is the M4 deliverable.                      |

## 2. Three measurable objectives (proposal §1.5) → harness

| # | Objective                          | Module owning it            | Harness deliverable (this plan)                                                                |
| - | ---------------------------------- | --------------------------- | ----------------------------------------------------------------------------------------------- |
| 1 | Reduce decision latency            | Widget Canvas               | Lighthouse + custom `performance.now()` instrumentation in drag/resize/save/layout-switch.   |
| 2 | Higher alert signal-to-noise       | Real-Time Alerts (Phase 3)  | Precision/recall on a labelled event corpus (out of scope here; owned by Alerts team).       |
| 3 | Reduce hallucination rate          | Chatbot (and AI widgets)    | DeepEval + RAGAS harness over curated reference sets (§4).                                     |

This document is about #3. #1 is a one-line result (median Lighthouse
score + median drag latency); #2 is owned by a parallel team.

## 3. Reference sets (hybrid: public 2025–2026 + internal)

Interim §3.2.1 commits to "produced internally", which is defensible for the
**widget-shape-specific sets** (Portfolio / Chart-rec / Chart-pattern numeric +
UI-rendering) — those encode the actual OpenUI / 4-section / `root = …` /
strict-JSON contracts the LLM must obey. For the **chat-panel hallucination
and grounded prompts**, however, 2025–2026 public benchmarks now provide
directly applicable datasets and tooling that the harness should use rather
than reinvent:

| Public source (2025–2026)             | What it provides                                       | License   | Used by                                |
| ------------------------------------- | ------------------------------------------------------ | --------- | -------------------------------------- |
| **FailSafeQA** (Writer Inc., Feb 2025; arXiv 2502.06329; HF `Writer/FailSafeQA`) | 220 base questions × 6 query/context failure variants (typos, incomplete, OCR-error, irrelevant doc, missing doc, out-of-domain). 24-model benchmark. | Public    | Robustness axis + bait-set source       |
| **FAITH** (Zhang et al., Aug 2025; arXiv 2508.05201; ACM ICAIF'25)        | Framework + dataset for *intrinsic tabular hallucination* on S&P 500 reports (masked-span prediction). | Public    | Chart-rec numeric methodology          |
| **OmniEval** (RUC-NLPIR, Dec 2024; arXiv 2412.13018; HF `RUC-NLPIR/...`) | Financial RAG eval: HAL / NAC / COM / UTL / ACC, auto-gen + human-annotated splits, evaluator model. | Public    | Cross-judge for inter-judge κ          |
| **RAGEval** (gomate-community, Aug 2024; arXiv 2408.01262)               | Schema → config → doc → Q/A auto-generation framework for vertical RAG. | Public    | Methodology for synthetic grounded set |
| **DeepEval Synthesizer** (`pip install deepeval`)                       | Generates Q/A goldens automatically from documents.      | MIT       | Auto-generates half of grounded set    |
| **RAGAS** (`pip install ragas`)                                         | Faithfulness / context-precision / context-recall / answer-relevance. | Apache-2  | Cross-check vs DeepEval                |

The revised split is **public backbone + internal complement**:

### 3.1 Internal sets (hand-curated — widget shape is proprietary)

| Set                              | Size | Question shape                                                         | What it scores                                                              |
| -------------------------------- | ---- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| **`ui_rendering.jsonl`**         | 20   | Prompt whose ideal answer is a ```` ```openui ```` block starting `root = …` | Parse success of `splitOpenUiResponse` (chat-panel.tsx:75); disclaimer present. |
| **`portfolio_numeric.jsonl`**    | 25   | Synthetic `PortfolioSnapshotResponse` + reference insight (per `SYSTEM_PROMPT` in `portfolio_analysis_service.py:65–86`). | Atomic faithfulness on strict-JSON keys `insight / riskLabel / riskTone / strategy / signals`. |
| **`chart_rec_numeric.jsonl`**    | 25   | Synthetic `MomentumSnapshot` + `TechnicalSnapshot` + reference 4-section markdown (`**Overview:**`, `**Momentum:**`, `**Indicators:**`, `**Levels / Risks:**`). | Section adherence, numeric grounding, `model_id` field present. |
| **`chart_pattern_numeric.jsonl`**| 25   | Synthetic `ChartPatternDetection[]` + reference explanation.            | `displayName`, `breakout_level`, `invalidation_level`, `rationale[]` quoted verbatim. |

### 3.2 Hybrid sets (public source adapted)

| Set                              | Size | Source                                                              | What it scores                                                              |
| -------------------------------- | ---- | ------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| **`grounded_prompts.jsonl`**     | 50   | **25 hand-curated** + **25 auto-generated** by DeepEval Synthesizer over a `PortfolioSnapshotResponse` + `MomentumSnapshot` corpus extracted from the running app. | DeepEval FaithfulnessMetric + AnswerRelevancyMetric + multi-widget coverage + hallucination metric. |
| **`hallucination_bait.jsonl`**   | 30   | **Sampled from FailSafeQA** missing-doc + out-of-domain variants, with widget-context swapped in. | Hallucination rate (target ≤ 20 %).                                       |
| **`robustness.jsonl`** *(new)*   | ~60  | **FailSafeQA** 6 failure variants (typos, incomplete, OCR-error, irrelevant-doc, missing-doc, out-of-domain) × 10 base questions. | Robustness drop vs. clean baseline; ≥ 4 compliance on Writer's 1–6 scale (FailSafeQA's metric). |

### 3.3 Net totals

- Internal hand-curated: **95** (down from 175) — UI-rendering 20 + portfolio 25 + chart-rec 25 + chart-pattern 25.
- Hand-curated portion of grounded: **25** prompts.
- Auto-generated portion of grounded: **25** prompts (DeepEval Synthesizer).
- Public-source bait: **30** sampled from FailSafeQA.
- Public-source robustness: **~60** from FailSafeQA 6-variant suite.
- **Total prompts: ~235** across 6 surfaces (vs. 175 originally).

Each full pass at ~10 s/call is ≈ 40 minutes against a single OpenRouter
model; with two judges ≈ 80 minutes. Nightly cadence still fits, and the
~50 % increase in coverage buys the panel a public-citation argument and a
robustness axis we didn't have before.

## 4. Harness design (concrete)

### 4.1 Tooling stack

```
pytest                     — test runner, junit.xml for CI
deepeval                   — FaithfulnessMetric, HallucinationMetric, AnswerRelevancyMetric, ContextualPrecisionMetric, ContextualRecallMetric
ragas                      — faithfulness, answer_relevancy (cross-check)
pydantic                   — reference-set schema
httpx                      — OpenRouter + local WebSocket test server
fastapi + uvicorn          — local WebSocket test backend (Nanobot stand-in)
scipy.stats.cohens_kappa   — inter-judge agreement
```

### 4.2 File layout (to be added under `apps/backend/eval/`)

```
apps/backend/eval/
├── README.md
├── conftest.py                          # pytest fixtures: env, judges, time mocking
├── datasets/
│   ├── internal/
│   │   ├── grounded_prompts.jsonl       # 50 prompts: 25 hand-curated + 25 DeepEval-Synthesizer
│   │   ├── ui_rendering.jsonl           # 20 prompts, each {prompt, expected_preamble, expected_openui_root}
│   │   ├── portfolio_numeric.jsonl      # 25 prompts, each {portfolio_json, reference_insight}
│   │   ├── chart_rec_numeric.jsonl      # 25 prompts (20 hand + 5 FAITH-style), each {metrics_json, recent_candles_json, reference_analysis}
│   │   └── chart_pattern_numeric.jsonl  # 25 prompts, each {patterns_json, metrics_json, reference_explanation}
│   └── public/
│       ├── failsafeqa_bait.jsonl        # 30 prompts sampled from Writer/FailSafeQA, widget-context swapped in
│       ├── failsafeqa_robustness.jsonl  # ~60 prompts from FailSafeQA 6-variant suite
│       └── README.md                    # source attribution + license + version pinning
├── harnesses/
│   ├── test_chatbot_faithfulness.py     # DeepEval FaithfulnessMetric × 110 (50 grounded + 30 bait + 30 public)
│   ├── test_chatbot_answer_relevancy.py # DeepEval AnswerRelevancyMetric × 50
│   ├── test_chatbot_multi_widget.py     # custom coverage × 50
│   ├── test_chatbot_robustness.py       # FailSafeQA 6-variant drop analysis × 60
│   ├── test_chatbot_ui_rendering.py     # SmartRenderer parse test × 20
│   ├── test_portfolio_faithfulness.py   # 25
│   ├── test_chart_rec_faithfulness.py   # 25
│   ├── test_chart_pattern_faithfulness.py # 25
│   ├── test_inter_judge.py              # Cohen's κ × all (DeepEval + OmniEval judge)
│   └── test_tabular_hallucination.py    # FAITH-style masked-span check on portfolio/chart JSON
├── judges/
│   ├── judge_a.py                       # project model (e.g. openrouter/minimax/...) via OpenRouter
│   ├── judge_b.py                       # different-family model (e.g. openrouter/anthropic/...) via OpenRouter
│   └── judge_c_omnieval.py              # OmniEval-HallucinationEvaluator cross-judge (HF)
├── ws_backend/
│   └── fake_nanobot.py                  # local FastAPI WebSocket test backend
├── scripts/
│   └── synthesize_grounded.py           # DeepEval Synthesizer driver; outputs 25 golden rows
├── run_eval.py                          # nightly driver
└── report_template.md                   # outputs docs/eval-results-2026-07.md
```

### 4.3 Dataset attribution & license table

Every public-source row carries `{source: "failsafeqa" | "faith" | "omnieval", source_id, license, version}` in the
jsonl `meta` field so the report can cite properly and so contaminated rows can be filtered before the LLM run.

| Public set | HF id                              | License | How we adapt it                          |
| ---------- | ---------------------------------- | ------- | ---------------------------------------- |
| FailSafeQA | `Writer/FailSafeQA`                | Public  | Sample 30 base + 10 base×6 variants; replace SEC 10-K context with OptiTrade widget snapshots; keep the 1–6 compliance scale. |
| FAITH      | arXiv 2508.05201 (ICAIF'25)        | Public  | Borrow the *masked-span tabular hallucination* methodology for the 5 mixed-in chart-rec numeric rows. No raw dataset re-distribution; we re-create the masking locally over our chart JSON. |
| OmniEval   | `RUC-NLPIR/OmniEval-HallucinationEvaluator` | Public  | Used as third cross-judge; we run it on the same 50 grounded + 30 bait answers and report pairwise κ against judge_a / judge_b. |
| RAGEval    | github.com/gomate-community/rageval | MIT     | Methodology borrow only — we run the schema → config → doc → Q/A loop locally to generate 25 of the 50 grounded prompts. |
| DeepEval Synthesizer | `deepeval.synthesizer.Synthesizer` | MIT  | Same — drives `scripts/synthesize_grounded.py`. |

### 4.3 Metrics, formulas, target thresholds

| Metric                              | Formula / source                                                                                | Target at Jul 8            | Stretch target |
| ----------------------------------- | ----------------------------------------------------------------------------------------------- | -------------------------- | -------------- |
| **Hallucination rate**              | `1 − mean(DeepEval FaithfulnessMetric × HallucinationMetric)` over the 30 bait prompts           | **≤ 20 %**                 | ≤ 10 %         |
| **Faithfulness (grounded)**         | `mean(DeepEval FaithfulnessMetric)` over the 50 grounded prompts                                 | **≥ 0.85**                 | ≥ 0.92         |
| **Answer-relevance (grounded)**     | `mean(DeepEval AnswerRelevancyMetric)` over the 50 grounded prompts                              | **≥ 0.80**                 | ≥ 0.88         |
| **Multi-widget coverage**           | `mean(|referenced_labels| / |pinned_labels|)` over the 50 grounded prompts                       | **≥ 0.90**                 | 1.00           |
| **Disclaimer presence**             | `mean(1{"not investment advice" ⊆ answer})` across all 125 chatbot + AI-widget answers           | **= 1.00** (hard rule)     | 1.00           |
| **UI-render parse success**         | `mean(1{SmartRenderer.splitOpenUiResponse(raw) succeeds})` over 20 prompts                      | **≥ 0.85**                 | ≥ 0.95         |
| **Inter-judge κ**                   | `scipy.stats.cohens_kappa(judge_a, judge_b)` over all chatbot answers (binary supported/unsupported) | **≥ 0.60** (substantial) | ≥ 0.75         |
| **TTFT (median)**                   | `median(performance.now() at first delta − send_time)`                                          | **≤ 1.5 s**                | ≤ 1.0 s        |
| **Inter-delta gap (p95)**           | `p95(delta gaps)`                                                                               | **≤ 250 ms**               | ≤ 150 ms       |
| **Section adherence (chart-rec)**   | `mean(1{all four **Overview / Momentum / Indicators / Levels / Risks** present})`                | **≥ 0.90**                 | ≥ 0.98         |
| **Pattern-explanation grounding**   | `mean(1{displayName AND breakout_level AND invalidation_level quoted verbatim})`                | **≥ 0.80**                 | ≥ 0.92         |

### 4.4 Reference-table for the QA panel (one row per axis)

This is the slide / handout the panel will most likely look at. Each
row is reproducible from `apps/backend/eval/run_eval.py` and the
reference sets in `apps/backend/eval/datasets/`.

| Axis                            | Metric                           | Baseline (no context) | OptiTrade (today) | Target | Method                                   |
| ------------------------------- | -------------------------------- | --------------------- | ----------------- | ------ | ---------------------------------------- |
| Hallucination                   | Rate on bait set (lower better)  | ~60–70 % (est.)        | TBD               | ≤ 20 % | DeepEval HallucinationMetric             |
| Faithfulness                    | DeepEval score (higher better)   | ~0.55 (est.)           | TBD               | ≥ 0.85 | DeepEval FaithfulnessMetric              |
| Multi-widget grounding          | Coverage of pinned labels          | 0 % (no context)       | TBD               | ≥ 0.90 | Custom substring match                   |
| Streaming UX                    | TTFT p50                         | n/a                    | TBD               | ≤ 1.5 s | Client `performance.now()`               |
| Streaming UX                    | Inter-delta p95                  | n/a                    | TBD               | ≤ 250 ms | Client `performance.now()`              |
| Numeric grounding (portfolio)   | Atomic-statement faithfulness    | n/a                    | TBD               | ≥ 0.80 | Custom + DeepEval                        |
| Numeric grounding (chart-rec)   | Atomic-statement faithfulness    | n/a                    | TBD               | ≥ 0.80 | Custom + DeepEval                        |
| Pattern-explanation grounding   | Verbatim name/levels              | n/a                    | TBD               | ≥ 0.80 | Custom substring                         |
| Inter-judge agreement           | Cohen's κ                        | n/a                    | TBD               | ≥ 0.60 | Two judges over same answers             |
| Section adherence (chart-rec)   | 4-section coverage                | n/a                    | TBD               | ≥ 0.90 | Markdown parse                           |
| OpenUI render                   | Parse success                     | n/a                    | TBD               | ≥ 0.85 | `splitOpenUiResponse` test               |

> "Baseline (no context)" is an optional ablation the team can run on
> demo day: send the same 80 prompts to the chat with **zero pinned
> context** and observe the delta in hallucination rate. Expected:
> the no-context run is 2–3× worse, which is the panel-friendly
> "context cards reduce hallucinations" proof point that maps directly
> onto proposal §1.5 / §3.3.2.

## 5. Risk register for the harness itself

| Risk                                                     | Mitigation                                                                                              |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Judge-LLM bias ≈ 30 % (KRAFTON AI 2025)                  | Two judges; report Cohen's κ; never quote a single-judge number as ground truth.                        |
| Length bias (Dubois et al. 2024)                        | Compute and report median answer length per set; if judge preferences correlate with length, flag it. |
| Reference-set contamination of the project LLM           | Hold-out the 30 bait prompts; do not include them in any system-prompt dev log or doc.                  |
| OpenRouter rate-limit flakiness                          | Nightly job is retryable; per-prompt `max_retries=1` in LangChain; `429` counted separately.            |
| Nanobot WebSocket unavailable during eval                | Local `fake_nanobot.py` test backend; harness never depends on the digital-ocean droplet.               |
| Streaming-parser regression                             | Add `use-nanobot.test.ts` covering chunked-tag boundary cases (probe pattern: `<thi` + `nk>...</thi` + `nk>answer`). |
| Cost                                                     | Nightly only; use cheap model for Judge B; gate the live-LLM run on `OPENROUTER_API_KEY` secret.       |

## 6. Demo script for the QA session (≈ 15 minutes)

1. **Open with the system architecture diagram** from
   `ai-usage-analysis.md` §1. Two LLM gateways (OpenRouter widgets +
   Nanobot chat) — name them, point at the file:line of the prompt
   contract for each.

2. **Live demo: candlestick + portfolio widgets.**

   - Open the dashboard, pin NVDA chart context, send
     `/analyze with the pinned context`.
   - Show `decision latency` from the dev-tools Performance tab
     (~80–120 ms layout switch, ~1 s chart-recommendation TTFT).

3. **Live demo: chat with multi-card pinning.**

   - Pin chart + portfolio + news; ask a question that requires all three.
   - Show `SmartRenderer` rendering Markdown for the preamble and
     OpenUI Lang for a comparison card. Open the ThinkingBlock — explain
     the `StreamingThinkParser` and why naive regex fails (point at
     `use-nanobot.ts:46–215`).

4. **Walk the panel through the eval harness.**

   - `apps/backend/eval/README.md` → `pytest apps/backend/eval -v`.
   - Show the live dashboard at `app.confident-ai.com` (DeepEval cloud
     free tier), the per-metric histogram, and the failure-list.

5. **Quote the result table (slide).** Hit at least 3 of the target
   thresholds; if a target is missed, name the root cause and the
   planned fix in Phase 3.

6. **Ablation (if time).** Run the 80-prompt chatbot set with zero
   pinned context, show the spike in hallucination rate, tie back to
   proposal §1.5 / §3.3.2.

7. **Close with risks & known limits.** Three bullets from §3 of
   `ai-usage-analysis.md` (two-judge protocol, no live OpenRouter in CI,
   length bias). Each bullet one line.

## 7. Expected-result envelope (for the report write-up)

These are the numbers the team should expect, based on (a) the prompt
contracts (which already forbid fabrication in the system prompts),
(b) the deterministic substrate that grounds every widget answer, and
(c) the published RAGAS / DeepEval defaults over comparable tasks:

| Axis                                | Expected at Jul 8 | What would force a re-think                                          |
| ----------------------------------- | ----------------- | --------------------------------------------------------------------- |
| Hallucination rate (bait set)       | 10–20 %           | > 30 % — would imply the system prompt is not enforcing the rule.    |
| Faithfulness (grounded)             | 0.85–0.95         | < 0.70 — would mean the widget JSON substrate is being ignored.       |
| Multi-widget coverage               | 0.90–1.00         | < 0.70 — would mean the chat is only answering the first card.       |
| Robustness drop (FailSafeQA 6-variant) | ≤ 15 pp vs clean baseline | > 25 pp — would mean the chat panel's input handling is brittle. |
| Inter-judge κ                       | 0.55–0.75         | < 0.40 — would mean the judge prompt is mis-aligned with the task.    |
| TTFT p50                            | 0.6–1.5 s         | > 3 s — would mean the OpenRouter latency is the bottleneck.          |
| Inter-delta p95                     | 100–250 ms        | > 500 ms — would mean Nanobot is throttling.                          |
| Section adherence (chart-rec)       | 0.90–0.98         | < 0.80 — would mean the section contract is being violated.          |
| Pattern-explanation grounding       | 0.80–0.95         | < 0.70 — would mean the pattern fields are not being quoted.         |
| Tabular hallucination (FAITH-style masked-span) | ≤ 8 % | > 15 % — would mean the JSON substrate isn't being treated as truth. |
| Disclaimer presence                 | 1.00              | < 1.00 — non-negotiable; treat as a bug.                              |
| OpenUI render parse                 | 0.85–0.95         | < 0.70 — would mean the OpenUI library version is the issue.         |

## 8. Mapping back to proposal / interim

| Source claim                                              | Demonstrated by                                                            |
| --------------------------------------------------------- | -------------------------------------------------------------------------- |
| Proposal §1.5 "Reduce hallucination rate"                 | Hallucination rate on bait set + faithfulness on grounded set + κ.        |
| Proposal §3.3.2 "Grounded responses cite the context"    | Multi-widget coverage + numeric grounding on the three widget axes.        |
| Proposal §3.3.4 "Streaming responses — no gaps"          | TTFT p50 + inter-delta p95.                                                |
| Proposal §3.4.4 "Widget canvas — Add to Chat Context"    | Smoke-test that every widget exposes a `contextData` and is pin-able.     |
| Interim §3.4 "Chatbot-specific axes"                      | The four metrics table in §4.3 of this document.                           |
| Interim §5.1 M4 "Hallucination-rate benchmark scored"     | The harness itself + the result table in §4.4.                            |

## 9. One-page checklist for demo day

```
[ ] apps/backend/eval/ in the repo, README explains the harness
[ ] Datasets present:
    - internal/  : 25 + 25 + 20 + 25 + 25 = 120 hand-curated rows
    - internal/  : 25 DeepEval-Synthesizer generated rows in grounded_prompts.jsonl
    - public/    : 30 FailSafeQA bait + 60 FailSafeQA robustness rows
    Total ≈ 235 rows
[ ] pytest apps/backend/eval -v runs green on the mock LLM
[ ] Live run on the project model — results captured to docs/eval-results-2026-07.md
[ ] Two judges + OmniEval cross-judge configured; Cohen's κ reported
[ ] TTFT / inter-delta log present in the chat panel instrumentation
[ ] A 1-page result slide ready (table from §4.4)
[ ] Ablation (no-context baseline) ready as backup
[ ] Three bullets on risks & known limits from §3 of ai-usage-analysis.md
[ ] Final report references this plan, the analysis, the research note,
    and the public datasets in §10
```

---

## 10. References

- `docs/ai-usage-analysis.md` — repo inventory of every AI surface.
- `docs/evaluation-research.md` — 2025–2026 methodology literature.
- Proposal §1.5, §3.3, §3.4.4 — measurable objectives and MVP acceptance.
- Interim §3.4, §5.1 (M4) — evaluation plan and Phase 3 schedule.

### Public datasets & frameworks used in this plan

- Kamble, Russak, Mozolevskyi, Ali, Russak, AlShikh. **FailSafeQA: Expect the Unexpected — FailSafe Long Context QA for Finance.** Writer Inc., arXiv:2502.06329, Feb 2025. Dataset: `huggingface.co/datasets/Writer/FailSafeQA`.
- Zhang, Fu, Warrier, Wang, Tan, Huang. **FAITH: A Framework for Assessing Intrinsic Tabular Hallucinations in Finance.** ACM ICAIF'25, arXiv:2508.05201, Aug 2025.
- Wang, Tan, Dou, Wen. **OmniEval: An Omnidirectional and Automatic RAG Evaluation Benchmark in Financial Domain.** RUC-NLPIR, arXiv:2412.13018, Dec 2024. Evaluator: `huggingface.co/RUC-NLPIR/OmniEval-HallucinationEvaluator`.
- gomate-community. **RAGEval: Scenario Specific RAG Evaluation Dataset Generation Framework.** arXiv:2408.01262, Aug 2024. Repo: `github.com/gomate-community/rageval`.
- Confident AI. **DeepEval: The LLM Evaluation Framework.** `github.com/confident-ai/deepeval` (includes `Synthesizer` module).
- RAGAS contributors. **RAGAS: Automated Evaluation of Retrieval Augmented Generation.** `github.com/explodinggradients/ragas`.

