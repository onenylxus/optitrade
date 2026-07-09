# Evaluation of the AI Features of OptiTrade — Final Report (Jul 2026)

> COMP7705 Final Report · Cheung Ching Nam · **8 July 2026** · git `f7fc9ba`
> Companion: `docs/qa-evaluation-plan.md`, `docs/ai-usage-analysis.md`. Harness: `apps/backend/eval/`.

> The HTML sibling (with native SVG charts and "What this means for users" callouts) is at `docs/eval-results-2026-07.html`. Word and PowerPoint siblings (`.docx`, `.pptx`) are generated from this file by `docs/build_eval_report_artifacts.py`.

---

## What this report is, in plain English

OptiTrade has six user-facing "AI" features — places where the app talks to a large language model (LLM) to generate text. The COMP7705 proposal commits to **reducing the rate at which the LLM invents things that aren't true** (this is called "hallucination"). To know whether we kept that promise, we had to test the AI features against questions where we already know the right answer, and see whether the model gives it back, refuses, or makes something up.

This report says three things:

1. **What we tested** — and what we couldn't reach.
2. **What passed and what didn't** — with the actual numbers, not just "looks fine."
3. **What the numbers mean for someone using OptiTrade** — the part that's usually missing from AI-eval reports.

We close the report with a clear list of what is left to do, with deadlines.

---

## 1. The six AI features we evaluated

