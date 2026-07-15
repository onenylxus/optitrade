"""Faithfulness / hallucination / κ driver for OptiTrade.

Runs the live LLM pipeline against the JSONL prompt sets and has a second
judge model (MiniMax-M3, Anthropic-compatible) score each answer along
three axes:

  - faithfulness: does the answer agree with the pinned context cards?
  - hallucination: does the answer invent facts not present in any card?
  - refusal_correctness: does the model refuse when the reference says it
    should (missing_doc, irrelevant_doc, typo, incomplete, ood, ocr_corrupt
    bait variants)?

Reports three aggregates:
  - per-surface pass rate
  - per-variant pass rate (for the FailSafeQA bait/robustness sets)
  - Cohen's κ between the generator's self-confidence (thresholded) and
    the judge's pass/fail verdict (the κ axis promised in §2.2 of the
    eval report).

Inputs
------
- .env must define OPENROUTER_API_KEY (generator) and
  ANTHROPIC_API_KEY + ANTHROPIC_BASE_URL + ANTHROPIC_MODEL (judge).
- Prompt sets: apps/backend/eval/datasets/internal/*.jsonl +
  apps/backend/eval/datasets/public/*.jsonl

Outputs
-------
- apps/backend/eval/results/faithfulness-<timestamp>.json   (raw records)
- apps/backend/eval/results/faithfulness-<timestamp>.md     (human-readable)

Usage
-----
    # Full run on the grounded set (25 prompts) — recommended first slice
    uv run python apps/backend/eval/scripts/run_faithfulness.py \\
        --input apps/backend/eval/datasets/internal/grounded_prompts.jsonl

    # Slice any set
    uv run python apps/backend/eval/scripts/run_faithfulness.py \\
        --input apps/backend/eval/datasets/public/failsafeqa_bait.jsonl --limit 5

    # All sets
    uv run python apps/backend/eval/scripts/run_faithfulness.py --all
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from statistics import mean
from typing import Any, Iterable

import httpx
from dotenv import load_dotenv

# Load .env from apps/backend/.env (gitignored). The driver reads
# OPENROUTER_API_KEY (generator) and ANTHROPIC_API_KEY (judge) from here.
_APP_BACKEND = Path(__file__).resolve().parents[2]
load_dotenv(_APP_BACKEND / ".env", override=False)

# ---------------------------------------------------------------------------
# Path bootstrap so we can import the production service
# ---------------------------------------------------------------------------

APP_BACKEND = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(APP_BACKEND))


# ---------------------------------------------------------------------------
# Config — read once from .env at the top of main()
# ---------------------------------------------------------------------------

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
GENERATOR_MODEL = os.environ.get("OPENROUTER_MODEL", "qwen/qwen3-235b-a22b-2507")

# MiniMax-M3 is Anthropic-compatible; ANTHROPIC_BASE_URL points at /anthropic
JUDGE_BASE_URL = os.environ.get("ANTHROPIC_BASE_URL", "https://api.minimaxi.com/anthropic").rstrip("/")
JUDGE_MODEL = os.environ.get("ANTHROPIC_MODEL", "MiniMax-M3")


# ---------------------------------------------------------------------------
# Result records
# ---------------------------------------------------------------------------

@dataclass
class JudgeVerdict:
    faithfulness: int         # 0 or 1
    hallucination: int        # 0 or 1
    refusal_correct: int      # 0 or 1
    overall_pass: int         # 0 or 1 (pass = faithfulness AND !hallucination)
    justification: str
    raw_judge_text: str


@dataclass
class FaithfulnessRow:
    id: str
    surface: str
    prompt: str
    variant: str | None
    reference: str
    expected_compliance_min: int | None
    pinned_labels: list[str]
    context_card_count: int
    generator_answer: str
    generator_self_confidence: float   # [0,1] parsed from response; 0.5 if absent
    refusal_detected: bool
    judge: JudgeVerdict
    elapsed_s: float


@dataclass
class Aggregate:
    total: int = 0
    pass_count: int = 0
    fail_count: int = 0
    hallucination_count: int = 0
    refusal_correct_count: int = 0
    pass_rate: float = 0.0
    hallucination_rate: float = 0.0
    refusal_correct_rate: float = 0.0
    mean_elapsed_s: float = 0.0

    @classmethod
    def from_rows(cls, rows: list[FaithfulnessRow]) -> "Aggregate":
        a = cls(total=len(rows))
        if not rows:
            return a
        a.pass_count = sum(r.judge.overall_pass for r in rows)
        a.fail_count = a.total - a.pass_count
        a.hallucination_count = sum(r.judge.hallucination for r in rows)
        a.refusal_correct_count = sum(r.judge.refusal_correct for r in rows)
        a.pass_rate = a.pass_count / a.total
        a.hallucination_rate = a.hallucination_count / a.total
        a.refusal_correct_rate = a.refusal_correct_count / a.total
        a.mean_elapsed_s = mean(r.elapsed_s for r in rows)
        return a


# ---------------------------------------------------------------------------
# Generator (OpenRouter) and Judge (MiniMax-M3) call helpers
# ---------------------------------------------------------------------------

GENERATOR_SYSTEM_PROMPT = """You are OptiTrade's assistant. Answer the user's question
using ONLY the data in the pinned context cards. If the pinned cards do not
contain the data needed to answer, say so explicitly — do not invent
numbers, prices, sectors, or sentiment.

