"""Deterministic chart-pattern detection from OHLC pivot geometry."""

from __future__ import annotations

from dataclasses import dataclass
from statistics import mean

from src.api.schemas.stock_chart import ChartCandle
from src.services.stock_support_resistance import (
    _pivot_high_indices,
    _pivot_low_indices,
)


@dataclass(frozen=True)
class PatternPoint:
    """A named time/price point used by frontend overlays and explanations."""

    label: str
    index: int
    date: str
    price: float


@dataclass(frozen=True)
class PatternLine:
    """A line segment connecting two pattern points."""

    label: str
    kind: str
    start: PatternPoint
    end: PatternPoint


@dataclass(frozen=True)
class ChartPattern:
    """Structured chart pattern result with no model-invented geometry."""

    pattern_type: str
    display_name: str
    direction: str
    status: str
    confidence: float
    points: list[PatternPoint]
    lines: list[PatternLine]
    breakout_level: float | None
    invalidation_level: float | None
    rationale: list[str]


def _round_price(v: float) -> float:
    return round(float(v), 4)


def _point(
    candles: list[ChartCandle],
    index: int,
    price: float,
    label: str,
) -> PatternPoint:
    return PatternPoint(
        label=label,
        index=index,
        date=candles[index].date,
        price=_round_price(price),
    )


def _line(label: str, kind: str, start: PatternPoint, end: PatternPoint) -> PatternLine:
    return PatternLine(label=label, kind=kind, start=start, end=end)


def _avg_true_range(candles: list[ChartCandle], window: int = 14) -> float:
    if not candles:
        return 0.0
    tail = candles[-min(window, len(candles)) :]
    ranges = [max(0.0, c.high - c.low) for c in tail]
    return mean(ranges) if ranges else 0.0


def _tolerance(candles: list[ChartCandle]) -> float:
    last = candles[-1].close if candles else 0.0
    return max(_avg_true_range(candles) * 0.6, abs(last) * 0.006, 0.01)


def _pct_similarity(a: float, b: float, tol: float) -> float:
    distance = abs(a - b)
    if tol <= 0:
        return 0.0
    return max(0.0, 1.0 - distance / (tol * 1.5))


def _slope(a: PatternPoint, b: PatternPoint) -> float:
    span = max(1, b.index - a.index)
    return (b.price - a.price) / span


def _last_two_separated(indices: list[int], min_gap: int) -> tuple[int, int] | None:
    for right_pos in range(len(indices) - 1, 0, -1):
        right = indices[right_pos]
        for left in reversed(indices[:right_pos]):
            if right - left >= min_gap:
                return left, right
    return None


def _last_three_separated(
    indices: list[int],
    min_gap: int,
) -> tuple[int, int, int] | None:
    for right_pos in range(len(indices) - 1, 1, -1):
        right = indices[right_pos]
        for mid_pos in range(right_pos - 1, 0, -1):
            mid = indices[mid_pos]
            if right - mid < min_gap:
                continue
            for left in reversed(indices[:mid_pos]):
                if mid - left >= min_gap:
                    return left, mid, right
    return None


def _range_high_index(highs: list[float], start: int, end: int) -> int:
    return max(range(start, end + 1), key=lambda i: highs[i])


def _range_low_index(lows: list[float], start: int, end: int) -> int:
    return min(range(start, end + 1), key=lambda i: lows[i])


def _double_top(
    candles: list[ChartCandle],
    highs: list[float],
    lows: list[float],
    high_idx: list[int],
    tol: float,
) -> ChartPattern | None:
    pair = _last_two_separated(high_idx, min_gap=3)
    if pair is None:
        return None
    left, right = pair
    if abs(highs[left] - highs[right]) > tol:
        return None
    valley_idx = min(range(left + 1, right), key=lambda i: lows[i], default=left)
    neckline = lows[valley_idx]
    if min(highs[left], highs[right]) - neckline < tol:
        return None

    last_close = candles[-1].close
    status = "confirmed" if last_close < neckline - tol * 0.25 else "forming"
    confidence = 0.48 + _pct_similarity(highs[left], highs[right], tol) * 0.28
    if status == "confirmed":
        confidence += 0.12
    confidence = min(confidence, 0.9)

    p1 = _point(candles, left, highs[left], "left top")
    p2 = _point(candles, right, highs[right], "right top")
    neck = _point(candles, valley_idx, neckline, "neckline")
    return ChartPattern(
        pattern_type="double_top",
        display_name="Double Top",
        direction="bearish",
        status=status,
        confidence=round(confidence, 2),
        points=[p1, neck, p2],
        lines=[
            _line("top resistance", "resistance", p1, p2),
            _line(
                "neckline",
                "support",
                neck,
                _point(candles, right, neckline, "neckline end"),
            ),
        ],
        breakout_level=_round_price(neckline),
        invalidation_level=_round_price(max(highs[left], highs[right]) + tol),
        rationale=[
            "Two separated swing highs formed at similar prices.",
            "The intervening pivot low defines the neckline.",
        ],
    )


