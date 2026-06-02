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
  getStockChartSupportResistance,
} from '@/lib/api/client';
import {
  chartIntervalToApi,
  chartTimeframeToApiQuery,
  normalizeSymbolList,
  normalizeTicker,
  stockApiCandlesToChartData,
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
    ],
  );

  const summaryContent = React.useMemo(() => {
    if (!loadAiSummary) {
      return (
        <span className="block whitespace-pre-wrap text-xs leading-relaxed text-primary/90">
          {ruleBasedInsight}
        </span>
      );
    }
    if (apiAiAnalysis) {
      return <CollapsibleStockAnalysis markdown={apiAiAnalysis} modelId={apiAiModel} />;
    }
    if (apiAiLoading) {
      return (
        <div className="space-y-1.5">
          <span className="block whitespace-pre-wrap text-xs leading-relaxed text-primary/90">
            {ruleBasedInsight}
          </span>
          <p className="text-[10px] text-muted-foreground">Generating AI summary…</p>
        </div>
      );
    }
    if (apiAiError) {
      return (
        <div className="space-y-1.5">
          <span className="block whitespace-pre-wrap text-xs leading-relaxed text-primary/90">
            {ruleBasedInsight}
          </span>
          <p className="text-[10px] text-destructive">{apiAiError}</p>
        </div>
      );
    }
    return (
      <span className="block whitespace-pre-wrap text-xs leading-relaxed text-primary/90">
        {ruleBasedInsight}
      </span>
    );
  }, [loadAiSummary, ruleBasedInsight, apiAiAnalysis, apiAiModel, apiAiLoading, apiAiError]);

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
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  aria-pressed={showAiSr}
                  aria-label="AI Support and Resistance levels on chart"
                  onClick={() => setShowAiSr((v) => !v)}
                  className={cn(
                    indicatorToggleButtonClass(showAiSr),
                    'ml-auto inline-flex shrink-0 items-center gap-1',
                  )}
                >
                  <Bot className="h-3.5 w-3.5 opacity-90" aria-hidden />
                  <span>
                    AI{' '}
                    <span className={indicatorToggleSuffixClass(showAiSr)}>Support/Resistance</span>
                  </span>
                </Button>
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
