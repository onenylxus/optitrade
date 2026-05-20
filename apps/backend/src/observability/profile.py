"""Opt-in timing helpers for debugging slow requests."""

from __future__ import annotations

import logging
import os
from collections.abc import Mapping

logger = logging.getLogger("optitrade.profile")


def stock_chart_profiling_enabled() -> bool:
    return os.environ.get("OPTITRADE_PROFILE_STOCK_CHART", "").strip().lower() in (
        "1",
        "true",
        "yes",
    )


def log_stock_chart_stages(symbol: str, stages_ms: Mapping[str, float]) -> None:
    parts = " ".join(f"{k}={v:.2f}ms" for k, v in stages_ms.items())
    logger.info("stock_chart profile symbol=%s %s", symbol, parts)