def _double_bottom(
    candles: list[ChartCandle],
    highs: list[float],
    lows: list[float],
    low_idx: list[int],
    tol: float,
) -> ChartPattern | None:
    pair = _last_two_separated(low_idx, min_gap=3)
    if pair is None:
        return None
    left, right = pair
    if abs(lows[left] - lows[right]) > tol:
        return None
    peak_idx = max(range(left + 1, right), key=lambda i: highs[i], default=left)
    neckline = highs[peak_idx]
    if neckline - max(lows[left], lows[right]) < tol:
        return None

    last_close = candles[-1].close
    status = "confirmed" if last_close > neckline + tol * 0.25 else "forming"
    confidence = 0.48 + _pct_similarity(lows[left], lows[right], tol) * 0.28
    if status == "confirmed":
        confidence += 0.12
    confidence = min(confidence, 0.9)

    p1 = _point(candles, left, lows[left], "left bottom")
    p2 = _point(candles, right, lows[right], "right bottom")
    neck = _point(candles, peak_idx, neckline, "neckline")
    return ChartPattern(
        pattern_type="double_bottom",
        display_name="Double Bottom",
        direction="bullish",
        status=status,
        confidence=round(confidence, 2),
        points=[p1, neck, p2],
        lines=[
            _line("bottom support", "support", p1, p2),
            _line(
                "neckline",
                "resistance",
                neck,
                _point(candles, right, neckline, "neckline end"),
            ),
        ],
        breakout_level=_round_price(neckline),
        invalidation_level=_round_price(min(lows[left], lows[right]) - tol),
        rationale=[
            "Two separated swing lows formed at similar prices.",
            "The intervening pivot high defines the neckline.",
        ],
    )


def _head_and_shoulders(
    candles: list[ChartCandle],
    highs: list[float],
    lows: list[float],
    high_idx: list[int],
    tol: float,
) -> ChartPattern | None:
    triple = _last_three_separated(high_idx, min_gap=3)
    if triple is None:
        return None
    left, head, right = triple
    shoulder_avg = mean([highs[left], highs[right]])
    if highs[head] <= shoulder_avg + tol * 0.8:
        return None
    if abs(highs[left] - highs[right]) > max(tol * 2.0, shoulder_avg * 0.03):
        return None

    neck_left_idx = _range_low_index(lows, left + 1, head - 1)
    neck_right_idx = _range_low_index(lows, head + 1, right - 1)
    neckline = mean([lows[neck_left_idx], lows[neck_right_idx]])
    if highs[head] - neckline < tol * 2:
        return None

    last_close = candles[-1].close
    status = "confirmed" if last_close < neckline - tol * 0.25 else "forming"
    symmetry = _pct_similarity(highs[left], highs[right], max(tol, shoulder_avg * 0.01))
    head_prominence = min(0.18, (highs[head] - shoulder_avg) / max(tol * 6, 1e-9))
    confidence = 0.56 + symmetry * 0.18 + head_prominence
    if status == "confirmed":
        confidence += 0.08

    left_shoulder = _point(candles, left, highs[left], "left shoulder")
    head_point = _point(candles, head, highs[head], "head")
    right_shoulder = _point(candles, right, highs[right], "right shoulder")
    neck_left = _point(candles, neck_left_idx, lows[neck_left_idx], "neckline")
    neck_right = _point(candles, neck_right_idx, lows[neck_right_idx], "neckline")
    return ChartPattern(
        pattern_type="head_and_shoulders",
        display_name="Head and Shoulders",
        direction="bearish",
        status=status,
        confidence=round(min(confidence, 0.9), 2),
        points=[left_shoulder, neck_left, head_point, neck_right, right_shoulder],
        lines=[
            _line("neckline", "support", neck_left, neck_right),
            _line("shoulder resistance", "resistance", left_shoulder, right_shoulder),
        ],
        breakout_level=_round_price(neckline),
        invalidation_level=_round_price(highs[head] + tol),
        rationale=[
            "Three swing highs form shoulders around a higher middle head.",
            "The lows between the shoulders and head define the neckline.",
        ],
    )


