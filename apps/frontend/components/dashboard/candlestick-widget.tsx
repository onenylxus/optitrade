'use client';

import type {
  CandlestickData,
  IChartApi,
  IPriceLine,
  ISeriesApi,
  LineData,
  Time,
} from 'lightweight-charts';
import {
  CandlestickSeries,
  ColorType,
  createChart,
  LineSeries,
  LineStyle,
} from 'lightweight-charts';
import * as React from 'react';
import {
  allowedIntervalsForTimeframe,
  CHART_INTERVALS,
  CHART_TIMEFRAMES,
  clampIntervalToTimeframe,
  generateMockCandles,
  type ChartInterval,
  type ChartTimeframe,
} from '@/lib/candlestick-timeframes';
import {
  getStockChart,
  getStockChartAnalysis,
  getStockChartPatterns,
  getStockChartSupportResistance,
} from '@/lib/api/client';
import {
  chartIntervalToApi,
  chartTimeframeToApiQuery,
  fmpDateToChartTime,
  normalizeSymbolList,
  normalizeTicker,
  stockApiCandlesToChartData,
  type StockChartPatternDetection,
} from '@/lib/stock-chart-bridge';
import {
  computeBollingerSeries,
  computeMASeries,
  computeRSISeries,
} from '@/lib/technical-indicators';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Bot, X } from 'lucide-react';
import { BaseWidget } from './base-widget';
import { CollapsibleStockAnalysis } from './collapsible-stock-analysis';

export type { ChartInterval, ChartTimeframe };

/** Layout footprint: default (compact), medium (same chart height, wider card), large (taller + wider chart). */
export type CandlestickWidgetVariant = 'default' | 'medium' | 'large';

function candlestickVariantClassNames(variant: CandlestickWidgetVariant): {
  root: string;
  chart: string;
} {
  switch (variant) {
    case 'medium':
      return {
        root: 'w-full min-w-0 sm:min-w-[34rem]',
        chart: 'h-56 min-h-56',
      };
    case 'large':
      return {
        root: 'w-full min-w-0 sm:min-w-[40rem] lg:min-w-[46rem]',
        chart: 'h-72 min-h-72 sm:h-80 sm:min-h-80',
      };
    default:
      return {
        root: 'w-full min-w-0',
        chart: 'h-56 min-h-56',
      };
  }
}

const MA_PERIOD = 20;
const BB_PERIOD = 20;
const BB_MULTIPLIER = 2;
const RSI_PERIOD = 14;

/** Matches line colors so the HTML legend and canvas labels read as one system. */
const STUDY_COLORS = {
  ma: '#2563eb',
  bbUpper: 'rgb(148, 163, 184)',
  bbMiddle: 'rgb(100, 116, 139)',
  bbLower: 'rgb(148, 163, 184)',
  rsi: '#a855f7',
  aiSupport: '#0d9488',
  aiResistance: '#ea580c',
  pattern: '#f59e0b',
  patternSupport: '#14b8a6',
  patternResistance: '#f97316',
  patternBreakout: '#eab308',
  patternInvalidation: '#ef4444',
} as const;

function fmt2(n: number) {
  return n.toFixed(2);
}

type IndicatorBundle = {
  ma: LineData<Time>[];
  bb: { upper: LineData<Time>[]; middle: LineData<Time>[]; lower: LineData<Time>[] };
  rsi: LineData<Time>[];
};

/** Rule-based copy for the AI insight panel (replace with API text when wired). */
function buildCandlestickInsight(
  data: CandlestickData<Time>[],
  timeframe: ChartTimeframe,
  interval: ChartInterval,
  flags: { showMA: boolean; showBB: boolean; showRSI: boolean },
  indicators: IndicatorBundle,
): string {
  if (data.length === 0) {
    return 'No candles in this range yet.';
  }

  const first = data[0];
  const last = data[data.length - 1];
  const firstClose = first.close;
  const lastClose = last.close;
  const pct = firstClose !== 0 ? ((lastClose - firstClose) / firstClose) * 100 : 0;
  const direction = pct > 0.05 ? 'rose' : pct < -0.05 ? 'fell' : 'was roughly flat';

  const parts: string[] = [
    `Over this ${timeframe} window shown as ${interval} bars, price ${direction} about ${Math.abs(pct).toFixed(2)}% from ${fmt2(firstClose)} to ${fmt2(lastClose)} (${data.length} bars).`,
    `The latest candle closed at ${fmt2(last.close)} (H ${fmt2(last.high)} / L ${fmt2(last.low)}).`,
  ];

  if (flags.showMA && indicators.ma.length > 0) {
    const ma = indicators.ma[indicators.ma.length - 1];
    if (ma) {
      const rel = last.close >= ma.value ? 'above' : 'below';
      parts.push(
        `Price is ${rel} the ${MA_PERIOD}-period simple moving average (${fmt2(ma.value)}).`,
      );
    }
  }

  if (flags.showBB && indicators.bb.middle.length > 0) {
    const mid = indicators.bb.middle[indicators.bb.middle.length - 1];
    const up = indicators.bb.upper[indicators.bb.upper.length - 1];
    const lo = indicators.bb.lower[indicators.bb.lower.length - 1];
    if (mid && up && lo) {
      parts.push(
        `Bollinger basis is ${fmt2(mid.value)} with band ${fmt2(lo.value)}–${fmt2(up.value)}.`,
      );
    }
  }

  if (flags.showRSI && indicators.rsi.length > 0) {
    const r = indicators.rsi[indicators.rsi.length - 1];
    if (r) {
      let tone = 'neutral momentum';
      if (r.value >= 70) {
        tone = 'stretched upward (often treated as overbought)';
      } else if (r.value <= 30) {
        tone = 'stretched downward (often treated as oversold)';
      }
      parts.push(`RSI(${RSI_PERIOD}) is ${fmt2(r.value)} — ${tone}.`);
    }
  }

  return parts.join(' ');
}

function buildCandlestickChatContext(params: {
  activeSymbol: string;
  symbols: string[];
  timeframe: ChartTimeframe;
  interval: ChartInterval;
  data: CandlestickData<Time>[];
  showMA: boolean;
  showBB: boolean;
  showRSI: boolean;
  indicators: IndicatorBundle;
  showAiSr: boolean;
  apiSrSupport: number | null;
  apiSrResistance: number | null;
  showPatterns: boolean;
  patterns: StockChartPatternDetection[];
}): string {
  const {
    activeSymbol,
    symbols,
    timeframe,
    interval,
    data,
    showMA,
    showBB,
    showRSI,
    indicators,
    showAiSr,
    apiSrSupport,
    apiSrResistance,
    showPatterns,
    patterns,
  } = params;

  const first = data[0];
  const last = data[data.length - 1];
  const lines: string[] = [];

  const pricePart = last ? ` — $${fmt2(last.close)}` : '';
  lines.push(`Current Stock Focus: ${activeSymbol || '—'} (${timeframe}, ${interval})${pricePart}`);
  lines.push(`Watchlist: ${symbols.length ? symbols.join(', ') : '—'}`);

  if (first && last && data.length >= 2) {
    const pct = first.close !== 0 ? ((last.close - first.close) / first.close) * 100 : 0;
    const sign = pct >= 0 ? '+' : '';
    const tone = pct > 0.05 ? 'up' : pct < -0.05 ? 'down' : 'flat';
    lines.push(`Momentum: ${sign}${pct.toFixed(2)}% (${tone}) over ${timeframe}`);
  } else {
    lines.push('Momentum: —');
  }

  const indicatorParts: string[] = [];
  if (showMA && indicators.ma.length > 0) {
    const ma = indicators.ma[indicators.ma.length - 1];
    if (ma && last) {
      const rel = last.close >= ma.value ? 'above' : 'below';
      indicatorParts.push(`MA(${MA_PERIOD}) ${fmt2(ma.value)} (${rel})`);
    }
  }
  if (showBB && indicators.bb.lower.length > 0) {
    const lo = indicators.bb.lower[indicators.bb.lower.length - 1];
    const up = indicators.bb.upper[indicators.bb.upper.length - 1];
    if (lo && up) {
      indicatorParts.push(`BB ${fmt2(lo.value)}–${fmt2(up.value)}`);
    }
  }
  if (showRSI && indicators.rsi.length > 0) {
    const rsi = indicators.rsi[indicators.rsi.length - 1];
    if (rsi) {
      indicatorParts.push(`RSI(${RSI_PERIOD}) ${fmt2(rsi.value)}`);
    }
  }
  lines.push(`Indicators: ${indicatorParts.length ? indicatorParts.join(', ') : 'none active'}`);

  if (showAiSr && (apiSrSupport != null || apiSrResistance != null)) {
    const levels: string[] = [];
    if (apiSrSupport != null) {
      levels.push(`support $${fmt2(apiSrSupport)}`);
    }
    if (apiSrResistance != null) {
      levels.push(`resistance $${fmt2(apiSrResistance)}`);
    }
    lines.push(`Key Levels: ${levels.join(', ')}`);
  } else {
    lines.push('Key Levels: —');
  }

  if (showPatterns && patterns.length > 0) {
    const top = patterns[0];
    lines.push(
      `Chart Pattern: ${top.display_name} (${top.status}, ${Math.round(top.confidence * 100)}% confidence, ${top.direction})`,
    );
  } else {
    lines.push('Chart Pattern: —');
  }

  return lines.join('\n');
}

const selectClass = cn(
  'h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground',
  'shadow-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
);

const indicatorTextButtonClass =
  'h-auto min-h-0 rounded-sm px-1.5 py-0.5 text-xs shadow-none hover:bg-transparent';

