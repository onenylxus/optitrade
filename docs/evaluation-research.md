# Evaluation Methodology Research — Latest (2025–2026)

> Companion to `ai-usage-analysis.md`. This document surveys the
> 2025–2026 evaluation methodology landscape for AI-augmented applications
> similar to OptiTrade Copilot (LLM widgets + RAG-style context-card
> grounding + a chat agent) and recommends a concrete harness stack that
> fits the project's constraints (single-team, ~3 weeks to final report,
> OpenRouter-routed models, financial domain).

The recommendation is **DeepEval + RAGAS + a small hand-curated reference
set**, supplemented by **client-side latency instrumentation** and a
**human-spot-check** pass on the chart-pattern widget. Rationale and the
alternatives are below.

---

## 1. What changed in 2025–2026 that is relevant to this project

| Trend                                    | Why it matters for OptiTrade                                                                                          |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **RAG is no longer the default.** Sebastian Raschka's *State of LLMs 2025* and Karpathy's 2025 retrospective both call out that long-context + tool-use is replacing classic RAG for doc-QA. | The project already takes the context-card route (not RAG) — but the news-widget RAG retriever is in Phase 3 plan. So the team's framing is forward-compatible. |
| **Hallucination is now split into 3 sub-types** (intrinsic / extrinsic / fabrication), each with its own metric. | News-widget "High Risk" + sentiment=0 used to be a generic "hallucination"; it is now treated as a *cross-field logical inconsistency* and the post-processing guardrail in `news_fetcher/analyzer.py:117–126` is the right mitigation. |
| **LLM-as-a-Judge has known bias.** KRAFTON AI (2025) measured ~30% judge bias on Chatbot Arena; CCRS (arXiv 2506.20128, 2025) and CCE (ACL 2025) propose crowd-comparison / zero-shot-RAG-aware judging to cut it. | Don't rely on a single judge LLM. Pair two judges (the project model + a different one) and report disagreement rate. |
| **Faithfulness vs. Groundedness split.** FaithfulRAG (ACL 2025) and SCORE (arXiv 2602.10017, Feb 2026) push for *fact-level* and *context-utilisation* metrics, not just "is the answer derived from context?" | The portfolio insight's `signals[]` payload (per-symbol bias + explanation) is exactly the unit FaithfulRAG grades on. |
| **Citation-hallucination as a distinct failure mode.** FACTUM (arXiv 2601.05866, Jan 2026) argues that citing a source that does not support a claim is mechanistically different from fabricating facts. | The chat panel does not yet cite — but the news-widget RAG retriever (Phase 3) should plan for this metric, not just "faithfulness". |
| **Process Reward Models + RLVR.** DeepSeek R1 / GRPO moved the frontier on math / code; OpenAI's gpt-oss and Qwen 3 went open-weight in 2025. | Not directly relevant — but the team's choice of `minimax/minimax-m2.7` as the placeholder model id means they're already positioned to swap providers and rerun the harness. |
| **Standardised "Chatbot Arena"-style harnesses.** AlpacaEval length-controlled (Dubois et al., 2024), EvalPlan, CCE — all make auto-judging cheaper and more reproducible. | Useful for the chatbot axis: comparing the OptiTrade chat (with / without context cards) as a paired-comparison study. |

---

## 2. The four evaluation axes in scope

Mapped to the three project objectives from proposal §1.5 (the third
objective "Reduce decision latency" is non-AI; covered only briefly).

### 2.1 Hallucination rate (Objective 3, chatbot module)

**What it measures.** Fraction of chatbot answers that fabricate a number,
a fact, or an action that is not in the pinned context cards.

**Reference framework.** RAGAS `faithfulness` is the canonical starting
point: extract atomic statements from the answer, verify each against the
context, score = `|verified| / |statements|`. DeepEval's `HallucinationMetric`
is the same idea packaged as a `pytest` assertion.

**Latest refinements (2025–2026).**

- *FaithfulRAG (ACL 2025)* — split into fact-level support / conflict /
  neutral, report a 3-way distribution, not just a single %.
