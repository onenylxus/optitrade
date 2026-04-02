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

// 4x5 Aspect Ratio (Desktop Dashboard)
export const Large: Story = {
    render: () => (
        <div className="w-[800px] h-[500px]">
            <PortfolioWidget size="large" />
        </div>
    ),
};

// 2x3 Aspect Ratio (Vertical Tablet/Mobile Summary)
export const Medium: Story = {
    render: () => (
        <div className="w-[400px] h-[600px]">
            <PortfolioWidget size="medium" />
        </div>
    ),
};

// 1x1 Aspect Ratio (Square Tile)
export const Small: Story = {
    render: () => (
        <div className="w-[300px] h-[300px]">
            <PortfolioWidget size="small" />
        </div>
    ),
};