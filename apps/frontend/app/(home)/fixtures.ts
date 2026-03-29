import type { CandlestickData, Time } from 'lightweight-charts';

export type WidgetType = 'number' | 'chart' | 'table' | 'text' | 'candlestick';

export const GRID_COLUMNS = 4;
export const GRID_ROWS = 14;
export const GRID_TOTAL_CELLS = GRID_COLUMNS * GRID_ROWS;
export const DRAWER_WIDGET_MIME = 'application/x-optitrade-widget';
export const SOURCE_CELL_MIME = 'application/x-optitrade-source-cell';

export const widgetLibrary: { id: WidgetType; label: string }[] = [
  { id: 'number', label: 'Number Widget' },
  { id: 'chart', label: 'Chart Widget' },
  { id: 'table', label: 'Table Widget' },
  { id: 'text', label: 'Text Widget' },
  { id: 'candlestick', label: 'Candlestick Widget' },
];

export const initialPlacements: Partial<Record<number, WidgetType>> = {
  0: 'number',
  1: 'chart',
  2: 'table',
  4: 'candlestick',
  5: 'text',
};

export const lineData = [
  { label: 'Mon', pnl: 3400 },
  { label: 'Tue', pnl: 2980 },
  { label: 'Wed', pnl: 4200 },
  { label: 'Thu', pnl: 3890 },
  { label: 'Fri', pnl: 5120 },
];

export const lineConfig = {
  pnl: {
    label: 'PnL',
    color: 'var(--chart-1)',
  },
};

export const candleData: CandlestickData<Time>[] = [
  { time: '2026-03-20' as Time, open: 102, high: 108, low: 98, close: 106 },
  { time: '2026-03-21' as Time, open: 106, high: 110, low: 103, close: 104 },
  { time: '2026-03-22' as Time, open: 104, high: 112, low: 101, close: 109 },
  { time: '2026-03-23' as Time, open: 109, high: 116, low: 107, close: 114 },
  { time: '2026-03-24' as Time, open: 114, high: 117, low: 111, close: 112 },
];

export const chatMessages = [
  { id: 1, role: 'assistant', text: 'Morning. Your risk is low and cash balance is healthy.' },
  { id: 2, role: 'user', text: 'Show me the strongest movers for today.' },
  {
    id: 3,
    role: 'assistant',
    text: 'Top movers: NVDA +3.2%, AMD +2.8%, META +2.1%. Want them pinned as widgets?',
  },
  { id: 4, role: 'user', text: 'Yes, and suggest one hedge idea too.' },
  {
    id: 5,
    role: 'assistant',
    text: 'Consider a short-dated QQQ put spread to cap downside while keeping upside room.',
  },
] as const;
