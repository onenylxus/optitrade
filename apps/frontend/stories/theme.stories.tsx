import { Typography } from '@/components/ui/typography';
import { cn } from '@/lib/utils';
import { StoryObj } from '@storybook/nextjs-vite';

const palette = [
  {
    name: 'Background',
    className: 'bg-background',
    lightValue: 'oklch(1 0 0)',
    darkValue: 'oklch(0.145 0 0)',
  },
  {
    name: 'Foreground',
    className: 'bg-foreground',
    lightValue: 'oklch(0.145 0 0)',
    darkValue: 'oklch(0.985 0 0)',
  },
  {
    name: 'Card',
    className: 'bg-card',
    lightValue: 'oklch(1 0 0)',
    darkValue: 'oklch(0.205 0 0)',
  },
  {
    name: 'Card Foreground',
    className: 'bg-card-foreground',
    lightValue: 'oklch(0.145 0 0)',
    darkValue: 'oklch(0.985 0 0)',
  },
  {
    name: 'Popover',
    className: 'bg-popover',
    lightValue: 'oklch(1 0 0)',
    darkValue: 'oklch(0.205 0 0)',
  },
  {
    name: 'Popover Foreground',
    className: 'bg-popover-foreground',
    lightValue: 'oklch(0.145 0 0)',
    darkValue: 'oklch(0.985 0 0)',
  },
  {
    name: 'Primary',
    className: 'bg-primary',
    lightValue: 'oklch(0.457 0.24 277.023)',
    darkValue: 'oklch(0.398 0.195 277.366)',
  },
  {
    name: 'Primary Foreground',
    className: 'bg-primary-foreground',
    lightValue: 'oklch(0.962 0.018 272.314)',
    darkValue: 'oklch(0.962 0.018 272.314)',
  },
  {
    name: 'Secondary',
    className: 'bg-secondary',
    lightValue: 'oklch(0.967 0.001 286.375)',
    darkValue: 'oklch(0.274 0.006 286.033)',
  },
  {
    name: 'Secondary Foreground',
    className: 'bg-secondary-foreground',
    lightValue: 'oklch(0.21 0.006 285.885)',
    darkValue: 'oklch(0.985 0 0)',
  },
  {
    name: 'Muted',
    className: 'bg-muted',
    lightValue: 'oklch(0.97 0 0)',
    darkValue: 'oklch(0.269 0 0)',
  },
  {
    name: 'Muted Foreground',
    className: 'bg-muted-foreground',
    lightValue: 'oklch(0.556 0 0)',
    darkValue: 'oklch(0.708 0 0)',
  },
  {
    name: 'Accent',
    className: 'bg-accent',
    lightValue: 'oklch(0.97 0 0)',
    darkValue: 'oklch(0.269 0 0)',
  },
  {
    name: 'Accent Foreground',
    className: 'bg-accent-foreground',
    lightValue: 'oklch(0.205 0 0)',
    darkValue: 'oklch(0.985 0 0)',
  },
  {
    name: 'Destructive',
    className: 'bg-destructive',
    lightValue: 'oklch(0.577 0.245 27.325)',
    darkValue: 'oklch(0.704 0.191 22.216)',
  },
  {
    name: 'Border',
    className: 'bg-border',
    lightValue: 'oklch(0.922 0 0)',
    darkValue: 'oklch(1 0 0 / 10%)',
  },
  {
    name: 'Input',
    className: 'bg-input',
    lightValue: 'oklch(0.922 0 0)',
    darkValue: 'oklch(1 0 0 / 15%)',
  },
  {
    name: 'Ring',
    className: 'bg-ring',
    lightValue: 'oklch(0.708 0 0)',
    darkValue: 'oklch(0.556 0 0)',
  },
  {
    name: 'Indicator Positive',
    className: 'bg-indicator-positive',
    lightValue: 'oklch(0.723 0.219 149.579)',
    darkValue: 'oklch(0.723 0.219 149.579)',
  },
  {
    name: 'Indicator Negative',
    className: 'bg-indicator-negative',
    lightValue: 'oklch(0.637 0.237 25.331)',
    darkValue: 'oklch(0.637 0.237 25.331)',
  },
  {
    name: 'Chart 1',
    className: 'bg-chart-1',
    lightValue: 'oklch(0.785 0.115 274.713)',
    darkValue: 'oklch(0.785 0.115 274.713)',
  },
  {
    name: 'Chart 2',
    className: 'bg-chart-2',
    lightValue: 'oklch(0.585 0.233 277.117)',
    darkValue: 'oklch(0.585 0.233 277.117)',
  },
  {
    name: 'Chart 3',
    className: 'bg-chart-3',
    lightValue: 'oklch(0.511 0.262 276.966)',
    darkValue: 'oklch(0.511 0.262 276.966)',
  },
  {
    name: 'Chart 4',
    className: 'bg-chart-4',
    lightValue: 'oklch(0.457 0.24 277.023)',
    darkValue: 'oklch(0.457 0.24 277.023)',
  },
  {
    name: 'Chart 5',
    className: 'bg-chart-5',
    lightValue: 'oklch(0.398 0.195 277.366)',
    darkValue: 'oklch(0.398 0.195 277.366)',
  },
  {
    name: 'Sidebar',
    className: 'bg-sidebar border-sidebar-border',
    lightValue: 'oklch(0.985 0 0)',
    darkValue: 'oklch(0.205 0 0)',
  },
  {
    name: 'Sidebar Foreground',
    className: 'bg-sidebar-foreground',
    lightValue: 'oklch(0.145 0 0)',
    darkValue: 'oklch(0.985 0 0)',
  },
  {
    name: 'Sidebar Primary',
    className: 'bg-sidebar-primary',
    lightValue: 'oklch(0.511 0.262 276.966)',
    darkValue: 'oklch(0.585 0.233 277.117)',
  },
  {
    name: 'Sidebar Primary Foreground',
    className: 'bg-sidebar-primary-foreground',
    lightValue: 'oklch(0.962 0.018 272.314)',
    darkValue: 'oklch(0.962 0.018 272.314)',
  },
  {
    name: 'Sidebar Accent',
    className: 'bg-sidebar-accent',
    lightValue: 'oklch(0.97 0 0)',
    darkValue: 'oklch(0.269 0 0)',
  },
  {
    name: 'Sidebar Accent Foreground',
    className: 'bg-sidebar-accent-foreground',
    lightValue: 'oklch(0.205 0 0)',
    darkValue: 'oklch(0.985 0 0)',
  },
  {
    name: 'Sidebar Border',
    className: 'bg-sidebar-border',
    lightValue: 'oklch(0.922 0 0)',
    darkValue: 'oklch(1 0 0 / 10%)',
  },
  {
    name: 'Sidebar Ring',
    className: 'bg-sidebar-ring',
    lightValue: 'oklch(0.708 0 0)',
    darkValue: 'oklch(0.556 0 0)',
  },
];

