# AI Usage Analysis — OptiTrade Copilot

> Companion to the COMP7705 final report. This document inventories every AI
> surface in the repo, the model it routes through, the prompt contract, the
> fallback path, and the observable telemetry. It is the canonical reference
> for the "AI Usage" section of the final report and the QA session.

**Scope.** Only AI/LLM-driven surfaces. Deterministic analytics (RSI, SMA,
chart-pattern pivot geometry, pivot-cluster support/resistance) are listed
where they form the **factual substrate** an LLM consumes, so the QA panel
can follow the "compute → feed → prompt → answer" chain end-to-end.

**As-of.** 2026-06-24. Working tree at `C:\Users\silwa\Projects\optitrade`.

---

## 1. System-level AI architecture

```
┌──────────────────────────── Frontend (Next.js 16 / React 19) ────────────────────────────┐
│                                                                                          │
│  Widgets ──export context──▶ ChatContextStore  ──inject──▶ ChatPanel ──WebSocket──▶      │
│  (candlestick, portfolio, news, earnings, market-clock)        │           nanobot       │
│                                                                 │           (178.128.…)   │
│  candlestick/portfolio ──fetch──▶ /api/ai/widget/* ──OpenRouter─▶ LLM (text + JSON)     │
│                                                                                          │
└──────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────── Backend (FastAPI, langchain-openai) ──────────────────────────┐
│                                                                                          │
│  PortfolioAnalysisService ──▶ prompt | ChatOpenAI(OpenRouter) | StrOutputParser           │
│  StockChartAnalysisService ──▶ prompt | ChatOpenAI(OpenRouter) | StrOutputParser          │
│  StockPatternAnalysisService ▶ prompt | ChatOpenAI(OpenRouter) | StrOutputParser (opt.)   │
│  news_fetcher.CloudAnalyzer ──▶ raw HTTP POST to /chat/completions                       │
│                                                                                          │
│  Deterministic substrate:                                                               │
│    stock_analytics  (RSI-14 Wilder, SMA20/50, 1/5/20-bar returns)                        │
│    stock_pattern_detection (double_top / H&S / inverse H&S / flag / pennant / cup…)      │
│    stock_support_resistance  (pivot clusters)                                            │
│                                                                                          │
└──────────────────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────── Cross-cutting ──────────────────────────────────────┐
│  LangSmith / observability: src/observability/profile.py (per-stage stock_chart profiling) │
│  Fallbacks: _fallback_analysis (portfolio), build_deterministic_pattern_explanation       │
│             (pattern), _mock_analysis (news sentiment)                                   │
│  Cache: _PATTERN_SUMMARY_CACHE (TTL-bounded + in-flight de-dup)                          │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

There are **two distinct LLM gateways** in the project — both matter for the
QA session and they have different eval profiles:

| Gateway                     | Owner                    | Purpose                                                                                  |
| --------------------------- | ------------------------ | ---------------------------------------------------------------------------------------- |
| **OpenRouter + LangChain**  | Backend (`src/services`) | Three deterministic-substrate LLM widgets (portfolio / chart / pattern).                 |
| **Nanobot WebSocket**       | Frontend (`use-nanobot`) | Free-form chat panel, including streaming `reasoning_delta`, `OpenUI Lang` rendering.   |

---

## 2. AI surface inventory

### 2.1 Portfolio AI Insight (large widget)

| Item             | Value                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------- |
| File             | `apps/backend/src/services/portfolio_analysis_service.py`                                   |
| Controller       | `apps/backend/src/api/controllers/portfolio_ai_controller.py`                              |
| Route            | `GET /api/ai/widget/portfolio` (`src/api/routes/ai_routes.py:163`)                          |
| Schema           | `src/api/schemas/ai_portfolio.py` (`PortfolioAnalysisResponse`, `PortfolioStrategyAction`) |
| Model            | OpenRouter via `langchain_openai.ChatOpenAI` (default `minimax/minimax-m2.7`)              |
| Temperature      | `0.25` (`OPENROUTER_TEMPERATURE`, clamped 0–2)                                             |
| Max tokens       | `220` default, 0 ⇒ omit, clamped 64–2048 (`OPENROUTER_MAX_OUTPUT_TOKENS`)                  |
| Timeout          | 60 s, clamped 5–300 (`OPENROUTER_REQUEST_TIMEOUT`)                                          |
| Prompt tokens    | System: ~50 lines (`SYSTEM_PROMPT`, l. 65–86). User: serialized `portfolio_json`.            |
| Output contract  | Strict JSON: `insight` (2–4 sentences), `riskLabel` (3–8 words), `riskTone` ∈ {low,medium,high}, `strategy[]` (`label`/`symbols`/`reason`), `signals[]` (per-symbol bias). |
| Deterministic substrate | Portfolio snapshot from `portfolio_service.build_portfolio_snapshot`; per-holding chart-pattern summary from `detect_chart_patterns` (cached, sem-bounded parallel fetch). |
| Fallback         | `_fallback_analysis` (deterministic concentration/PnL heuristics; no LLM call).             |
| Cache            | `_PATTERN_SUMMARY_CACHE` (key `(symbol, interval, range)`, TTL `PORTFOLIO_PATTERN_CACHE_TTL_SECONDS`=3600, error TTL 120, max concurrency 3). |
| Observability    | None at the route layer — only the inner FMP-fetch is profiled via `stock_chart_profiling_enabled`. |
| Tests            | `tests/test_portfolio_analysis_service.py` (deterministic fallback only — no live-LLM test). |

### 2.2 Stock-Chart AI Recommendation (candlestick widget)

| Item             | Value                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------- |
| File             | `apps/backend/src/services/stock_chart_analysis_service.py`                                |
| Controller       | `apps/backend/src/api/controllers/ai_recommendation_controller.py`                          |
| Route            | `GET /api/ai/widget/stock-chart` (`src/api/routes/ai_routes.py:178`)                        |
| Schema           | `src/api/schemas/ai_stock_chart.py` (`StockChartAnalysisResponse`, `MomentumSnapshot`, `TechnicalSnapshot`) |
| Model            | OpenRouter via `langchain_openai.ChatOpenAI`                                                |
| Temperature      | `0.35`                                                                                      |
| Max tokens       | `400`, clamped 64–8192                                                                      |
| Timeout          | 90 s, clamped 5–300                                                                         |
| Prompt           | System: 8-line contract enforcing 4 markdown bold sections (`Overview` / `Momentum` / `Indicators` / `Levels / Risks`) + mandatory "not investment advice" closer. |
|                 | User: `symbol`, `interval`, `range_note`, `from/to`, `metrics_json` (`MomentumSnapshot` + `TechnicalSnapshot`), `recent_candles_json` (last N bars, default 48, env-tunable). |
| Deterministic substrate | OHLC from `StockChartService.fetch_chart` (FMP) → `build_momentum_snapshot` (1/5/20-bar returns) → `build_technical_snapshot` (RSI-14 Wilder, SMA-20/50, close-vs-SMA20 %). |
| Output contract  | Markdown with 4 sections, 100-word budget, no invented prices.                              |
| Fallback         | None at route level (raises 502). No "no-LLM" branch — the LLM is required when the route is configured. |
| Cache            | None at this layer (re-invokes per request; per-key caching lives in the frontend bridge, `lib/stock-chart-bridge.ts`). |
| Observability    | `src/observability/profile.py` — per-stage timings (FMP fetch / analytics prep / OpenRouter ainvoke / total). |
| Tests            | `tests/test_ai_stock_chart.py` — RSI/momentum/technical unit tests; API JSON-aliased shape test; 503 when `OPENROUTER_API_KEY` unset (no override). |

### 2.3 Stock-Chart Pattern Analysis (overlay + explanation)

| Item             | Value                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------- |
| File             | `apps/backend/src/services/stock_pattern_analysis_service.py`                              |
| Controller       | `apps/backend/src/api/controllers/stock_chart_pattern_controller.py`                        |
| Route            | `GET /api/ai/widget/stock-chart/patterns` (`src/api/routes/ai_routes.py:34`)                 |
| Schema           | `StockChartPatternAnalysisResponse`, `ChartPatternDetection`, `ChartPatternPoint/Line`       |
| Model            | OpenRouter via `langchain_openai.ChatOpenAI` (only if `OPENROUTER_API_KEY` set)             |
| Pattern detection | Deterministic pivot-geometry: `detect_chart_patterns` — double_top, head_and_shoulders, inverse_head_and_shoulders, flag, pennant, cup_and_handle. |
| Optional LLM explanation | 90-word commentary structured as `**Pattern:**` / `**Confirmation / Risk:**` + disclaimer. |
| Fallback         | `build_deterministic_pattern_explanation` — pure template over `top.display_name`, `confidence`, `breakout_level`, `invalidation_level`. |
| `model_id`        | Either the OpenRouter model id **or** the sentinel `"deterministic-pattern-summary"` — the QA panel can grep responses for this. |
| Tests            | `tests/test_stock_chart_patterns.py` — 6 synthetic candle fixtures (one per pattern type), short-window rejection test, widget-endpoint aliasing test (falls back to deterministic when no key). |

### 2.4 Support / Resistance Overlay (deterministic — listed for completeness)

| Item             | Value                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------- |
| File             | `apps/backend/src/services/stock_support_resistance.py`                                    |
| Controller       | `apps/backend/src/api/controllers/stock_support_resistance_controller.py`                   |
| Route            | `GET /api/ai/widget/stock-chart/support-resistance`                                         |
| Method           | **Pivot-clustering, no LLM** (`method: "pivot_clusters"`).                                  |
| Role in QA       | Baseline comparator for §2.3 — pattern overlay has a deterministic twin.                    |

### 2.5 News-Widget AI Sentiment (batch pipeline)

| Item             | Value                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------- |
| Files            | `apps/backend/news_fetcher/pipeline.py`, `analyzer.py`, `config.py`                          |
| Trigger          | 15-minute cron; reads RSS sources; gates with strict keyword pre-filter before LLM call.    |
| Model            | OpenRouter raw HTTP (`requests.post`), `CLOUD_MODEL_NAME` env, default `openrouter/free`   |
| Prompt contract  | Sentiment ∈ [-1, +1], `risk_tag` ∈ {High, Medium, Low}, 3 highlights, reasoning ≤ 300 chars. |
| Guardrails       | Post-processing physical-guardrails in `analyzer.py` (l. 117–126): if `sentiment≈0` & `risk_tag∈{Medium,High}` ⇒ force `Low Risk`; if `High Risk` & `sentiment≥0` ⇒ force `-0.50`; etc. |
| Fallback         | `_mock_analysis` — keyword-driven positive/negative/neutral.                                |
| Readiness score  | Internal 0–100 quality heuristic (`calculate_readiness_score`) for the news widget; penalises empty reasoning, AI-confidence/local-score mismatch > 40, default highlights, etc. |
| Role in QA       | Side-channel to the Chatbot. Demonstrate grounding when news cards are pinned.            |

### 2.6 AI Chat Panel (Nanobot WebSocket)

| Item             | Value                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------- |
| Files            | `apps/frontend/lib/use-nanobot.ts`, `components/home/chat-panel.tsx`, `contexts/chat-context-store.tsx` |
| Endpoint         | `ws://178.128.213.162:8765/?client_id=OptiTrade&token=capstone` (hard-coded in `use-nanobot.ts:23`) |
| Wire protocol    | Custom Nanobot: `ready` / `delta` / `reasoning_delta` / `reasoning_end` / `stream_end` / `turn_end` / `message` |
| Streaming parser | `StreamingThinkParser` (incremental `<think>...</think>` tag splitter, safe over chunked tag boundaries — see §2.6.1 below) |
| Rendering        | `SmartRenderer` (Markdown + OpenUI Lang), `ThinkingBlock` (collapsible), `MessageBubble` (skips empty assistant bubbles) |
| System prompt    | `openuiChatLibrary.prompt(openuiChatPromptOptions)` — prepended on first message            |
| Context push     | `[Widget Context]\n{label}: {text}\n\nUser: …` prefix in `chat-panel.tsx:227`. Auto-clears after send (`clearAll()`). |
| Slash commands   | `/analyze`, `/portfolio`, `/news`, `/compare`, `/help` — drop-down + keyboard nav           |
| Observability    | Client-side only (status pill, typing indicator, reconnect on error/disconnect)            |
| Tests            | `apps/frontend/lib/use-nanobot.ts` parser logic is not unit-tested — high-risk for QA.        |

