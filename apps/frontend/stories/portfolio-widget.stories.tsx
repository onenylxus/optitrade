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

export const Large: Story = {
  render: () => (
    <div className="h-120 w-150">
      <PortfolioWidget
        title="Portfolio Snapshot"
        description="Live holdings and allocation"
        variant="large"
      />
    </div>
  ),
};

export const Medium: Story = {
  render: () => (
    <div className="h-105 w-130">
      <PortfolioWidget
        title="Portfolio Snapshot"
        description="Live holdings and allocation"
        variant="medium"
      />
    </div>
  ),
};

export const Small: Story = {
  render: () => (
    <div className="h-80 w-80">
      <PortfolioWidget
        title="Portfolio Snapshot"
        description="Live holdings and allocation"
        variant="small"
      />
    </div>
  ),
};