function indicatorToggleButtonClass(active: boolean) {
  return cn(
    indicatorTextButtonClass,
    active
      ? 'font-semibold text-primary'
      : 'font-normal text-muted-foreground/40 hover:text-muted-foreground/75',
  );
}

function indicatorToggleSuffixClass(active: boolean) {
  return cn('tabular-nums', active ? 'font-medium text-primary/80' : 'text-muted-foreground/35');
}

type ChartPatternGraphicVariant =
  | 'channel'
  | 'wedge'
  | 'double-top'
  | 'double-bottom'
  | 'head-and-shoulders'
  | 'inverse-head-and-shoulders'
  | 'ascending-triangle'
  | 'descending-triangle'
  | 'flag'
  | 'pennant'
  | 'cup-and-handle'
  | 'generic';

type ChartPatternEducation = {
  title: string;
  subtitle: string;
  graphic: ChartPatternGraphicVariant;
  what: string;
  howToUse: string;
  watchFor: string;
};

const chartPatternEducationByType: Record<string, ChartPatternEducation> = {
  channel: {
    title: 'Price Channel',
    subtitle: 'Price is oscillating between two sloped, mostly parallel boundaries.',
    graphic: 'channel',
    what:
      'A price channel forms when swing highs and swing lows move in the same direction, creating a resistance line above price and a support line below price. An upward channel shows controlled upside progress; a downward channel shows controlled downside pressure.',
    howToUse:
      'Traders usually watch for bounces near channel support, rejection near channel resistance, or a decisive breakout beyond either boundary. A bullish channel continuation needs price to hold the lower boundary and eventually push above the upper boundary.',
    watchFor:
      'A clean break below channel support can invalidate a bullish channel, while a break above resistance can signal acceleration. Volume and broader market context help confirm whether the break is meaningful.',
  },
  wedge: {
    title: 'Wedge',
    subtitle: 'Price is compressing between converging trend lines.',
    graphic: 'wedge',
    what:
      'A wedge forms when support and resistance converge, showing that each swing is getting smaller. Rising wedges often warn of weakening upside momentum, while falling wedges can show selling pressure fading.',
    howToUse:
      'The key signal is a breakout through one side of the wedge. Traders often wait for price to close outside the boundary instead of acting while price is still compressing inside the pattern.',
    watchFor:
      'False breakouts are common in wedges, so confirmation from follow-through candles, volume, or nearby support/resistance improves confidence.',
  },
  double_top: {
    title: 'Double Top',
    subtitle: 'Two failed attempts to break above a similar resistance area.',
    graphic: 'double-top',
    what:
      'A double top is a bearish reversal pattern where price tests resistance twice and fails to push materially higher. The low between the two tops forms the neckline.',
    howToUse:
      'The pattern is usually considered confirmed when price breaks below the neckline. Traders then watch the former neckline as possible resistance on retests.',
    watchFor:
      'If price closes above the two tops, the bearish setup is invalidated and can turn into a breakout instead.',
  },
  double_bottom: {
    title: 'Double Bottom',
    subtitle: 'Two defended tests of a similar support area.',
    graphic: 'double-bottom',
    what:
      'A double bottom is a bullish reversal pattern where sellers fail to push price below support on the second test. The high between the two bottoms forms the neckline.',
    howToUse:
      'The pattern is usually considered confirmed when price breaks above the neckline. Traders often look for the neckline to hold as support on a retest.',
    watchFor:
      'If price breaks below the two bottoms, the bullish reversal thesis is invalidated.',
  },
  head_and_shoulders: {
    title: 'Head and Shoulders',
    subtitle: 'A bearish reversal with a higher middle peak between two lower shoulders.',
    graphic: 'head-and-shoulders',
    what:
      'This pattern shows buyers making one final higher high, then failing to match it on the right shoulder. The lows between the shoulders and head create the neckline.',
    howToUse:
      'Traders usually treat a break below the neckline as confirmation. The neckline can become resistance if price retests it from below.',
    watchFor:
      'A move back above the right shoulder or head weakens the reversal signal.',
  },
  inverse_head_and_shoulders: {
    title: 'Inverse Head and Shoulders',
    subtitle: 'A bullish reversal with a lower middle low between two higher shoulders.',
    graphic: 'inverse-head-and-shoulders',
    what:
      'This pattern shows sellers making one final lower low, then failing to repeat it. The highs between the shoulders and head create the neckline.',
    howToUse:
      'Traders usually treat a break above the neckline as confirmation. The neckline can become support if price retests it from above.',
    watchFor:
      'A move back below the right shoulder or head weakens the reversal signal.',
  },
  ascending_triangle: {
    title: 'Ascending Triangle',
    subtitle: 'Flat resistance with rising lows pressing upward.',
    graphic: 'ascending-triangle',
    what:
      'An ascending triangle forms when buyers keep stepping in at higher prices while resistance stays near the same level. It often has a bullish bias because pressure builds into resistance.',
    howToUse:
      'The main signal is a breakout above resistance. Traders also watch whether former resistance becomes support after the breakout.',
    watchFor:
      'A breakdown below rising support warns that the buying pressure has failed.',
  },
  descending_triangle: {
    title: 'Descending Triangle',
    subtitle: 'Flat support with falling highs pressing downward.',
    graphic: 'descending-triangle',
    what:
      'A descending triangle forms when sellers keep appearing at lower prices while support stays near the same level. It often has a bearish bias because pressure builds into support.',
    howToUse:
      'The main signal is a breakdown below support. Traders also watch whether former support becomes resistance after the breakdown.',
    watchFor:
      'A breakout above falling resistance warns that the bearish pressure has failed.',
  },
  flag: {
    title: 'Flag',
    subtitle: 'A sharp move followed by a smaller counter-trend consolidation.',
    graphic: 'flag',
    what:
      'A flag forms after a strong impulse move, then price pauses in a compact channel that often slopes against the prior move. It is commonly treated as a continuation pattern.',
    howToUse:
      'Traders watch for price to break out of the flag in the direction of the original impulse. The prior impulse gives context for the expected continuation direction.',
    watchFor:
      'If the consolidation breaks opposite the impulse, the continuation setup is weakened or invalidated.',
  },
  pennant: {
    title: 'Pennant',
    subtitle: 'A sharp move followed by a small triangular compression.',
    graphic: 'pennant',
    what:
      'A pennant forms after a strong impulse move, then price compresses into converging support and resistance lines. It is usually interpreted as a continuation pause.',
    howToUse:
      'Traders watch for a breakout from the pennant in the direction of the prior impulse, ideally with expanding volume or strong follow-through.',
    watchFor:
      'A break against the impulse suggests the market rejected the continuation setup.',
  },
  cup_and_handle: {
    title: 'Cup and Handle',
    subtitle: 'A rounded recovery followed by a smaller pullback near resistance.',
    graphic: 'cup-and-handle',
    what:
      'A cup and handle forms when price recovers from a rounded base back toward prior resistance, then pauses in a shallower pullback called the handle.',
    howToUse:
      'The usual bullish trigger is a breakout above the rim resistance. Traders watch the handle low as a key invalidation area.',
    watchFor:
      'A handle that becomes too deep can weaken the pattern because it shows sellers are still in control.',
  },
};

function getChartPatternEducation(pattern: StockChartPatternDetection): ChartPatternEducation {
  const direct = chartPatternEducationByType[pattern.pattern_type];
  if (direct) {
    return direct;
  }

  return {
    title: pattern.display_name,
    subtitle: 'A chart pattern defined by recent swing highs, swing lows, and boundary lines.',
    graphic: 'generic',
    what:
      'Chart patterns organize price action into a structure that can make support, resistance, momentum, and invalidation levels easier to reason about.',
    howToUse:
      'Use the detected boundary lines, breakout level, and invalidation level as a checklist. A pattern is stronger when price respects its boundaries and then breaks in the expected direction.',
    watchFor:
      'Treat the pattern as context, not a standalone signal. Confirmation from volume, trend, market regime, and risk levels matters.',
  };
}

type PatternCandle = {
  close: number;
  open?: number;
};

type PatternOverlayLine = {
  label: string;
  kind: 'support' | 'resistance' | 'neckline' | 'trend';
  startIndex: number;
  startPrice: number;
  endIndex: number;
  endPrice: number;
};

type PatternLabel = {
  text: string;
  index: number;
  price: number;
};

type PatternChartSpec = {
  candles: PatternCandle[];
  overlays: PatternOverlayLine[];
  labels?: PatternLabel[];
};

