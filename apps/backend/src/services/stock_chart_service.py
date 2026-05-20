"""Fetch normalized OHLCV chart series from Financial Modeling Prep (stable API)."""

from __future__ import annotations

import calendar
import logging
import os
import time
from datetime import date, datetime, timedelta
from typing import Any
from urllib.parse import urlencode

import httpx

from src.api.schemas.stock_chart import (
    ChartCandle,
    ChartInterval,
    ChartRange,
    StockChartParams,
    StockChartResponse,
)
from src.observability.profile import stock_chart_profiling_enabled

_log = logging.getLogger("optitrade.profile")

FMP_STABLE_BASE = "https://financialmodelingprep.com/stable"


def _subtract_months(d: date, months: int) -> date:
    y, m = d.year, d.month
    m -= months
    while m <= 0:
        m += 12
        y -= 1
    last = calendar.monthrange(y, m)[1]
    return date(y, m, min(d.day, last))


def _range_start(anchor: date, chart_range: ChartRange) -> date:
    if chart_range is ChartRange.YTD:
        return date(anchor.year, 1, 1)
    if chart_range is ChartRange.DAY_1:
        return anchor - timedelta(days=1)
    if chart_range is ChartRange.WEEK_1:
        return anchor - timedelta(days=7)
    if chart_range is ChartRange.MONTH_1:
        return _subtract_months(anchor, 1)
    if chart_range is ChartRange.MONTH_3:
        return _subtract_months(anchor, 3)
    if chart_range is ChartRange.MONTH_6:
        return _subtract_months(anchor, 6)
    if chart_range is ChartRange.YEAR_1:
        return _subtract_months(anchor, 12)
    if chart_range is ChartRange.YEAR_3:
        return _subtract_months(anchor, 36)
    if chart_range is ChartRange.YEAR_5:
        return _subtract_months(anchor, 60)
    raise NotImplementedError(chart_range)


def default_chart_range(interval: ChartInterval) -> ChartRange:
    """Default lookback when the client omits ``range`` and explicit ``from``/``to``."""
    if interval in (
        ChartInterval.MIN_1,
        ChartInterval.MIN_5,
        ChartInterval.MIN_30,
        ChartInterval.HOUR_1,
    ):
        return ChartRange.DAY_1
    return ChartRange.MONTH_1


def resolve_stock_chart_params(
    *,
    symbol: str,
    interval: ChartInterval,
    chart_range: ChartRange | None,
    from_date: date | None,
    to_date: date | None,
) -> StockChartParams:
    """
    Resolve ``from``/``to`` from explicit dates and/or a preset ``range``.

    If both ``from_date`` and ``to_date`` are set, ``chart_range`` is ignored.
    Otherwise ``to_date`` defaults to today (UTC calendar date) and ``from_date``
    is derived from ``chart_range`` (defaulting via :func:`default_chart_range`).
    """
    sym = symbol.strip().upper()
    if not sym:
        raise ValueError("symbol is required")

    to_d = to_date or date.today()
    used_range: ChartRange | None = None

    if from_date is not None and to_date is not None:
        start, end = from_date, to_date
    elif from_date is not None and to_date is None:
        start, end = from_date, to_d
    elif from_date is None and to_date is not None:
        end = to_date
        cr = chart_range or default_chart_range(interval)
        used_range = cr
        start = _range_start(end, cr)
    else:
        cr = chart_range or default_chart_range(interval)
        used_range = cr
        end = to_d
        start = _range_start(end, cr)

    if start > end:
        raise ValueError("'from' must be on or before 'to'")

    return StockChartParams(
        symbol=sym,
        interval=interval,
        date_from=start,
        date_to=end,
        chart_range=used_range,
    )


def _fmp_sort_key(row: dict[str, Any]) -> datetime:
    raw = row.get("date")
    if not isinstance(raw, str):
        return datetime.min
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(raw, fmt)
        except ValueError:
            continue
    return datetime.min


def _interval_to_fmp_chart_path(interval: ChartInterval) -> str | None:
    """Return ``historical-chart`` path segment, or ``None`` for EOD-only interval."""
    mapping: dict[ChartInterval, str | None] = {
        ChartInterval.MIN_1: "1min",
        ChartInterval.MIN_5: "5min",
        ChartInterval.MIN_30: "30min",
        ChartInterval.HOUR_1: "1hour",
        ChartInterval.DAY_1: None,
        ChartInterval.MONTH_1: "1month",
    }
    return mapping[interval]


def _normalize_fmp_payload(data: Any) -> list[dict[str, Any]]:
    if isinstance(data, dict) and "Error Message" in data:
        raise RuntimeError(str(data["Error Message"]))
    if not isinstance(data, list):
        raise RuntimeError("Unexpected FMP response shape")
    out: list[dict[str, Any]] = []
    for row in data:
        if isinstance(row, dict):
            out.append(row)
    return out


class StockChartService:
    """Calls FMP stable endpoints for intraday ``historical-chart`` and EOD ``full``."""

    def __init__(
        self,
        api_key: str | None = None,
        *,
        base_url: str = FMP_STABLE_BASE,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self._api_key = (api_key or os.environ.get("FMP_API_KEY", "")).strip()
        self._base = base_url.rstrip("/")
        self._client = client

    @property
    def api_key_configured(self) -> bool:
        return bool(self._api_key)

    async def fetch_chart(self, params: StockChartParams) -> StockChartResponse:
        if not self._api_key:
            raise RuntimeError("FMP_API_KEY is not configured")

        profile = stock_chart_profiling_enabled()
        t0 = time.perf_counter()
        segment = _interval_to_fmp_chart_path(params.interval)
        if segment is None:
            rows = await self._fetch_eod_full(params)
        else:
            rows = await self._fetch_historical_chart(segment, params)
        t1 = time.perf_counter()

        rows = sorted(rows, key=_fmp_sort_key)
        candles = [ChartCandle.model_validate(r) for r in rows]
        t2 = time.perf_counter()
        if profile:
            _log.info(
                "stock_chart fmp symbol=%s interval=%s fmp_http=%.2fms "
                "sort_validate=%.2fms rows=%d",
                params.symbol,
                params.interval.value,
                (t1 - t0) * 1000,
                (t2 - t1) * 1000,
                len(candles),
            )

        return StockChartResponse(
            symbol=params.symbol,
            interval=params.interval,
            chart_range=params.chart_range,
            from_=params.date_from,
            to=params.date_to,
            candles=candles,
        )

    async def _request_json(self, path: str, query: dict[str, str]) -> Any:
        q = {**query, "apikey": self._api_key}
        url = f"{self._base}{path}?{urlencode(q)}"
        if self._client is not None:
            r = await self._client.get(url)
            r.raise_for_status()
            return r.json()

        async with httpx.AsyncClient(timeout=60.0) as client:
            r = await client.get(url)
            r.raise_for_status()
            return r.json()

    async def _fetch_eod_full(self, params: StockChartParams) -> list[dict[str, Any]]:
        data = await self._request_json(
            "/historical-price-eod/full",
            {
                "symbol": params.symbol,
                "from": params.date_from.isoformat(),
                "to": params.date_to.isoformat(),
            },
        )
        return _normalize_fmp_payload(data)

    async def _fetch_historical_chart(
        self,
        segment: str,
        params: StockChartParams,
    ) -> list[dict[str, Any]]:
        data = await self._request_json(
            f"/historical-chart/{segment}",
            {
                "symbol": params.symbol,
                "from": params.date_from.isoformat(),
                "to": params.date_to.isoformat(),
            },
        )
        return _normalize_fmp_payload(data)