When asked to decline or when no context is pinned, briefly explain what
context would be needed and suggest pinning the relevant widget. Always
end your answer with: "Educational only, not investment advice."

Be concise: 1–4 sentences for short questions. Markdown formatting is
acceptable for tables and bullet points but the prose must remain
readable."""


JUDGE_SYSTEM_PROMPT = """You are an impartial judge scoring an LLM's answer against a
pinned context and a gold reference.

For each (prompt, pinned context, gold reference, candidate answer), output
ONLY a JSON object with these fields:

  {
    "faithfulness":       0 | 1,    // 1 if the answer is consistent with the pinned context cards
    "hallucination":      0 | 1,    // 1 if the answer invents facts, prices, sectors, or sentiment
                                     //    NOT present in the pinned context cards
    "refusal_correct":    0 | 1,    // 1 if the answer correctly refused/redirected (when the
                                     //    reference expects a refusal) OR answered correctly
                                     //    (when the reference expects an answer)
    "overall_pass":       0 | 1,    // 1 if faithfulness=1 AND hallucination=0
    "justification":      "..."     // one-sentence reasoning, ≤30 words
  }

Rules:
- The reference is the gold answer or the expected behaviour (refusal,
  decline, redirect). The candidate answer should be compared to it.
- "faithfulness=0" only if the answer contradicts the pinned context.
- "hallucination=1" only if the answer asserts something the pinned
  context does NOT say and the reference does not endorse.
- For bait prompts where the reference says "decline to answer", a
  refusal counts as refusal_correct=1 AND overall_pass=1.
- Do not let the answer's tone or length influence the score.

