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
    initialData: [
      {
        id: 1,
        title: "NVIDIA Q4 Earnings Beat Estimates, AI Demand Soars",
        source: "The Economic Times",
        region: "US NYSE",
        sentiment: 0.92,
        sentimentReason: "Revenue up over 200% YoY, Blackwell platform outlook bullish.",
        summary: "NVIDIA reports strong earnings, AI chip demand drives stock surge.",
        bullets: ["Data center revenue +409%", "Multiple firms reiterate Buy", "Price targets raised"],
        risk: { level: "Low", type: "Market Risk" }
      },
      {
        id: 2,
        title: "Tesla Faces New Safety Probe Over 'Full Self-Driving'",
        source: "Reuters",
        region: "US NYSE",
        sentiment: -0.85,
        sentimentReason: "Regulators expand investigation, potential mandatory recalls.",
        summary: "NHTSA launches new probe into Tesla's FSD system, covering 2M vehicles.",
        bullets: ["Multiple accident reports", "Potential software recall", "Stock downgrade risk"],
        risk: { level: "High", type: "Legal Risk" }
      }
    ]
  },
};
