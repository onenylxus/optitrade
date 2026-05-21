"""Clustered pivot-based support/resistance from OHLC series (education / visualization)."""

from __future__ import annotations

from typing import Sequence

from src.api.schemas.stock_chart import ChartCandle


def _pivot_low_indices(lows: Sequence[float], left: int, right: int) -> list[int]:
    n = len(lows)
    out: list[int] = []
    if n < left + right + 1:
        return out
    for i in range(left, n - right):
        v = lows[i]
        segment = lows[i - left : i + right + 1]
        if v == min(segment):
            out.append(i)
    return out


def _pivot_high_indices(highs: Sequence[float], left: int, right: int) -> list[int]:
    n = len(highs)
    out: list[int] = []
    if n < left + right + 1:
        return out
    for i in range(left, n - right):
        v = highs[i]
        segment = highs[i - left : i + right + 1]
        if v == max(segment):
            out.append(i)
    return out


def _cluster_sorted_pivots(
    pivots_sorted: Sequence[tuple[float, int]],
    tol: float,
) -> list[list[tuple[float, int]]]:
    clusters: list[list[tuple[float, int]]] = []
    for price, bar_index in pivots_sorted:
        if not clusters:
            clusters.append([(price, bar_index)])
            continue
        pts = clusters[-1]
        mean_p = sum(p for p, _ in pts) / len(pts)
        if abs(price - mean_p) <= tol:
            pts.append((price, bar_index))
        else:
            clusters.append([(price, bar_index)])
    return clusters


def _cluster_score(cluster: Sequence[tuple[float, int]], n_bars: int) -> tuple[float, float]:
    scores = [(bar_index + 1) / n_bars for _, bar_index in cluster]
    strength = sum(scores)
    centroid = sum(p for p, _ in cluster) / len(cluster)
    return strength, centroid


def _pick_level_from_pivots(
    pivots: list[tuple[float, int]],
    *,
    tol: float,
    n_bars: int,
    below: float | None,
    above: float | None,
) -> float | None:
    """Pick centroid of highest-scoring cluster matching below/above last price."""
    if not pivots:
        return None
    clusters = _cluster_sorted_pivots(sorted(pivots, key=lambda x: x[0]), tol)
    best: tuple[float, float] | None = None
    for cluster in clusters:
        strength, centroid = _cluster_score(cluster, n_bars)
        if below is not None and not (centroid < below):
            continue
        if above is not None and not (centroid > above):
            continue
        if best is None or strength > best[0]:
            best = (strength, centroid)
    if best is None:
        return None
    return round(best[1], 4)


def compute_support_resistance(candles: list[ChartCandle]) -> tuple[float | None, float | None]:
    """
    Pivot highs/lows with price clustering — intended for SR overlay display.

    Returns (support, resistance) anchored to bars below / above last close where possible.
    """
    n = len(candles)
    if n < 6:
        return None, None

    highs = [c.high for c in candles]
    lows = [c.low for c in candles]
    closes = [c.close for c in candles]
    last = closes[-1]

    atr_window = max(2, min(14, n - 1))
    tr_tail = [
        highs[i] - lows[i]
        for i in range(max(0, n - atr_window), n)
    ]
    atr = sum(tr_tail) / len(tr_tail)
    tol = max(atr * 0.5, last * 0.0025)

    piv_w = max(2, min(5, max(2, n // 25)))

    low_idx = _pivot_low_indices(lows, piv_w, piv_w)
    high_idx = _pivot_high_indices(highs, piv_w, piv_w)

    lows_p = [(lows[i], i) for i in low_idx]
    highs_p = [(highs[i], i) for i in high_idx]

    support = _pick_level_from_pivots(lows_p, tol=tol, n_bars=n, below=last, above=None)

    trailing = lows[max(0, n - min(35, max(15, n // 3))) :]
    if support is None or support >= last:
        cand = [lows[i] for _, i in lows_p if lows[i] < last]
        if cand:
            support = round(max(cand), 4)
        elif trailing:
            support = round(min(trailing), 4)
        else:
            support = None

    resistance = _pick_level_from_pivots(highs_p, tol=tol, n_bars=n, below=None, above=last)

    trail_h = highs[max(0, n - min(35, max(15, n // 3))) :]
    if resistance is None or resistance <= last:
        cand_h = [highs[i] for _, i in highs_p if highs[i] > last]
        if cand_h:
            resistance = round(min(cand_h), 4)
        elif trail_h:
            resistance = round(max(trail_h), 4)
        else:
            resistance = None

    if support is not None and resistance is not None and resistance <= support:
        resistance = round(max(highs), 4)
        if resistance <= support:
            resistance = None

    return support, resistance
