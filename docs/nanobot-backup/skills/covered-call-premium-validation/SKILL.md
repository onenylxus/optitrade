---
name: covered-call-premium-validation
description: Before executing a covered call, calculate the actual option premium per contract using Black-Scholes with current IV and compare against user expectations to correct inflated math.
---

# Covered Call Premium Validation

## When to Use

- User asks about selling a covered call and mentions an expected premium amount
- User references a specific dollar figure ("I heard I can get $5,000 premium")
- Assistant is about to confirm a covered call trade without verifying the math first
- IV is elevated (earnings approaching) and user wants to know the realistic premium

## Steps

```
1. Fetch current stock price, IV (implied volatility), and days to expiry
2. Run Black-Scholes for the target strike (or use market option chain data if available)
3. Calculate premium per contract = delta_premium × 100 shares
4. Compare against user expectation
5. If user expectation > 2× actual → correct before executing
```

## Formula

```
Premium per contract = Option Price × 100
Black-Scholes call price = S × N(d1) - K × e^(-rT) × N(d2)
where:
  S = current stock price
  K = strike price
  r = risk-free rate (use ~5.3% for 2026)
  T = time to expiry in years
  d1 = (ln(S/K) + (r + σ²/2)T) / (σ√T)
  d2 = d1 - σ√T
  σ = implied volatility
```

## Key Rules

- **Never confirm a trade without validating the user's math first**
- If user expects $5,680 and reality is ~$73 → flag the discrepancy immediately
- Short-dated options (< 7 DTE) have minimal premium even with high IV — explain IV crush risk
- Use realistic numbers: DTE ~5-7, IV from options chain or estimate ~60-80% for earnings plays

## Example

**User says**: "I'll sell a $21.5 call on FIG and collect ~$5,680 premium (2 contracts × $28.40)"

**Assistant validates**:
```
FIG price: $21.03 | IV: ~65% | DTE: 5 days | Strike: $21.5 (OTM by ~$0.47)

Black-Scholes estimate:
  d1 = (ln(21.03/21.5) + (0.053 + 0.4225/2) × (5/365)) / (0.65 × √(5/365))
  ≈ (ln(0.978) + 0.0003) / 0.048 ≈ (-0.022 + 0.0003) / 0.048 ≈ -0.45

  N(d1) ≈ 0.33 | N(d2) ≈ 0.33
  Call ≈ 21.03 × 0.33 - 21.5 × e^(-0.053 × 0.0137) × 0.33
  ≈ 6.94 - 7.11 × 0.9993 × 0.33 ≈ 6.94 - 2.35 ≈ $0.37 per share

Actual premium per contract: $0.37 × 100 = $37
2 contracts: $37 × 2 = $73
```

**Correction**: "Timmy, FIG's IV isn't that high and the strike is only $0.47 OTM — the actual premium for 2 contracts is closer to **$73**, not $5,680. That changes the risk/reward significantly."

## Output Format

```
## Premium Validation — [TICKER] Covered Call

| Parameter | Value |
|-----------|-------|
| Stock Price | $XX |
| Strike | $XX (X% OTM) |
| IV | X% |
| DTE | X days |
| Est. Premium/Contract | $XX |
| Total (X contracts) | $XX |
| Your Expectation | $XX |
| **Correction** | $XX |

⚠️ [BUY/SKIP based on corrected math]
```