def _inverse_head_and_shoulders(
    candles: list[ChartCandle],
    highs: list[float],
    lows: list[float],
    low_idx: list[int],
    tol: float,
) -> ChartPattern | None:
    triple = _last_three_separated(low_idx, min_gap=3)
    if triple is None:
        return None
    left, head, right = triple
    shoulder_avg = mean([lows[left], lows[right]])
    if lows[head] >= shoulder_avg - tol * 0.8:
        return None
    if abs(lows[left] - lows[right]) > max(tol * 2.0, abs(shoulder_avg) * 0.03):
        return None

    neck_left_idx = _range_high_index(highs, left + 1, head - 1)
    neck_right_idx = _range_high_index(highs, head + 1, right - 1)
    neckline = mean([highs[neck_left_idx], highs[neck_right_idx]])
    if neckline - lows[head] < tol * 2:
        return None

    last_close = candles[-1].close
    status = "confirmed" if last_close > neckline + tol * 0.25 else "forming"
    symmetry = _pct_similarity(
        lows[left],
        lows[right],
        max(tol, abs(shoulder_avg) * 0.01),
    )
    head_prominence = min(0.18, (shoulder_avg - lows[head]) / max(tol * 6, 1e-9))
    confidence = 0.56 + symmetry * 0.18 + head_prominence
    if status == "confirmed":
        confidence += 0.08

    left_shoulder = _point(candles, left, lows[left], "left shoulder")
    head_point = _point(candles, head, lows[head], "head")
    right_shoulder = _point(candles, right, lows[right], "right shoulder")
    neck_left = _point(candles, neck_left_idx, highs[neck_left_idx], "neckline")
    neck_right = _point(candles, neck_right_idx, highs[neck_right_idx], "neckline")
    return ChartPattern(
        pattern_type="inverse_head_and_shoulders",
        display_name="Inverse Head and Shoulders",
        direction="bullish",
        status=status,
        confidence=round(min(confidence, 0.9), 2),
        points=[left_shoulder, neck_left, head_point, neck_right, right_shoulder],
        lines=[
            _line("neckline", "resistance", neck_left, neck_right),
            _line("shoulder support", "support", left_shoulder, right_shoulder),
        ],
        breakout_level=_round_price(neckline),
        invalidation_level=_round_price(lows[head] - tol),
        rationale=[
            "Three swing lows form shoulders around a lower middle head.",
            "The highs between the shoulders and head define the neckline.",
        ],
    )