const patternChartSpecs: Record<ChartPatternGraphicVariant, PatternChartSpec> = {
  channel: {
    candles: [34, 48, 40, 58, 50, 68, 60, 78, 70, 88].map((close) => ({ close })),
    overlays: [
      { label: 'support', kind: 'support', startIndex: 0, startPrice: 30, endIndex: 9, endPrice: 72 },
      {
        label: 'resistance',
        kind: 'resistance',
        startIndex: 0,
        startPrice: 52,
        endIndex: 9,
        endPrice: 94,
      },
    ],
  },
  wedge: {
    candles: [32, 70, 44, 64, 50, 61, 55, 59, 57, 58].map((close) => ({ close })),
    overlays: [
      { label: 'support', kind: 'support', startIndex: 0, startPrice: 30, endIndex: 9, endPrice: 57 },
      {
        label: 'resistance',
        kind: 'resistance',
        startIndex: 0,
        startPrice: 74,
        endIndex: 9,
        endPrice: 60,
      },
    ],
  },
  'double-top': {
    candles: [36, 56, 78, 61, 45, 63, 79, 58, 42, 31].map((close) => ({ close })),
    overlays: [
      {
        label: 'resistance',
        kind: 'resistance',
        startIndex: 1,
        startPrice: 80,
        endIndex: 7,
        endPrice: 80,
      },
      { label: 'neckline', kind: 'neckline', startIndex: 3, startPrice: 45, endIndex: 8, endPrice: 45 },
    ],
    labels: [
      { text: 'Top 1', index: 2, price: 86 },
      { text: 'Top 2', index: 6, price: 86 },
    ],
  },
  'double-bottom': {
    candles: [72, 50, 26, 44, 59, 42, 27, 46, 64, 76].map((close) => ({ close })),
    overlays: [
      { label: 'support', kind: 'support', startIndex: 1, startPrice: 24, endIndex: 7, endPrice: 24 },
      {
        label: 'neckline',
        kind: 'neckline',
        startIndex: 3,
        startPrice: 60,
        endIndex: 9,
        endPrice: 60,
      },
    ],
    labels: [
      { text: 'Bottom 1', index: 2, price: 16 },
      { text: 'Bottom 2', index: 6, price: 16 },
    ],
  },
  'head-and-shoulders': {
    candles: [35, 56, 74, 53, 90, 51, 73, 55, 42, 32].map((close) => ({ close })),
    overlays: [
      { label: 'neckline', kind: 'neckline', startIndex: 3, startPrice: 51, endIndex: 7, endPrice: 54 },
    ],
    labels: [
      { text: 'Shoulder', index: 2, price: 82 },
      { text: 'Head', index: 4, price: 98 },
      { text: 'Shoulder', index: 6, price: 81 },
    ],
  },
  'inverse-head-and-shoulders': {
    candles: [76, 56, 35, 58, 19, 60, 36, 55, 73, 86].map((close) => ({ close })),
    overlays: [
      {
        label: 'neckline',
        kind: 'neckline',
        startIndex: 3,
        startPrice: 59,
        endIndex: 7,
        endPrice: 57,
      },
    ],
    labels: [
      { text: 'Shoulder', index: 2, price: 26 },
      { text: 'Head', index: 4, price: 10 },
      { text: 'Shoulder', index: 6, price: 27 },
    ],
  },
  'ascending-triangle': {
    candles: [36, 72, 48, 74, 57, 75, 64, 76, 70, 86].map((close) => ({ close })),
    overlays: [
      {
        label: 'resistance',
        kind: 'resistance',
        startIndex: 1,
        startPrice: 76,
        endIndex: 8,
        endPrice: 76,
      },
      { label: 'rising support', kind: 'support', startIndex: 0, startPrice: 34, endIndex: 8, endPrice: 68 },
    ],
  },
  'descending-triangle': {
    candles: [82, 48, 72, 47, 62, 46, 55, 45, 49, 32].map((close) => ({ close })),
    overlays: [
      { label: 'support', kind: 'support', startIndex: 1, startPrice: 46, endIndex: 8, endPrice: 46 },
      {
        label: 'falling resistance',
        kind: 'resistance',
        startIndex: 0,
        startPrice: 84,
        endIndex: 8,
        endPrice: 50,
      },
    ],
  },
  flag: {
    candles: [22, 36, 53, 72, 88, 77, 82, 72, 76, 67, 72].map((close) => ({ close })),
    overlays: [
      { label: 'impulse', kind: 'trend', startIndex: 0, startPrice: 20, endIndex: 4, endPrice: 90 },
      {
        label: 'flag resistance',
        kind: 'resistance',
        startIndex: 5,
        startPrice: 84,
        endIndex: 10,
        endPrice: 76,
      },
      { label: 'flag support', kind: 'support', startIndex: 5, startPrice: 70, endIndex: 10, endPrice: 62 },
    ],
  },
  pennant: {
    candles: [20, 35, 54, 74, 88, 75, 82, 73, 78, 75, 77].map((close) => ({ close })),
    overlays: [
      { label: 'impulse', kind: 'trend', startIndex: 0, startPrice: 19, endIndex: 4, endPrice: 90 },
      {
        label: 'pennant resistance',
        kind: 'resistance',
        startIndex: 5,
        startPrice: 86,
        endIndex: 10,
        endPrice: 77,
      },
      {
        label: 'pennant support',
        kind: 'support',
        startIndex: 5,
        startPrice: 69,
        endIndex: 10,
        endPrice: 77,
      },
    ],
  },
  'cup-and-handle': {
    candles: [78, 60, 43, 31, 25, 34, 50, 68, 78, 68, 73, 86].map((close) => ({ close })),
    overlays: [
      {
        label: 'rim resistance',
        kind: 'resistance',
        startIndex: 0,
        startPrice: 79,
        endIndex: 8,
        endPrice: 79,
      },
      { label: 'handle support', kind: 'support', startIndex: 8, startPrice: 72, endIndex: 10, endPrice: 66 },
    ],
    labels: [{ text: 'Handle', index: 9, price: 57 }],
  },
  generic: {
    candles: [35, 48, 42, 58, 52, 66, 60, 75, 70, 82].map((close) => ({ close })),
    overlays: [
      { label: 'support', kind: 'support', startIndex: 0, startPrice: 30, endIndex: 9, endPrice: 72 },
      {
        label: 'resistance',
        kind: 'resistance',
        startIndex: 0,
        startPrice: 54,
        endIndex: 9,
        endPrice: 90,
      },
    ],
  },
};

function ChartPatternEducationGraphic({ variant }: { variant: ChartPatternGraphicVariant }) {
  const spec = patternChartSpecs[variant] ?? patternChartSpecs.generic;
  const chart = { left: 28, top: 18, width: 264, height: 138 };
  const minPrice = 0;
  const maxPrice = 100;
  const xForIndex = (index: number) =>
    chart.left + (index / Math.max(1, spec.candles.length - 1)) * chart.width;
  const yForPrice = (price: number) =>
    chart.top + ((maxPrice - price) / (maxPrice - minPrice)) * chart.height;
  const overlayColor = {
    support: '#0f766e',
    resistance: '#ea580c',
    neckline: '#7c3aed',
    trend: '#2563eb',
  } satisfies Record<PatternOverlayLine['kind'], string>;

  const resolvedCandles = spec.candles.map((candle, index) => {
    const previousClose = spec.candles[index - 1]?.close ?? candle.close - 5;
    const open = candle.open ?? previousClose;
    const high = Math.min(98, Math.max(open, candle.close) + 5 + (index % 2));
    const low = Math.max(2, Math.min(open, candle.close) - 5 - ((index + 1) % 2));
    return { ...candle, open, high, low };
  });

  return (
    <svg
      viewBox="0 0 320 200"
      className="h-full min-h-52 w-full"
      role="img"
      aria-label="Chart pattern candlestick illustration"
    >
      <rect x="8" y="8" width="304" height="184" rx="18" fill="#f8fafc" />
      <rect
        x={chart.left}
        y={chart.top}
        width={chart.width}
        height={chart.height}
        rx="10"
        fill="#ffffff"
        stroke="#e2e8f0"
      />
      {[0.25, 0.5, 0.75].map((ratio) => (
        <line
          key={`grid-y-${ratio}`}
          x1={chart.left}
          x2={chart.left + chart.width}
          y1={chart.top + chart.height * ratio}
          y2={chart.top + chart.height * ratio}
          stroke="#e2e8f0"
          strokeDasharray="4 8"
        />
      ))}
      {[0.25, 0.5, 0.75].map((ratio) => (
        <line
          key={`grid-x-${ratio}`}
          x1={chart.left + chart.width * ratio}
          x2={chart.left + chart.width * ratio}
          y1={chart.top}
          y2={chart.top + chart.height}
          stroke="#eef2f7"
          strokeDasharray="4 8"
        />
      ))}

      {resolvedCandles.map((candle, index) => {
        const x = xForIndex(index);
        const openY = yForPrice(candle.open);
        const closeY = yForPrice(candle.close);
        const bodyTop = Math.min(openY, closeY);
        const bodyHeight = Math.max(4, Math.abs(closeY - openY));
        const bullish = candle.close >= candle.open;
        const color = bullish ? '#16a34a' : '#dc2626';

        return (
          <g key={`pattern-candle-${index}`}>
            <line
              x1={x}
              x2={x}
              y1={yForPrice(candle.high)}
              y2={yForPrice(candle.low)}
              stroke={color}
              strokeWidth="2"
              strokeLinecap="round"
            />
            <rect
              x={x - 5}
              y={bodyTop}
              width="10"
              height={bodyHeight}
              rx="2"
              fill={bullish ? '#dcfce7' : '#fee2e2'}
              stroke={color}
              strokeWidth="2"
            />
          </g>
        );
      })}

      {spec.overlays.map((line) => {
        const startX = xForIndex(line.startIndex);
        const endX = xForIndex(line.endIndex);
        const startY = yForPrice(line.startPrice);
        const endY = yForPrice(line.endPrice);
        const labelX = (startX + endX) / 2;
        const labelY = (startY + endY) / 2 + (line.kind === 'support' ? 16 : -8);
        return (
          <g key={`${line.label}-${line.startIndex}-${line.endIndex}`}>
            <line
              x1={startX}
              x2={endX}
              y1={startY}
              y2={endY}
              stroke={overlayColor[line.kind]}
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={line.kind === 'trend' ? undefined : '7 5'}
            />
            <text
              x={labelX}
              y={labelY}
              textAnchor="middle"
              fill={overlayColor[line.kind]}
              fontSize="9"
              fontWeight="600"
            >
              {line.label}
            </text>
          </g>
        );
      })}

      {spec.labels?.map((label) => (
        <text
          key={`${label.text}-${label.index}`}
          x={xForIndex(label.index)}
          y={yForPrice(label.price)}
          textAnchor="middle"
          fill="#334155"
          fontSize="9"
          fontWeight="700"
        >
          {label.text}
        </text>
      ))}

      <text x={chart.left} y="180" fill="#64748b" fontSize="10">
        Static example, not live market data
      </text>
    </svg>
  );
}

