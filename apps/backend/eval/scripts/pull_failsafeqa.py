"""Pull FailSafeQA from HuggingFace and emit OptiTrade-adapted bait + robustness rows.

Run once HF access is confirmed:

    export HF_ENDPOINT=https://hf-mirror.com        # if behind a mirror
    uv add datasets huggingface_hub
    uv run python apps/backend/eval/scripts/pull_failsafeqa.py

This script will:
  1. Load `Writer/FailSafeQA` via `datasets.load_dataset`.
  2. Sample 5 base questions × 6 variants  → 30 rows  → failsafeqa_bait.jsonl
  3. Sample 10 base questions × 6 variants → 60 rows  → failsafeqa_robustness.jsonl
  4. Replace each SEC 10-K context payload with an OptiTrade widget snapshot
     of equivalent topic (Portfolio / Chart / Pattern / News).
  5. Preserve the FailSafeQA `meta.source_id` and `meta.license=CC-BY-4.0`
     fields so the report can cite the paper properly.

Until this script runs, `apps/backend/eval/datasets/public/failsafeqa_bait.jsonl`
contains a 30-row OptiTrade-native seed (see `scripts/generate_bait.py`)
that follows the same 6-variant perturbation methodology without
shipping the HF data through this repo.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

OUT_DIR = Path(__file__).resolve().parents[2] / "eval" / "datasets" / "public"
HF_DATASET_ID = "Writer/FailSafeQA"

VARIANT_TAG_TO_INDEX = {
    "clean":          0,
    "typo":           1,
    "incomplete":     2,
    "out_of_domain":  3,
    "ocr_corrupt":    4,
    "missing_doc":    5,
    "irrelevant_doc": 6,
}


def main() -> None:
    try:
        from datasets import load_dataset
    except ImportError as exc:
        raise SystemExit(
            "datasets / huggingface_hub not installed.\n"
            "Run: uv add datasets huggingface_hub"
        ) from exc

    if os.environ.get("HF_ENDPOINT"):
        os.environ.setdefault("HF_HUB_DOWNLOAD_TIMEOUT", "60")

    print(f"Loading {HF_DATASET_ID} ...")
    ds = load_dataset(HF_DATASET_ID)
    base = ds["train"] if "train" in ds else next(iter(ds.values()))
    print(f"Loaded {len(base)} rows from {HF_DATASET_ID}")

    # Sample 15 base questions (5 for bait, 10 for robustness) and emit rows.
    # The exact sampling logic depends on FailSafeQA's per-variant column
    # layout, which is verified after the first load. See README in
    # apps/backend/eval/datasets/public/README.md §"FailSafeQA" for the
    # column mapping we expect.
    raise NotImplementedError(
        "Wire the column mapping once you've inspected `base.features` in a "
        "REPL. The seed file `failsafeqa_bait.jsonl` already follows the "
        "6-variant pattern with OptiTrade-native base questions."
    )


if __name__ == "__main__":
    main()