- *CCRS (arXiv 2506.20128)* — zero-shot LLM-as-Judge framework that scores
  contextual coherence, query relevance, factual correctness, and
  informational completeness in a single pass; useful when the reference
  set is too small for RAGAS-style claim extraction.
- *FACTUM (Jan 2026)* — citation-hallucination detection. Relevant once
  the news-widget RAG retriever starts emitting inline citations.

**Project-specific issue.** The chat panel context is **explicit,
user-pinned** rather than retrieved. This means the "context recall"
metric (which measures retrieval) is structurally 100 % — what varies is
**whether the answer uses the context correctly**. So *faithfulness* and
*answer-relevance* are the two metrics that matter; *context-precision /
context-recall* are not informative.

**Recommendation.** Use **DeepEval's `FaithfulnessMetric`** (low setup
cost, fits pytest, plays nicely with CI) for the chatbot axis. Pair with
a *two-judge* protocol (the project model + a second, different-family
LLM) and report the inter-judge agreement.

### 2.2 Grounding faithfulness (Objective 3, also chart-pattern and portfolio widgets)

**What it measures.** Whether every claim in the AI narrative can be
traced to the numeric substrate the prompt was given.

**Reference framework.** RAGAS `faithfulness` plus a *task-specific
template*:

| Widget                          | Atomic unit of evaluation                              | Where the substrate lives                                    |
| ------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------ |
| Portfolio insight               | Each sentence of `insight` references a field of the portfolio JSON (`topPositions[].weightPercent`, `summary.pnlPercent`, …) or a `chartPattern` block. | `portfolio_analysis_service._portfolio_payload` |
| Stock-chart recommendation      | Each section (`**Overview:**` / `**Momentum:**` / `**Indicators:**` / `**Levels / Risks:**`) cites a number present in `metrics_json`. | `stock_chart_analysis_service._metrics_payload` |
| Chart-pattern explanation       | `display_name`, `breakout_level`, `invalidation_level`, `confidence` are quoted verbatim. | `stock_pattern_analysis_service._patterns_payload` |
| News sentiment                  | `sentiment` sign matches the title keywords list in the prompt; `risk_tag` is consistent with the post-processing guardrails. | `news_fetcher/analyzer.analyze` |

**Reference point.** *SCORE (arXiv 2602.10017, Feb 2026)* — the four
metrics **Specificity / Context Utilization / Robustness / Relevance** —
captures almost exactly this: it penalises a model that produces a
plausible-sounding answer that does not engage with the specific
context. Use it for the financial-domain widgets.

### 2.3 Multi-widget coverage / grounding completeness

**What it measures.** Whether the answer references **all** pinned
context cards, not just the first one (the most common multi-card
failure mode).

**Reference framework.** Two options:

1. *RAGAS `context_recall`* adapted to "user-pinned coverage": for each
   prompt with N cards, parse the answer for each card's `label`
   (literal substring match is sufficient for the project since labels
   are short and stable). Score = `|labels_referenced| / |labels_pinned|`.
2. *DeepEval multi-turn `MultiTurnContextualRecallMetric`* — same idea
   but framed for multi-turn conversation; for the project, a
   single-turn coverage check is enough.

### 2.4 Streaming UX (objective 3 latency axis, chatbot module)

**What it measures.** Time-to-first-token (TTFT), inter-delta gap,
stream-end-to-stream-end latency.

**Reference framework.** No formal benchmark needed. Record
`performance.now()` at `delta` events in `use-nanobot.ts` and emit a
histogram. Compare against the proposal's "no perceptible gaps" criterion
(subjectively ≤ 200 ms median inter-delta gap on a 50 Mbps link).

### 2.5 Decision latency (Objective 1, non-AI)

Lighthouse / Performance API timing for drag / resize / save / layout
switch. Out of scope for this document.

### 2.6 Alert precision / recall (Objective 2)

Out of scope here — owned by the Alerts module team. Recommended
metric: precision/recall against a labelled event corpus; report
false-positive rate per active rule per trading day.

