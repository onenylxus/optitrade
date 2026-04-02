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
        <div className="w-[800px] h-[500px]">
            <PortfolioWidget size="large" />
        </div>
    ),
};

export const Small: Story = {
    render: () => (
        <div className="w-[250px] h-[250px]">
            <PortfolioWidget size="small" />
        </div>
    ),
};