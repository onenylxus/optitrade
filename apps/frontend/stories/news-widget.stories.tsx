import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { NewsWidget } from '@/components/dashboard/news-widget';

const meta: Meta<typeof NewsWidget> = {
  title: 'Dashboard/NewsWidget',
  component: NewsWidget,
  parameters: {
    layout: 'padded',
  },
};

export default meta;
type Story = StoryObj<typeof NewsWidget>;

export const Default: Story = {
  args: {
    title: 'Financial News',
    summary: 'AI-powered sentiment analysis',
    variant: 'medium',
  },
};
