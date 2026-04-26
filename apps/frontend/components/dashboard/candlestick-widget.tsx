'use client';

import type { CandlestickData, IChartApi, ISeriesApi, LineData, Time } from 'lightweight-charts';
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
  computeBollingerSeries,
  computeMASeries,
  computeRSISeries,
} from '@/lib/technical-indicators';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { BaseWidget } from './base-widget';

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
}: {
  lastBar: CandlestickData<Time> | undefined;
  maPoint: LineData<Time> | undefined;
  bbLast: { upper: number; middle: number; lower: number } | undefined;
  rsiPoint: LineData<Time> | undefined;
  showMA: boolean;
  showBB: boolean;
  showRSI: boolean;
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
};

const emptySeriesRefs = (): SeriesRefs => ({
  chart: null,
  candle: null,
  ma: null,
  bbUpper: null,
  bbMiddle: null,
  bbLower: null,
  rsi: null,
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
  className,
  ...props
}: CandlestickWidgetProps) {
  const chartContainerRef = React.useRef<HTMLDivElement | null>(null);
  const seriesRefs = React.useRef<SeriesRefs>(emptySeriesRefs());

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

  const timeframe = timeframeProp ?? internalTf;
  const interval = intervalProp ?? internalIv;

  const useGeneratedData = dataProp === undefined;
  const showControls =
    showControlsProp ??
    (useGeneratedData || onTimeframeChange !== undefined || onIntervalChange !== undefined);

  const resolvedData = React.useMemo(() => {
    if (dataProp !== undefined) {
      return dataProp;
    }
    return generateMockCandles(timeframe, interval);
  }, [dataProp, timeframe, interval]);

  const indicatorLines = React.useMemo(
    () => ({
      ma: computeMASeries(resolvedData, MA_PERIOD),
      bb: computeBollingerSeries(resolvedData, BB_PERIOD, BB_MULTIPLIER),
      rsi: computeRSISeries(resolvedData, RSI_PERIOD),
    }),
    [resolvedData],
  );

  const allowedIntervals = React.useMemo(
    () => allowedIntervalsForTimeframe(timeframe),
    [timeframe],
  );

  React.useEffect(() => {
    const allowed = allowedIntervalsForTimeframe(timeframe);
    if (intervalProp !== undefined) {
      const fallback = allowed[0];
      if (fallback && !allowed.includes(intervalProp)) {
        onIntervalChange?.(fallback);
      }
      return;
    }
    setInternalIv((iv) => {
      if (allowed.includes(iv)) {
        return iv;
      }
      return allowed[0] ?? iv;
    });
  }, [timeframe, intervalProp, onIntervalChange]);

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

  const aiInsightText = React.useMemo(
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

  const showToolbar = showControls || showIndicatorToggles;
  const variantClasses = candlestickVariantClassNames(variant);

  return (
    <BaseWidget {...props} summary={aiInsightText} className={cn(variantClasses.root, className)}>
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
                'flex flex-wrap items-baseline gap-x-0.5 gap-y-1',
                showControls && 'border-t border-border pt-2',
              )}
            >
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
          ) : null}
        </div>
      ) : null}
      <div className={cn('relative w-full', variantClasses.chart)}>
        <div className="h-full w-full" ref={chartContainerRef} />
        <CandlestickStudyLegend
          lastBar={studyLegendProps.lastBar}
          maPoint={studyLegendProps.maPoint}
          bbLast={studyLegendProps.bbLast}
          rsiPoint={studyLegendProps.rsiPoint}
          showMA={showMA}
          showBB={showBB}
          showRSI={showRSI}
        />
      </div>
    </BaseWidget>
  );
}