#### 2.6.1 Why the `StreamingThinkParser` matters for QA

The Chat panel surfaces the model's chain-of-thought to the user (the
collapsible "Thinking… / Thought process" block). The parser
(`use-nanobot.ts:46–215`) is **not** a naive regex `replace` — it carries a
small uncommitted tail so it never splits mid-tag when chunks land like
`<thi` / `nk>reasoning...` / `</thi` / `nk>answer`. This is exactly the
shape of failure that makes most `<think>`-style streaming demos leak raw
markup. The QA panel may probe this; the parser is the answer.

### 2.7 Widget Context Export (cross-cutting)

Every dashboard widget exports a plain-text `contextData = { label, text }`
that the user pins to the chat via the `Add to Context` action in
`components/dashboard/base-widget.tsx:47–59`. The texts are exactly what the
assistant sees under the `[Widget Context]` header — there is **no
serialization gap** between the widget UI and the prompt. This is the
project's "context-card provenance" claim (§1.5 of the proposal).

| Widget             | Context payload                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------------------ |
| Candlestick        | Symbol, watchlist, timeframe, interval, window-level momentum, enabled indicators, S/R levels.   |
| Portfolio (3 sizes)| Title, snapshot summary (total value / day PnL / concentration) and the deterministic insight.   |
| News (FinNews)     | Headline list with sentiment/risk badges per article; per-article highlights + reasoning.        |
| Earnings           | Earnings calendar rows.                                                                          |
| Market-Clock       | Local time per market + open/closed badge.                                                       |
| Number / Table / Chart | Title + serialized cells.                                                                     |