Output ONLY the JSON object, nothing else."""


def _context_cards_to_text(cards: list[dict]) -> str:
    """Render a list of context cards as a compact text block for the LLM prompt."""
    if not cards:
        return "(no context cards pinned)"
    blocks = []
    for c in cards:
        ctype = c.get("type", "unknown")
        ctx_id = c.get("contextId", "")
        payload = c.get("payload", {})
        blocks.append(f"[{ctype} {ctx_id}]\n{json.dumps(payload, indent=2)}")
    return "\n\n".join(blocks)


def call_generator(
    *,
    prompt: str,
    context_cards: list[dict],
    api_key: str,
    timeout: float = 60.0,
) -> tuple[str, float]:
    """Call OpenRouter and return (answer_text, self_confidence ∈ [0,1]).

    Self-confidence is parsed from a trailing JSON line like
    `__confidence__: 0.87` if the model emits it; otherwise defaults to 0.5.
    """
    user_msg = (
        f"Question:\n{prompt}\n\n"
        f"Pinned context cards:\n{_context_cards_to_text(context_cards)}\n\n"
        "Answer using only the pinned data above. If the data is missing, "
        "say so. End with the disclaimer."
    )
    payload = {
        "model": GENERATOR_MODEL,
        "messages": [
            {"role": "system", "content": GENERATOR_SYSTEM_PROMPT},
            {"role": "user", "content": user_msg},
        ],
        "temperature": 0.2,
        "max_tokens": 600,
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    with httpx.Client(timeout=timeout) as client:
        r = client.post(OPENROUTER_URL, json=payload, headers=headers)
        r.raise_for_status()
        body = r.json()
    answer = body["choices"][0]["message"]["content"]
    # Try to parse a trailing __confidence__: N line; else default 0.5.
    confidence = 0.5
    if "__confidence__" in answer:
        for line in answer.splitlines()[::-1]:
            if "__confidence__" in line:
                try:
                    confidence = float(line.split(":", 1)[1].strip().rstrip("."))
                    confidence = max(0.0, min(1.0, confidence))
                except (ValueError, IndexError):
                    pass
                break
    return answer, confidence


def call_judge(
    *,
    prompt: str,
    context_cards: list[dict],
    candidate_answer: str,
    gold_reference: str,
    api_key: str,
    timeout: float = 60.0,
) -> JudgeVerdict:
    """Call MiniMax-M3 (Anthropic-compatible) and return a structured verdict."""
    user_msg = (
        f"PROMPT:\n{prompt}\n\n"
        f"PINNED CONTEXT CARDS:\n{_context_cards_to_text(context_cards)}\n\n"
        f"GOLD REFERENCE (expected answer or behaviour):\n{gold_reference}\n\n"
        f"CANDIDATE ANSWER:\n{candidate_answer}\n\n"
        "Score the candidate. Output only the JSON object described in the system prompt."
    )
    payload = {
        "model": JUDGE_MODEL,
        "max_tokens": 400,
        "temperature": 0.0,
        "system": JUDGE_SYSTEM_PROMPT,
        "messages": [{"role": "user", "content": user_msg}],
    }
    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
    }
    # MiniMax-M3 exposes its Anthropic-compatible endpoint at /v1/messages
    url = f"{JUDGE_BASE_URL}/v1/messages"
    with httpx.Client(timeout=timeout) as client:
        r = client.post(url, json=payload, headers=headers)
        r.raise_for_status()
        body = r.json()
    raw_text = ""
    for block in body.get("content", []):
        if block.get("type") == "text":
            raw_text += block.get("text", "")
    raw_text = raw_text.strip()

    # Try to extract the JSON object from the judge's text.
    parsed: dict[str, Any] = {}
    try:
        start = raw_text.find("{")
        end = raw_text.rfind("}")
        if start != -1 and end != -1 and end > start:
            parsed = json.loads(raw_text[start : end + 1])
    except json.JSONDecodeError:
        parsed = {}

    def _bit(key: str) -> int:
        v = parsed.get(key, 0)
        try:
            return 1 if int(v) == 1 else 0
        except (ValueError, TypeError):
            return 0

    return JudgeVerdict(
        faithfulness=_bit("faithfulness"),
        hallucination=_bit("hallucination"),
        refusal_correct=_bit("refusal_correct"),
        overall_pass=_bit("overall_pass"),
        justification=str(parsed.get("justification", "(no justification parsed)"))[:300],
        raw_judge_text=raw_text[:2000],
    )


# ---------------------------------------------------------------------------
# Cohen's κ
# ---------------------------------------------------------------------------

def cohens_kappa(rater_a: list[int], rater_b: list[int]) -> float:
    """Binary Cohen's κ. Both lists must have the same length."""
    assert len(rater_a) == len(rater_b)
    if not rater_a:
        return 0.0
    n = len(rater_a)
    po = sum(1 for a, b in zip(rater_a, rater_b) if a == b) / n
    p_a_1 = sum(rater_a) / n
    p_a_0 = 1 - p_a_1
    p_b_1 = sum(rater_b) / n
    p_b_0 = 1 - p_b_1
    pe = p_a_0 * p_b_0 + p_a_1 * p_b_1
    if pe == 1.0:
        return 1.0 if po == 1.0 else 0.0
    return (po - pe) / (1 - pe)


# ---------------------------------------------------------------------------
# Driver
# ---------------------------------------------------------------------------

