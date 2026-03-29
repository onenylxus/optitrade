import type { ComponentProps } from 'react';
import { CandlestickWidget } from '@/components/dashboard/candlestick-widget';
import { StoryObj } from '@storybook/nextjs-vite';

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
    <div className="w-120">
      <CandlestickWidget {...args} />
    </div>
  ),
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof CandlestickWidget>;

export const Default: Story = {
  args: {
    title: 'AAPL Candlesticks',
    description: 'Daily OHLC movement for the last two weeks',
    data: ohlcData,
  },
};

export const BordersAndPriceLine: Story = {
  args: {
    title: 'Candlestick Detail',
    description: 'Candles with borders and live price line enabled',
    data: ohlcData,
    borderVisible: true,
    priceLineVisible: true,
  },
};
