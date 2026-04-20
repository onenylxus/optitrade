import { MessageSquare, TrendingDown, TrendingUp } from 'lucide-react';
import { BaseWidget } from './base-widget';

export interface Stock {
  id: string;
  symbol: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  sector: string;
}

type PortfolioVariant = 'small' | 'medium' | 'large';

interface PortfolioWidgetProps extends Omit<
  React.ComponentProps<typeof BaseWidget>,
  'children' | 'title' | 'summary' | 'size'
> {
  title?: string;
  stocks?: Stock[];
  variant?: PortfolioVariant;
  /** Backward-compatible alias for `variant`. */
  size?: PortfolioVariant;
}

interface PortfolioDerivedData {
  totalValue: number;
  pnl: number;
  pnlPercent: number;
  sectorValues: Array<{ sector: string; value: number; percent: number }>;
}

interface PortfolioVariantProps {
  stocks: Stock[];
  data: PortfolioDerivedData;
}

const DEFAULT_STOCKS: Stock[] = [
  {
    id: '1',
    symbol: 'NVDA',
    quantity: 200,
    avgPrice: 120,
    currentPrice: 145.75,
    sector: 'Technology',
  },
  {
    id: '2',
    symbol: 'AAPL',
    quantity: 100,
    avgPrice: 175,
    currentPrice: 189.5,
    sector: 'Technology',
  },
  { id: '3', symbol: 'TSLA', quantity: 50, avgPrice: 160, currentPrice: 182.3, sector: 'Energy' },
];

const formatCurrency = (value: number, maximumFractionDigits = 0) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits,
  }).format(value);

const percentClass = (value: number) => (value >= 0 ? 'text-emerald-600' : 'text-rose-600');