### 2.8 Deterministic Analytics (substrate, not "AI" — listed because QA often asks)

| Module                                | Purpose                                                            | Test coverage                          |
| ------------------------------------- | ------------------------------------------------------------------ | -------------------------------------- |
| `stock_analytics.build_momentum_snapshot` | 1-bar / 5-bar / 20-bar return percentages.                      | `test_momentum_and_technical_from_candles` |
| `stock_analytics.rsi_14_wilder`       | Wilder-style 14-period RSI.                                        | `test_rsi_14_known_trending_series`     |
| `stock_analytics.build_technical_snapshot` | SMA-20/50, last_close_vs_sma20_pct.                            | `test_momentum_and_technical_from_candles` |
| `stock_pattern_detection.detect_chart_patterns` | 6 chart patterns on OHLC pivots with confidence + breakout/invalidation levels. | 6 pattern fixtures + short-window reject |
| `stock_support_resistance`            | Pivot-cluster S/R.                                                 | `tests/test_stock_support_resistance.py` |
| Portfolio deterministic insight       | Concentration / PnL heuristic inside `_fallback_analysis`          | `test_fallback_analysis_mentions_top_holding_pattern_context` |
| News readiness score                  | 0–100 quality of AI analysis; penalises inconsistencies, empty reasoning. | implicit (no dedicated test)            |

