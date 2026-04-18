import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { TextWidget } from '../components/dashboard/text-widget';

const meta: Meta<typeof TextWidget> = {
  title: 'Dashboard/TextWidget',
  component: TextWidget,
  render: (args) => (
    <div className="w-90">
      <TextWidget {...args} />
    </div>
  ),
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof TextWidget>;

export const Default: Story = {
  args: {
    title: 'Market Summary',
    text: 'The portfolio was up 2.1% today with strongest gains in energy and finance.',
  },
};

export const RichText = {
  args: {
    title: 'Daily Briefing',
    text: (
      <>
        <h2>Top Takeaways</h2>
        The market is reacting to macro headlines with fast reversals near resistance.
        <ul>
          <li>
            <strong>Bias:</strong> Neutral-to-bullish above the prior day open.
          </li>
          <li>
            <strong>Risk:</strong> Elevated around US session open.
          </li>
          <li>
            <strong>Plan:</strong> Wait for a pullback before trend continuation.
          </li>
        </ul>
        Read the full report in the <a href="#">strategy panel</a>.
      </>
    ),
  },
};