function buildPortfolioData(stocks: Stock[]): PortfolioDerivedData {
  const totalValue = stocks.reduce((sum, stock) => sum + stock.currentPrice * stock.quantity, 0);
  const totalCost = stocks.reduce((sum, stock) => sum + stock.avgPrice * stock.quantity, 0);
  const pnl = totalValue - totalCost;
  const pnlPercent = totalCost > 0 ? (pnl / totalCost) * 100 : 0;

  const groupedSectorValues = stocks.reduce<Record<string, number>>((acc, stock) => {
    const sector = stock.sector || 'Uncategorized';
    acc[sector] = (acc[sector] ?? 0) + stock.currentPrice * stock.quantity;
    return acc;
  }, {});

  const sectorValues = Object.entries(groupedSectorValues)
    .map(([sector, value]) => ({
      sector,
      value,
      percent: totalValue > 0 ? (value / totalValue) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value);

  return {
    totalValue,
    pnl,
    pnlPercent,
    sectorValues,
  };
}

function PortfolioWidgetSmall({ data }: PortfolioVariantProps) {
  return (
    <div className="flex h-full items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-center shadow-sm">
      <div>
        <div className="mb-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">
          Total P/L
        </div>
        <div className={`text-3xl font-black leading-none ${percentClass(data.pnlPercent)}`}>
          {data.pnlPercent >= 0 ? '+' : ''}
          {data.pnlPercent.toFixed(1)}%
        </div>
      </div>
    </div>
  );
}

function PortfolioWidgetMedium({ stocks, data }: PortfolioVariantProps) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
      <div className="grid grid-cols-2 gap-3 border-b border-slate-100 px-3 py-2.5">
        <div>
          <div className="mb-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">
            Total Value
          </div>
          <div className="text-xl font-black tracking-tight text-slate-900">
            {formatCurrency(data.totalValue)}
          </div>
        </div>
        <div className="text-right">
          <div className="mb-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">
            Unrealized P/L
          </div>
          <div className={`text-xl font-black tracking-tight ${percentClass(data.pnl)}`}>
            {data.pnl >= 0 ? '+' : ''}
            {formatCurrency(data.pnl)}
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-0.5 overflow-y-auto px-3 py-1.5">
        {stocks.map((stock) => {
          const stockPnlPercent = (stock.currentPrice / stock.avgPrice - 1) * 100 || 0;

          return (
            <div
              key={stock.id}
              className="-mx-0.5 flex items-center justify-between rounded-lg border-b border-slate-50 px-1.5 py-2 transition-colors hover:bg-slate-50 last:border-0"
            >
              <div>
                <div className="text-sm font-bold text-slate-800">{stock.symbol}</div>
                <div className="text-[10px] font-medium text-slate-400">
                  {stock.quantity} shares
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-slate-700">
                  {formatCurrency(stock.currentPrice, 2)}
                </div>
                <div className={`text-[9px] font-bold ${percentClass(stockPnlPercent)}`}>
                  {stockPnlPercent >= 0 ? '+' : ''}
                  {stockPnlPercent.toFixed(1)}%
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PortfolioWidgetLarge({ stocks, data }: PortfolioVariantProps) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div className="text-sm font-black uppercase tracking-wider text-slate-700">
          Portfolio Optimizer
        </div>
        <div className="flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
          <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" /> Connected
        </div>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4">
          <table className="w-full border-separate border-spacing-y-2 text-xs text-left">
            <thead className="sticky top-0 z-10 bg-white text-slate-400">
              <tr>
                <th className="px-3 py-2 uppercase tracking-widest">Symbol</th>
                <th className="px-3 py-2 text-right uppercase tracking-widest">Price</th>
                <th className="px-3 py-2 text-right uppercase tracking-widest">Day Change</th>
              </tr>
            </thead>
            <tbody>
              {stocks.map((stock) => {
                const stockPnlPercent = (stock.currentPrice / stock.avgPrice - 1) * 100 || 0;
                return (
                  <tr key={stock.id} className="group">
                    <td className="rounded-l-xl border border-transparent bg-slate-50/60 px-3 py-3 font-bold text-slate-800 transition-colors group-hover:bg-slate-100">
                      {stock.symbol}
                    </td>
                    <td className="border-y border-transparent bg-slate-50/60 px-3 py-3 text-right font-medium text-slate-600 transition-colors group-hover:bg-slate-100">
                      {formatCurrency(stock.currentPrice, 2)}
                    </td>
                    <td
                      className={`rounded-r-xl border border-transparent bg-slate-50/60 px-3 py-3 text-right font-black transition-colors group-hover:bg-slate-100 ${percentClass(stockPnlPercent)}`}
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        {stockPnlPercent >= 0 ? (
                          <TrendingUp size={14} />
                        ) : (
                          <TrendingDown size={14} />
                        )}
                        {stockPnlPercent >= 0 ? '+' : ''}
                        {stockPnlPercent.toFixed(1)}%
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="w-64 space-y-5 overflow-y-auto border-l border-slate-100 bg-slate-50/50 p-4">
          <div>
            <h3 className="mb-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">
              Sector Allocation
            </h3>
            <div className="space-y-2">
              {data.sectorValues.map((sector) => (
                <div key={sector.sector} className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-600">
                    <span>{sector.sector}</span>
                    <span className="font-bold">{sector.percent.toFixed(0)}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-blue-500"
                      style={{ width: `${sector.percent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-blue-200 transition-colors hover:bg-blue-700"
          >
            <MessageSquare size={14} /> Add to Context
          </button>
        </div>
      </div>
    </div>
  );
}

type PortfolioWidgetComponent = ((props: PortfolioWidgetProps) => React.JSX.Element) & {
  Small: (props: PortfolioVariantProps) => React.JSX.Element;
  Medium: (props: PortfolioVariantProps) => React.JSX.Element;
  Large: (props: PortfolioVariantProps) => React.JSX.Element;
};

const PortfolioWidgetRoot = ({
  title = 'Portfolio',
  stocks = DEFAULT_STOCKS,
  variant,
  size,
  ...props
}: PortfolioWidgetProps) => {
  const resolvedVariant = variant ?? size ?? 'medium';
  const portfolioData = buildPortfolioData(stocks);
  const variantProps: PortfolioVariantProps = { stocks, data: portfolioData };

  return (
    <BaseWidget title={title} {...props}>
      {resolvedVariant === 'small' ? (
        <PortfolioWidgetSmall {...variantProps} />
      ) : resolvedVariant === 'large' ? (
        <PortfolioWidgetLarge {...variantProps} />
      ) : (
        <PortfolioWidgetMedium {...variantProps} />
      )}
    </BaseWidget>
  );
};

export const PortfolioWidget = Object.assign(PortfolioWidgetRoot, {
  Small: PortfolioWidgetSmall,
  Medium: PortfolioWidgetMedium,
  Large: PortfolioWidgetLarge,
}) as PortfolioWidgetComponent;