def _refusal_detected(answer: str) -> bool:
    """Heuristic refusal detection — the answer starts with one of the
    canonical decline phrases or contains "I cannot" / "I don't have"."""
    low = answer.lower().lstrip()
    refusal_prefixes = (
        "i cannot", "i can't", "i'm unable", "i am unable",
        "i don't have", "i do not have", "i'm not able",
        "i need more", "no context", "no pinned",
    )
    return low.startswith(refusal_prefixes) or "no context is pinned" in low


def run_one(
    row: dict,
    *,
    openrouter_api_key: str,
    judge_api_key: str,
    timeout: float,
) -> FaithfulnessRow:
    t0 = time.monotonic()
    answer, confidence = call_generator(
        prompt=row["prompt"],
        context_cards=row.get("context_cards", []),
        api_key=openrouter_api_key,
        timeout=timeout,
    )
    refusal = _refusal_detected(answer)
    verdict = call_judge(
        prompt=row["prompt"],
        context_cards=row.get("context_cards", []),
        candidate_answer=answer,
        gold_reference=row.get("reference", ""),
        api_key=judge_api_key,
        timeout=timeout,
    )
    return FaithfulnessRow(
        id=row["id"],
        surface=row["surface"],
        prompt=row["prompt"],
        variant=(row.get("meta") or {}).get("variant"),
        reference=row.get("reference", ""),
        expected_compliance_min=row.get("expected_compliance_min"),
        pinned_labels=row.get("pinned_labels", []),
        context_card_count=len(row.get("context_cards", [])),
        generator_answer=answer,
        generator_self_confidence=confidence,
        refusal_detected=refusal,
        judge=verdict,
        elapsed_s=time.monotonic() - t0,
    )


def aggregate_by(rows: list[FaithfulnessRow], key_fn) -> dict[str, Aggregate]:
    out: dict[str, list[FaithfulnessRow]] = {}
    for r in rows:
        k = key_fn(r)
        out.setdefault(k, []).append(r)
    return {k: Aggregate.from_rows(v) for k, v in sorted(out.items())}