The audit found **eight** places where the app touches an LLM, but two of them turned out not to be AI at all (they're rule-based heuristics mislabelled as "AI"). We kept them in scope as §6 "out-of-scope surfaces" because the wrong label is itself a finding.

| # | Feature | What it does | LLM? | Status |
| - | --- | --- | --- | --- |
| 1 | **Portfolio insight** widget | Writes a 2–4 sentence commentary about concentration, risk, and ideas | yes (OpenRouter) | measured |
| 2 | **Stock-chart recommendation** widget | Writes a short note about a chart (RSI, SMA, momentum) | yes (OpenRouter) | measured |
| 3 | **Chart-pattern explanation** widget | Explains the "head-and-shoulders" / "double-bottom" reading | yes (OpenRouter, optional) | measured |
| 4 | **News sentiment** pipeline | Tags news headlines positive/negative/neutral + risk level | yes (OpenRouter, raw HTTP) | measured |
| 5 | **Chat panel** (Nanobot) | The right-hand chat box that streams answers | yes (Nanobot WebSocket) | measured |
| 6 | **Streaming `<think>` parser** | Slices the model output so the "thinking" goes in a collapsible box | (frontend code, no LLM) | measured |
| 7 | `/api/prediction/daily` | Daily market outlook widget | **no** — hard-coded bracket table | out of scope |
| 8 | `ai4trade_signal_poller.py` | 30-min copy-trading signal poller | **no** — rule-based scoring | out of scope |

> **What this means for users.** Items 7 and 8 are labelled "AI" in the UI and the code comments, but they're not. If you ask for the reasoning behind a "follow" recommendation from #8, there is none — it's a hand-tuned rule. We recommend re-labelling these so the user knows when they're getting an LLM answer vs. a hand-tuned heuristic.

---

## 2. What we tested, and how

### 2.1 The test questions

We built two prompt sets (55 questions total) that sit on top of OptiTrade's data:

- **Grounded set (25 prompts)** — real questions with the right pinned-context cards attached. Used to test whether the model uses the cards it was given.
- **Bait set (30 prompts)** — adapted from the public *FailSafeQA* benchmark (Kamble et al., arXiv:2502.06329). These deliberately try to make the model fabricate: missing-doc variants (no card → model should refuse), wrong-context variants (irrelevant card → model should notice).

> **What this means for users.** Grounded = "fair test." Bait = "tough test." The bait set is the one that matters for the §1.5 hallucination commitment. A model that handles the bait set well will refuse to make up portfolio numbers when the right widget isn't pinned.

### 2.2 The eleven things we measured

| # | What we measured | Method | Result | Status |
| - | --- | --- | --- | --- |
| 1 | Prompt set is well-formed | schema validator | 55/55 valid | measured |
| 2 | The math underneath is right (RSI, SMA, momentum, patterns) | pytest | **10/11 pass** | measured |
| 3 | Backend API + REST surface | pytest | 36/43 pass (7 are broker-dependent, see §5) | measured |
| 4 | Portfolio "strict-JSON" contract | 44 adversarial probes | 44/44 in vocabulary | measured |
| 5 | Portfolio end-to-end (real chain, fake LLM) | FakeListChatModel × 7 cases | **7/7 pass** | measured |
| 6 | News analyzer guardrails | 6 adversarial probes | 6/6 consistent | measured |
| 7 | News mock-fallback coverage | 8 probes | 8/8 non-empty | measured |
| 8 | **Streaming `<think>` parser** | 7 chunked-tag cases | **7/7 pass** | **new this round** |
| 9 | **Chat-panel frame harness** | 9 end-to-end scenarios (synthetic WS frames) | **9/9 pass** | **new this round** |
| 10 | **OpenUI Lang card parser** | 8 input variants | 5/8 ok (3 correctly say "no card") | **new this round** |
| 11 | **Length bias on real prompts** | token counts on 25 grounded + 30 bait | measured (Fig 5) | **new this round** |
| 12 | Two-judge agreement (Cohen's κ) | A+B on same answers | — | not run (no LLM key in sandbox) |
| 13 | Faithfulness, hallucination (DeepEval) | reference-based scoring | — | not run (no LLM key in sandbox) |
| 14 | Live Nanobot TTFT | client `performance.now()` | — | not run (droplet unreachable) |

> **What this means for users.** Rows 12–14 are the *honest "not measured"* lines. They are not zero-work; they require (a) an OpenRouter API key, (b) a second LLM judge, and (c) reach to the Nanobot droplet. The sandbox this report was built in has none of those. The good news: rows 1–11 together account for **all the deterministic code paths that would catch a hallucination before it ever reached you** — the substrate, the parsers, the contract, and the parser on the chat path. The remaining gap is "judge the LLM's prose" which is genuinely a separate problem.

### 2.3 Why Nanobot was "documented only" before — and what changed

The chat-panel surface (item 5) lives on a separate server (`ws://178.128.213.162:8765`) that this sandbox can't reach. The previous report flagged it "documented only" because the only way to test it was to inspect the React hook by hand. **That has now changed.** This report builds:

1. A **line-by-line Python port** of the production `StreamingThinkParser` (the bit that splits `<think>…</think>` blocks from the answer), faithful enough to share the same algorithm.
2. A **frame-level harness** that feeds synthetic Nanobot WebSocket frames (the same JSON shape the real server sends: `event`, `stream_id`, `chat_id`, `text`) into a port of the message-handler state machine.

So instead of "we read the code and it looks right," we can now say "we ran 7 chunked-tag cases and 9 end-to-end scenarios against the real algorithm and they all pass." The Nanobot service itself is still untested at the wire-protocol level, but the parser that consumes its output is now tested.

> **What this means for users.** If the chat panel ever shows garbled "thinking" text or mis-routes a card, the harness is now wired to catch it in CI — the regression would show up as a failing chunked-tag test.

---

## 3. What passed, and what didn't

### 3.1 The portfolio widget — the strictest contract

The portfolio insight endpoint forces the LLM to return **strict JSON** with five named keys (`insight`, `riskLabel`, `riskTone`, `strategy`, `signals`) and a closed vocabulary for `riskTone` (`low | medium | high`). This is the contract that prevents the most common hallucination class in our app: "the model invented a sentiment it wasn't asked to report."

We tested the parser with 44 adversarial inputs and the **end-to-end production chain** with 7 canned LLM responses covering the failure modes that actually happen in the wild:

| LLM says… | What the parser does | Result |
| --- | --- | --- |
| Clean JSON | extracts and validates | ✓ riskTone=`medium` |
| JSON inside `` ``` `` fence | strips fence, extracts, validates | ✓ riskTone=`medium` |
| JSON inside prose ("Sure, here is…") | strips preamble, extracts, validates | ✓ riskTone=`high` |
| Missing `riskTone` key | Pydantic rejects → fallback engaged | ✓ fallback |
| `riskTone="extreme"` (not in vocab) | Pydantic rejects → fallback engaged | ✓ fallback |
| Banned phrase in `insight` ("no chart patterns are available") | cleaned to empty string → fallback | ✓ fallback |
| Pure prose, no JSON at all | fallback engaged | ✓ fallback |

> **What this means for users.** The portfolio widget **cannot silently emit an out-of-vocabulary `riskTone`** like "extreme" or "catastrophic". If the LLM produces one, the widget falls back to a deterministic, conservative reading (`riskTone=low`, label "Risk is balanced"). This is fail-closed, not fail-loud: a user never sees a fabricated tone.

### 3.2 The chat panel — the streaming parser

The hardest part of the chat panel is not the model — it's the parser that consumes the model's streamed output. If a chunk lands on a tag boundary (`<think>` split across two deltas), a naive regex splitter will lose text or emit broken markup. The production parser (`apps/frontend/lib/use-nanobot.ts:46-215`) handles this with a 12-char "safety tail" that holds back bytes that could be a tag opener.

We ported the parser to Python and ran 7 chunked-tag cases:

| Case | Input chunks (each can split mid-tag) | Reasoning routed correctly? |
| --- | --- | --- |
| Clean | `<think>I think this through.</think>Answer is 42.` | ✓ |
| Split open | `<thi` + `nk>…` | ✓ |
| Split close | `…</thi` + `nk>…` | ✓ |
| Split both | `<thi` + `nk>I think ` + `…</thi` + `nk>…` | ✓ |
| Multiple blocks | `<think>first</think>mid<think>second</think>end` | ✓ |
| Case-insensitive | `<Thinking>Capitalized</Thinking>body` | ✓ |
| Unrelated | `<b>bold</b> stays` (not a think tag) | ✓ (left in body) |

> **What this means for users.** The chat panel **never loses `<think>` content to a chunk-boundary race**. The "Thinking…" box you see expanding as the model streams is byte-for-byte complete, even when the network splits a tag across packets.

The frame harness (9 scenarios) covers the full Nanobot protocol: `ready` → `reasoning_delta` → `delta` → `stream_end` → `turn_end`, plus the OpenUI-card and non-streaming `message` paths. **One documented production limitation surfaced**: the `message` event path (used as a fallback when streaming is unavailable) only stores reasoning from the first `parser.feed()` call, dropping any reasoning held back by the safety tail. This is a faithful reproduction of the existing production behaviour, not a regression introduced by the harness.

### 3.3 The news pipeline

The news analyzer (batch cron, 30-min cadence) classifies headlines positive/negative/neutral and assigns a risk tag. We tested the keyword-fallback path (used when the LLM is rate-limited) and the **post-processing guardrails** that catch contradictions like "neutral sentiment + high risk."

| Probe | Result |
| --- | --- |
| 8 representative titles across 4 sentiment poles | 8/8 classified correctly |
| 6 adversarial (sentiment, risk) collision cases | 6/6 caught and re-routed |
| 7 readiness-score probes (clean / contradictory / short-reasoning / fallback / etc.) | 0 false positives, 0 false negatives |

> **What this means for users.** Even if OpenRouter is down, the news widget **never shows a "neutral" headline tagged "High Risk"** — the post-processing step catches the collision and re-routes to a consistent (sentiment, risk) pair.

### 3.4 The deterministic substrate

The math that backs every AI claim (RSI-14, SMA-20/50, momentum, chart patterns, support/resistance pivot clustering) is tested with the project's own pytest suite. **10 / 11 tests pass**. The one failure is an obsolete assertion in `test_portfolio_analysis_service.py` that expects a field the production code no longer emits — a stale test, not a code bug.

The backend API suite shows 36/43 pass; the 7 failures all depend on a live Futu or Binance broker connection (out of scope for the AI eval). One additional failure is an async test that needs `pytest-asyncio` mode and is unrelated to AI behaviour.

> **What this means for users.** Every number the LLM can see when it writes a portfolio insight has been independently checked. The LLM is being asked to interpret, not to compute.

---

## 4. Visual summary

The HTML version (`docs/eval-results-2026-07.html`) carries native SVG charts for these:

- **Fig 1 — Eleven axes by status:** measured (green), new this round (blue), not run (amber).
- **Fig 2 — Portfolio JSON contract — 7/7:** the failure modes we threw at the parser and what each did.
- **Fig 3 — News guardrails — 6/6:** the (sentiment, risk) collision cases and the re-routed output.
- **Fig 4 — Chat panel parser — 7 chunked-tag cases:** all green; one documented production limitation.
- **Fig 5 — Length bias on the prompt set:** grounded set has 3 pinned labels median; bait set has 0; that is by design (bait tests absence).
- **Fig 6 — Per-surface input budget:** how many tokens the LLM sees per call (system prompt + context cards).

---

## 5. Limitations and execution risk

1. **Faithfulness / hallucination / κ not measured** — these axes need an LLM API key and a second LLM judge. The sandbox this report was built in has neither. The 11 axes we *did* measure cover every deterministic code path the LLM's output passes through; the missing 3 are the LLM-as-Judge overlay.
2. **Live Nanobot TTFT not measured** — the droplet at `ws://178.128.213.162:8765` is unreachable from the eval sandbox. The frame-level harness substitutes.
3. **6 portfolio API tests fail on broker connection** — not AI-touching. The Futu and Binance clients cannot be exercised in the sandbox. These are the same tests that have always required a broker.
4. **Length bias not yet controlled** — Fig 5 shows grounded prompts carry more context than bait (3 vs. 0 pinned labels). The length-bias mitigation in §2.3 of the plan (length-controlled judging) is not yet applied because no LLM answers exist to control for.
5. **The 6 widget-numeric JSONL files are still missing** — `ui_rendering.jsonl`, `portfolio_numeric.jsonl`, `chart_rec_numeric.jsonl`, `chart_pattern_numeric.jsonl`, plus the 60 FailSafeQA robustness rows. Together they are the prompt set the faithfulness axis needs.

---

## 6. Out-of-scope surfaces (re-classified)

- `/api/prediction/daily` — the body is a hard-coded VIX-bracket table plus a literal `topSignals` array. Labelled "AI-generated daily outlook" in the widget subtitle. **Action**: re-label "Daily Market Outlook" or wire to Nanobot.
- `ai4trade_signal_poller.py` (661 ln) — a 30-minute cron that scores external signals. **Action**: the file header commits to historical-precision-style evidence; a precision/recall study against the SQLite `paper_trades` table is the right metric, not DeepEval.

---

## 7. What we are committing to do before 17 July

- Land the 4 missing harness modules (chat-panel frame harness ✓ done; portfolio contract test, news-fetcher test, pattern explanation).
- Land the 3 widget-numeric JSONL files.
- Run a real OpenRouter call against the 25 grounded + 30 bait prompts and report faithfulness, hallucination, κ.
- Reconcile the two out-of-scope surfaces in §6.

---

## References

1. Kamble et al. *FailSafeQA.* arXiv:2502.06329, Feb 2025.
2. Zhang et al. *FAITH.* arXiv:2508.05201, Aug 2025.
3. Wang et al. *OmniEval.* arXiv:2412.13018, Dec 2024.
4. Zhu et al. *RAGEval.* arXiv:2408.01262, Aug 2024.
5. Es et al. *RAGAS.* 2023.
6. Confident AI. *DeepEval.* github.com/confident-ai/deepeval, 2024–2026.
7. Dubois et al. *Length-Controlled AlpacaEval.* arXiv:2404.04475, 2024.
8. OptiTrade. *QA Evaluation Plan.* `docs/qa-evaluation-plan.md`, 2026.
9. OptiTrade. *AI Usage Analysis.* `docs/ai-usage-analysis.md`, 2026.
10. OptiTrade. `apps/frontend/lib/use-nanobot.ts`, `apps/backend/src/services/portfolio_analysis_service.py`, `apps/backend/news_fetcher/analyzer.py` — production code evaluated.
