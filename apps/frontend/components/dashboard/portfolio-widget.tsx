import React, { useEffect, useState } from 'react';
import { 
  TrendingDown, 
  TrendingUp, 
  Loader2, 
  Settings, 
  ArrowLeft, 
  ShieldCheck,
  Globe,
  Lock
} from 'lucide-react';
import { BaseWidget } from './base-widget';

// --- Interfaces ---

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
  variant?: PortfolioVariant;
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
  onOpenSettings: () => void;
}

// --- Mock Data ---

const DEFAULT_STOCKS: Stock[] = [
  { id: '1', symbol: 'NVDA', quantity: 200, avgPrice: 120, currentPrice: 145.75, sector: 'Technology' },
  { id: '2', symbol: 'AAPL', quantity: 100, avgPrice: 175, currentPrice: 189.5, sector: 'Technology' },
  { id: '3', symbol: 'TSLA', quantity: 50, avgPrice: 160, currentPrice: 182.3, sector: 'Energy' },
];

// --- Utilities ---

const formatCurrency = (value: number, maximumFractionDigits = 1) =>
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

  return { totalValue, pnl, pnlPercent, sectorValues };
}

// --- Sub-Components ---

function IBKRConnectionPanel({ onBack }: { onBack: () => void }) {
  const [connecting, setConnecting] = useState(false);

  const handleConnect = () => {
    setConnecting(true);
    setTimeout(() => {
      setConnecting(false);
      onBack();
    }, 1500);
  };

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-center gap-3 border-b border-slate-50 px-4 py-3">
        <button onClick={onBack} className="text-slate-400 hover:text-slate-900">
          <ArrowLeft size={16} />
        </button>
        <div className="text-[11px] font-medium uppercase tracking-tight text-slate-500">
          IBKR TWS Bridge
        </div>
      </div>
      
      <div className="flex-1 p-5 space-y-4">
        {/* Host and Port on one line for density */}
        <div className="flex gap-4">
          <div className="flex-1 space-y-1">
            <div className="text-[10px] text-slate-400 uppercase">Host</div>
            <input 
              type="text" 
              defaultValue="127.0.0.1"
              className="w-full border-b border-slate-200 py-1 text-xs outline-none focus:border-slate-900 transition-colors"
            />
          </div>
          <div className="w-20 space-y-1">
            <div className="text-[10px] text-slate-400 uppercase">Port</div>
            <input 
              type="text" 
              placeholder="7497"
              className="w-full border-b border-slate-200 py-1 text-xs outline-none focus:border-slate-900 transition-colors"
            />
          </div>
        </div>

        <div className="space-y-1">
          <div className="text-[10px] text-slate-400 uppercase">Client ID</div>
          <input 
            type="text" 
            placeholder="1"
            className="w-full border-b border-slate-200 py-1 text-xs outline-none focus:border-slate-900 transition-colors"
          />
        </div>

        <div className="pt-4">
          <button 
            onClick={handleConnect}
            disabled={connecting}
            className="w-full bg-slate-900 py-2.5 text-xs text-white transition-all hover:bg-slate-800 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {connecting ? <Loader2 size={12} className="animate-spin" /> : <Lock size={12} />}
            {connecting ? 'Syncing...' : 'Initialize Connection'}
          </button>
        </div>

        <div className="flex items-center justify-center gap-2 text-[10px] text-slate-300 pt-2">
          <ShieldCheck size={12} />
          Verified Local Socket
        </div>
      </div>
    </div>
  );
}

function PortfolioWidgetSmall({ data, onOpenSettings }: PortfolioVariantProps) {
  return (
    <div className="relative flex h-full flex-col items-center justify-center bg-white p-3 border border-slate-100 rounded-lg">
      <button 
        onClick={onOpenSettings}
        className="absolute right-2 top-2 text-slate-300 hover:text-slate-500"
      >
        <Settings size={12} />
      </button>
      
      <div className="text-[9px] font-medium uppercase tracking-wider text-slate-400 mb-1">
        Total Return
      </div>
      <div className={`text-xl font-medium tracking-tight ${percentClass(data.pnlPercent)}`}>
        {data.pnlPercent >= 0 ? '+' : ''}{data.pnlPercent.toFixed(1)}%
      </div>
      {/* Optional: Tiny absolute value for context */}
      <div className="text-[10px] text-slate-400 mt-0.5">
        {formatCurrency(data.pnl, 0)}
      </div>
    </div>
  );
}

