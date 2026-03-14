import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { BaseWidget } from '../components/dashboard/base-widget';

const meta: Meta<typeof BaseWidget> = {
  title: 'Dashboard/BaseWidget',
  component: BaseWidget,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof BaseWidget>;

export const Default: Story = {
  render: (args) => (
    <div className="w-90">
      <BaseWidget {...args}>
        <div className="min-h-30 pt-1">This is the widget content.</div>
      </BaseWidget>
    </div>
  ),
  args: {
    title: 'Widget Title',
    description: 'A short description of the widget.',
    isAiWidget: false,
  },
};

export const AiWidget: Story = {
  render: (args) => (
    <div className="w-90">
      <BaseWidget {...args}>
        <div className="min-h-30 pt-1">
          This widget has AI capabilities - check the sparkles icon.
        </div>
      </BaseWidget>
    </div>
  ),
  args: {
    title: 'AI Insight',
    description: 'An AI-powered widget providing insights.',
    isAiWidget: true,
  },
};
