# Faithfulness run — aggregate

- combined rows: 209 (from `eval/results/faithfulness-*.json`)
- generator: `qwen/qwen3-235b-a22b-2507` (OpenRouter)
- judge: `MiniMax-M3` (Anthropic-compatible)

## Overall

| metric | value |
| --- | --- |
| pass rate | 98.1% (205/209) |
| hallucination rate | 1.4% (3/209) |
| refusal-correct rate (judge) | 90.4% (189/209) |
| refusal-detected rate (generator) | 10.5% (22/209) |
| Cohen's κ (refusal_detected vs refusal_correct) | -0.034 |

## By prompt set

| set | n | pass | hallu | refusal-correct | refusal-detected | mean s |
| --- | --- | --- | --- | --- | --- | --- |
| chart_pattern_numeric.jsonl | 24 | 100.0% (24/24) | 0.0% (0/24) | 100.0% (24/24) | 0.0% | 5.42 |
| chart_rec_numeric.jsonl | 24 | 100.0% (24/24) | 0.0% (0/24) | 100.0% (24/24) | 0.0% | 9.48 |
| failsafeqa_bait.jsonl | 30 | 96.7% (29/30) | 3.3% (1/30) | 96.7% (29/30) | 16.7% | 5.64 |
| failsafeqa_robustness.jsonl | 60 | 100.0% (60/60) | 0.0% (0/60) | 98.3% (59/60) | 18.3% | 4.93 |
| grounded_prompts.jsonl | 26 | 88.5% (23/26) | 7.7% (2/26) | 88.5% (23/26) | 0.0% | 6.45 |
| portfolio_numeric.jsonl | 25 | 100.0% (25/25) | 0.0% (0/25) | 100.0% (25/25) | 0.0% | 6.18 |
| ui_rendering.jsonl | 20 | 100.0% (20/20) | 0.0% (0/20) | 25.0% (5/20) | 30.0% | 4.72 |