---

## 3. Tooling recommendation

| Layer               | Tool                                       | Why                                                                                          |
| ------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------- |
| Test framework      | **DeepEval** (`pip install deepeval`)      | Pytest-native, CI-friendly, 14+ built-in metrics including `HallucinationMetric`, `FaithfulnessMetric`, `AnswerRelevancyMetric`, `ContextualPrecisionMetric`, `ContextualRecallMetric`. |
| Reference-free judge | **RAGAS** (`pip install ragas`)          | The four canonical metrics (`faithfulness`, `answer_relevancy`, `context_precision`, `context_recall`). Useful for cross-checking DeepEval numbers and for the news-widget RAG retriever in Phase 3. |
| Multi-judge         | Custom: same prompt sent to project model + a different-family judge (e.g. Claude via OpenRouter), report Cohen's κ. | Cuts ~30 % LLM-as-Judge bias per KRAFTON AI (2025). |
| Synthetic data      | **RAGAS TestsetGenerator** (200 questions over a small corpus) + human audit on top-50. | Standard "200 synthetic, 50 human-audited" recipe from the RAGAS playbook. |
| Chart-pattern unit tests | **pytest fixtures already in repo** + add a `confusion_matrix` test over labelled OHLC windows. | See `tests/test_stock_chart_patterns.py` for the pattern. |
| Streaming UX        | **Custom `performance.now()` instrumentation in `use-nanobot.ts`** + a tiny histogram emitter. | No off-the-shelf tool fits. |
| Dashboarding        | `deepeval login` (cloud dashboard) + CSV export for the final report. | Free tier is sufficient for the project size. |

**Explicit non-recommendations.**

- **AlpacaEval / MT-Bench / Chatbot Arena.** These score *general*
  chat quality; the project's value proposition is *domain-grounded*
  chat. They would dilute the signal and inflate the eval cost.
- **Custom-built LLM-as-Judge from scratch.** The "30 % bias" finding
  means a single-judge approach is fragile. Use two off-the-shelf
  judges, not a hand-rolled one.
- **Static benchmarks (MMLU, TruthfulQA, HellaSwag).** They do not
  measure grounding against user-pinned context. They would generate
  numbers, not evidence.

---

## 4. Recommended harness architecture

```
              ┌──────────────────────────────────────────────────────────────┐
              │             pytest + DeepEval + RAGAS (Python)               │
              │                                                              │
   dataset ──▶│  50 hand-written Grounded prompts      ──▶  OptiTrade chat   │
   (yaml/json)│  30 Hallucination-bait prompts          ──▶  (via WebSocket) │
              │  20 OpenUI / generative-UI prompts       ──▶                 │
              │  25 Portfolio-insight numeric-grounded prompts              │
              │  25 Chart-pattern numeric-grounded prompts                  │
              │  25 Chart-rec numeric-grounded prompts                       │
              │  ──                                                          │
              │  Metrics:                                                    │
              │    Faithfulness       (DeepEval + RAGAS cross-check)         │
              │    AnswerRelevancy    (DeepEval)                            │
              │    ContextCoverage    (custom: substring match on labels)   │
              │    InterJudgeAgreement (Cohen's κ)                          │
              │    TTFT / inter-delta   (client-side perf.now)              │
              │    StreamingUX          (subjective; rubric in §6)          │
              │                                                              │
              │  Judge A = project model                                     │
              │  Judge B = different-family model (e.g. Claude via OR)       │
              │                                                              │
              │  Output: pytest junit.xml + deepeval cloud dashboard         │
              │          + CSV → docs/eval-results-2026-07.md               │
              └──────────────────────────────────────────────────────────────┘
```

The "harness is a Phase 3 deliverable" line in interim §5.1 (M4, by
Jul 8) is exactly this.

---

## 5. Open issues to flag for the QA panel

1. **Two-judge cost.** Running two LLMs per prompt roughly doubles the
   eval budget. Use a cheaper model for Judge B (e.g. a small open-weight
   model routed through OpenRouter) and accept slightly noisier B-judge
   scores. The κ is what matters.

