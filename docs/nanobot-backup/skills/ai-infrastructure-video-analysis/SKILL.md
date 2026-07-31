---
name: ai-infrastructure-video-analysis
description: Watch a financial video → extract the investment thesis → fetch real-time prices for mentioned tickers → score opportunities → recommend specific entry zones with pullback targets and max loss calculations. Use when user shares a video about AI infrastructure, semiconductor trends, or tech investment themes.
---

# AI Infrastructure Video Analysis

Transform a video into an actionable trade setup in 4 steps.

## When to Use

- User shares a YouTube/video about AI infrastructure, semiconductors, or tech investment themes
- Extracting a tradeable thesis from video content
- Building a watchlist from video recommendations
- Confirming or challenging existing positions based on new research

---

## Step 1 — Extract the Thesis

Use the `summarize` skill or read the transcript. Extract:

- **Core theme**: What is the video arguing? (e.g., "GPU war → optical network relay")
- **Key tickers mentioned**: Stocks, ETFs, or sectors
- **Catalysts identified**: Capex growth, product cycles, policy, demand data
- **Valuation signals**: Forward PE comparisons, historical multiples
- **Contrarian points**: What does the market think vs what the video says?

**Output**: Bullet summary of the thesis in 3-5 sentences.

---

## Step 2 — Fetch Real-Time Prices

Run `stock_data.py` via exec for each mentioned ticker:

```bash
cd /root/.nanobot/workspace && source venv/bin/activate && python scripts/stock_data.py <TICKER>
```

For each ticker, capture:
- Current price and daily change %
- Forward PE ratio
- 52-week high (ATH) proximity
- Volume and beta
- Note if near ATH (strong momentum) or near 52w low (contrarian entry)

**Rule**: Every price MUST be fetched fresh. Never reuse stale numbers.

---

## Step 3 — Score Opportunities

Score each ticker on a 5-point scale across these dimensions:

| Factor | 5 pts | 3 pts | 1 pt |
|--------|-------|-------|------|
| **Forward PE** | <15x (cheap) | 15-30x | >30x (expensive) |
| **ATH Proximity** | Within 2% of 52w High | 5-15% below | >15% below |
| **Daily Change** | +3% to +8% (momentum) | +0-3% or -0-3% | >3% decline |
| **Thesis Alignment** | Core bet (directly mentioned) | Supporting cast | Tangential |
| **Catalyst Strength** | Q2/Q3 earnings imminent | Capex data confirmed | Vague timeline |

**Total score**: 20-25 pts = BUY, 12-19 pts = HOLD/WAIT, <12 pts = SKIP

**Example scoring table**:
| Ticker | Fwd PE | ATH Dist | Daily % | Thesis | Catalyst | Score | Signal |
|--------|--------|----------|---------|--------|----------|-------|--------|
| MU | 7.3x | 0% | +15.5% | Direct | Earnings beat | 22 | BUY (wait pullback) |
| COHR | 41.8x | 8% | +5.0% | Direct | Q2 earnings | 16 | HOLD |
| AAOI | 31.2x | 22% | -5.5% | Peripheral | None | 8 | SKIP |

---

## Step 4 — Recommend Specific Entries

For each BUY/HOLD signal:

### Pullback Entry Zones
- If AT ATH or within 5% of ATH → **wait for pullback**
- Pullback target = 52w High × (0.85–0.92) or specific support level
- Example: MU at $747 (ATH) → wait for $650-680 (-8% to -13%)

### Position Sizing Template
```
1. Max loss per trade: ≤10% of available capital
2. Shares = (capital × risk%) / (entry - stop)
3. Position cap: ≤20% of total portfolio
4. Always answer: Target / Stop / Max Loss% / Position%
```

### Max Loss Calculation
```
Max Loss = (Shares × (Entry Price - Stop Price))
Max Loss % = Max Loss / Total Capital
```

---

## Example Workflow

**Input**: Video: "AI Data Transmission War — GPU Bottleneck Shifts to Fiber"

**Step 1 — Thesis**:
- GPU compute (NVDA) is saturating → data transmission becomes the new bottleneck
- Fiber optics / optical modules / HBM memory / AI storage are next
- Big-5 hyperscaler 2026 capex: $705B (+67% YoY)
- NVDA Jensen: "Copper wires are not enough, need optical connections"

**Step 2 — Prices**:
```
MU:   $746.81 | +15.52% | Fwd PE 7.3x | AT ATH
WDC:  $480    | +3.47%  | Fwd PE 27.6x | Near ATH ($483.87)
COHR: $335.26 | +5.03%  | Fwd PE 41.8x | 8% below 52w High
GLW:  $186.94 | +2.49%  | Fwd PE 44.4x | 6% below 52w High
AAOI: $148.94 | -5.46%  | Fwd PE 31.2x | 22% below 52w High
LITE: $903.80 | +1.23%  | Fwd PE 50.2x | 11% below 52w High
```

**Step 3 — Scoring**:
| Ticker | Score | Signal |
|--------|-------|--------|
| MU | 22/25 | BUY — cheapest HBM leader, AT ATH, wait pullback $650-680 |
| WDC | 19/25 | HOLD — storage cycle intact, near ATH, hold existing |
| COHR | 16/25 | HOLD — optical core, Q2 earnings catalyst ahead |
| GLW | 14/25 | HOLD — fiber infrastructure, approaching ATH |
| LITE | 13/25 | HOLD — NVDA加持, Q2 earnings |
| AAOI | 8/25 | SKIP — weakest today, needs stabilization |

**Step 4 — Entry Plan**:
```
MU:
  Entry: Wait $650-680 (pullback)
  Target: $800+ (new ATH + momentum)
  Stop: $620 (immediate support)
  Max Loss: 8-10%
  Action: Alert when price enters zone

WDC:
  Entry: Hold existing — near ATH, no pullback available
  Target: $550+ (+15%)
  Stop: $440 (-8%)
  
COHR:
  Entry: Hold, or add on 5% pullback to ~$318
  Target: $380+ (52w High $364.80)
  Stop: $295 (-12%)
  
AAOI:
  Entry: SKIP for now — down -5.46% today, no catalyst
  Re-evaluate: If stabilizes at $140+ with +3% back above 50d MA
```

---

## Output Format

```
# 📺 Video Thesis: [Title]

## 🎯 Core Thesis (3 sentences)
...

## 📊 Price Scan
[Table with all mentioned tickers]

## 🏆 Opportunity Ranking
1. [TICKER] — Score: XX/25 — [BUY/HOLD/WAIT/SKIP]
2. ...

## 🎯 Action Plan
| Stock | Signal | Entry | Target | Stop | Max Loss |
|-------|--------|-------|--------|------|----------|
| XXX | BUY | $X | $X | $X | X% |

⚠️ Reminder: Before any trade — target/stop/loss%/position%/%impact?
```

---

## Key Reminders

- **Always fetch fresh prices** — never use stale numbers from previous sessions
- **ATH stocks**: Momentum is real, but waiting for 8-13% pullback improves risk/reward
- **Scoring is directional, not absolute** — compare tickers within the same video thesis
- **MU is special**: Fwd PE 7.3x is historically cheap for HBM leader at ATH — pullback = gift
- **AAOI weakness**: -5% on heavy volume without clear catalyst = institutional exit = wait
- **Q2 earnings**: COHR/LITE earnings are binary catalysts — check earnings-covered-call skill if selling premium