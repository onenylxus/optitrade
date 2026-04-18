import type { ComponentProps } from 'react';
import { NumberWidget } from '@/components/dashboard/number-widget';
import { StoryObj } from '@storybook/nextjs-vite';

const meta = {
  title: 'Dashboard/NumberWidget',
  component: NumberWidget,
  render: (args: ComponentProps<typeof NumberWidget>) => (
    <div className="w-90">
      <NumberWidget {...args} />
    </div>
  ),
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof NumberWidget>;

export const Default: Story = {
  args: {
    title: 'Portfolio Value',
    value: 12500.45,
  },
};

export const PositiveChange: Story = {
  args: {
    title: 'Portfolio Value',
    value: 18750.25,
    prev: 17600.1,
  },
};

export const NegativeChange: Story = {
  args: {
    title: 'Portfolio Value',
    value: 9420.7,
    prev: 10010.45,
  },
};

export const PercentChange: Story = {
  args: {
    title: 'Portfolio Value',
    value: 18750.25,
    prev: 17600.1,
    type: 'percent',
  },
};
