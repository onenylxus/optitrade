import type { ComponentProps } from 'react';
import { EarningsWidget } from '@/components/dashboard/earnings-widget';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta: Meta<ComponentProps<typeof EarningsWidget>> = {
  title: 'Dashboard/EarningsWidget',
  component: EarningsWidget,
  render: (args) => (
    <div className="w-[640px] h-[420px]">
      <EarningsWidget {...args} />
    </div>
  ),
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  args: { title: 'Earnings Calendar', summary: 'Upcoming earnings & results' },
};

export const PortfolioOnly: Story = {
  args: { title: 'Earnings Calendar', summary: 'Portfolio holdings only' },
};