2. **No live OpenRouter in CI.** The CI test target should mock the
   `ChatOpenAI` layer (LangChain supports this via `FakeListLLM` /
   custom Runnable). The harness *runs* against the live model only on
   a scheduled nightly job, gated by the `OPENROUTER_API_KEY` secret.

3. **Nanobot WebSocket is opaque.** The chat harness needs a *local*
   test backend. Easiest: a tiny FastAPI WebSocket server that returns
   canned `delta` / `reasoning_delta` frames. This decouples the harness
   from the digital-ocean droplet and makes the eval reproducible.

4. **Coverage of OpenUI Lang rendering.** The SmartRenderer's split
   between `preamble` (Markdown) and `openui` (program) is non-trivial.
   Add a fixture-based unit test asserting that a model output like
   "Here is the comparison. ```openui\nroot = ...```" is parsed as
   `preamble = "Here is the comparison."`, `openui = "root = ..."`.

5. **Length bias on the LLM-as-Judge.** Follow Dubois et al. 2024
   (AlpacaEval length-controlled): if Judge A consistently prefers
   longer answers, report it as a known bias, not as ground truth.

6. **Eval-bait set must be held out.** The 30 hallucination-bait prompts
   must not appear anywhere in the system prompts, prompt-engineering
   notes, or developer docs (this is why the team is curating it
   internally per interim §3.2.1).

---

## 6. References (already in the project, plus 2025–2026 additions)

**Project citations (proposal §2.2, interim §2.2).**

- [6] Kang & Liu (2023) — Deficiency of LLMs in Finance: hallucination empirical exam. `arXiv:2311.15548`.
- [8] Wang & Li (2025) — RAG-Augmented Multi-Agent Framework for Quant Finance. ACM.
- [9] Zeng (2025) — QuantMCP: Grounding LLMs in Verifiable Financial Reality. `arXiv:2506.06622`.
- [10] Sinha, Agarwal & Malo (2025) — FinBloom: Knowledge Grounding LLM with Real-time Financial Data. KBS.

**New (added by this research note).**

- Es et al. (2023) — *RAGAS: Automated Evaluation of Retrieval Augmented Generation*. The four-metric canonical reference.
- DeepEval maintainers (2024–2026) — *DeepEval: The LLM Evaluation Framework*. Pytest-native, 14+ metrics. github.com/confident-ai/deepeval
- TruLens (2024–2026) — *RAG Triad* observability. `truera/trulens`.
- Dubois, Galambosi, Liang, Hashimoto (2024) — *Length-Controlled AlpacaEval*. `arXiv:2404.04475`. Relevant to the LLM-as-Judge bias concern.
- KRAFTON AI (2025) — *30 % LLM-as-Judge bias on Chatbot Arena*. Workshop paper.
- Aashiq Muhamed (2025) — *CCRS: Zero-Shot LLM-as-a-Judge for Comprehensive RAG Evaluation*. `arXiv:2506.20128`.
- ACL 2025 — *FaithfulRAG: Fact-Level Conflict Modeling for Context-Faithful RAG*.
- Dassen et al. (Jan 2026) — *FACTUM: Mechanistic Detection of Citation Hallucination in Long-Form RAG*. `arXiv:2601.05866`.
- Shomee et al. (Feb 2026) — *SCORE: Specificity, Context Utilization, Robustness, and Relevance for Reference-Free LLM Evaluation*. `arXiv:2602.10017`.
- Chen et al. (Jul 2025) — *Multi-Stage Verification-Centric Framework for Mitigating Hallucination in Multi-Modal RAG* (CRUISE, KDD Cup 2025 CRAG-MM). `arXiv:2507.20136`.
- Raschka, S. (Dec 2025) — *State of LLMs 2025*. Trend-setting industry retrospective that the panel is likely to have read.
- Karpathy, A. (Dec 2025) — *2025 LLM Year in Review*. Same context.

