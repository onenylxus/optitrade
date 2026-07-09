import type { CandlestickData, Time } from 'lightweight-charts';

import type { ChartInterval, ChartTimeframe } from '@/lib/candlestick-timeframes';

/** Query values accepted by the backend ``/api/stock/chart`` endpoint. */
export type StockChartApiInterval =
  | '1min'
  | '5min'
  | '30min'
  | '1hour'
  | '1day'
  | '1month';

export type StockChartApiRange =
  | '1D'
  | '1W'
  | '1M'
  | '3M'
  | '6M'
  | 'YTD'
  | '1Y'
  | '3Y'
  | '5Y';

export interface StockChartCandleRow {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface StockChartResponse {
  symbol: string;
  interval: string;
  range: string | null;
  from: string;
  to: string;
  candles: StockChartCandleRow[];
}

/** ``GET /api/ai/widget/stock-chart`` — momentum/technical snapshots plus LLM ``analysis``. */
export interface StockChartMomentumSnapshot {
  return_pct_1_bar: number | null;
  return_pct_5_bar: number | null;
  return_pct_20_bar: number | null;
}

export interface StockChartTechnicalSnapshot {
  rsi_14: number | null;
  sma_20: number | null;
  sma_50: number | null;
  last_close_vs_sma20_pct: number | null;
}

export interface StockChartAnalysisResponse {
  symbol: string;
  interval: string;
  range: string | null;
  from: string;
  to: string;
  momentum: StockChartMomentumSnapshot;
  technical: StockChartTechnicalSnapshot;
  analysis: string;
  model_id: string;
}

/** ``GET /api/ai/widget/stock-chart/support-resistance`` — OHLC-derived levels for chart overlays. */
export interface StockChartSupportResistanceResponse {
  symbol: string;
  interval: string;
  range: string | null;
  from: string;
  to: string;
  support: number | null;
  resistance: number | null;
  method: string;
}

export interface StockChartPatternPoint {
  label: string;
  index: number;
  date: string;
  price: number;
}

export interface StockChartPatternLine {
  label: string;
  kind: string;
  start: StockChartPatternPoint;
  end: StockChartPatternPoint;
}

export interface StockChartPatternDetection {
  pattern_type: string;
  display_name: string;
  direction: string;
  status: string;
  confidence: number;
  points: StockChartPatternPoint[];
  lines: StockChartPatternLine[];
  breakout_level: number | null;
  invalidation_level: number | null;
  rationale: string[];
}

/** ``GET /api/ai/widget/stock-chart/patterns`` — deterministic geometry plus explanation. */
export interface StockChartPatternAnalysisResponse {
  symbol: string;
  interval: string;
  range: string | null;
  from: string;
  to: string;
  patterns: StockChartPatternDetection[];
  analysis: string;
  model_id: string;
  method: string;
}

export function chartIntervalToApi(interval: ChartInterval): StockChartApiInterval {
  switch (interval) {
    case '1m':
      return '1min';
    case '5m':
      return '5min';
    case '15m':
      return '30min';
    case '1h':
      return '1hour';
    case '1d':
      return '1day';
    default:
      return '1day';
  }
}

/**
 * Map UI timeframe to backend ``range`` and/or explicit ``from``/``to``.
 * ``5D`` uses calendar dates because the API has no ``5D`` preset.
 */
export function chartTimeframeToApiQuery(timeframe: ChartTimeframe): {
  range?: StockChartApiRange;
  from?: string;
  to?: string;
} {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const toStr = today.toISOString().slice(0, 10);

  switch (timeframe) {
    case '1D':
      return { range: '1D' };
    case '5D': {
      const from = new Date(today);
      from.setUTCDate(from.getUTCDate() - 7);
      return { from: from.toISOString().slice(0, 10), to: toStr };
    }
    case '1M':
      return { range: '1M' };
    case '3M':
      return { range: '3M' };
    case '6M':
      return { range: '6M' };
    case '1Y':
      return { range: '1Y' };
    case '5Y':
      return { range: '5Y' };
    case 'MAX':
      return { range: '5Y' };
    default:
      return { range: '1M' };
  }
}

/** Normalize FMP ``date`` strings to ``lightweight-charts`` ``Time``. */
export function fmpDateToChartTime(dateStr: string): Time {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr as Time;
  }
  const normalized = dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T');
  const ms = Date.parse(normalized);
  if (!Number.isFinite(ms)) {
    return dateStr as Time;
  }
  return Math.floor(ms / 1000) as Time;
}

export function stockApiCandlesToChartData(
  rows: StockChartCandleRow[],
): CandlestickData<Time>[] {
  return rows.map((row) => ({
    time: fmpDateToChartTime(row.date),
    open: row.open,
    high: row.high,
    low: row.low,
    close: row.close,
  }));
}

const SYMBOL_RE = /^[-A-Za-z0-9^.]{1,32}$/;

export function normalizeTicker(raw: string): string | null {
  const s = raw.trim().toUpperCase();
  if (!s || !SYMBOL_RE.test(s)) {
    return null;
  }
  return s;
}

export function normalizeSymbolList(symbols: string[], max = 3): string[] {
  const out: string[] = [];
  for (const raw of symbols) {
    const n = normalizeTicker(raw);
    if (n && !out.includes(n)) {
      out.push(n);
    }
    if (out.length >= max) {
      break;
    }
  }
  return out;
}

const STOCK_CHART_SYMBOL_SELECTED_EVENT = 'optitrade:stock-chart-symbol-selected';

export function requestStockChartSymbolSelection(rawSymbol: string): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const symbol = normalizeTicker(rawSymbol);
  if (!symbol) {
    return false;
  }

  window.dispatchEvent(
    new CustomEvent<string>(STOCK_CHART_SYMBOL_SELECTED_EVENT, {
      detail: symbol,
    }),
  );
  return true;
}

export function subscribeToStockChartSymbolSelection(
  listener: (symbol: string) => void,
): () => void {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  const handleSelection = (event: Event) => {
    const symbol = normalizeTicker((event as CustomEvent<string>).detail ?? '');
    if (symbol) {
      listener(symbol);
    }
  };

  window.addEventListener(STOCK_CHART_SYMBOL_SELECTED_EVENT, handleSelection);
  return () => window.removeEventListener(STOCK_CHART_SYMBOL_SELECTED_EVENT, handleSelection);
}
