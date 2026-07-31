---
name: earnings-covered-call
description: Identify high-IV stocks with upcoming earnings → sell short calls 5-7 days out near current price → collect elevated premium → manage assignment risk if stock gaps up past strike. Use when user asks about earnings plays, IV crush strategies, covered calls on earnings, or selling premium around binary events.
---

# Earnings Covered Call Strategy

## When to Use

- Stock has earnings within 5-7 days
- Implied Volatility (IV) Rank > 50% (ideally >60%)
- User wants income generation or reduce cost basis on existing shares
- NOT for new share purchases unless conviction is very high (IV crush works against buyers)

## Steps

### 1. Screen for Candidates
- Run `options <TICKER>` to get IV Rank
- Target: IV Rank > 60%, earnings within 1 week
- Confirm: no major binary risks (FDA decisions, merger votes) — only earnings

### 2. Analyze the Setup
- Current stock price vs recent range
- Earnings date and time (before/after market)
- Historical post-earnings move (typically ±5-15%)
- IV crush magnitude: options will lose 30-60% of premium post-earnings

### 3. Choose Strike & Expiry
- **Expiry**: Pick the shortest-dated cycle that covers earnings (e.g., 6-7 DTE)
- **Strike**: Near current price (ATM to +5% OTM)
- Avoid deep ITM calls — early assignment risk
- Avoid deep OTM calls — low premium, high pin risk

### 4. Calculate Premium
```
Max profit = premium received (if stock stays below strike at expiry)
Assignment risk = stock gaps above strike through earnings
```

### 5. Manage Post-Earnings
- **Stock below strike**: Keep premium, let options expire. Consider rolling or selling another covered call
- **Stock above strike**: Assigned — you sell shares at strike. Calculate if the gain (strike - cost basis + premium) beats holding through the move
- **Stock explodes +20%+**: Evaluate buying back the call to cap losses vs holding assignment

### 6. Risk Checklist
- □ Premium collected vs assignment opportunity cost
- □ Max loss if stock drops 20% post-earnings
- □ Can you afford assignment (capital tied up)?
- □ Is this a new position or scaling existing?

## Output Format

```
🎯 EARNINGS COVERED CALL: <TICKER>

📅 Earnings: <DATE> (<N> days)
📊 IV Rank: <X>% | IV: <X>%
💰 Stock: $<PRICE>

CALL OPTION:
  Strike: $<STRIKE> (ATM/+X%)
  Expiry: <DATE> (X DTE)
  Premium: $<PREMIUM>/share

⏱️ IF ASSIGNED: Sell at $<STRIKE>
💵 NET: Strike gain + premium − share cost basis

⚠️ RISK: IV crush if held; assignment above strike
```

## Example

FIG earnings May 14 → May 16 $25 Call
- IV Rank 67.58% → premium elevated
- Sell $25 call (near current ~$24), May 16 expiry (6 DTE)
- Collect ~$2-3 premium
- If assigned: sell at $25, net ~$27-28 effective exit
- If not assigned: keep premium, reassess

---