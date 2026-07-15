// import type { CandlestickData, Time } from 'lightweight-charts';

export type WidgetType =
  | 'number'
  | 'chart'
  | 'table'
  | 'text'
  | 'candlestick'
  | 'portfolio-small'
  | 'portfolio-medium'
  | 'portfolio-large'
  | 'news'
  | 'earnings'
  | 'market-clock'
  | 'paper-trading-history'
  | 'daily-prediction';

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

export const GRID_CELL_WIDTH_REM = 8;
export const GRID_CELL_HEIGHT_REM = 8;
export const GRID_GAP_REM = 0.5;
export const DRAWER_WIDGET_MIME = 'application/x-optitrade-widget';
export const SOURCE_WIDGET_MIME = 'application/x-optitrade-source-widget';

export const widgetDefaultSpans: Record<WidgetType, WidgetSpan> = {
  number: { cols: 2, rows: 2 },
  chart: { cols: 2, rows: 2 },
  table: { cols: 2, rows: 2 },
  text: { cols: 2, rows: 2 },
  candlestick: { cols: 5, rows: 4 },
  'portfolio-small': { cols: 2, rows: 2 },
  'portfolio-medium': { cols: 3, rows: 3 },
  'portfolio-large': { cols: 4, rows: 4 },
  news: { cols: 4, rows: 4 },
  earnings: { cols: 4, rows: 4 },
  'market-clock': { cols: 3, rows: 3 },
  'paper-trading-history': { cols: 4, rows: 5 },
  'daily-prediction': { cols: 4, rows: 6 },
};

export const widgetLibrary: { id: WidgetType; label: string; sizeLabel: string }[] = [
  { id: 'candlestick', label: 'Candlestick Chart', sizeLabel: '5x4' },
  { id: 'portfolio-small', label: 'Portfolio Widget (Small)', sizeLabel: '2x2' },
  { id: 'portfolio-medium', label: 'Portfolio Widget (Medium)', sizeLabel: '3x3' },
  { id: 'portfolio-large', label: 'Portfolio Widget (Large)', sizeLabel: '4x4' },
  { id: 'news', label: 'News Widget', sizeLabel: '4x4' },
  { id: 'earnings', label: 'Earnings Calendar', sizeLabel: '4x4' },
  { id: 'market-clock', label: 'Market Clock', sizeLabel: '3x3' },
  { id: 'paper-trading-history', label: 'Paper Trading History', sizeLabel: '4x5' },
  { id: 'daily-prediction', label: 'Daily Market Prediction', sizeLabel: '4x6' },
];

export const initialPlacements: WidgetPlacement[] = [
  {
    id: 'candlestick-1',
    widgetType: 'candlestick',
    col: 0,
    row: 0,
    colSpan: 5,
    rowSpan: 4,
  },
  {
    id: 'earnings-1',
    widgetType: 'earnings',
    col: 5,
    row: 0,
    colSpan: 4,
    rowSpan: 4,
  },
  {
    id: 'market-clock-1',
    widgetType: 'market-clock',
    col: 9,
    row: 0,
    colSpan: 3,
    rowSpan: 3,
  },
  {
    id: 'portfolio-large-1',
    widgetType: 'portfolio-large',
    col: 0,
    row: 4,
    colSpan: 4,
    rowSpan: 4,
  },
  {
    id: 'news-1',
    widgetType: 'news',
    col: 4,
    row: 4,
    colSpan: 4,
    rowSpan: 4,
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
