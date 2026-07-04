"""Validate every internal/public jsonl in eval/datasets/.

Enforces the canonical schema documented in apps/backend/eval/README.md
§"Canonical row schema" and §"Canonical meta schema".

Exits non-zero if any required field is missing on any row.
Reports (does not error) on missing expected files.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2] / "eval" / "datasets"

REQUIRED_TOP_LEVEL = {"id", "surface", "prompt", "context_cards", "pinned_labels",
                      "reference", "disclaimer_required", "meta"}

CANONICAL_META = {"source", "methodology", "license", "version",
                  "created_by", "source_id", "provenance"}

ALLOWED_SOURCES = {
    "optitrade_native",
    "hf_failsafeqa",
    "deepeval_synthesizer",
    "hf_omnieval",
}

ALLOWED_METHODOLOGIES = {
    "hand",
    "failsafeqa_v1",
    "deepeval_synth_v1",
    "faith_v1",
    "ragas_v1",
    "hf_pull",
}

ALLOWED_LICENSES = {"internal", "CC-BY-4.0", "MIT", "Apache-2.0"}

# Files the README promises; missing → WARN, not FAIL.
EXPECTED_FILES = [
    ROOT / "internal" / "grounded_prompts.jsonl",
    ROOT / "internal" / "ui_rendering.jsonl",
    ROOT / "internal" / "portfolio_numeric.jsonl",
    ROOT / "internal" / "chart_rec_numeric.jsonl",
    ROOT / "internal" / "chart_pattern_numeric.jsonl",
    ROOT / "public" / "failsafeqa_bait.jsonl",
    ROOT / "public" / "failsafeqa_robustness.jsonl",
]


def _validate_row(row: dict, *, src_path: Path, line_no: int) -> list[str]:
    errs: list[str] = []
    missing_top = REQUIRED_TOP_LEVEL - set(row)
    if missing_top:
        errs.append(f"{src_path.name}:{line_no} missing top-level fields {sorted(missing_top)}")

    meta = row.get("meta")
    if not isinstance(meta, dict):
        errs.append(f"{src_path.name}:{line_no} meta must be a dict")
    else:
        missing_meta = CANONICAL_META - set(meta)
        if missing_meta:
            errs.append(
                f"{src_path.name}:{line_no} missing canonical meta fields {sorted(missing_meta)}"
            )
        if "source" in meta and meta["source"] not in ALLOWED_SOURCES:
            errs.append(
                f"{src_path.name}:{line_no} meta.source={meta['source']!r} "
                f"not in {sorted(ALLOWED_SOURCES)}"
            )
        if "methodology" in meta and meta["methodology"] not in ALLOWED_METHODOLOGIES:
            errs.append(
                f"{src_path.name}:{line_no} meta.methodology={meta['methodology']!r} "
                f"not in {sorted(ALLOWED_METHODOLOGIES)}"
            )
        if "license" in meta and meta["license"] not in ALLOWED_LICENSES:
            errs.append(
                f"{src_path.name}:{line_no} meta.license={meta['license']!r} "
                f"not in {sorted(ALLOWED_LICENSES)}"
            )

    return errs


def main() -> int:
    # Report missing expected files first (warning, not failure).
    print("=== expected files (missing → WIP) ===")
    for p in EXPECTED_FILES:
        status = "OK" if p.exists() else "MISSING (WIP)"
        print(f"  [{status}] {p.relative_to(ROOT.parent.parent.parent)}")

    print("\n=== present files ===")
    all_errors: list[str] = []
    for p in sorted(ROOT.rglob("*.jsonl")):
        rel = p.relative_to(ROOT.parent.parent.parent)
        if not p.exists() or p.stat().st_size == 0:
            print(f"  [EMPTY]  {rel}")
            continue
        try:
            with p.open(encoding="utf-8") as f:
                lines = [ln for ln in (line.strip() for line in f) if ln]
        except OSError as exc:
            print(f"  [ERROR]  {rel}: {exc}")
            all_errors.append(f"{rel}: {exc}")
            continue

        if not lines:
            print(f"  [EMPTY]  {rel}")
            continue

        rows = []
        parse_errors: list[str] = []
        for i, ln in enumerate(lines, 1):
            try:
                rows.append(json.loads(ln))
            except json.JSONDecodeError as exc:
                parse_errors.append(f"{rel}:{i} JSON parse error: {exc}")
        for e in parse_errors:
            all_errors.append(e)

        surfaces = sorted({r.get("surface", "?") for r in rows})
        for i, r in enumerate(rows, 1):
            all_errors.extend(_validate_row(r, src_path=p, line_no=i))

        print(f"  [OK]     {rel}")
        print(f"           rows: {len(rows)}")
        print(f"           surfaces: {surfaces}")
        print(f"           first id: {rows[0].get('id')}, last id: {rows[-1].get('id')}")

    if all_errors:
        print("\n=== ERRORS ===")
        for e in all_errors:
            print(f"  - {e}")
        return 1

    print("\nAll present files valid.")
    return 0


if __name__ == "__main__":
    sys.exit(main())