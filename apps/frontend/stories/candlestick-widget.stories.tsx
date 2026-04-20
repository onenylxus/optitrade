import type { ComponentProps } from 'react';
import * as React from 'react';
import { CandlestickWidget } from '@/components/dashboard/candlestick-widget';
import { generateMockCandles } from '@/lib/candlestick-timeframes';
import { cn } from '@/lib/utils';
import { StoryObj } from '@storybook/nextjs-vite';

function storyCanvasClass(variant: ComponentProps<typeof CandlestickWidget>['variant']) {
  switch (variant) {
    case 'large':
      return 'w-full max-w-6xl px-3';
    case 'medium':
      return 'w-full max-w-4xl px-3';
    default:
      return 'w-full max-w-sm px-3 sm:max-w-md';
  }
}

const ohlcData = [
  { time: '2026-03-02', open: 178.1, high: 182.7, low: 176.8, close: 181.5 },
  { time: '2026-03-03', open: 181.5, high: 183.2, low: 179.9, close: 180.4 },
  { time: '2026-03-04', open: 180.4, high: 186.0, low: 179.2, close: 184.6 },
  { time: '2026-03-05', open: 184.6, high: 185.9, low: 181.4, close: 182.1 },
  { time: '2026-03-06', open: 182.1, high: 187.3, low: 181.2, close: 186.4 },
  { time: '2026-03-09', open: 186.4, high: 189.8, low: 184.8, close: 188.7 },
  { time: '2026-03-10', open: 188.7, high: 190.1, low: 185.5, close: 186.3 },
  { time: '2026-03-11', open: 186.3, high: 191.6, low: 185.7, close: 190.8 },
  { time: '2026-03-12', open: 190.8, high: 192.2, low: 188.1, close: 189.5 },
  { time: '2026-03-13', open: 189.5, high: 194.0, low: 188.9, close: 193.6 },
];

const meta = {
  title: 'Dashboard/CandlestickWidget',
  component: CandlestickWidget,
  render: (args: ComponentProps<typeof CandlestickWidget>) => (
    <div className={cn('mx-auto', storyCanvasClass(args.variant))}>
      <CandlestickWidget {...args} />
    </div>
  ),
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'medium', 'large'],
      description: 'Card width + chart height preset',
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof CandlestickWidget>;

/** Demo data is generated from timeframe + interval when `data` is omitted. */
export const Default: Story = {
  args: {
    title: 'AAPL Candlesticks',
    defaultTimeframe: '1M',
    defaultInterval: '1d',
    variant: 'default',
  },
};

/** The header summary is generated from the current series and indicators. */
export const WithAiInsight: Story = {
  args: {
    title: 'AAPL Candlesticks',
    defaultTimeframe: '1M',
    defaultInterval: '1d',
    variant: 'medium',
  },
};

export const BordersAndPriceLine: Story = {
  args: {
    title: 'Candlestick Detail',
    defaultTimeframe: '5D',
    defaultInterval: '1h',
    borderVisible: true,
    priceLineVisible: true,
    variant: 'large',
  },
};

/** Fixed daily series; toolbar hidden (wire `onTimeframeChange` + fresh `data` to enable controls). */
export const StaticData: Story = {
  args: {
    title: 'Static OHLC',
    data: ohlcData,
    showControls: false,
    showIndicatorToggles: true,
    variant: 'default',
  },
};

/** Wider card; chart height matches default (14rem). */
export const VariantMedium: Story = {
  args: {
    title: 'Medium layout',
    variant: 'medium',
    defaultTimeframe: '3M',
    defaultInterval: '1d',
    showIndicatorToggles: true,
  },
};

/** Taller chart + wider card. */
export const VariantLarge: Story = {
  args: {
    title: 'Large layout',
    variant: 'large',
    defaultTimeframe: '6M',
    defaultInterval: '1d',
    borderVisible: true,
  },
};

function ControlledDemo(args: ComponentProps<typeof CandlestickWidget>) {
  const [tf, setTf] = React.useState(args.defaultTimeframe ?? '3M');
  const [iv, setIv] = React.useState(args.defaultInterval ?? '1d');
  const data = React.useMemo(() => generateMockCandles(tf, iv), [tf, iv]);
  return (
    <div className={cn('mx-auto', storyCanvasClass(args.variant))}>
      <CandlestickWidget
        {...args}
        data={data}
        timeframe={tf}
        interval={iv}
        onTimeframeChange={setTf}
        onIntervalChange={setIv}
      />
    </div>
  );
}

/** Same UX as Default, but data is produced in the story (typical API shape). */
export const ControlledFromParent: Story = {
  render: (args) => <ControlledDemo {...args} />,
  args: {
    title: 'Controlled (parent-owned data)',
    defaultTimeframe: '3M',
    defaultInterval: '1d',
    variant: 'large',
  },
};
