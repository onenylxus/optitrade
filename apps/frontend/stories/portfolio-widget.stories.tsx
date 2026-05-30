import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { PortfolioWidget } from '../components/dashboard/portfolio-widget';

const meta: Meta<typeof PortfolioWidget> = {
  title: 'Dashboard/PortfolioWidget',
  component: PortfolioWidget,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof PortfolioWidget>;

export const Full: Story = {
  render: () => (
    <div className="h-[52rem] w-[72rem]">
      <PortfolioWidget title="Portfolio Full" variant="full" />
    </div>
  ),
};

export const PnlTile: Story = {
  render: () => (
    <div className="h-64 w-64">
      <PortfolioWidget title="Portfolio P/L Tile" variant="pl-tile" />
    </div>
  ),
};

export const TopMoverTile: Story = {
  render: () => (
    <div className="h-64 w-64">
      <PortfolioWidget title="Top Mover Tile" variant="top-mover-tile" />
    </div>
  ),
};
