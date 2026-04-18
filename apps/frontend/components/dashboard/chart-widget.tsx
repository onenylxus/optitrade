'use client';

import type { ComponentProps } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
} from 'recharts';
import {
  ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { BaseWidget } from './base-widget';

type ChartWidgetType = 'bar' | 'line' | 'area' | 'pie';

type ChartDatum = Record<string, string | number>;

interface ChartWidgetProps extends Omit<ComponentProps<typeof BaseWidget>, 'children'> {
  chartType: ChartWidgetType;
  config: ChartConfig;
  data: ChartDatum[];
  valueKey?: string;
  valueKeys?: string[];
  xKey?: string;
  categoryKey?: string;
  showLegend?: boolean;
}

export function ChartWidget({
  chartType,
  config,
  data,
  valueKey,
  valueKeys,
  xKey = 'label',
  categoryKey,
  showLegend,
  ...props
}: ChartWidgetProps) {
  const seriesKeys = valueKeys ?? (valueKey ? [valueKey] : []);
  const pieCategoryKey = categoryKey ?? xKey;
  const resolvedShowLegend = showLegend ?? (chartType === 'pie' || seriesKeys.length > 1);

  return (
    <BaseWidget {...props}>
      <ChartContainer config={config} className="h-56 w-full aspect-auto">
        {chartType === 'bar' ? (
          <BarChart data={data}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey={xKey} tickLine={false} axisLine={false} tickMargin={8} />
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
            {seriesKeys.map((key) => (
              <Bar key={key} dataKey={key} fill={`var(--color-${key})`} radius={6} />
            ))}
            {resolvedShowLegend && <ChartLegend content={<ChartLegendContent />} />}
          </BarChart>
        ) : chartType === 'line' ? (
          <LineChart data={data}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey={xKey} tickLine={false} axisLine={false} tickMargin={8} />
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
            {seriesKeys.map((key) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={`var(--color-${key})`}
                strokeWidth={2}
                dot={false}
              />
            ))}
            {resolvedShowLegend && <ChartLegend content={<ChartLegendContent />} />}
          </LineChart>
        ) : chartType === 'area' ? (
          <AreaChart data={data}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey={xKey} tickLine={false} axisLine={false} tickMargin={8} />
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
            {seriesKeys.map((key) => (
              <Area
                key={key}
                type="monotone"
                dataKey={key}
                stroke={`var(--color-${key})`}
                fill={`var(--color-${key})`}
                fillOpacity={0.2}
                strokeWidth={2}
                dot={false}
              />
            ))}
            {resolvedShowLegend && <ChartLegend content={<ChartLegendContent />} />}
          </AreaChart>
        ) : (
          <PieChart>
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent nameKey={pieCategoryKey} />}
            />
            <Pie
              data={data}
              dataKey={valueKey ?? ''}
              nameKey={pieCategoryKey}
              innerRadius={50}
              outerRadius={85}
              paddingAngle={2}
            >
              {data.map((entry, index) => {
                const segmentKey = String(entry[pieCategoryKey] ?? valueKey);

                return (
                  <Cell key={`slice-${segmentKey}-${index}`} fill={`var(--color-${segmentKey})`} />
                );
              })}
            </Pie>
            {resolvedShowLegend && (
              <ChartLegend content={<ChartLegendContent nameKey={pieCategoryKey} />} />
            )}
          </PieChart>
        )}
      </ChartContainer>
    </BaseWidget>
  );
}
