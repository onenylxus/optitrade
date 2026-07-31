---
name: ai4trade-following-traders
description: Manage the AI4Trade copy-trading signal pipeline — followed traders, signal poller, and portfolio sync. Use when asked about ai4trade signal setup, followed traders, or the copy-trading workflow.
---

# AI4Trade Copy-Trading Setup

## Followed Traders
- **HermesTradingX** (HermesCryptoTrader) — crypto-focused copy trader
- **raftapart** — crypto-focused, 2 active recommendations

## Signal Poller
- **Script**: `/root/.nanobot/workspace/scripts/ai4trade_signal_poller.py`
- **Paper portfolio**: `/root/optitrade-clone/apps/backend/data/paper_portfolios.json`
- **Editable portfolio**: `/root/optitrade-clone/apps/backend/data/editable_portfolio.json` (synced for PortfolioWidget)
- **Max positions**: 3
- **Stop-loss**: -8% | **Target**: +15%

## Workflow
1. Run poller → fetch followed traders' recommendations
2. Parse strategy response: look for `### <TICKER>: **BUY** (Score: X.X)` markdown blocks
3. If portfolio < 3 positions → evaluate signals against criteria (stop-loss ≤8%, target ≥15%, positive score)
4. If portfolio full → skip silently
5. Dual-write: update `paper_portfolios.json` AND sync to `editable_portfolio.json`

## Output
Brief reminder only when actionable: new signals to follow, stop-loss triggers, target-price hits. Otherwise silent.