const radiusScale = [
  {
    name: 'radius-sm',
    className: 'rounded-tl-sm',
    value: '0.375rem',
  },
  {
    name: 'radius-md',
    className: 'rounded-tl-md',
    value: '0.5rem',
  },
  {
    name: 'radius-lg',
    className: 'rounded-tl-lg',
    value: '0.625rem',
  },
  {
    name: 'radius-xl',
    className: 'rounded-tl-xl',
    value: '0.875rem',
  },
  {
    name: 'radius-2xl',
    className: 'rounded-tl-2xl',
    value: '1.125rem',
  },
  {
    name: 'radius-3xl',
    className: 'rounded-tl-3xl',
    value: '1.375rem',
  },
  {
    name: 'radius-4xl',
    className: 'rounded-tl-4xl',
    value: '1.625rem',
  },
  {
    name: 'radius',
    className: 'rounded-tl-lg',
    value: '0.625rem',
  },
];

const renderPaletteRows = (mode: 'light' | 'dark') =>
  palette.map((color) => (
    <div
      key={`${color.name}-${mode}`}
      className={cn(
        'flex items-center gap-4 rounded-xl border border-border p-3 bg-background',
        mode === 'dark' && 'dark',
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-col">
          <Typography variant="small" className="font-semibold text-foreground">
            {color.name}
          </Typography>
          <Typography variant="small" className="mt-1 break-all text-muted-foreground">
            {mode === 'light' ? color.lightValue : color.darkValue}
          </Typography>
        </div>
      </div>

      <div
        className={cn(mode === 'dark' && 'dark', 'h-16 w-24 shrink-0 rounded-lg', color.className)}
      />
    </div>
  ));

const meta = {
  title: 'Foundations/Theme',
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => (
    <main className="min-h-screen bg-background text-foreground p-6 md:p-10">
      <div className="mx-auto max-w-6xl space-y-10">
        <section className="rounded-2xl border border-border bg-card p-6 md:p-8 shadow-sm">
          <Typography variant="h4" className="text-primary">
            Typography
          </Typography>

          <div className="mt-6 space-y-6">
            <div className="space-y-2">
              <Typography variant="muted">h1</Typography>
              <Typography variant="h1" className="text-left">
                Design clear market insight.
              </Typography>
            </div>

            <div className="space-y-2">
              <Typography variant="muted">h2</Typography>
              <Typography variant="h2" className="border-b-0 pb-0">
                Portfolio Overview
              </Typography>
            </div>

            <div className="space-y-2">
              <Typography variant="muted">h3</Typography>
              <Typography variant="h3">Open Positions</Typography>
            </div>

            <div className="space-y-2">
              <Typography variant="muted">h4</Typography>
              <Typography variant="h4">Signals and Alerts</Typography>
            </div>

            <div className="space-y-2">
              <Typography variant="muted">lead</Typography>
              <Typography variant="lead">
                This dashboard highlights current portfolio performance and risk context.
              </Typography>
            </div>

            <div className="space-y-2">
              <Typography variant="muted">p</Typography>
              <Typography variant="p" className="not-first:mt-0">
                Use concise language for financial context and action prompts.
              </Typography>
            </div>

            <div className="space-y-2">
              <Typography variant="muted">large</Typography>
              <Typography variant="large">$24,891.55</Typography>
            </div>

            <div className="space-y-2">
              <Typography variant="muted">small</Typography>
              <Typography variant="small">Updated 2 minutes ago</Typography>
            </div>

            <div className="space-y-2">
              <Typography variant="muted">muted</Typography>
              <Typography variant="muted">
                Muted text supports details without competing with key signals.
              </Typography>
            </div>

            <div className="space-y-2">
              <Typography variant="muted">inlineCode</Typography>
              <div>
                <Typography variant="inlineCode">AAPL 182.45 +1.86%</Typography>
              </div>
            </div>

            <div className="space-y-2">
              <Typography variant="muted">blockquote</Typography>
              <Typography variant="blockquote" className="mt-0">
                Risk management is a feature, not a reaction.
              </Typography>
            </div>

            <div className="space-y-2">
              <Typography variant="muted">list</Typography>
              <Typography variant="list" className="my-0">
                <li>Track position size before entry.</li>
                <li>Define exit levels and review them daily.</li>
                <li>Evaluate winners and losers with the same rigor.</li>
              </Typography>
            </div>

            <div className="space-y-2">
              <Typography variant="muted">table</Typography>
              <div className="my-0 overflow-x-auto rounded-md border border-border">
                <table className="w-full text-sm">
                  <thead className="border-b border-border">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Ticker</th>
                      <th className="px-3 py-2 text-left font-medium">Price</th>
                      <th className="px-3 py-2 text-left font-medium">Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-border">
                      <td className="px-3 py-2">AAPL</td>
                      <td className="px-3 py-2">182.45</td>
                      <td className="px-3 py-2 text-indicator-positive">+1.86%</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2">MSFT</td>
                      <td className="px-3 py-2">412.11</td>
                      <td className="px-3 py-2 text-indicator-negative">-0.42%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6 md:p-8 shadow-sm">
          <Typography variant="h4" className="text-primary">
            Palette (Light)
          </Typography>

          <div className="mt-6 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {renderPaletteRows('light')}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6 md:p-8 shadow-sm">
          <Typography variant="h4" className="text-primary">
            Palette (Dark)
          </Typography>

          <div className="mt-6 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {renderPaletteRows('dark')}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6 md:p-8 shadow-sm">
          <Typography variant="h4" className="text-primary">
            Radius
          </Typography>

          <div className="mt-6 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {radiusScale.map((radius) => (
              <div
                key={radius.name}
                className="flex items-center justify-between gap-4 rounded-xl border border-border bg-background p-3"
              >
                <div className="flex flex-col">
                  <Typography variant="small" className="font-semibold text-foreground">
                    {radius.name}
                  </Typography>
                  <Typography variant="small" className="mt-1 break-all text-muted-foreground">
                    {radius.value}
                  </Typography>
                </div>

                <div
                  className={cn(
                    'relative h-16 w-16 overflow-hidden border-l border-t border-primary bg-muted',
                    radius.className,
                  )}
                />
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  ),
};
