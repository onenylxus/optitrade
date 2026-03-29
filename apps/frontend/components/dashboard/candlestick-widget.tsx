'use client';

import type { CandlestickData, Time } from 'lightweight-charts';
import { CandlestickSeries, ColorType, createChart } from 'lightweight-charts';
import { useEffect, useRef, type ComponentProps } from 'react';
import { BaseWidget } from './base-widget';

export interface CandlestickWidgetProps extends ComponentProps<typeof BaseWidget> {
  data: CandlestickData<Time>[];
  borderVisible?: boolean;
  priceLineVisible?: boolean;
  timeVisible?: boolean;
}

export function CandlestickWidget({
  data,
  borderVisible = false,
  priceLineVisible = false,
  timeVisible = true,
  ...props
}: CandlestickWidgetProps) {
  const chartContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) {
      return;
    }

    const chart = createChart(container, {
      autoSize: true,
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

    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
      borderVisible,
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      priceLineVisible,
    });

    series.setData(data);
    chart.timeScale().fitContent();

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
    };
  }, [data, borderVisible, priceLineVisible, timeVisible]);

  return (
    <BaseWidget {...props}>
      <div className="h-56 w-full" ref={chartContainerRef} />
    </BaseWidget>
  );
}
