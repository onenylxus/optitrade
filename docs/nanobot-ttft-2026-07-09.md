# Nanobot TTFT probe — 2026-07-09

- url: `ws://178.128.213.162:8765/?client_id=OptiTrade&token=capstone`
- probes attempted: 10 · successful: 9
- per-probe timeout: 50.0

## Latency summary (ms)

| metric | result |
| --- | --- |
| TTFT to first reasoning_delta (chain-of-thought begins) | min 2628 · median 3898 · mean 4887 · p95 7409 · max 7537 (n=9) |
| TTFT to first answer delta (user-facing text begins) | min 7409 · median 12920 · mean 15609 · p95 25471 · max 35541 (n=9) |
| server-reported `turn_end.latency_ms` (model's authoritative E2E) | min 7944 · median 15215 · mean 17946 · p95 29604 · max 38801 (n=9) |

## Per-probe detail

| # | question (truncated) | ready | send | TTFT-reasoning | TTFT-answer | server_latency | total |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | What's the latest news affecting AAPL? | 96 | 0 | 3041 | 11353 | 15049 | 15390 |
| 2 | Is NVDA's RSI overbought right now? | 88 | 0 | 3898 | 35541 | 38801 | 39187 |
| 3 | What's the unrealized PnL of my AAPL pos | 99 | 0 | 6866 | 14863 | 15273 | 15762 |
| 4 | Describe the chart pattern detected on T | 98 | 0 | 3714 | 12920 | 15215 | 15639 |
| 5 | What is my portfolio's biggest sector ex | 267 | 0 | 7537 | 7636 | 7944 | 8562 |
| 6 | Has the Fed signaled anything for next m | 166 | 0 | 7409 | 7409 | 9350 | 9931 |
| 7 | Show me a summary stat for NVDA's last c | 83 | 0 | 3538 | 11386 | 11857 | 12323 |
| 8 | What's the breakout level on MSFT's Asce | 89 | 0 | 5355 | 13903 | 18422 | 18777 |
| 9 | How concentrated is my portfolio in Tech | 142 | 0 | 2628 | 25471 | 29604 | 30013 |

## Failed probes

- probe 10 (What's the sentiment of today's news for JPM?): recv timeout after 50.0s
