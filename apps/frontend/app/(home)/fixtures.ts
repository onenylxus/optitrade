import type { CandlestickData, Time } from 'lightweight-charts';

export type WidgetType =
  | 'number'
  | 'chart'
  | 'table'
  | 'text'
  | 'candlestick'
  | 'portfolio-small'
  | 'portfolio-medium'
  | 'portfolio-large'
  | 'news';

export interface WidgetSpan {
  cols: number;
  rows: number;
}

export interface WidgetPlacement {
  id: string;
  widgetType: WidgetType;
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
}

export const GRID_CELL_WIDTH_REM = 4;
export const GRID_CELL_HEIGHT_REM = 3.5;
export const GRID_GAP_REM = 0.5;
export const DRAWER_WIDGET_MIME = 'application/x-optitrade-widget';
export const SOURCE_WIDGET_MIME = 'application/x-optitrade-source-widget';

export const widgetDefaultSpans: Record<WidgetType, WidgetSpan> = {
  number: { cols: 4, rows: 3 },
  chart: { cols: 5, rows: 5 },
  table: { cols: 5, rows: 5 },
  text: { cols: 5, rows: 5 },
  candlestick: { cols: 8, rows: 7 },
  'portfolio-small': { cols: 5, rows: 5 },
  'portfolio-medium': { cols: 6, rows: 7 },
  'portfolio-large': { cols: 8, rows: 8 },
  news: { cols: 8, rows: 8 },
};

export const widgetLibrary: { id: WidgetType; label: string; sizeLabel: string }[] = [
  { id: 'number', label: 'Number Widget', sizeLabel: '4x3' },
  { id: 'chart', label: 'Chart Widget', sizeLabel: '5x5' },
  { id: 'table', label: 'Table Widget', sizeLabel: '5x5' },
  { id: 'text', label: 'Text Widget', sizeLabel: '5x5' },
  { id: 'candlestick', label: 'Candlestick Widget', sizeLabel: '8x7' },
  { id: 'portfolio-small', label: 'Portfolio Widget (Small)', sizeLabel: '5x5' },
  { id: 'portfolio-medium', label: 'Portfolio Widget (Medium)', sizeLabel: '6x7' },
  { id: 'portfolio-large', label: 'Portfolio Widget (Large)', sizeLabel: '8x8' },
];

export const initialPlacements: WidgetPlacement[] = [
  { id: 'widget-number-1', widgetType: 'number', col: 0, row: 0, colSpan: 4, rowSpan: 3 },
  { id: 'widget-chart-1', widgetType: 'chart', col: 4, row: 0, colSpan: 5, rowSpan: 5 },
  { id: 'widget-text-1', widgetType: 'text', col: 9, row: 0, colSpan: 5, rowSpan: 5 },
  { id: 'widget-table-1', widgetType: 'table', col: 0, row: 5, colSpan: 5, rowSpan: 5 },
  { id: 'widget-candlestick-1', widgetType: 'candlestick', col: 5, row: 5, colSpan: 8, rowSpan: 7 },
  {
    id: 'widget-portfolio-small-1',
    widgetType: 'portfolio-small',
    col: 13,
    row: 5,
    colSpan: 5,
    rowSpan: 5,
  },
  {
    id: 'widget-portfolio-medium-1',
    widgetType: 'portfolio-medium',
    col: 0,
    row: 12,
    colSpan: 6,
    rowSpan: 7,
  },
  {
    id: 'widget-portfolio-large-1',
    widgetType: 'portfolio-large',
    col: 5,
    row: 12,
    colSpan: 8,
    rowSpan: 8,
  },
];

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
