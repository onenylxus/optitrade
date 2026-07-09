"""Aggregate faithfulness runs across all per-set JSON result files.

Reads every `eval/results/faithfulness-*.json`, combines them into a single
cross-set view, and recomputes Cohen's κ using a meaningful two-rater
comparison: the generator's binary `refusal_detected` signal vs the judge's
binary `refusal_correct` verdict. (The `self_confidence` field defaulted to
0.5 for every row because the OpenRouter generator does not emit a trailing
`__confidence__: N` line — that thresholding was degenerate.)

Outputs:
  - `eval/results/faithfulness-aggregate.md`  (human-readable)
  - `eval/results/faithfulness-aggregate.json` (raw aggregates)

Usage:
    uv run python apps/backend/eval/scripts/aggregate_faithfulness.py
"""
from __future__ import annotations

import json
import sys
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path
from statistics import mean
from typing import Any


RESULTS_DIR = Path(__file__).resolve().parents[2] / "eval" / "results"


def cohens_kappa(rater_a: list[int], rater_b: list[int]) -> float:
    assert len(rater_a) == len(rater_b)
    if not rater_a:
        return 0.0
    n = len(rater_a)
    po = sum(1 for a, b in zip(rater_a, rater_b) if a == b) / n
    p_a_1 = sum(rater_a) / n
    p_b_1 = sum(rater_b) / n
    pe = (1 - p_a_1) * (1 - p_b_1) + p_a_1 * p_b_1
    if pe == 1.0:
        return 1.0 if po == 1.0 else 0.0
    return (po - pe) / (1 - pe)


def load_all() -> list[dict[str, Any]]:
    """Concatenate every per-set faithfulness run into one list of records."""
    out: list[dict[str, Any]] = []
    for path in sorted(RESULTS_DIR.glob("faithfulness-*.json")):
        # Skip aggregate outputs from prior runs.
        if "aggregate" in path.name:
            continue
        data = json.loads(path.read_text())
        out.extend(data)
    return out


@dataclass
class GroupAgg:
    label: str
    n: int = 0
    pass_count: int = 0
    hallu_count: int = 0
    refusal_correct_count: int = 0
    refusal_detected_count: int = 0
    pass_rate: float = 0.0
    hallu_rate: float = 0.0
    refusal_correct_rate: float = 0.0
    mean_elapsed_s: float = 0.0


def aggregate(records: list[dict[str, Any]], label: str) -> GroupAgg:
    a = GroupAgg(label=label)
    a.n = len(records)
    if not records:
        return a
    a.pass_count = sum(r["judge"]["overall_pass"] for r in records)
    a.hallu_count = sum(r["judge"]["hallucination"] for r in records)
    a.refusal_correct_count = sum(r["judge"]["refusal_correct"] for r in records)
    a.refusal_detected_count = sum(1 for r in records if r["refusal_detected"])
    a.pass_rate = a.pass_count / a.n
    a.hallu_rate = a.hallu_count / a.n
    a.refusal_correct_rate = a.refusal_correct_count / a.n
    a.mean_elapsed_s = mean(r["elapsed_s"] for r in records)
    return a


def render_markdown(groups: list[GroupAgg], overall: GroupAgg, kappa: float, total_records: int) -> str:
    lines = [
        "# Faithfulness run — aggregate",
        "",
        f"- combined rows: {total_records} (from `eval/results/faithfulness-*.json`)",
        f"- generator: `qwen/qwen3-235b-a22b-2507` (OpenRouter)",
        f"- judge: `MiniMax-M3` (Anthropic-compatible)",
        "",
        "## Overall",
        "",
        "| metric | value |",
        "| --- | --- |",
        f"| pass rate | {overall.pass_rate:.1%} ({overall.pass_count}/{overall.n}) |",
        f"| hallucination rate | {overall.hallu_rate:.1%} ({overall.hallu_count}/{overall.n}) |",
        f"| refusal-correct rate (judge) | {overall.refusal_correct_rate:.1%} ({overall.refusal_correct_count}/{overall.n}) |",
        f"| refusal-detected rate (generator) | {overall.refusal_detected_count / overall.n:.1%} ({overall.refusal_detected_count}/{overall.n}) |",
        f"| Cohen's κ (refusal_detected vs refusal_correct) | {kappa:.3f} |",
        "",
        "## By prompt set",
        "",
        "| set | n | pass | hallu | refusal-correct | refusal-detected | mean s |",
        "| --- | --- | --- | --- | --- | --- | --- |",
    ]
    for g in groups:
        lines.append(
            f"| {g.label} | {g.n} | {g.pass_rate:.1%} ({g.pass_count}/{g.n}) "
            f"| {g.hallu_rate:.1%} ({g.hallu_count}/{g.n}) "
            f"| {g.refusal_correct_rate:.1%} ({g.refusal_correct_count}/{g.n}) "
            f"| {g.refusal_detected_count / max(g.n, 1):.1%} "
            f"| {g.mean_elapsed_s:.2f} |"
        )
    return "\n".join(lines) + "\n"


def main() -> int:
    if not RESULTS_DIR.exists():
        print(f"ERROR: results dir {RESULTS_DIR} does not exist", file=sys.stderr)
        return 1
    records = load_all()
    if not records:
        print("ERROR: no faithfulness-*.json result files found", file=sys.stderr)
        return 1

    # Group by source set (file stem)
    by_set: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for rec in records:
        # The first row carries the originating JSONL path indirectly via id prefix.
        # We instead group by the file the record came from.
        # NOTE: run_faithfulness.py doesn't write the input path; recover via id.
        rid = rec["id"]
        if rid.startswith("grounded-"):
            set_name = "grounded_prompts.jsonl"
        elif rid.startswith("bait-"):
            set_name = "failsafeqa_bait.jsonl"
        elif rid.startswith("port-"):
            set_name = "portfolio_numeric.jsonl"
        elif rid.startswith("crc-"):
            set_name = "chart_rec_numeric.jsonl"
        elif rid.startswith("cpn-"):
            set_name = "chart_pattern_numeric.jsonl"
        elif rid.startswith("ui-"):
            set_name = "ui_rendering.jsonl"
        elif rid.startswith("rb-"):
            set_name = "failsafeqa_robustness.jsonl"
        else:
            set_name = "(unknown)"
        by_set[set_name].append(rec)

    groups = [aggregate(rs, label=k) for k, rs in sorted(by_set.items())]
    overall = aggregate(records, label="(overall)")

    # Cohen's κ: refusal_detected (generator) vs refusal_correct (judge)
    rater_a = [1 if r["refusal_detected"] else 0 for r in records]
    rater_b = [r["judge"]["refusal_correct"] for r in records]
    kappa = cohens_kappa(rater_a, rater_b)

    md = render_markdown(groups, overall, kappa, len(records))
    md_path = RESULTS_DIR / "faithfulness-aggregate.md"
    json_path = RESULTS_DIR / "faithfulness-aggregate.json"
    md_path.write_text(md)
    json_path.write_text(json.dumps(
        {
            "overall": overall.__dict__,
            "by_set": [g.__dict__ for g in groups],
            "cohens_kappa_refusal_detected_vs_refusal_correct": kappa,
            "n_records": len(records),
        },
        indent=2,
    ))
    print(md)
    print(f"\nWrote {md_path}")
    print(f"Wrote {json_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())