---
name: earnings-analysis-workflow
description: Analyze earnings results using a 5-step framework. Use when user asks about earnings analysis, Q results, beat/miss evaluation, guidance changes, or operational signals for any stock.
---

# Earnings Analysis Workflow

Analyze every earnings report through this 5-step framework before forming any opinion or recommendation.

## Step 1 — Revenue Beat/Miss

- Fetch consensus estimate vs actual reported revenue
- Calculate the beat/miss percentage
- Context: Which segments drove the beat? Any headwinds cited?

**Tools**: `read_file` `/root/.nanobot/workspace/scripts/stock_data.py` → run `financials <TICKER>`, then cross-reference analyst consensus via web search.

## Step 2 — EPS Beat/Miss

- Consensus EPS vs actual EPS
- Beat/miss percentage and magnitude
- GAAP vs Non-GAAP — which number matters for valuation?

**Output format**: `EPS: $X.XX actual vs $X.XX consensus → [BEAT/MISS] by Y%`

## Step 3 — Guidance (Management Forward-Looking)

- Did mgmt raise, lower, or maintain full-year guidance?
- Key metrics watched: Revenue guidance, EBITDA margins, subscriber counts, ARR, free cash flow
- Language tone: Cautious → neutral → confident
- Compare to analyst consensus — who was closer?

**Critical**: Guidance changes move stocks more than the actual print in after-hours.

## Step 4 — Market Pricing Reaction

- AH price reaction % — immediately discounts consensus
- What does the market think? Price in 1 day, 1 week
- Compare to historical reactions: Same-company past beats with similar magnitude → how did stock move?
- Identify if stock is undervalued/overvalued relative to the reaction

**Rule**: AH reaction ≠ next-day move. Check options implied vol and sentiment before assuming gap holds.

## Step 5 — Operational Signal (The Decision)

```
IF guidance raised + AH reaction positive + valuation reasonable
  → Signal: BUILD / ADD position
  → Check covered call entry if IV is elevated (use earnings-covered-call skill)

IF guidance maintained + AH flat + valuation neutral  
  → Signal: HOLD / monitor

IF guidance lowered OR AH reaction negative + high valuation
  → Signal: REDUCE / EXIT / wait for pullback
  → Check if catalyst still intact (product cycle, market share, macro dependency)

IF revenue miss + no credible explanation
  → Signal: EXIT immediately, fundamental deterioration
```

---

## Example Output

```
TICKER — Q1 2026 Earnings Analysis

Step 1: Revenue: $1.24B vs $1.18B consensus → BEAT by +5.1%
  → Design revenue +18% YoY; Enterprise +22% YoY

Step 2: EPS: $0.89 vs $0.74 consensus → BEAT by +20%
  → Non-GAAP, GAAP was $0.61

Step 3: Guidance: Q2 revenue raised to $1.28-1.30B (vs $1.22B consensus)
  → Management tone: CONFIDENT
  → Raises full-year revenue by +8%

Step 4: AH Reaction: +12% after-hours → stock at $20.66
  → Forward PE 72x — expensive relative to growth
  → Historical: Q4 2025 beat +8% → next day +4% → 1w later +11%

Step 5: Signal: HOLD
  → Beat was real, guidance solid, BUT valuation stretched
  → Wait for pullback to $18-19 before adding
  → If already holding shares: consider covered call at $22-23 strike
```

---

## Pro Tips

- **Look at the conference call transcript** (web search for "Q1 2026 earnings call transcript TICKER") — mgmt language reveals more than the press release
- **Segment breakdown** tells the real story — is growth broadening or concentrated?
- **Free cash flow** vs EPS — companies that miss FCF but beat EPS are flagging future problems
- **Guidance vs consensus gap** — if mgmt raises but still低于 analyst high, stock may still have room
- **Options market** before earnings: check IV Rank — if >40%, premium is rich, selling covered calls attractive

## Output Format

Always structure earnings analysis as:
1. Revenue beat/miss + segments
2. EPS beat/miss + GAAP vs Non-GAAP
3. Guidance change + mgmt tone
4. AH reaction + valuation context
5. Clear operational signal (BUILD / HOLD / REDUCE / EXIT) with specific price levels