function ChartPatternExplanationModal({
  pattern,
  onClose,
}: {
  pattern: StockChartPatternDetection;
  onClose: () => void;
}) {
  const education = getChartPatternEducation(pattern);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="chart-pattern-explanation-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-4 py-3">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Chart Pattern
            </p>
            <h3 id="chart-pattern-explanation-title" className="text-base font-semibold">
              What is {education.title}?
            </h3>
          </div>
          <button
            type="button"
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Close chart pattern explanation"
            onClick={onClose}
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="overflow-y-auto">
          <section className="border-b border-border bg-muted/20 p-4">
            <p className="mb-3 text-sm text-muted-foreground">{education.subtitle}</p>
            <div className="rounded-xl border border-border/70 bg-background p-3">
              <ChartPatternEducationGraphic variant={education.graphic} />
              <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <span className="h-0.5 w-4 rounded-full bg-teal-500" aria-hidden />
                  Support
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-0.5 w-4 rounded-full bg-orange-500" aria-hidden />
                  Resistance
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-0.5 w-4 rounded-full bg-primary/70" aria-hidden />
                  Price path
                </span>
              </div>
            </div>
          </section>

          <section className="space-y-3 p-4 text-sm leading-relaxed">
            <div>
              <h4 className="font-medium text-foreground">What It Means</h4>
              <p className="mt-1 text-muted-foreground">{education.what}</p>
            </div>
            <div>
              <h4 className="font-medium text-foreground">How To Use It</h4>
              <p className="mt-1 text-muted-foreground">{education.howToUse}</p>
            </div>
            <div>
              <h4 className="font-medium text-foreground">What To Watch</h4>
              <p className="mt-1 text-muted-foreground">{education.watchFor}</p>
            </div>
            <div className="grid gap-2 rounded-lg border border-border/70 bg-muted/25 p-3 text-xs sm:grid-cols-3">
              <div>
                <span className="block text-muted-foreground">Detected Bias</span>
                <span className="font-medium capitalize text-foreground">{pattern.direction}</span>
              </div>
              <div>
                <span className="block text-muted-foreground">Breakout Level</span>
                <span className="font-medium text-foreground">
                  {pattern.breakout_level != null ? fmt2(pattern.breakout_level) : 'Not set'}
                </span>
              </div>
              <div>
                <span className="block text-muted-foreground">Invalidation</span>
                <span className="font-medium text-foreground">
                  {pattern.invalidation_level != null ? fmt2(pattern.invalidation_level) : 'Not set'}
                </span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

/**
 * TradingView-style data readout: OHLC for the latest bar + last values for enabled studies.
 * (Canvas also shows `title` next to each series’ value on the price scale — see series applyOptions.)
 */
function CandlestickStudyLegend({
  lastBar,
  maPoint,
  bbLast,
  rsiPoint,
  showMA,
  showBB,
  showRSI,
  showAiSr,
  aiSupport,
  aiResistance,
}: {
  lastBar: CandlestickData<Time> | undefined;
  maPoint: LineData<Time> | undefined;
  bbLast: { upper: number; middle: number; lower: number } | undefined;
  rsiPoint: LineData<Time> | undefined;
  showMA: boolean;
  showBB: boolean;
  showRSI: boolean;
  showAiSr: boolean;
  aiSupport: number | null;
  aiResistance: number | null;
}) {
  if (!lastBar) {
    return null;
  }

  const legendBox = cn(
    'pointer-events-none absolute left-2 top-2 z-20 max-w-[min(100%-1rem,18rem)] select-none',
    'rounded-md border border-border/70 bg-card/90 px-2 py-1.5 text-[10px] leading-snug shadow-sm backdrop-blur-sm',
  );

  return (
    <div className={legendBox}>
      <div className="flex flex-wrap gap-x-2 gap-y-0.5 tabular-nums">
        <span>
          <span className="text-muted-foreground">O</span>{' '}
          <span className="font-medium text-foreground">{fmt2(lastBar.open)}</span>
        </span>
        <span>
          <span className="text-muted-foreground">H</span>{' '}
          <span className="font-medium text-foreground">{fmt2(lastBar.high)}</span>
        </span>
        <span>
          <span className="text-muted-foreground">L</span>{' '}
          <span className="font-medium text-foreground">{fmt2(lastBar.low)}</span>
        </span>
        <span>
          <span className="text-muted-foreground">C</span>{' '}
          <span className="font-medium text-foreground">{fmt2(lastBar.close)}</span>
        </span>
      </div>
      {showMA && maPoint !== undefined ? (
        <div className="mt-1 flex items-center gap-1.5 border-t border-border/50 pt-1 tabular-nums">
          <span
            className="h-0.5 w-3 shrink-0 rounded-full"
            style={{ backgroundColor: STUDY_COLORS.ma }}
            aria-hidden
          />
          <span className="text-muted-foreground">MA {MA_PERIOD}</span>
          <span className="font-medium text-foreground">{fmt2(maPoint.value)}</span>
        </div>
      ) : null}
      {showBB && bbLast !== undefined ? (
        <div className="mt-1 space-y-0.5 border-t border-border/50 pt-1 tabular-nums">
          <div className="flex items-center gap-1.5">
            <span
              className="h-0.5 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: STUDY_COLORS.bbUpper }}
              aria-hidden
            />
            <span className="text-muted-foreground">BB upper</span>
            <span className="font-medium text-foreground">{fmt2(bbLast.upper)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className="h-0.5 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: STUDY_COLORS.bbMiddle }}
              aria-hidden
            />
            <span className="text-muted-foreground">BB basis</span>
            <span className="font-medium text-foreground">{fmt2(bbLast.middle)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className="h-0.5 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: STUDY_COLORS.bbLower }}
              aria-hidden
            />
            <span className="text-muted-foreground">BB lower</span>
            <span className="font-medium text-foreground">{fmt2(bbLast.lower)}</span>
          </div>
        </div>
      ) : null}
      {showRSI && rsiPoint !== undefined ? (
        <div className="mt-1 flex items-center gap-1.5 border-t border-border/50 pt-1 tabular-nums">
          <span
            className="h-0.5 w-3 shrink-0 rounded-full"
            style={{ backgroundColor: STUDY_COLORS.rsi }}
            aria-hidden
          />
          <span className="text-muted-foreground">RSI {RSI_PERIOD}</span>
          <span className="font-medium text-foreground">{fmt2(rsiPoint.value)}</span>
        </div>
      ) : null}
      {showAiSr && aiSupport !== null && Number.isFinite(aiSupport) ? (
        <div className="mt-1 flex items-center gap-1.5 border-t border-border/50 pt-1 tabular-nums">
          <span
            className="h-0.5 w-3 shrink-0 rounded-full"
            style={{ backgroundColor: STUDY_COLORS.aiSupport }}
            aria-hidden
          />
          <span className="text-muted-foreground">AI support</span>
          <span className="font-medium text-foreground">{fmt2(aiSupport)}</span>
        </div>
      ) : null}
      {showAiSr && aiResistance !== null && Number.isFinite(aiResistance) ? (
        <div className="mt-1 flex items-center gap-1.5 border-t border-border/50 pt-1 tabular-nums">
          <span
            className="h-0.5 w-3 shrink-0 rounded-full"
            style={{ backgroundColor: STUDY_COLORS.aiResistance }}
            aria-hidden
          />
          <span className="text-muted-foreground">AI resistance</span>
          <span className="font-medium text-foreground">{fmt2(aiResistance)}</span>
        </div>
      ) : null}
    </div>
  );
}

function ChartPatternSummary({
  patterns,
  analysis,
  modelId,
  loading,
  error,
}: {
  patterns: StockChartPatternDetection[];
  analysis: string | null;
  modelId: string | null;
  loading: boolean;
  error: string | null;
}) {
  const [selectedPattern, setSelectedPattern] = React.useState<StockChartPatternDetection | null>(
    null,
  );
  const closeExplanation = React.useCallback(() => setSelectedPattern(null), []);

  if (loading) {
    return <p className="text-[10px] text-muted-foreground">Scanning chart patterns…</p>;
  }
  if (error) {
    return <p className="text-[10px] text-destructive">{error}</p>;
  }
  if (patterns.length === 0) {
    return (
      <p className="text-[10px] text-muted-foreground">
        No high-confidence chart pattern detected for this range.
      </p>
    );
  }

  const top = patterns[0];

  return (
    <>
      <div className="space-y-1.5 rounded-md border border-border/70 bg-muted/30 p-2">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px]">
          <button
            type="button"
            className="rounded-sm font-medium text-foreground underline-offset-2 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`Learn about ${top.display_name}`}
            onClick={() => setSelectedPattern(top)}
          >
            {top.display_name}
          </button>
          <span className="rounded-full bg-background px-1.5 py-0.5 text-muted-foreground">
            {top.status}
          </span>
          <span className="rounded-full bg-background px-1.5 py-0.5 text-muted-foreground">
            {Math.round(top.confidence * 100)}% confidence
          </span>
          <span className="rounded-full bg-background px-1.5 py-0.5 text-muted-foreground">
            {top.direction}
          </span>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
          {top.breakout_level != null ? (
            <span>
              Breakout{' '}
              <span className="font-medium text-foreground">{fmt2(top.breakout_level)}</span>
            </span>
          ) : null}
          {top.invalidation_level != null ? (
            <span>
              Invalidation{' '}
              <span className="font-medium text-foreground">{fmt2(top.invalidation_level)}</span>
            </span>
          ) : null}
        </div>
        {analysis ? <CollapsibleStockAnalysis markdown={analysis} modelId={modelId} /> : null}
      </div>
      {selectedPattern ? (
        <ChartPatternExplanationModal pattern={selectedPattern} onClose={closeExplanation} />
      ) : null}
    </>
  );
}

type SeriesRefs = {
  chart: IChartApi | null;
  candle: ISeriesApi<'Candlestick'> | null;
  ma: ISeriesApi<'Line'> | null;
  bbUpper: ISeriesApi<'Line'> | null;
  bbMiddle: ISeriesApi<'Line'> | null;
  bbLower: ISeriesApi<'Line'> | null;
  rsi: ISeriesApi<'Line'> | null;
  aiSupport: IPriceLine | null;
  aiResistance: IPriceLine | null;
  patternLines: ISeriesApi<'Line'>[];
  patternBreakout: IPriceLine | null;
  patternInvalidation: IPriceLine | null;
};

const emptySeriesRefs = (): SeriesRefs => ({
  chart: null,
  candle: null,
  ma: null,
  bbUpper: null,
  bbMiddle: null,
  bbLower: null,
  rsi: null,
  aiSupport: null,
  aiResistance: null,
  patternLines: [],
  patternBreakout: null,
  patternInvalidation: null,
});

export interface CandlestickWidgetProps extends Omit<
  React.ComponentProps<typeof BaseWidget>,
  'children'
> {
  /** When omitted, demo OHLC is generated from timeframe + interval. */
  data?: CandlestickData<Time>[];
  borderVisible?: boolean;
  priceLineVisible?: boolean;
  timeVisible?: boolean;
  /** Controlled timeframe (use with `onTimeframeChange` + `data` from your API). */
  timeframe?: ChartTimeframe;
  defaultTimeframe?: ChartTimeframe;
  onTimeframeChange?: (timeframe: ChartTimeframe) => void;
  /** Controlled interval (use with `onIntervalChange` + `data`). */
  interval?: ChartInterval;
  defaultInterval?: ChartInterval;
  onIntervalChange?: (interval: ChartInterval) => void;
  /**
   * Show timeframe / interval controls.
   * Default: `true` when `data` is omitted or either change callback is set; otherwise `false`.
   */
  showControls?: boolean;
  /** Show MA / BB / RSI toggles. Default `true`. */
  showIndicatorToggles?: boolean;
  /**
   * Layout footprint: `default` (compact), `medium` (same chart height as default, wider card),
   * `large` (taller and wider chart area).
   */
  variant?: CandlestickWidgetVariant;
  /**
   * When true (and `data` is not passed), load candles from ``GET /api/stock/chart``.
   * Requires ``NEXT_PUBLIC_BACKEND_URL`` and server ``FMP_API_KEY``.
   */
  useStockApi?: boolean;
  /**
   * When ``useStockApi`` is true, also call ``GET /api/ai/widget/stock-chart`` and render
   * the returned markdown in the summary (GFM: headings, lists, tables). Default: true.
   */
  useAiAnalysis?: boolean;
  /** Watchlist symbols (max 3) when ``useStockApi`` is enabled. */
  defaultSymbols?: string[];
}

export function CandlestickWidget({
  data: dataProp,
  borderVisible = false,
  priceLineVisible = false,
  timeVisible = true,
  timeframe: timeframeProp,
  defaultTimeframe = '1M',
  onTimeframeChange,
  interval: intervalProp,
  defaultInterval,
  onIntervalChange,
  showControls: showControlsProp,
  showIndicatorToggles = true,
  variant = 'default',
  useStockApi = false,
  useAiAnalysis = true,
  defaultSymbols = ['AAPL'],
  className,
  ...props
}: CandlestickWidgetProps) {
  const chartContainerRef = React.useRef<HTMLDivElement | null>(null);
  const seriesRefs = React.useRef<SeriesRefs>(emptySeriesRefs());
  const chartCacheRef = React.useRef<Map<string, CandlestickData<Time>[]>>(new Map());
  const aiCacheRef = React.useRef<Map<string, { analysis: string; modelId: string }>>(new Map());
  const srCacheRef = React.useRef<
    Map<string, { support: number | null; resistance: number | null }>
  >(new Map());
  const patternCacheRef = React.useRef<
    Map<
      string,
      {
        patterns: StockChartPatternDetection[];
        analysis: string;
        modelId: string;
      }
    >
  >(new Map());

  const [internalTf, setInternalTf] = React.useState<ChartTimeframe>(defaultTimeframe);
  const [internalIv, setInternalIv] = React.useState<ChartInterval>(() =>
    clampIntervalToTimeframe(
      defaultTimeframe,
      defaultInterval ?? clampIntervalToTimeframe(defaultTimeframe, '1d'),
    ),
  );

  const [showMA, setShowMA] = React.useState(false);
  const [showBB, setShowBB] = React.useState(false);
  const [showRSI, setShowRSI] = React.useState(false);
  /** Horizontal AI support/resistance price lines (when ``useStockApi`` provides levels). */
  const [showAiSr, setShowAiSr] = React.useState(true);
  /** Deterministic chart-pattern overlays from backend OHLC pivot geometry. */
  const [showPatterns, setShowPatterns] = React.useState(true);

  const [symbols, setSymbols] = React.useState<string[]>(() =>
    normalizeSymbolList(defaultSymbols, 3),
  );
  const [activeSymbolIndex, setActiveSymbolIndex] = React.useState(0);
  const [symbolDraft, setSymbolDraft] = React.useState('');
  const [apiCandles, setApiCandles] = React.useState<CandlestickData<Time>[]>([]);
  const [apiError, setApiError] = React.useState<string | null>(null);
  const [apiLoading, setApiLoading] = React.useState(false);

  const [apiAiAnalysis, setApiAiAnalysis] = React.useState<string | null>(null);
  const [apiAiModel, setApiAiModel] = React.useState<string | null>(null);
  const [apiAiLoading, setApiAiLoading] = React.useState(false);
  const [apiAiError, setApiAiError] = React.useState<string | null>(null);

  const [apiSrSupport, setApiSrSupport] = React.useState<number | null>(null);
  const [apiSrResistance, setApiSrResistance] = React.useState<number | null>(null);

  const [apiPatterns, setApiPatterns] = React.useState<StockChartPatternDetection[]>([]);
  const [apiPatternAnalysis, setApiPatternAnalysis] = React.useState<string | null>(null);
  const [apiPatternModel, setApiPatternModel] = React.useState<string | null>(null);
  const [apiPatternsLoading, setApiPatternsLoading] = React.useState(false);
  const [apiPatternsError, setApiPatternsError] = React.useState<string | null>(null);

  const timeframe = timeframeProp ?? internalTf;

  const allowedIntervals = React.useMemo(
    () => allowedIntervalsForTimeframe(timeframe),
    [timeframe],
  );

  const resolvedInternalIv = React.useMemo(() => {
    if (intervalProp !== undefined) {
      return intervalProp;
    }

    return allowedIntervals.includes(internalIv) ? internalIv : (allowedIntervals[0] ?? internalIv);
  }, [allowedIntervals, internalIv, intervalProp]);

  const interval = intervalProp ?? resolvedInternalIv;

  const activeSymbolIndexResolved =
    symbols.length === 0 ? 0 : Math.min(activeSymbolIndex, symbols.length - 1);
  const activeSymbol = symbols[activeSymbolIndexResolved] ?? '';

  const useGeneratedData = dataProp === undefined && !useStockApi;
  const showSymbolTabs = useStockApi && dataProp === undefined;
  const showControls =
    showControlsProp ??
    (useGeneratedData ||
      useStockApi ||
      onTimeframeChange !== undefined ||
      onIntervalChange !== undefined);

  React.useEffect(() => {
    const ac = new AbortController();

    void (async () => {
      if (!useStockApi || dataProp !== undefined) {
        return;
      }

      if (!activeSymbol) {
        setApiCandles([]);
        setApiError(null);
        setApiLoading(false);
        return;
      }

      const apiInterval = chartIntervalToApi(interval);
      const q = chartTimeframeToApiQuery(timeframe);
      const cacheKey = `${activeSymbol}|${timeframe}|${interval}|${apiInterval}|${JSON.stringify(q)}`;
      const cached = chartCacheRef.current.get(cacheKey);
      if (cached && cached.length > 0) {
        setApiCandles(cached);
      }

      setApiLoading(true);
      setApiError(null);

      try {
        const res = await getStockChart({
          symbol: activeSymbol,
          interval: apiInterval,
          range: q.range,
          from: q.from,
          to: q.to,
          signal: ac.signal,
        });
        const mapped = stockApiCandlesToChartData(res.candles);
        if (!ac.signal.aborted) {
          chartCacheRef.current.set(cacheKey, mapped);
          setApiCandles(mapped);
        }
      } catch (e: unknown) {
        if (ac.signal.aborted) {
          return;
        }
        const msg =
          e && typeof e === 'object' && 'message' in e
            ? String((e as { message: string }).message)
            : 'Could not load chart';
        setApiError(msg);
        if (!cached?.length) {
          setApiCandles([]);
        }
      } finally {
        if (!ac.signal.aborted) {
          setApiLoading(false);
        }
      }
    })();

    return () => ac.abort();
  }, [useStockApi, dataProp, activeSymbol, timeframe, interval]);

  React.useEffect(() => {
    const ac = new AbortController();

    void (async () => {
      if (!useStockApi || dataProp !== undefined || !useAiAnalysis) {
        setApiAiAnalysis(null);
        setApiAiModel(null);
        setApiAiLoading(false);
        setApiAiError(null);
        return;
      }

      if (!activeSymbol) {
        setApiAiAnalysis(null);
        setApiAiModel(null);
        setApiAiLoading(false);
        setApiAiError(null);
        return;
      }

      const apiInterval = chartIntervalToApi(interval);
      const q = chartTimeframeToApiQuery(timeframe);
      const cacheKey = `${activeSymbol}|${timeframe}|${interval}|${apiInterval}|${JSON.stringify(q)}`;
      const cached = aiCacheRef.current.get(cacheKey);
      if (cached) {
        setApiAiAnalysis(cached.analysis);
        setApiAiModel(cached.modelId);
        setApiAiError(null);
        setApiAiLoading(false);
        return;
      }

      setApiAiAnalysis(null);
      setApiAiModel(null);
      setApiAiError(null);
      setApiAiLoading(true);

      try {
        const res = await getStockChartAnalysis({
          symbol: activeSymbol,
          interval: apiInterval,
          range: q.range,
          from: q.from,
          to: q.to,
          signal: ac.signal,
        });
        if (ac.signal.aborted) {
          return;
        }
        aiCacheRef.current.set(cacheKey, {
          analysis: res.analysis,
          modelId: res.model_id,
        });
        setApiAiAnalysis(res.analysis);
        setApiAiModel(res.model_id);
      } catch (e: unknown) {
        if (ac.signal.aborted) {
          return;
        }
        const msg =
          e && typeof e === 'object' && 'message' in e
            ? String((e as { message: string }).message)
            : 'Could not load AI analysis';
        setApiAiError(msg);
        setApiAiAnalysis(null);
        setApiAiModel(null);
      } finally {
        if (!ac.signal.aborted) {
          setApiAiLoading(false);
        }
      }
    })();

    return () => ac.abort();
  }, [useStockApi, dataProp, useAiAnalysis, activeSymbol, timeframe, interval]);

  React.useEffect(() => {
    const ac = new AbortController();

    void (async () => {
      if (!useStockApi || dataProp !== undefined) {
        setApiSrSupport(null);
        setApiSrResistance(null);
        return;
      }

      if (!activeSymbol) {
        setApiSrSupport(null);
        setApiSrResistance(null);
        return;
      }

      const apiInterval = chartIntervalToApi(interval);
      const q = chartTimeframeToApiQuery(timeframe);
      const cacheKey = `sr|${activeSymbol}|${timeframe}|${interval}|${apiInterval}|${JSON.stringify(q)}`;
      const cached = srCacheRef.current.get(cacheKey);
      if (cached) {
        setApiSrSupport(cached.support);
        setApiSrResistance(cached.resistance);
        return;
      }

      setApiSrSupport(null);
      setApiSrResistance(null);

      try {
        const res = await getStockChartSupportResistance({
          symbol: activeSymbol,
          interval: apiInterval,
          range: q.range,
          from: q.from,
          to: q.to,
          signal: ac.signal,
        });
        if (ac.signal.aborted) {
          return;
        }
        const levels = {
          support: res.support ?? null,
          resistance: res.resistance ?? null,
        };
        srCacheRef.current.set(cacheKey, levels);
        setApiSrSupport(levels.support);
        setApiSrResistance(levels.resistance);
      } catch {
        if (!ac.signal.aborted) {
          setApiSrSupport(null);
          setApiSrResistance(null);
        }
      }
    })();

    return () => ac.abort();
  }, [useStockApi, dataProp, activeSymbol, timeframe, interval]);

  React.useEffect(() => {
    const ac = new AbortController();

    void (async () => {
      if (!useStockApi || dataProp !== undefined) {
        setApiPatterns([]);
        setApiPatternAnalysis(null);
        setApiPatternModel(null);
        setApiPatternsLoading(false);
        setApiPatternsError(null);
        return;
      }

      if (!activeSymbol) {
        setApiPatterns([]);
        setApiPatternAnalysis(null);
        setApiPatternModel(null);
        setApiPatternsLoading(false);
        setApiPatternsError(null);
        return;
      }

      const apiInterval = chartIntervalToApi(interval);
      const q = chartTimeframeToApiQuery(timeframe);
      const cacheKey = `patterns|${activeSymbol}|${timeframe}|${interval}|${apiInterval}|${JSON.stringify(q)}`;
      const cached = patternCacheRef.current.get(cacheKey);
      if (cached) {
        setApiPatterns(cached.patterns);
        setApiPatternAnalysis(cached.analysis);
        setApiPatternModel(cached.modelId);
        setApiPatternsLoading(false);
        setApiPatternsError(null);
        return;
      }

      setApiPatterns([]);
      setApiPatternAnalysis(null);
      setApiPatternModel(null);
      setApiPatternsError(null);
      setApiPatternsLoading(true);

      try {
        const res = await getStockChartPatterns({
          symbol: activeSymbol,
          interval: apiInterval,
          range: q.range,
          from: q.from,
          to: q.to,
          signal: ac.signal,
        });
        if (ac.signal.aborted) {
          return;
        }
        const result = {
          patterns: res.patterns.slice(0, 3),
          analysis: res.analysis,
          modelId: res.model_id,
        };
        patternCacheRef.current.set(cacheKey, result);
        setApiPatterns(result.patterns);
        setApiPatternAnalysis(result.analysis);
        setApiPatternModel(result.modelId);
      } catch (e: unknown) {
        if (ac.signal.aborted) {
          return;
        }
        const msg =
          e && typeof e === 'object' && 'message' in e
            ? String((e as { message: string }).message)
            : 'Could not load chart patterns';
        setApiPatternsError(msg);
        setApiPatterns([]);
        setApiPatternAnalysis(null);
        setApiPatternModel(null);
      } finally {
        if (!ac.signal.aborted) {
          setApiPatternsLoading(false);
        }
      }
    })();

    return () => ac.abort();
  }, [useStockApi, dataProp, activeSymbol, timeframe, interval]);

  const resolvedData = React.useMemo(() => {
    if (dataProp !== undefined) {
      return dataProp;
    }
    if (useStockApi) {
      return apiCandles;
    }
    return generateMockCandles(timeframe, interval);
  }, [dataProp, useStockApi, apiCandles, timeframe, interval]);

  const addSymbol = React.useCallback(() => {
    setSymbols((s) => {
      const t = normalizeTicker(symbolDraft);
      if (!t || s.includes(t) || s.length >= 3) {
        return s;
      }
      setActiveSymbolIndex(s.length);
      setSymbolDraft('');
      return [...s, t];
    });
  }, [symbolDraft]);

  const removeSymbol = React.useCallback((index: number) => {
    setSymbols((s) => s.filter((_, i) => i !== index));
  }, []);

  const indicatorLines = React.useMemo(
    () => ({
      ma: computeMASeries(resolvedData, MA_PERIOD),
      bb: computeBollingerSeries(resolvedData, BB_PERIOD, BB_MULTIPLIER),
      rsi: computeRSISeries(resolvedData, RSI_PERIOD),
    }),
    [resolvedData],
  );

  React.useEffect(() => {
    if (intervalProp !== undefined) {
      const fallback = allowedIntervals[0];
      if (fallback && !allowedIntervals.includes(intervalProp)) {
        onIntervalChange?.(fallback);
      }
    }
  }, [allowedIntervals, intervalProp, onIntervalChange]);

  const setTimeframe = React.useCallback(
    (next: ChartTimeframe) => {
      if (timeframeProp === undefined) {
        setInternalTf(next);
      }
      onTimeframeChange?.(next);
    },
    [timeframeProp, onTimeframeChange],
  );

  const setInterval = React.useCallback(
    (next: ChartInterval) => {
      if (intervalProp === undefined) {
        setInternalIv(next);
      }
      onIntervalChange?.(next);
    },
    [intervalProp, onIntervalChange],
  );

  React.useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) {
      return;
    }

    const chart = createChart(container, {
      width: Math.max(1, container.clientWidth),
      height: Math.max(1, container.clientHeight),
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#64748b',
      },
      grid: {
        vertLines: { color: 'rgba(148, 163, 184, 0.15)' },
        horzLines: { color: 'rgba(148, 163, 184, 0.15)' },
      },
      rightPriceScale: {
        borderVisible: false,
      },
      timeScale: {
        borderVisible: false,
        timeVisible,
      },
    });

    const candle = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
      borderVisible,
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      priceLineVisible,
      title: 'Price',
      lastValueVisible: true,
    });

    const ma = chart.addSeries(
      LineSeries,
      {
        color: STUDY_COLORS.ma,
        lineWidth: 1,
        priceLineVisible: false,
        title: `MA ${MA_PERIOD}`,
        lastValueVisible: false,
        visible: false,
      },
      0,
    );

    const bbUpper = chart.addSeries(
      LineSeries,
      {
        color: STUDY_COLORS.bbUpper,
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        priceLineVisible: false,
        title: 'BB upper',
        lastValueVisible: false,
        visible: false,
      },
      0,
    );

    const bbMiddle = chart.addSeries(
      LineSeries,
      {
        color: STUDY_COLORS.bbMiddle,
        lineWidth: 1,
        priceLineVisible: false,
        title: 'BB basis',
        lastValueVisible: false,
        visible: false,
      },
      0,
    );

    const bbLower = chart.addSeries(
      LineSeries,
      {
        color: STUDY_COLORS.bbLower,
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        priceLineVisible: false,
        title: 'BB lower',
        lastValueVisible: false,
        visible: false,
      },
      0,
    );

    seriesRefs.current = {
      chart,
      candle,
      ma,
      bbUpper,
      bbMiddle,
      bbLower,
      rsi: null,
      aiSupport: null,
      aiResistance: null,
      patternLines: [],
      patternBreakout: null,
      patternInvalidation: null,
    };

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry) {
          return;
        }
        chart.applyOptions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      });
      resizeObserver.observe(container);
    }

    return () => {
      resizeObserver?.disconnect();
      chart.remove();
      seriesRefs.current = emptySeriesRefs();
    };
  }, [borderVisible, priceLineVisible, timeVisible]);

  React.useEffect(() => {
    const r = seriesRefs.current;
    const { chart, candle } = r;
    if (!chart || !candle) {
      return;
    }
    candle.applyOptions({
      borderVisible,
      priceLineVisible,
      title: 'Price',
      lastValueVisible: true,
    });
  }, [borderVisible, priceLineVisible]);

  React.useEffect(() => {
    const r = seriesRefs.current;
    const chart = r.chart;
    if (!chart) {
      return;
    }

    if (showRSI) {
      if (!r.rsi) {
        chart.addPane();
        const rsiSeries = chart.addSeries(
          LineSeries,
          {
            color: STUDY_COLORS.rsi,
            lineWidth: 1,
            priceLineVisible: false,
            lastValueVisible: true,
            title: `RSI ${RSI_PERIOD}`,
            priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
          },
          1,
        );
        r.rsi = rsiSeries;
        const panes = chart.panes();
        if (panes[0]) {
          panes[0].setStretchFactor(2.75);
        }
        if (panes[1]) {
          panes[1].setStretchFactor(0.9);
        }
        chart.priceScale('right', 1).applyOptions({
          scaleMargins: { top: 0.12, bottom: 0.12 },
        });
      }
    } else if (r.rsi) {
      chart.removeSeries(r.rsi);
      r.rsi = null;
      chart.removePane(1);
      const main = chart.panes()[0];
      if (main) {
        main.setStretchFactor(1);
      }
    }
  }, [showRSI]);

  /** TradingView-style: `title` is drawn next to the last-value label on each price scale. */
  React.useEffect(() => {
    const r = seriesRefs.current;
    const { ma, bbUpper, bbMiddle, bbLower } = r;
    if (!ma || !bbUpper || !bbMiddle || !bbLower) {
      return;
    }

    ma.applyOptions({
      title: `MA ${MA_PERIOD}`,
      lastValueVisible: showMA,
      visible: showMA,
    });
    bbUpper.applyOptions({
      title: 'BB upper',
      lastValueVisible: showBB,
      visible: showBB,
    });
    bbMiddle.applyOptions({
      title: 'BB basis',
      lastValueVisible: showBB,
      visible: showBB,
    });
    bbLower.applyOptions({
      title: 'BB lower',
      lastValueVisible: showBB,
      visible: showBB,
    });

    if (r.rsi) {
      r.rsi.applyOptions({
        title: `RSI ${RSI_PERIOD}`,
        lastValueVisible: showRSI,
        visible: showRSI,
      });
    }
  }, [showMA, showBB, showRSI]);

  React.useEffect(() => {
    const r = seriesRefs.current;
    const { chart, candle, ma, bbUpper, bbMiddle, bbLower } = r;
    if (!chart || !candle || !ma || !bbUpper || !bbMiddle || !bbLower) {
      return;
    }

    candle.setData(resolvedData);

    ma.setData(showMA ? indicatorLines.ma : []);
    bbUpper.setData(showBB ? indicatorLines.bb.upper : []);
    bbMiddle.setData(showBB ? indicatorLines.bb.middle : []);
    bbLower.setData(showBB ? indicatorLines.bb.lower : []);

    const rsi = r.rsi;
    if (rsi) {
      rsi.setData(showRSI ? indicatorLines.rsi : []);
      if (showRSI) {
        const rsiScale = chart.priceScale('right', 1);
        rsiScale.setAutoScale(false);
        rsiScale.setVisibleRange({ from: 0, to: 100 });
      }
    }

    chart.timeScale().fitContent();
    chart.priceScale('right', 0).setAutoScale(true);
  }, [resolvedData, showMA, showBB, showRSI, indicatorLines]);

  /** Lightweight Charts horizontal price lines (TradingView-style scale labels via ``title``). */
  React.useEffect(() => {
    const r = seriesRefs.current;
    const candle = r.candle;
    if (!candle) {
      return;
    }

    if (r.aiSupport) {
      candle.removePriceLine(r.aiSupport);
      r.aiSupport = null;
    }
    if (r.aiResistance) {
      candle.removePriceLine(r.aiResistance);
      r.aiResistance = null;
    }

    if (!useStockApi || dataProp !== undefined || !showAiSr) {
      return;
    }

    const showSup = apiSrSupport !== null && Number.isFinite(apiSrSupport);
    const showRes = apiSrResistance !== null && Number.isFinite(apiSrResistance);
    if (!showSup && !showRes) {
      return;
    }

    if (showSup) {
      r.aiSupport = candle.createPriceLine({
        price: apiSrSupport as number,
        color: STUDY_COLORS.aiSupport,
        lineWidth: 2,
        lineStyle: LineStyle.LargeDashed,
        axisLabelVisible: true,
        title: 'AI Support',
      });
    }

    if (showRes) {
      r.aiResistance = candle.createPriceLine({
        price: apiSrResistance as number,
        color: STUDY_COLORS.aiResistance,
        lineWidth: 2,
        lineStyle: LineStyle.LargeDashed,
        axisLabelVisible: true,
        title: 'AI Resistance',
      });
    }
  }, [
    apiSrSupport,
    apiSrResistance,
    showAiSr,
    useStockApi,
    dataProp,
    resolvedData.length,
    borderVisible,
    priceLineVisible,
    timeVisible,
  ]);

  React.useEffect(() => {
    const r = seriesRefs.current;
    const { chart, candle } = r;
    if (!chart || !candle) {
      return;
    }

    for (const series of r.patternLines) {
      chart.removeSeries(series);
    }
    r.patternLines = [];
    if (r.patternBreakout) {
      candle.removePriceLine(r.patternBreakout);
      r.patternBreakout = null;
    }
    if (r.patternInvalidation) {
      candle.removePriceLine(r.patternInvalidation);
      r.patternInvalidation = null;
    }

    if (!useStockApi || dataProp !== undefined || !showPatterns || apiPatterns.length === 0) {
      return;
    }

    const visiblePatterns = apiPatterns.slice(0, 3);
    for (const pattern of visiblePatterns) {
      for (const line of pattern.lines) {
        const color =
          line.kind === 'support'
            ? STUDY_COLORS.patternSupport
            : line.kind === 'resistance'
              ? STUDY_COLORS.patternResistance
              : STUDY_COLORS.pattern;
        const series = chart.addSeries(
          LineSeries,
          {
            color,
            lineWidth: 2,
            lineStyle: LineStyle.Dashed,
            priceLineVisible: false,
            lastValueVisible: false,
            title: pattern.display_name,
          },
          0,
        );
        series.setData([
          { time: fmpDateToChartTime(line.start.date), value: line.start.price },
          { time: fmpDateToChartTime(line.end.date), value: line.end.price },
        ]);
        r.patternLines.push(series);
      }
    }

    const top = visiblePatterns[0];
    if (top?.breakout_level != null && Number.isFinite(top.breakout_level)) {
      r.patternBreakout = candle.createPriceLine({
        price: top.breakout_level,
        color: STUDY_COLORS.patternBreakout,
        lineWidth: 1,
        lineStyle: LineStyle.LargeDashed,
        axisLabelVisible: true,
        title: 'Pattern Breakout',
      });
    }
    if (top?.invalidation_level != null && Number.isFinite(top.invalidation_level)) {
      r.patternInvalidation = candle.createPriceLine({
        price: top.invalidation_level,
        color: STUDY_COLORS.patternInvalidation,
        lineWidth: 1,
        lineStyle: LineStyle.LargeDashed,
        axisLabelVisible: true,
        title: 'Pattern Invalid',
      });
    }
  }, [
    apiPatterns,
    showPatterns,
    useStockApi,
    dataProp,
    resolvedData.length,
    borderVisible,
    priceLineVisible,
    timeVisible,
  ]);

  const studyLegendProps = React.useMemo(() => {
    const lastBar = resolvedData[resolvedData.length - 1];
    const maPoint = showMA ? indicatorLines.ma[indicatorLines.ma.length - 1] : undefined;
    let bbLast: { upper: number; middle: number; lower: number } | undefined;
    if (showBB) {
      const u = indicatorLines.bb.upper;
      const m = indicatorLines.bb.middle;
      const l = indicatorLines.bb.lower;
      const lu = u[u.length - 1];
      const lm = m[m.length - 1];
      const ll = l[l.length - 1];
      if (lu !== undefined && lm !== undefined && ll !== undefined) {
        bbLast = { upper: lu.value, middle: lm.value, lower: ll.value };
      }
    }
    const rsiPoint = showRSI ? indicatorLines.rsi[indicatorLines.rsi.length - 1] : undefined;
    return { lastBar, maPoint, bbLast, rsiPoint };
  }, [resolvedData, indicatorLines, showMA, showBB, showRSI]);

  const ruleBasedInsight = React.useMemo(
    () =>
      buildCandlestickInsight(
        resolvedData,
        timeframe,
        interval,
        { showMA, showBB, showRSI },
        indicatorLines,
      ),
    [resolvedData, timeframe, interval, showMA, showBB, showRSI, indicatorLines],
  );

  const loadAiSummary = useStockApi && dataProp === undefined && useAiAnalysis;
  const loadPatternSummary = useStockApi && dataProp === undefined;

  const contextText = React.useMemo(
    () =>
      buildCandlestickChatContext({
        activeSymbol,
        symbols,
        timeframe,
        interval,
        data: resolvedData,
        showMA,
        showBB,
        showRSI,
        indicators: indicatorLines,
        showAiSr,
        apiSrSupport,
        apiSrResistance,
        showPatterns,
        patterns: apiPatterns,
      }),
    [
      activeSymbol,
      symbols,
      timeframe,
      interval,
      resolvedData,
      showMA,
      showBB,
      showRSI,
      indicatorLines,
      showAiSr,
      apiSrSupport,
      apiSrResistance,
      showPatterns,
      apiPatterns,
    ],
  );

  const patternSummaryContent = React.useMemo(() => {
    if (!loadPatternSummary) {
      return null;
    }
    return (
      <ChartPatternSummary
        patterns={apiPatterns}
        analysis={apiPatternAnalysis}
        modelId={apiPatternModel}
        loading={apiPatternsLoading}
        error={apiPatternsError}
      />
    );
  }, [
    loadPatternSummary,
    apiPatterns,
    apiPatternAnalysis,
    apiPatternModel,
    apiPatternsLoading,
    apiPatternsError,
  ]);

  const summaryContent = React.useMemo(() => {
    let aiSummary: React.ReactNode;
    if (!loadAiSummary) {
      aiSummary = (
        <span className="block whitespace-pre-wrap text-xs leading-relaxed text-primary/90">
          {ruleBasedInsight}
        </span>
      );
    } else if (apiAiAnalysis) {
      aiSummary = <CollapsibleStockAnalysis markdown={apiAiAnalysis} modelId={apiAiModel} />;
    } else if (apiAiLoading) {
      aiSummary = (
        <div className="space-y-1.5">
          <span className="block whitespace-pre-wrap text-xs leading-relaxed text-primary/90">
            {ruleBasedInsight}
          </span>
          <p className="text-[10px] text-muted-foreground">Generating AI summary…</p>
        </div>
      );
    } else if (apiAiError) {
      aiSummary = (
        <div className="space-y-1.5">
          <span className="block whitespace-pre-wrap text-xs leading-relaxed text-primary/90">
            {ruleBasedInsight}
          </span>
          <p className="text-[10px] text-destructive">{apiAiError}</p>
        </div>
      );
    } else {
      aiSummary = (
        <span className="block whitespace-pre-wrap text-xs leading-relaxed text-primary/90">
          {ruleBasedInsight}
        </span>
      );
    }

    if (!patternSummaryContent) {
      return aiSummary;
    }

    return (
      <div className="space-y-2">
        {aiSummary}
        {patternSummaryContent}
      </div>
    );
  }, [
    loadAiSummary,
    ruleBasedInsight,
    apiAiAnalysis,
    apiAiModel,
    apiAiLoading,
    apiAiError,
    patternSummaryContent,
  ]);

  const showToolbar = showControls || showIndicatorToggles;
  const variantClasses = candlestickVariantClassNames(variant);

  return (
    <BaseWidget
      {...props}
      summary={summaryContent}
      contextData={{ label: props.title ?? 'Candlestick Chart', text: contextText }}
      className={cn(variantClasses.root, className)}
    >
      {showSymbolTabs ? (
        <div className="mb-2 flex flex-col gap-2">
          <div
            className="flex flex-wrap items-center gap-1 border-b border-border pb-1.5"
            role="tablist"
            aria-label="Stock symbols"
          >
            {symbols.map((sym, idx) => (
              <div key={`${sym}-${idx}`} className="flex items-center gap-0.5">
                <button
                  type="button"
                  role="tab"
                  aria-selected={idx === activeSymbolIndex}
                  className={cn(
                    'inline-flex items-center rounded-t-md px-2.5 py-1 text-xs font-medium transition-colors',
                    idx === activeSymbolIndex
                      ? 'border border-b-0 border-border bg-muted/90 text-foreground shadow-sm'
                      : 'border border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                  )}
                  onClick={() => setActiveSymbolIndex(idx)}
                >
                  {sym}
                </button>
                <button
                  type="button"
                  className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label={`Remove ${sym}`}
                  onClick={() => removeSymbol(idx)}
                >
                  <X className="size-3.5 shrink-0" />
                </button>
              </div>
            ))}
            {symbols.length < 3 ? (
              <div className="ml-1 flex items-center gap-1">
                <input
                  className={cn(selectClass, 'h-7 w-22')}
                  placeholder="Ticker"
                  value={symbolDraft}
                  maxLength={12}
                  aria-label="Ticker to add"
                  onChange={(e) => setSymbolDraft(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addSymbol();
                    }
                  }}
                />
                <Button type="button" size="xs" variant="secondary" onClick={addSymbol}>
                  Add
                </Button>
              </div>
            ) : null}
          </div>
          {symbols.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Add up to 3 tickers to load OHLCV from the backend.
            </p>
          ) : null}
          {apiError ? (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1 text-xs text-destructive">
              {apiError}
            </p>
          ) : null}
        </div>
      ) : null}
      {showToolbar ? (
        <div className="mb-3 flex flex-col gap-2">
          {showControls ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="whitespace-nowrap">Timeframe</span>
                  <select
                    className={selectClass}
                    value={timeframe}
                    onChange={(e) => setTimeframe(e.target.value as ChartTimeframe)}
                    aria-label="Chart timeframe"
                  >
                    {CHART_TIMEFRAMES.map((tf) => (
                      <option key={tf} value={tf}>
                        {tf}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="whitespace-nowrap">Interval</span>
                  <select
                    className={selectClass}
                    value={interval}
                    onChange={(e) => setInterval(e.target.value as ChartInterval)}
                    aria-label="Candle interval"
                  >
                    {CHART_INTERVALS.map((iv) => (
                      <option key={iv} value={iv} disabled={!allowedIntervals.includes(iv)}>
                        {iv}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </>
          ) : null}
          {showIndicatorToggles ? (
            <div
              className={cn(
                'flex flex-wrap items-center gap-x-2 gap-y-1',
                showControls && 'border-t border-border pt-2',
              )}
            >
              <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-0.5 gap-y-1">
                <span className="pr-1 text-xs text-muted-foreground">Indicators</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  aria-pressed={showMA}
                  aria-label="Moving average"
                  onClick={() => setShowMA((v) => !v)}
                  className={indicatorToggleButtonClass(showMA)}
                >
                  MA <span className={indicatorToggleSuffixClass(showMA)}>({MA_PERIOD})</span>
                </Button>
                <span className="select-none px-0.5 text-muted-foreground/40" aria-hidden>
                  ·
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  aria-pressed={showBB}
                  aria-label="Bollinger Bands"
                  onClick={() => setShowBB((v) => !v)}
                  className={indicatorToggleButtonClass(showBB)}
                >
                  BB{' '}
                  <span className={indicatorToggleSuffixClass(showBB)}>
                    ({BB_PERIOD},{BB_MULTIPLIER}σ)
                  </span>
                </Button>
                <span className="select-none px-0.5 text-muted-foreground/40" aria-hidden>
                  ·
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  aria-pressed={showRSI}
                  aria-label="RSI"
                  onClick={() => setShowRSI((v) => !v)}
                  className={indicatorToggleButtonClass(showRSI)}
                >
                  RSI <span className={indicatorToggleSuffixClass(showRSI)}>({RSI_PERIOD})</span>
                </Button>
              </div>
              {useStockApi && dataProp === undefined ? (
                <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    aria-pressed={showPatterns}
                    aria-label="Chart patterns on chart"
                    onClick={() => setShowPatterns((v) => !v)}
                    className={cn(
                      indicatorToggleButtonClass(showPatterns),
                      'inline-flex items-center gap-1',
                    )}
                  >
                    <Bot className="h-3.5 w-3.5 opacity-90" aria-hidden />
                    <span>
                      Chart{' '}
                      <span className={indicatorToggleSuffixClass(showPatterns)}>Patterns</span>
                    </span>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    aria-pressed={showAiSr}
                    aria-label="AI Support and Resistance levels on chart"
                    onClick={() => setShowAiSr((v) => !v)}
                    className={cn(
                      indicatorToggleButtonClass(showAiSr),
                      'inline-flex items-center gap-1',
                    )}
                  >
                    <Bot className="h-3.5 w-3.5 opacity-90" aria-hidden />
                    <span>
                      AI{' '}
                      <span className={indicatorToggleSuffixClass(showAiSr)}>
                        Support/Resistance
                      </span>
                    </span>
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
      <div className={cn('relative w-full', variantClasses.chart)}>
        {useStockApi && dataProp === undefined && apiLoading ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-md bg-background/55 text-xs text-muted-foreground backdrop-blur-[1px]">
            Loading chart…
          </div>
        ) : null}
        <div className="h-full w-full" ref={chartContainerRef} />
        <CandlestickStudyLegend
          lastBar={studyLegendProps.lastBar}
          maPoint={studyLegendProps.maPoint}
          bbLast={studyLegendProps.bbLast}
          rsiPoint={studyLegendProps.rsiPoint}
          showMA={showMA}
          showBB={showBB}
          showRSI={showRSI}
          showAiSr={showAiSr && useStockApi && dataProp === undefined}
          aiSupport={apiSrSupport}
          aiResistance={apiSrResistance}
        />
      </div>
    </BaseWidget>
  );
}