def _triangle(
    candles: list[ChartCandle],
    highs: list[float],
    lows: list[float],
    high_idx: list[int],
    low_idx: list[int],
    tol: float,
    *,
    ascending: bool,
) -> ChartPattern | None:
    if len(high_idx) < 2 or len(low_idx) < 2:
        return None

    h1, h2 = _last_two_separated(high_idx, min_gap=3) or (high_idx[-2], high_idx[-1])
    l1, l2 = _last_two_separated(low_idx, min_gap=3) or (low_idx[-2], low_idx[-1])
    if h2 <= h1 or l2 <= l1:
        return None

    high_flat = abs(highs[h1] - highs[h2]) <= tol
    low_flat = abs(lows[l1] - lows[l2]) <= tol
    lows_rising = lows[l2] > lows[l1] + tol * 0.2
    highs_falling = highs[h2] < highs[h1] - tol * 0.2

    if ascending:
        if not high_flat or not lows_rising:
            return None
        level = mean([highs[h1], highs[h2]])
        last_close = candles[-1].close
        status = "confirmed" if last_close > level + tol * 0.25 else "forming"
        support_start = _point(candles, l1, lows[l1], "rising low")
        support_end = _point(candles, l2, lows[l2], "rising low")
        res_start = _point(candles, h1, level, "resistance")
        res_end = _point(candles, h2, level, "resistance")
        confidence = 0.58 + min(0.18, (lows[l2] - lows[l1]) / max(tol * 4, 1e-9))
        if status == "confirmed":
            confidence += 0.1
        return ChartPattern(
            pattern_type="ascending_triangle",
            display_name="Ascending Triangle",
            direction="bullish",
            status=status,
            confidence=round(min(confidence, 0.88), 2),
            points=[support_start, support_end, res_start, res_end],
            lines=[
                _line("resistance", "resistance", res_start, res_end),
                _line("rising support", "support", support_start, support_end),
            ],
            breakout_level=_round_price(level),
            invalidation_level=_round_price(min(lows[l1], lows[l2]) - tol),
            rationale=[
                "Swing highs are clustering near a horizontal resistance area.",
                "Swing lows are rising into that resistance.",
            ],
        )

    if not low_flat or not highs_falling:
        return None
    level = mean([lows[l1], lows[l2]])
    last_close = candles[-1].close
    status = "confirmed" if last_close < level - tol * 0.25 else "forming"
    resistance_start = _point(candles, h1, highs[h1], "falling high")
    resistance_end = _point(candles, h2, highs[h2], "falling high")
    sup_start = _point(candles, l1, level, "support")
    sup_end = _point(candles, l2, level, "support")
    confidence = 0.58 + min(0.18, (highs[h1] - highs[h2]) / max(tol * 4, 1e-9))
    if status == "confirmed":
        confidence += 0.1
    return ChartPattern(
        pattern_type="descending_triangle",
        display_name="Descending Triangle",
        direction="bearish",
        status=status,
        confidence=round(min(confidence, 0.88), 2),
        points=[resistance_start, resistance_end, sup_start, sup_end],
        lines=[
            _line("falling resistance", "resistance", resistance_start, resistance_end),
            _line("support", "support", sup_start, sup_end),
        ],
        breakout_level=_round_price(level),
        invalidation_level=_round_price(max(highs[h1], highs[h2]) + tol),
        rationale=[
            "Swing lows are clustering near a horizontal support area.",
            "Swing highs are falling into that support.",
        ],
    )


