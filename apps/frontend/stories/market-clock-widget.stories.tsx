import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { MarketClockWidget } from '../components/dashboard/market-clock-widget';

const meta: Meta<typeof MarketClockWidget> = {
  title: 'Dashboard/MarketClockWidget',
  component: MarketClockWidget,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof MarketClockWidget>;

export const Default: Story = {
  render: () => (
    <div className="w-80">
      <MarketClockWidget />
    </div>
  ),
};
