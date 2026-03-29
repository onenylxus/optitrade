import type { ComponentProps } from 'react';
import { ChartWidget } from '@/components/dashboard/chart-widget';
import { StoryObj } from '@storybook/nextjs-vite';

const monthlyPerformance = [
  { month: 'Jan', pnl: 3200 },
  { month: 'Feb', pnl: 4100 },
  { month: 'Mar', pnl: 3600 },
  { month: 'Apr', pnl: 5200 },
  { month: 'May', pnl: 4700 },
  { month: 'Jun', pnl: 5900 },
];

const comparisonData = [
  { month: 'Jan', portfolio: 3200, benchmark: 2900 },
  { month: 'Feb', portfolio: 4100, benchmark: 3500 },
  { month: 'Mar', portfolio: 3600, benchmark: 3800 },
  { month: 'Apr', portfolio: 5200, benchmark: 4200 },
  { month: 'May', portfolio: 4700, benchmark: 4500 },
  { month: 'Jun', portfolio: 5900, benchmark: 5100 },
];

const allocationData = [
  { asset: 'stocks', value: 56 },
  { asset: 'etfs', value: 24 },
  { asset: 'cash', value: 14 },
  { asset: 'crypto', value: 6 },
];

const meta = {
  title: 'Dashboard/ChartWidget',
  component: ChartWidget,
  render: (args: ComponentProps<typeof ChartWidget>) => (
    <div className="w-120">
      <ChartWidget {...args} />
    </div>
  ),
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ChartWidget>;

export const BarChart: Story = {
  args: {
    title: 'Monthly P&L',
    description: 'Realized performance over the last 6 months',
    chartType: 'bar',
    xKey: 'month',
    valueKey: 'pnl',
    data: monthlyPerformance,
    config: {
      pnl: {
        label: 'P&L',
        color: '#6366f1',
      },
    },
  },
};

export const BarChartMulti: Story = {
  args: {
    title: 'Portfolio vs Benchmark',
    description: 'Monthly P&L comparison',
    chartType: 'bar',
    xKey: 'month',
    valueKeys: ['portfolio', 'benchmark'],
    data: comparisonData,
    config: {
      portfolio: {
        label: 'Portfolio',
        color: '#6366f1',
      },
      benchmark: {
        label: 'Benchmark',
        color: '#f59e0b',
      },
    },
  },
};

export const LineChart: Story = {
  args: {
    title: 'Equity Curve',
    description: 'Portfolio progression trend',
    chartType: 'line',
    xKey: 'month',
    valueKey: 'pnl',
    data: monthlyPerformance,
    config: {
      pnl: {
        label: 'Equity',
        color: '#22c55e',
      },
    },
  },
};

export const LineChartMulti: Story = {
  args: {
    title: 'Portfolio vs Benchmark',
    description: 'Equity curve comparison',
    chartType: 'line',
    xKey: 'month',
    valueKeys: ['portfolio', 'benchmark'],
    data: comparisonData,
    config: {
      portfolio: {
        label: 'Portfolio',
        color: '#6366f1',
      },
      benchmark: {
        label: 'Benchmark',
        color: '#f59e0b',
      },
    },
  },
};

export const PieChart: Story = {
  args: {
    title: 'Asset Allocation',
    description: 'Portfolio distribution by asset class',
    chartType: 'pie',
    xKey: 'asset',
    categoryKey: 'asset',
    valueKey: 'value',
    data: allocationData,
    config: {
      stocks: {
        label: 'Stocks',
        color: '#6366f1',
      },
      etfs: {
        label: 'ETFs',
        color: '#22c55e',
      },
      cash: {
        label: 'Cash',
        color: '#f59e0b',
      },
      crypto: {
        label: 'Crypto',
        color: '#ef4444',
      },
      value: {
        label: 'Allocation',
      },
    },
  },
};

export const AreaChart: Story = {
  args: {
    title: 'Equity Curve',
    description: 'Portfolio performance with filled area',
    chartType: 'area',
    xKey: 'month',
    valueKey: 'pnl',
    data: monthlyPerformance,
    config: {
      pnl: {
        label: 'Equity',
        color: '#22c55e',
      },
    },
  },
};

export const AreaChartMulti: Story = {
  args: {
    title: 'Portfolio vs Benchmark',
    description: 'Equity curve comparison with filled area',
    chartType: 'area',
    xKey: 'month',
    valueKeys: ['portfolio', 'benchmark'],
    data: comparisonData,
    config: {
      portfolio: {
        label: 'Portfolio',
        color: '#6366f1',
      },
      benchmark: {
        label: 'Benchmark',
        color: '#f59e0b',
      },
    },
  },
};