def _flag_or_pennant(
    candles: list[ChartCandle],
    highs: list[float],
    lows: list[float],
    tol: float,
) -> ChartPattern | None:
    n = len(candles)
    if n < 12:
        return None

    consolidation = min(7, max(4, n // 3))
    pole_window = min(12, max(5, n - consolidation - 1))
    pole_start = max(0, n - consolidation - pole_window)
    pole_end = n - consolidation - 1
    if pole_end <= pole_start:
        return None

    pole_move = candles[pole_end].close - candles[pole_start].close
    pole_pct = pole_move / max(abs(candles[pole_start].close), 1e-9)
    if abs(pole_move) < tol * 3 or abs(pole_pct) < 0.03:
        return None

    direction = "bullish" if pole_move > 0 else "bearish"
    cons_start = pole_end + 1
    cons_end = n - 1
    first_high = _range_high_index(highs, cons_start, min(cons_start + 2, cons_end))
    last_high = _range_high_index(highs, max(cons_end - 2, cons_start), cons_end)
    first_low = _range_low_index(lows, cons_start, min(cons_start + 2, cons_end))
    last_low = _range_low_index(lows, max(cons_end - 2, cons_start), cons_end)

    upper_start = _point(candles, first_high, highs[first_high], "upper consolidation")
    upper_end = _point(candles, last_high, highs[last_high], "upper consolidation")
    lower_start = _point(candles, first_low, lows[first_low], "lower consolidation")
    lower_end = _point(candles, last_low, lows[last_low], "lower consolidation")
    upper_slope = _slope(upper_start, upper_end)
    lower_slope = _slope(lower_start, lower_end)
    recent_highs = highs[cons_start : cons_end + 1]
    recent_lows = lows[cons_start : cons_end + 1]
    pole_highs = highs[pole_start : pole_end + 1]
    pole_lows = lows[pole_start : pole_end + 1]
    recent_range = max(recent_highs) - min(recent_lows)
    pole_range = max(pole_highs) - min(pole_lows)
    if pole_range <= 0 or recent_range > pole_range * 0.7:
        return None

    contracting = upper_slope < 0 < lower_slope
    counter_slope = (
        upper_slope < 0 and lower_slope < 0
        if direction == "bullish"
        else upper_slope > 0 and lower_slope > 0
    )
    if not contracting and not counter_slope:
        return None

    pattern_type = "pennant" if contracting else "flag"
    display = "Pennant" if contracting else "Flag"
    breakout_level = max(highs[cons_start : cons_end + 1])
    invalidation_level = min(lows[cons_start : cons_end + 1])
    last_close = candles[-1].close
    status = (
        "confirmed"
        if (
            last_close > breakout_level + tol * 0.25
            if direction == "bullish"
            else last_close < invalidation_level - tol * 0.25
        )
        else "forming"
    )
    confidence = 0.55 + min(0.16, abs(pole_pct) * 1.5)
    if contracting:
        confidence += 0.05
    if status == "confirmed":
        confidence += 0.08

    pole_base = _point(candles, pole_start, candles[pole_start].close, "pole start")
    pole_tip = _point(candles, pole_end, candles[pole_end].close, "pole tip")
    return ChartPattern(
        pattern_type=pattern_type,
        display_name=display,
        direction=direction,
        status=status,
        confidence=round(min(confidence, 0.84), 2),
        points=[pole_base, pole_tip, upper_start, upper_end, lower_start, lower_end],
        lines=[
            _line("impulse pole", "trend", pole_base, pole_tip),
            _line("upper consolidation", "resistance", upper_start, upper_end),
            _line("lower consolidation", "support", lower_start, lower_end),
        ],
        breakout_level=_round_price(
            breakout_level if direction == "bullish" else invalidation_level
        ),
        invalidation_level=_round_price(
            invalidation_level if direction == "bullish" else breakout_level
        ),
        rationale=[
            "A sharp impulse move is followed by a smaller consolidation.",
            "The consolidation boundaries define the flag or pennant area.",
        ],
    )


def _cup_and_handle(
    candles: list[ChartCandle],
    highs: list[float],
    lows: list[float],
    high_idx: list[int],
    low_idx: list[int],
    tol: float,
) -> ChartPattern | None:
    if len(high_idx) < 2 or not low_idx:
        return None

    rims = _last_two_separated(high_idx, min_gap=6)
    if rims is None:
        return None
    left_rim, right_rim = rims
    cup_lows = [i for i in low_idx if left_rim < i < right_rim]
    if not cup_lows:
        return None
    bottom = min(cup_lows, key=lambda i: lows[i])
    rim_level = mean([highs[left_rim], highs[right_rim]])
    if abs(highs[left_rim] - highs[right_rim]) > max(tol * 2.5, rim_level * 0.035):
        return None
    if rim_level - lows[bottom] < tol * 3:
        return None

    handle_start = right_rim + 1
    if handle_start >= len(candles):
        return None
    handle_low = _range_low_index(lows, handle_start, len(candles) - 1)
    handle_depth = rim_level - lows[handle_low]
    cup_depth = rim_level - lows[bottom]
    if handle_depth <= 0 or handle_depth > cup_depth * 0.55:
        return None

    last_close = candles[-1].close
    status = "confirmed" if last_close > rim_level + tol * 0.25 else "forming"
    rim_similarity = _pct_similarity(
        highs[left_rim],
        highs[right_rim],
        max(tol, rim_level * 0.01),
    )
    confidence = (
        0.55
        + rim_similarity * 0.18
        + min(0.12, cup_depth / max(tol * 8, 1e-9))
    )
    if status == "confirmed":
        confidence += 0.07

    left = _point(candles, left_rim, highs[left_rim], "left rim")
    bottom_point = _point(candles, bottom, lows[bottom], "cup bottom")
    right = _point(candles, right_rim, highs[right_rim], "right rim")
    handle = _point(candles, handle_low, lows[handle_low], "handle low")
    return ChartPattern(
        pattern_type="cup_and_handle",
        display_name="Cup and Handle",
        direction="bullish",
        status=status,
        confidence=round(min(confidence, 0.86), 2),
        points=[left, bottom_point, right, handle],
        lines=[
            _line("rim resistance", "resistance", left, right),
            _line("cup recovery", "support", bottom_point, right),
            _line("handle pullback", "support", right, handle),
        ],
        breakout_level=_round_price(rim_level),
        invalidation_level=_round_price(lows[handle_low] - tol),
        rationale=[
            "Two similar rim highs surround a rounded pullback and recovery.",
            "A smaller handle pullback forms after the right rim.",
        ],
    )


def _channel_or_wedge(
    candles: list[ChartCandle],
    highs: list[float],
    lows: list[float],
    high_idx: list[int],
    low_idx: list[int],
    tol: float,
) -> ChartPattern | None:
    if len(high_idx) < 2 or len(low_idx) < 2:
        return None

    h1, h2 = high_idx[-2], high_idx[-1]
    l1, l2 = low_idx[-2], low_idx[-1]
    hp1 = _point(candles, h1, highs[h1], "upper boundary")
    hp2 = _point(candles, h2, highs[h2], "upper boundary")
    lp1 = _point(candles, l1, lows[l1], "lower boundary")
    lp2 = _point(candles, l2, lows[l2], "lower boundary")
    upper_slope = _slope(hp1, hp2)
    lower_slope = _slope(lp1, lp2)
    if abs(upper_slope) < tol / 20 and abs(lower_slope) < tol / 20:
        return None

    same_direction = upper_slope * lower_slope > 0
    converging = abs(upper_slope - lower_slope) > tol / 30
    if not same_direction and not converging:
        return None

    direction = "bullish" if lower_slope > 0 and upper_slope >= 0 else "bearish"
    pattern_type = "wedge" if converging and not same_direction else "channel"
    display = "Wedge" if pattern_type == "wedge" else "Price Channel"
    confidence = 0.52 + min(0.18, abs(upper_slope + lower_slope) / max(tol / 2, 1e-9))
    return ChartPattern(
        pattern_type=pattern_type,
        display_name=display,
        direction=direction,
        status="forming",
        confidence=round(min(confidence, 0.78), 2),
        points=[hp1, hp2, lp1, lp2],
        lines=[
            _line("upper boundary", "resistance", hp1, hp2),
            _line("lower boundary", "support", lp1, lp2),
        ],
        breakout_level=_round_price(hp2.price if direction == "bullish" else lp2.price),
        invalidation_level=_round_price(
            lp2.price if direction == "bullish" else hp2.price
        ),
        rationale=[
            "Recent swing highs and lows define two visible sloped boundaries.",
            (
                "The boundaries are treated as a forming range until price "
                "breaks either side."
            ),
        ],
    )


def detect_chart_patterns(
    candles: list[ChartCandle],
    max_patterns: int = 3,
) -> list[ChartPattern]:
    """Return the strongest deterministic chart patterns for the OHLC window."""
    n = len(candles)
    if n < 12:
        return []

    highs = [c.high for c in candles]
    lows = [c.low for c in candles]
    tol = _tolerance(candles)
    piv_w = max(2, min(5, max(2, n // 25)))
    high_idx = _pivot_high_indices(highs, piv_w, piv_w)
    low_idx = _pivot_low_indices(lows, piv_w, piv_w)

    candidates = [
        _double_top(candles, highs, lows, high_idx, tol),
        _double_bottom(candles, highs, lows, low_idx, tol),
        _head_and_shoulders(candles, highs, lows, high_idx, tol),
        _inverse_head_and_shoulders(candles, highs, lows, low_idx, tol),
        _triangle(candles, highs, lows, high_idx, low_idx, tol, ascending=True),
        _triangle(candles, highs, lows, high_idx, low_idx, tol, ascending=False),
        _flag_or_pennant(candles, highs, lows, tol),
        _cup_and_handle(candles, highs, lows, high_idx, low_idx, tol),
        _channel_or_wedge(candles, highs, lows, high_idx, low_idx, tol),
    ]
    patterns = [p for p in candidates if p is not None and p.confidence >= 0.45]
    patterns.sort(key=lambda p: p.confidence, reverse=True)
    return patterns[:max_patterns]