---

## 3. Risks / sharp edges for the QA session

These are pre-emptively true statements the panel is most likely to probe.

1. **OpenRouter model id is environment-driven.** Every service falls back to
   `minimax/minimax-m2.7` if `OPENROUTER_MODEL` is unset. The default
   placeholder is intentional but the team should confirm the production
   model id for the demo recording.

2. **Three different "AI" paths, three different fallback policies.**

   | Service                       | LLM required?           | Fallback              |
   | ----------------------------- | ----------------------- | --------------------- |
   | Portfolio insight (2.1)       | Yes (when key present)  | Deterministic concentration heuristic. |
   | Stock-chart recommendation (2.2) | **Yes — hard requirement** | 502. |
   | Chart pattern explanation (2.3) | Optional             | Deterministic template. |
   | News sentiment (2.5)          | Yes (per article)        | Keyword mock + `readiness_score=50`. |
   | Chat panel (2.6)              | Yes                     | Disconnected/reconnect. |

   The QA panel will likely ask *"what happens when the model is down?"* —
   the answer is service-by-service, not project-wide.

3. **Strict-JSON parsing fragility in 2.1.** `_extract_json_object` is
   tolerant (it grabs `{…}` substring and parses), but a model that wraps
   the JSON in a markdown fence with stray prose still flips to the
   deterministic fallback. Worth demonstrating in the harness.

4. **No automated test for the streaming `<think>` parser.** The
   `StreamingThinkParser` is hand-rolled and complex. The harness should
   add unit tests at `use-nanobot.test.ts` covering the chunked-tag cases
   (probe pattern: `<thi` + `nk>...` + `</thi` + `nk>answer`).

5. **Cache key for pattern summaries.** It is
   `(symbol, interval, range)`, **not** `(symbol, interval, range, as_of)` —
   the cache is "good enough" for the widget but not for fresh-time testing.
   For the QA harness, prefer to mock `time.monotonic` so tests are stable.

6. **No rate-limit / quota handling at the route layer.** Backend only logs
   the exception (`raise RuntimeError(...)`); retry policy is up to
   `ChatOpenAI(max_retries=1)` in LangChain. News fetcher has the 15-minute
   throttle; the OpenRouter widgets do not. The QA panel will likely ask
   *"what happens under burst load?"* — answer: rate-limit failure from
   OpenRouter surfaces as 502.

7. **Chart-pattern detector is purely geometric.** It does not use volume,
   does not validate with market structure, and produces confidence as a
   geometric heuristic. The panel may ask about false-positive rate —
   answer: pattern detector unit tests assert pattern presence, not
   pattern quality over real data.

8. **Chat panel endpoint is hard-coded.** `WS_URL` in `use-nanobot.ts:23`
   points at a non-localhost server. The QA panel should be told whether
   the demo will run on a digital-ocean droplet (per the interim report
   §4.2.1.1) and whether a local fallback exists for offline demos.

---

## 4. Cross-references for the final report

- Proposal §1.5 — measurable objectives (the metric anchors below).
- Proposal §3.3 — chatbot MVP acceptance criteria (provenance + disclaimer + multi-widget).
- Proposal §3.4 — alerts evaluation (out of scope here, owned by Ng Sui Yat / Ng Wing Yin).
- Interim §3.4 — evaluation plan that this analysis operationalises.
- Interim §5 — Phase 3 schedule; this analysis feeds M4 "Hallucination-rate benchmark scored (Jul 8)".

