"""Length-bias measurement on the present prompt set.

Reports the median prompt length (chars and words) and the distribution of
pinned-label counts per set. Length bias is a known confounder for LLM-as-Judge
metrics: longer answers are rated more favourably independent of correctness
(Dubois et al., arXiv:2404.04475).

We don't have any LLM answers to measure the other side of the bias, so this
reports:
  - prompt length distribution (per set)
  - pinned-label count distribution (proxy for context complexity)
  - estimated system-prompt + context-card token cost per surface (the
    *answer-length budget* the LLM has to work with)

The system-prompt token counts come from the production services' literal
SYSTEM_PROMPT strings.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

# Locate the SYSTEM_PROMPT strings from the production services. We extract
# the literal string contents from the source files (no import side effects
# — these services depend on pydantic/langchain which we don't need to load).
ROOT = Path(__file__).resolve().parents[2] / "src" / "services"
NEWS_ROOT = Path(__file__).resolve().parents[2] / "news_fetcher"


def _extract_top_level_string(path: Path, name: str = "SYSTEM_PROMPT") -> str | None:
    # Pull `NAME = triple-quoted-block` from a .py source file without importing
    # it (the production services depend on pydantic/langchain).
    if not path.exists():
        return None
    text = path.read_text()
    m = re.search(
        rf'^{name}\s*=\s*(?:"""([\s\S]*?)"""|\'\'\'([\s\S]*?)\'\'\')',
        text,
        re.MULTILINE,
    )
    if not m:
        return None
    return m.group(1) or m.group(2)


def _extract_inline_prompt(path: Path, search: str = "You are a professional financial news analyst") -> str | None:
    # News analyzer builds the prompt inline inside `analyze()`. Find the
    # triple-quoted block that starts with the given prefix and return it.
    if not path.exists():
        return None
    text = path.read_text()
    m = re.search(
        rf'"""([^"]*{re.escape(search)}[\s\S]*?)"""',
        text,
    )
    if not m:
        return None
    return m.group(1)


PORTFOLIO_SP = _extract_top_level_string(ROOT / "portfolio_analysis_service.py")
CHART_SP = _extract_top_level_string(ROOT / "stock_chart_analysis_service.py")
NEWS_SP = _extract_inline_prompt(NEWS_ROOT / "analyzer.py")
_OK_PORTFOLIO = PORTFOLIO_SP is not None
_OK_CHART = CHART_SP is not None
_OK_NEWS = NEWS_SP is not None

ROOT = Path(__file__).resolve().parents[1] / "datasets"


def _token_estimate(s: str | None) -> int:
    """Rough char/4 token estimate — close enough for budget reporting."""
    if not s:
        return 0
    return max(1, round(len(s) / 4))


def _card_tokens(card: dict) -> int:
    """Approximate context-card token cost as a JSON-serialised chunk."""
    return _token_estimate(json.dumps(card, separators=(",", ":")))


def _stats(values: list[int]) -> dict:
    if not values:
        return {"n": 0, "min": 0, "max": 0, "median": 0, "p25": 0, "p75": 0, "mean": 0}
    s = sorted(values)
    n = len(s)
    return {
        "n":      n,
        "min":    s[0],
        "max":    s[-1],
        "median": s[n // 2] if n % 2 else (s[n // 2 - 1] + s[n // 2]) // 2,
        "p25":    s[n // 4],
        "p75":    s[(3 * n) // 4],
        "mean":   round(sum(s) / n, 1),
    }


def _load_jsonl(path: Path) -> list[dict]:
    if not path.exists():
        return []
    out = []
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            out.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return out


def analyze_set(rows: list[dict], label: str) -> dict:
    prompt_chars = [len(r.get("prompt", "")) for r in rows]
    prompt_words = [len(re.findall(r"\b\w+\b", r.get("prompt", ""))) for r in rows]
    pinned_counts = [len(r.get("pinned_labels", []) or []) for r in rows]
    context_card_counts = [len(r.get("context_cards", []) or []) for r in rows]
    surfaces: dict[str, int] = {}
    for r in rows:
        s = r.get("surface", "unknown")
        surfaces[s] = surfaces.get(s, 0) + 1
    return {
        "set":                  label,
        "n_prompts":            len(rows),
        "prompt_chars":         _stats(prompt_chars),
        "prompt_words":         _stats(prompt_words),
        "pinned_label_count":   _stats(pinned_counts),
        "context_card_count":   _stats(context_card_counts),
        "surfaces":             surfaces,
    }


def main() -> int:
    sets: list[tuple[str, Path]] = [
        ("grounded",  ROOT / "internal" / "grounded_prompts.jsonl"),
        ("bait",      ROOT / "public" / "failsafeqa_bait.jsonl"),
    ]
    by_set: dict[str, dict] = {}
    for label, path in sets:
        rows = _load_jsonl(path)
        by_set[label] = analyze_set(rows, label)

    sp_chars = {
        "portfolio":  len(PORTFOLIO_SP) if PORTFOLIO_SP else 0,
        "stock_chart": len(CHART_SP) if CHART_SP else 0,
        "news":       len(NEWS_SP) if NEWS_SP else 0,
    }
    sp_tokens = {k: _token_estimate(PORTFOLIO_SP if k == "portfolio"
                                    else CHART_SP if k == "stock_chart"
                                    else NEWS_SP) for k in sp_chars}

    # Compute average context-card token cost per surface across the 25 grounded
    # prompts (they all have context cards).
    grounded = _load_jsonl(ROOT / "internal" / "grounded_prompts.jsonl")
    card_tokens_by_surface: dict[str, list[int]] = {}
    for r in grounded:
        surf = r.get("surface", "unknown")
        cards = r.get("context_cards", []) or []
        card_tokens_by_surface.setdefault(surf, []).append(
            sum(_card_tokens(c) for c in cards)
        )
    avg_card_tokens = {
        surf: round(sum(xs) / len(xs), 1) if xs else 0
        for surf, xs in card_tokens_by_surface.items()
    }

    # Composite: how much context we feed per call (system prompt + cards).
    surface_totals: dict[str, int] = {}
    for surf, avg in avg_card_tokens.items():
        sp_t = sp_tokens.get({
            "chatbot":      "portfolio",
            "portfolio":    "portfolio",
            "stock_chart":  "stock_chart",
            "news":         "news",
        }.get(surf, ""), 0) if surf != "news" else 0
        surface_totals[surf] = round(avg + sp_t, 1)

    summary = {
        "per_set":               by_set,
        "system_prompt_chars":   sp_chars,
        "system_prompt_tokens":  sp_tokens,
        "avg_card_tokens":       avg_card_tokens,
        "surface_input_total":   surface_totals,
        "import_ok": {
            "portfolio_service": _OK_PORTFOLIO,
            "chart_service":     _OK_CHART,
            "news_analyzer":     _OK_NEWS,
        },
    }

    # Pretty print
    print(f"{'set':<10} {'n':>4} {'prompt_chars_median':>22} {'words_med':>10} {'pinned_med':>11} {'cards_med':>10}")
    for label, stats in by_set.items():
        print(
            f"{label:<10} {stats['n_prompts']:>4} "
            f"{stats['prompt_chars']['median']:>22} "
            f"{stats['prompt_words']['median']:>10} "
            f"{stats['pinned_label_count']['median']:>11} "
            f"{stats['context_card_count']['median']:>10}"
        )
    print()
    print("System prompts (approx tokens, char/4):")
    for k, v in sp_tokens.items():
        if v > 0:
            print(f"  {k:<12} {v:>5} tokens  ({sp_chars[k]} chars)")
        else:
            print(f"  {k:<12} (not found)")
    print()
    print("Average context-card tokens per surface (grounded set):")
    for surf, t in avg_card_tokens.items():
        print(f"  {surf:<20} {t:>6.1f} tokens")
    print()
    print("Composite input budget per surface (system + cards):")
    for surf, t in surface_totals.items():
        print(f"  {surf:<20} {t:>6.1f} tokens")

    Path("/tmp/length_bias.json").write_text(json.dumps(summary, indent=2, default=str))
    print("\nWritten to /tmp/length_bias.json")
    return 0


if __name__ == "__main__":
    sys.exit(main())
