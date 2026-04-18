import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { BaseWidget } from '../components/dashboard/base-widget';
import { WidgetProvider } from '../contexts/widget-context';

const meta: Meta<typeof BaseWidget> = {
  title: 'Dashboard/BaseWidget',
  component: BaseWidget,
  parameters: {
    layout: 'centered',
  },
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
  },
};

export const InEditMode: Story = {
  render: (args) => (
    <div className="w-90">
      <WidgetProvider isEditMode onDelete={() => {}}>
        <BaseWidget {...args}>
          <div className="min-h-30 pt-1">
            Delete appears in the footer when edit mode context is enabled.
          </div>
        </BaseWidget>
      </WidgetProvider>
    </div>
  ),
  args: {
    title: 'Editing Widget',
  },
};
