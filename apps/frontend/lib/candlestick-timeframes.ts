import type { CandlestickData, Time } from 'lightweight-charts';

export const CHART_TIMEFRAMES = [
  '1D',
  '5D',
  '1M',
  '3M',
  '6M',
  '1Y',
  '5Y',
  'MAX',
] as const;

export type ChartTimeframe = (typeof CHART_TIMEFRAMES)[number];

export const CHART_INTERVALS = ['1m', '5m', '15m', '1h', '1d'] as const;

export type ChartInterval = (typeof CHART_INTERVALS)[number];

const TRADING_MINUTES_PER_DAY = 6.5 * 60;
const MAX_CANDLES = 1000;

/** Which bar sizes make sense for each lookback window. */
export function allowedIntervalsForTimeframe(timeframe: ChartTimeframe): ChartInterval[] {
  switch (timeframe) {
    case '1D':
      return ['1m', '5m', '15m', '1h'];
    case '5D':
      return ['1m', '5m', '15m', '1h', '1d'];
    case '1M':
      return ['5m', '15m', '1h', '1d'];
    case '3M':
      return ['15m', '1h', '1d'];
    case '6M':
      return ['1h', '1d'];
    case '1Y':
      return ['1h', '1d'];
    case '5Y':
    case 'MAX':
      return ['1d'];
    default:
      return [...CHART_INTERVALS];
  }
}

export function isIntervalAllowedForTimeframe(
  timeframe: ChartTimeframe,
  interval: ChartInterval,
): boolean {
  return allowedIntervalsForTimeframe(timeframe).includes(interval);
}

export function clampIntervalToTimeframe(
  timeframe: ChartTimeframe,
  interval: ChartInterval,
): ChartInterval {
  const allowed = allowedIntervalsForTimeframe(timeframe);
  if (allowed.includes(interval)) {
    return interval;
  }
  const fallback = allowed[0];
  return fallback ?? interval;
}

function intervalMinutes(interval: ChartInterval): number {
  switch (interval) {
    case '1m':
      return 1;
    case '5m':
      return 5;
    case '15m':
      return 15;
    case '1h':
      return 60;
    case '1d':
      return 24 * 60;
    default:
      return 1;
  }
}

function tradingDaysForTimeframe(timeframe: ChartTimeframe): number {
  switch (timeframe) {
    case '1D':
      return 1;
    case '5D':
      return 5;
    case '1M':
      return 22;
    case '3M':
      return 63;
    case '6M':
      return 126;
    case '1Y':
      return 252;
    case '5Y':
      return 252 * 5;
    case 'MAX':
      return Math.min(4000, 252 * 25);
    default:
      return 22;
  }
}

export function desiredBarCount(timeframe: ChartTimeframe, interval: ChartInterval): number {
  if (interval === '1d') {
    return Math.min(MAX_CANDLES, Math.max(2, tradingDaysForTimeframe(timeframe)));
  }

  const mins = intervalMinutes(interval);

  if (timeframe === '1D') {
    return Math.min(
      MAX_CANDLES,
      Math.max(2, Math.floor(TRADING_MINUTES_PER_DAY / mins)),
    );
  }

  const days = tradingDaysForTimeframe(timeframe);
  const totalMins = days * TRADING_MINUTES_PER_DAY;
  return Math.min(MAX_CANDLES, Math.max(2, Math.floor(totalMins / mins)));
}

function mulberry32(seed: number): () => number {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(31, h) + s.charCodeAt(i);
  }
  return h >>> 0;
}

/** Rough OHLC range from generated data (for default custom Y bounds). */
export function candlePriceBounds(data: CandlestickData<Time>[]): { min: number; max: number } {
  if (data.length === 0) {
    return { min: 0, max: 1 };
  }
  let min = Infinity;
  let max = -Infinity;
  for (const c of data) {
    min = Math.min(min, c.low);
    max = Math.max(max, c.high);
  }
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
    const mid = Number.isFinite(min) ? min : 100;
    return { min: mid * 0.98, max: mid * 1.02 };
  }
  const pad = (max - min) * 0.05;
  return { min: min - pad, max: max + pad };
}

/**
 * Deterministic demo series for Storybook / local dev when no API is wired.
 */
export function generateMockCandles(
  timeframe: ChartTimeframe,
  interval: ChartInterval,
  seed = 42,
): CandlestickData<Time>[] {
  const n = desiredBarCount(timeframe, interval);
  const rng = mulberry32(seed ^ hashStr(timeframe) ^ hashStr(interval));
  const out: CandlestickData<Time>[] = [];

  let open = 100 + rng() * 40;
  const stepSec =
    interval === '1d'
      ? 86400
      : intervalMinutes(interval) * 60;

  const endSec = Math.floor(Date.now() / 1000);

  if (interval === '1d') {
    for (let i = 0; i < n; i++) {
      const d = new Date();
      d.setUTCHours(0, 0, 0, 0);
      d.setUTCDate(d.getUTCDate() - (n - 1 - i));
      const time = d.toISOString().slice(0, 10) as Time;
      const vol = 0.4 + rng() * 1.2;
      const change = (rng() - 0.48) * vol;
      const close = open + change;
      const high = Math.max(open, close) + rng() * vol * 0.5;
      const low = Math.min(open, close) - rng() * vol * 0.5;
      out.push({ time, open, high, low, close });
      open = close;
    }
    return out;
  }

  for (let i = 0; i < n; i++) {
    const time = (endSec - (n - 1 - i) * stepSec) as Time;
    const vol = 0.08 + rng() * 0.25;
    const change = (rng() - 0.5) * vol;
    const close = open + change;
    const high = Math.max(open, close) + rng() * vol * 0.35;
    const low = Math.min(open, close) - rng() * vol * 0.35;
    out.push({ time, open, high, low, close });
    open = close;
  }

  return out;
}