def render_markdown(
    rows: list[FaithfulnessRow],
    *,
    input_path: Path,
    started_at: datetime,
    finished_at: datetime,
) -> str:
    overall = Aggregate.from_rows(rows)
    by_surface = aggregate_by(rows, lambda r: r.surface)
    by_variant = aggregate_by(rows, lambda r: r.variant or "(no-variant)")

    # Cohen's κ: thresholded self-confidence (≥0.5 ⇒ pass) vs judge.overall_pass.
    rater_a = [1 if r.generator_self_confidence >= 0.5 else 0 for r in rows]
    rater_b = [r.judge.overall_pass for r in rows]
    kappa = cohens_kappa(rater_a, rater_b)

    lines = [
        f"# Faithfulness run — {started_at.isoformat()}",
        f"",
        f"- input: `{input_path}`",
        f"- generator: `{GENERATOR_MODEL}` (OpenRouter)",
        f"- judge: `{JUDGE_MODEL}` (Anthropic-compatible)",
        f"- rows: {len(rows)}",
        f"- started: `{started_at.isoformat()}`",
        f"- finished: `{finished_at.isoformat()}`",
        f"",
        f"## Overall",
        f"",
        f"| metric | value |",
        f"| --- | --- |",
        f"| pass rate | {overall.pass_rate:.1%} ({overall.pass_count}/{overall.total}) |",
        f"| hallucination rate | {overall.hallucination_rate:.1%} ({overall.hallucination_count}/{overall.total}) |",
        f"| refusal-correct rate | {overall.refusal_correct_rate:.1%} ({overall.refusal_correct_count}/{overall.total}) |",
        f"| mean elapsed / row | {overall.mean_elapsed_s:.2f} s |",
        f"| Cohen's κ (self-conf vs judge) | {kappa:.3f} |",
        f"",
        f"## By surface",
        f"",
        f"| surface | pass | hallu | refusal | mean s |",
        f"| --- | --- | --- | --- | --- |",
    ]
    for k, a in by_surface.items():
        lines.append(
            f"| {k} | {a.pass_rate:.1%} ({a.pass_count}/{a.total}) "
            f"| {a.hallucination_rate:.1%} "
            f"| {a.refusal_correct_rate:.1%} "
            f"| {a.mean_elapsed_s:.2f} |"
        )
    if len(by_variant) > 1:
        lines += [
            "",
            "## By variant",
            "",
            "| variant | pass | hallu | refusal | n |",
            "| --- | --- | --- | --- | --- |",
        ]
        for k, a in by_variant.items():
            lines.append(
                f"| {k} | {a.pass_rate:.1%} | {a.hallucination_rate:.1%} "
                f"| {a.refusal_correct_rate:.1%} | {a.total} |"
            )

    lines += ["", "## Per-row verdicts", "", "| id | surface | conf | refusal | pass | justif |", "| --- | --- | --- | --- | --- | --- |"]
    for r in rows:
        lines.append(
            f"| {r.id} | {r.surface} | {r.generator_self_confidence:.2f} "
            f"| {'yes' if r.refusal_detected else 'no'} "
            f"| {'✓' if r.judge.overall_pass else '✗'} "
            f"| {r.judge.justification[:80]} |"
        )
    return "\n".join(lines) + "\n"


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, help="path to a JSONL prompt set")
    parser.add_argument("--all", action="store_true", help="run every JSONL in datasets/")
    parser.add_argument("--limit", type=int, default=0, help="cap rows per file (0 = no cap)")
    parser.add_argument("--timeout", type=float, default=60.0)
    parser.add_argument("--out-dir", type=Path, default=APP_BACKEND / "eval" / "results")
    args = parser.parse_args(argv)

    openrouter_api_key = os.environ.get("OPENROUTER_API_KEY", "")
    judge_api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not openrouter_api_key:
        print("ERROR: OPENROUTER_API_KEY not set in env", file=sys.stderr)
        return 2
    if not judge_api_key:
        print("ERROR: ANTHROPIC_API_KEY not set in env (MiniMax-M3 judge)", file=sys.stderr)
        return 2

    if args.all:
        targets = sorted((APP_BACKEND / "eval" / "datasets").rglob("*.jsonl"))
    elif args.input:
        targets = [args.input]
    else:
        print("ERROR: pass --input <path.jsonl> or --all", file=sys.stderr)
        return 2

    args.out_dir.mkdir(parents=True, exist_ok=True)
    started = datetime.now(timezone.utc)
    ts = started.strftime("%Y%m%dT%H%M%SZ")

    all_rows: list[FaithfulnessRow] = []
    for target in targets:
        print(f"\n=== {target} ===", flush=True)
        with target.open(encoding="utf-8") as f:
            rows = [json.loads(ln) for ln in f if ln.strip()]
        if args.limit:
            rows = rows[: args.limit]
        for i, row in enumerate(rows, 1):
            try:
                fr = run_one(
                    row,
                    openrouter_api_key=openrouter_api_key,
                    judge_api_key=judge_api_key,
                    timeout=args.timeout,
                )
            except Exception as exc:
                print(f"  [{i:>3}/{len(rows)}] {row['id']} ERROR: {exc}", flush=True)
                continue
            mark = "✓" if fr.judge.overall_pass else "✗"
            print(
                f"  [{i:>3}/{len(rows)}] {fr.id:<26} "
                f"conf={fr.generator_self_confidence:.2f} "
                f"refusal={'y' if fr.refusal_detected else 'n'} "
                f"{mark} ({fr.elapsed_s:.1f}s) "
                f"{fr.judge.justification[:80]}",
                flush=True,
            )
            all_rows.append(fr)

    finished = datetime.now(timezone.utc)

    # Write JSON + markdown
    json_path = args.out_dir / f"faithfulness-{ts}.json"
    md_path = args.out_dir / f"faithfulness-{ts}.md"
    json_path.write_text(
        json.dumps(
            [asdict(r) for r in all_rows],
            indent=2,
            ensure_ascii=False,
        )
    )
    md_path.write_text(
        render_markdown(
            all_rows,
            input_path=args.input or Path("(all)"),
            started_at=started,
            finished_at=finished,
        )
    )
    print(f"\nWrote {json_path}\nWrote {md_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())