function PortfolioWidgetMedium({ stocks, data, onOpenSettings }: PortfolioVariantProps) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
      {/* Header aligned with Large variant style */}
      <div className="flex items-center justify-between border-b border-slate-50 px-3 py-2">
        <div className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Overview</div>
        <button onClick={onOpenSettings} className="text-slate-300 hover:text-slate-500">
          <Settings size={14} />
        </button>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 gap-3 bg-slate-50/30 px-3 py-3 border-b border-slate-50">
        <div>
          <div className="text-[9px] uppercase text-slate-400 mb-0.5">Value</div>
          <div className="text-base font-medium text-slate-900">{formatCurrency(data.totalValue, 0)}</div>
        </div>
        <div className="text-right">
          <div className="text-[9px] uppercase text-slate-400 mb-0.5">P/L</div>
          <div className={`text-base font-medium ${percentClass(data.pnl)}`}>
            {data.pnl >= 0 ? '+' : ''}{formatCurrency(data.pnl, 0)}
          </div>
        </div>
      </div>

      {/* Tighter List */}
      <div className="flex-1 space-y-px overflow-y-auto px-2 py-1">
        {stocks.map((stock) => {
          const stockPnlPercent = (stock.currentPrice / stock.avgPrice - 1) * 100 || 0;
          return (
            <div key={stock.id} className="flex items-center justify-between rounded-lg px-2 py-2 hover:bg-slate-50 transition-colors">
              <div>
                <div className="text-xs font-medium text-slate-800">{stock.symbol}</div>
                <div className="text-[9px] text-slate-400">{stock.quantity} shares</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-700">{formatCurrency(stock.currentPrice, 1)}</div>
                <div className={`text-[9px] font-medium ${percentClass(stockPnlPercent)}`}>
                  {stockPnlPercent >= 0 ? '+' : ''}{stockPnlPercent.toFixed(1)}%
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PortfolioWidgetLarge({ stocks, data, onOpenSettings }: PortfolioVariantProps) {
  const topStock = [...stocks].sort((a, b) => 
    (b.currentPrice / b.avgPrice) - (a.currentPrice / a.avgPrice)
  )[0];

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-white text-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-50">
        <div className="text-xs font-medium uppercase tracking-tight text-slate-500">Portfolio</div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-[10px] text-emerald-600">
            <div className="h-1 w-1 rounded-full bg-emerald-500" />
            LIVE
          </div>
          <button onClick={onOpenSettings} className="text-slate-300 hover:text-slate-600 transition-colors">
            <Settings size={14} />
          </button>
        </div>
      </div>

      {/* Simplified Ribbon */}
      <div className="flex flex-wrap gap-x-6 gap-y-2 px-4 py-3 bg-slate-50/30">
        <div>
          <div className="text-[9px] uppercase text-slate-400">Net Liquidity</div>
          <div className="text-sm">{formatCurrency(data.totalValue, 0)}</div>
        </div>
        <div>
          <div className="text-[9px] uppercase text-slate-400">Unrealized P/L</div>
          <div className={`text-sm ${percentClass(data.pnl)}`}>
            {data.pnlPercent.toFixed(2)}%
          </div>
        </div>
        <div>
          <div className="text-[9px] uppercase text-slate-400">Buying Power</div>
          <div className="text-sm">{formatCurrency(data.totalValue * 0.15, 0)}</div>
        </div>
      </div>

      {/* Main Table Area */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto px-2">
          <table className="w-full text-[11px] text-left border-collapse">
            <thead className="sticky top-0 z-10 bg-white border-b border-slate-50 text-slate-400 uppercase text-[9px]">
              <tr>
                <th className="px-2 py-2 font-normal">Instrument</th>
                <th className="px-2 py-2 text-right font-normal">Avg Cost</th>
                <th className="px-2 py-2 text-right font-normal">Price</th>
                <th className="px-2 py-2 text-right font-normal">Return</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {stocks.map((stock) => {
                const stockPnlPercent = (stock.currentPrice / stock.avgPrice - 1) * 100 || 0;
                return (
                  <tr key={stock.id} className="hover:bg-slate-50/50">
                    <td className="px-2 py-2">
                      <div className="font-medium">{stock.symbol}</div>
                      <div className="text-[9px] text-slate-400">{stock.quantity} units</div>
                    </td>
                    <td className="px-2 py-2 text-right text-slate-500">
                      {formatCurrency(stock.avgPrice, 2)}
                    </td>
                    <td className="px-2 py-2 text-right text-slate-700">
                      {formatCurrency(stock.currentPrice, 2)}
                    </td>
                    <td className={`px-2 py-2 text-right font-medium ${percentClass(stockPnlPercent)}`}>
                      {stockPnlPercent >= 0 ? '+' : ''}{stockPnlPercent.toFixed(2)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Sidebar */}
        <div className="w-32 flex-shrink-0 bg-slate-50/50 p-4 border-l border-slate-50">
          <div className="text-[9px] uppercase text-slate-400 mb-3">Allocation</div>
          <div className="space-y-4">
            {data.sectorValues.map((sector) => (
              <div key={sector.sector}>
                <div className="flex items-center justify-between text-[10px] mb-1 text-slate-600">
                  <span className="truncate">{sector.sector}</span>
                  <span>{sector.percent.toFixed(0)}%</span>
                </div>
                <div className="h-0.5 w-full bg-slate-200">
                  <div 
                    className="h-full bg-slate-400" 
                    style={{ width: `${sector.percent}%` }} 
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Main Root Component ---

const PortfolioWidgetRoot = ({
  title = 'Portfolio',
  variant,
  size,
  ...props
}: PortfolioWidgetProps) => {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showBrokerPanel, setShowBrokerPanel] = useState(false);

  const resolvedVariant = variant ?? size ?? 'medium';

  useEffect(() => {
    const loadPortfolio = async () => {
      try {
        setLoading(true);
        const response = await fetch('/v1/api/portfolio');
        if (!response.ok) {
          setStocks(DEFAULT_STOCKS);
          return;
        }
        const data = await response.json();
        setStocks(data);
      } catch (err) {
        setStocks(DEFAULT_STOCKS);
      } finally {
        setLoading(false);
      }
    };
    loadPortfolio();
  }, []);

  const portfolioData = buildPortfolioData(stocks);
  const variantProps: PortfolioVariantProps = { 
    stocks, 
    data: portfolioData,
    onOpenSettings: () => setShowBrokerPanel(true)
  };

  return (
    <BaseWidget title={title} {...props} className="overflow-hidden">
      {loading ? (
        <div className="flex h-full items-center justify-center space-x-2 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-xs font-bold uppercase tracking-widest">Syncing...</span>
        </div>
      ) : showBrokerPanel ? (
        <IBKRConnectionPanel onBack={() => setShowBrokerPanel(false)} />
      ) : (
        <>
          {resolvedVariant === 'small' && <PortfolioWidgetSmall {...variantProps} />}
          {resolvedVariant === 'medium' && <PortfolioWidgetMedium {...variantProps} />}
          {resolvedVariant === 'large' && <PortfolioWidgetLarge {...variantProps} />}
        </>
      )}
    </BaseWidget>
  );
};

export const PortfolioWidget = Object.assign(PortfolioWidgetRoot, {
  Small: PortfolioWidgetSmall,
  Medium: PortfolioWidgetMedium,
  Large: PortfolioWidgetLarge,
});