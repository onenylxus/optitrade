import type { ComponentProps } from 'react';
import { TableWidget } from '@/components/dashboard/table-widget';
import { StoryObj } from '@storybook/nextjs-vite';

const meta = {
  title: 'Dashboard/TableWidget',
  component: TableWidget,
  render: (args: ComponentProps<typeof TableWidget>) => (
    <div className="w-120">
      <TableWidget {...args} />
    </div>
  ),
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof TableWidget>;

export const Default: Story = {
  args: {
    title: 'Holdings',
    headers: ['Symbol', 'Shares', 'Price', 'Value'],
    rows: [
      ['AAPL', '10', '$178.20', '$1,782.00'],
      ['MSFT', '5', '$415.50', '$2,077.50'],
      ['GOOGL', '2', '$172.80', '$345.60'],
      ['AMZN', '8', '$194.30', '$1,554.40'],
    ],
  },
};

export const Empty: Story = {
  args: {
    title: 'Watchlist',
    headers: ['Symbol', 'Last Price', 'Change'],
    rows: [],
  },
};

export const AiWidget: Story = {
  args: {
    title: 'AI Signals',
    headers: ['Symbol', 'Signal', 'Confidence', 'Target'],
    rows: [
      ['TSLA', 'BUY', '87%', '$280.00'],
      ['NVDA', 'HOLD', '72%', '$950.00'],
      ['META', 'SELL', '65%', '$490.00'],
    ],
  },
};
