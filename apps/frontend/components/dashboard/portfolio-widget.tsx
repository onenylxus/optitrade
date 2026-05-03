'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Check, Loader2, Settings, ArrowLeft, Lock, Save } from 'lucide-react';
import { Area, AreaChart, YAxis, XAxis } from 'recharts';
import { BaseWidget } from './base-widget';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';

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
  dailyPnl: number;
  dailyPnlPercent: number;
  marginUsage: number;
  sectorValues: Array<{ sector: string; value: number; percent: number }>;
  history: Array<{ time: string; value: number }>;
}

interface PortfolioVariantProps {
  stocks: Stock[];
  data: PortfolioDerivedData;
  source: 'backend' | 'demo';
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  onOpenSettings: () => void;
  onSavePaperPortfolio: () => void;
}

interface PortfolioApiPosition extends Stock {
  marketValue?: number;
  costBasis?: number;
  unrealizedPnl?: number;
  unrealizedPnlPercent?: number;
}

interface PortfolioApiSnapshot {
  positions: PortfolioApiPosition[];
  summary: {
    totalValue: number;
    pnl: number;
    pnlPercent: number;
    dailyPnl: number;
    dailyPnlPercent: number;
    marginUsage: number;
  };
  sectorValues: PortfolioDerivedData['sectorValues'];
  history: PortfolioDerivedData['history'];
}

const PORTFOLIO_API_BASE_URL =
  process.env.NEXT_PUBLIC_PORTFOLIO_API_BASE_URL ?? 'http://127.0.0.1:8000';

// --- Mock Data ---

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
  {
    id: '4',
    symbol: 'MSFT',
    quantity: 40,
    avgPrice: 380,
    currentPrice: 420.15,
    sector: 'Technology',
  },
  {
    id: '5',
    symbol: 'AMZN',
    quantity: 120,
    avgPrice: 145,
    currentPrice: 178.22,
    sector: 'Consumer',
  },
  { id: '9', symbol: 'JPM', quantity: 60, avgPrice: 140, currentPrice: 195.3, sector: 'Financial' },
  {
    id: '12',
    symbol: 'NFLX',
    quantity: 20,
    avgPrice: 450,
    currentPrice: 610.05,
    sector: 'Communication',
  },
];

// --- Utilities ---

const formatCurrency = (value: number, maxDigits = 0) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: maxDigits,
  }).format(value);

const percentClass = (value: number) => (value >= 0 ? 'text-emerald-600' : 'text-rose-600');

const portfolioApiUrl = (path: string) => {
  const baseUrl = PORTFOLIO_API_BASE_URL.endsWith('/')
    ? PORTFOLIO_API_BASE_URL.slice(0, -1)
    : PORTFOLIO_API_BASE_URL;
  return `${baseUrl}${path}`;
};

function mapPortfolioSnapshot(snapshot: PortfolioApiSnapshot): {
  stocks: Stock[];
  data: PortfolioDerivedData;
} {
  return {
    stocks: snapshot.positions.map((position) => ({
      id: position.id,
      symbol: position.symbol,
      quantity: position.quantity,
      avgPrice: position.avgPrice,
      currentPrice: position.currentPrice,
      sector: position.sector,
    })),
    data: {
      totalValue: snapshot.summary.totalValue,
      pnl: snapshot.summary.pnl,
      pnlPercent: snapshot.summary.pnlPercent,
      dailyPnl: snapshot.summary.dailyPnl,
      dailyPnlPercent: snapshot.summary.dailyPnlPercent,
      marginUsage: snapshot.summary.marginUsage,
      sectorValues: snapshot.sectorValues,
      history: snapshot.history,
    },
  };
}

function buildPortfolioData(stocks: Stock[]): PortfolioDerivedData {
  const totalValue = stocks.reduce((sum, stock) => sum + stock.currentPrice * stock.quantity, 0);
  const totalCost = stocks.reduce((sum, stock) => sum + stock.avgPrice * stock.quantity, 0);
  const pnl = totalValue - totalCost;
  const pnlPercent = totalCost > 0 ? (pnl / totalCost) * 100 : 0;

  const dailyPnl = totalValue * 0.012;
  const dailyPnlPercent = 1.2;
  const marginUsage = totalValue * 0.25;

  const history = [
    { time: '09:30', value: totalValue * 0.985 },
    { time: '10:30', value: totalValue * 0.992 },
    { time: '11:30', value: totalValue * 1.012 },
    { time: '12:30', value: totalValue * 1.005 },
    { time: '13:30', value: totalValue * 1.018 },
    { time: '14:30', value: totalValue * 1.011 },
    { time: '15:30', value: totalValue },
  ];

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
    dailyPnl,
    dailyPnlPercent,
    marginUsage,
    sectorValues,
    history,
  };
}

function PerformanceChart({
  data,
  height = 100,
  showAxis = false,
}: {
  data: PortfolioDerivedData['history'];
  height?: number;
  showAxis?: boolean;
}) {
  const isPositive = data[data.length - 1].value >= data[0].value;
  const chartColor = isPositive ? 'var(--emerald-500)' : 'var(--rose-500)';

  return (
    <ChartContainer
      config={{ value: { label: 'Value', color: chartColor } }}
      className="w-full"
      style={{ height }}
    >
      <AreaChart data={data} margin={{ top: 5, right: 0, left: 0, bottom: 5 }}>
        <defs>
          <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={chartColor} stopOpacity={0.3} />
            <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
          </linearGradient>
        </defs>
        {showAxis && <XAxis dataKey="time" hide />}
        <YAxis domain={['dataMin - 100', 'dataMax + 100']} hide />
        <ChartTooltip content={<ChartTooltipContent hideLabel />} />
        <Area
          type="monotone"
          dataKey="value"
          stroke={chartColor}
          fill="url(#chartGradient)"
          strokeWidth={2}
          dot={false}
        />
      </AreaChart>
    </ChartContainer>
  );
}

// --- Sub-Components ---

function IBKRConnectionPanel({ onBack }: { onBack: () => void }) {
  const [connecting, setConnecting] = useState(false);
  const [host, setHost] = useState('127.0.0.1');
  const [port, setPort] = useState('7497');
  const handleConnect = async () => {
    setConnecting(true);
    try {
      await fetch(portfolioApiUrl('/api/portfolio/connect'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host, port: Number(port) }),
      });
      onBack();
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-center gap-3 border-b border-slate-50 py-3">
        <button onClick={onBack} className="text-slate-400 hover:text-slate-900 transition-colors">
          <ArrowLeft size={16} />
        </button>
        <div className="text-[11px] font-medium uppercase tracking-tight text-slate-500">
          IBKR Bridge
        </div>
      </div>
      <div className="flex-1 py-5 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="text-[10px] text-slate-400 uppercase">Host</div>
            <input
              type="text"
              value={host}
              onChange={(event) => setHost(event.target.value)}
              className="w-full border-b border-slate-200 py-1 text-xs outline-none focus:border-slate-900"
            />
          </div>
          <div className="space-y-1">
            <div className="text-[10px] text-slate-400 uppercase">Port</div>
            <input
              type="text"
              value={port}
              onChange={(event) => setPort(event.target.value)}
              className="w-full border-b border-slate-200 py-1 text-xs outline-none focus:border-slate-900"
            />
          </div>
        </div>
        <button
          onClick={handleConnect}
          disabled={connecting}
          className="w-full bg-slate-900 py-2.5 text-xs text-white hover:bg-slate-800 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {connecting ? <Loader2 size={12} className="animate-spin" /> : <Lock size={12} />}
          {connecting ? 'Syncing...' : 'Initialize Connection'}
        </button>
      </div>
    </div>
  );
}

function PortfolioWidgetSmall({ data, source, onOpenSettings }: PortfolioVariantProps) {
  return (
    <div className="relative flex h-full flex-col items-center justify-center bg-white">
      <button
        onClick={onOpenSettings}
        className="absolute right-0 top-0 text-slate-200 hover:text-slate-400"
      >
        <Settings size={12} />
      </button>
      <div
        className={`absolute left-0 top-0 h-1.5 w-1.5 rounded-full ${
          source === 'backend' ? 'bg-emerald-500' : 'bg-amber-400'
        }`}
        title={source === 'backend' ? 'Backend data' : 'Demo fallback data'}
      />
      <div className={`text-xl font-medium tracking-tight ${percentClass(data.pnlPercent)}`}>
        {data.pnlPercent >= 0 ? '+' : ''}
        {data.pnlPercent.toFixed(1)}%
      </div>
      <div className="text-[10px] text-slate-400 mt-0.5">{formatCurrency(data.pnl)}</div>
    </div>
  );
}

function PortfolioWidgetMedium({
  stocks,
  data,
  source,
  saveStatus,
  onOpenSettings,
  onSavePaperPortfolio,
}: PortfolioVariantProps) {
  return (
    <div className="flex h-full flex-col overflow-hidden bg-white">
      <div className="flex items-center justify-between border-b border-slate-50 py-2.5">
        <div className="flex items-center gap-2">
          <div className="text-[10px] font-medium uppercase tracking-wider text-slate-400 font-mono">
            PNL_SNAPSHOT
          </div>
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              source === 'backend' ? 'bg-emerald-500' : 'bg-amber-400'
            }`}
            title={source === 'backend' ? 'Backend data' : 'Demo fallback data'}
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onSavePaperPortfolio}
            disabled={saveStatus === 'saving'}
            className="text-slate-300 hover:text-slate-500 disabled:opacity-50"
            title="Save paper portfolio"
          >
            {saveStatus === 'saved' ? <Check size={14} /> : <Save size={14} />}
          </button>
          <button onClick={onOpenSettings} className="text-slate-300 hover:text-slate-500">
            <Settings size={14} />
          </button>
        </div>
      </div>

      <div className="py-3 border-b border-slate-50 flex items-center justify-between">
        <div>
          <div className="text-[9px] uppercase text-slate-400 mb-0.5">Total Value</div>
          <div className="text-lg font-medium text-slate-900">
            {formatCurrency(data.totalValue)}
          </div>
        </div>
        <div className="w-24">
          <PerformanceChart data={data.history} height={32} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {stocks.map((stock) => (
          <div
            key={stock.id}
            className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors px-1"
          >
            <div className="flex flex-col">
              <div className="text-xs font-bold text-slate-800">{stock.symbol}</div>
              <div className="text-[8px] text-slate-400 uppercase tracking-tighter">
                {stock.quantity} shs
              </div>
            </div>
            <div className="flex flex-col items-end">
              <div
                className={`text-[10px] font-bold ${percentClass(stock.currentPrice - stock.avgPrice)}`}
              >
                {formatCurrency(stock.currentPrice, 1)}
              </div>
              <div className="text-[8px] text-slate-400 font-mono">
                Avg: {formatCurrency(stock.avgPrice, 0)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PortfolioWidgetLarge({
  stocks,
  data,
  source,
  saveStatus,
  onOpenSettings,
  onSavePaperPortfolio,
}: PortfolioVariantProps) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-white text-slate-900">
      <div className="flex items-center justify-between py-3 border-b border-slate-50">
        <div className="flex items-center gap-2">
          <div className="text-xs font-medium uppercase tracking-tight text-slate-500">
            Executive Summary
          </div>
          <span className="bg-emerald-50 text-emerald-600 text-[9px] px-1.5 py-0.5 rounded font-bold italic uppercase">
            {source === 'backend' ? 'Live' : 'Demo'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onSavePaperPortfolio}
            disabled={saveStatus === 'saving'}
            className="text-slate-300 hover:text-slate-600 disabled:opacity-50 transition-colors"
            title="Save paper portfolio"
          >
            {saveStatus === 'saved' ? <Check size={14} /> : <Save size={14} />}
          </button>
          <button
            onClick={onOpenSettings}
            className="text-slate-300 hover:text-slate-600 transition-colors"
          >
            <Settings size={14} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 py-4 bg-slate-50/40 border-b border-slate-50 px-1">
        {[
          { label: 'Net Liq', val: formatCurrency(data.totalValue) },
          {
            label: 'Daily P/L',
            val: formatCurrency(data.dailyPnl),
            class: percentClass(data.dailyPnl),
          },
          {
            label: 'Unrealized',
            val: `${data.pnlPercent.toFixed(2)}%`,
            class: percentClass(data.pnl),
          },
          { label: 'Buying Power', val: formatCurrency(data.totalValue * 0.15) },
        ].map((m) => (
          <div key={m.label}>
            <div className="text-[9px] uppercase text-slate-400 mb-0.5 tracking-wide">
              {m.label}
            </div>
            <div className={`text-xs font-semibold ${m.class || ''}`}>{m.val}</div>
          </div>
        ))}
      </div>

      <div className="py-2 border-b border-slate-50 bg-white">
        <PerformanceChart data={data.history} height={60} showAxis />
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="w-3/5 overflow-y-auto pr-3 scrollbar-thin scrollbar-thumb-slate-100">
          <table className="w-full text-[10px] text-left border-collapse">
            <thead className="sticky top-0 z-10 bg-white shadow-[0_1px_0_0_rgba(0,0,0,0.05)] text-slate-400 uppercase text-[8px] tracking-wider">
              <tr>
                <th className="py-2 font-semibold first:pl-0 bg-white">Instrument</th>
                <th className="py-2 text-right font-semibold bg-white">Avg</th>
                <th className="py-2 text-right font-semibold bg-white">Price</th>
                <th className="py-2 text-right font-semibold last:pr-0 bg-white">Return</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {stocks.map((stock) => {
                const stockPnl = (stock.currentPrice / stock.avgPrice - 1) * 100;
                return (
                  <tr key={stock.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="py-2 first:pl-0">
                      <div className="font-bold text-slate-900 leading-tight">{stock.symbol}</div>
                      <div className="text-[8px] text-slate-400 font-mono tracking-tighter">
                        {stock.quantity} <span className="text-[7px] opacity-70">shs</span>
                      </div>
                    </td>
                    <td className="py-2 text-right font-mono text-slate-400 text-[9px]">
                      {formatCurrency(stock.avgPrice, 0)}
                    </td>
                    <td className="py-2 text-right font-bold text-slate-800 text-[9px]">
                      {formatCurrency(stock.currentPrice, 0)}
                    </td>
                    <td
                      className={`py-2 text-right font-bold last:pr-0 text-[9px] ${percentClass(stockPnl)}`}
                    >
                      {stockPnl >= 0 ? '+' : ''}
                      {stockPnl.toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="w-2/5 bg-slate-50/30 p-3 border-l border-slate-50 overflow-y-auto">
          <div className="text-[8px] uppercase text-slate-400 mb-3 font-bold tracking-widest border-b border-slate-100 pb-1">
            Allocation
          </div>
          <div className="space-y-4">
            {data.sectorValues.map((sector) => (
              <div key={sector.sector} className="group">
                <div className="flex items-center justify-between text-[8px] mb-1 text-slate-500 font-bold uppercase tracking-tighter">
                  <span className="truncate pr-1 group-hover:text-slate-900 transition-colors">
                    {sector.sector}
                  </span>
                  <span className="font-mono">{sector.percent.toFixed(0)}%</span>
                </div>
                <div className="h-1 w-full bg-slate-200/60 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-slate-400 group-hover:bg-slate-700 transition-all"
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

const PortfolioWidgetRoot = ({
  title = 'Portfolio Snapshot',
  variant,
  size,
  ...props
}: PortfolioWidgetProps) => {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [backendData, setBackendData] = useState<PortfolioDerivedData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [showBrokerPanel, setShowBrokerPanel] = useState(false);
  const [source, setSource] = useState<'backend' | 'demo'>('demo');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const resolvedVariant = variant ?? size ?? 'medium';

  useEffect(() => {
    const loadPortfolio = async () => {
      try {
        setLoading(true);
        const response = await fetch(portfolioApiUrl('/api/portfolio'), {
          headers: { Accept: 'application/json' },
        });

        if (!response.ok) {
          throw new Error(`Portfolio API returned ${response.status}`);
        }

        const snapshot = (await response.json()) as PortfolioApiSnapshot;
        const mappedSnapshot = mapPortfolioSnapshot(snapshot);
        setStocks(mappedSnapshot.stocks);
        setBackendData(mappedSnapshot.data);
        setSource('backend');
      } catch {
        setStocks(DEFAULT_STOCKS);
        setBackendData(null);
        setSource('demo');
      } finally {
        setLoading(false);
      }
    };
    loadPortfolio();
  }, []);

  const portfolioData = useMemo(
    () => backendData ?? buildPortfolioData(stocks),
    [backendData, stocks],
  );

  const savePaperPortfolio = async () => {
    setSaveStatus('saving');
    try {
      const response = await fetch(portfolioApiUrl('/api/paper-portfolio'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Portfolio Widget Paper Portfolio',
          positions: stocks,
        }),
      });

      if (!response.ok) {
        throw new Error(`Paper portfolio API returned ${response.status}`);
      }

      setSaveStatus('saved');
      window.setTimeout(() => setSaveStatus('idle'), 1600);
    } catch {
      setSaveStatus('error');
      window.setTimeout(() => setSaveStatus('idle'), 1600);
    }
  };

  const variantProps: PortfolioVariantProps = {
    stocks,
    data: portfolioData,
    source,
    saveStatus,
    onOpenSettings: () => setShowBrokerPanel(true),
    onSavePaperPortfolio: savePaperPortfolio,
  };

  return (
    <BaseWidget title={title} {...props} className="overflow-hidden">
      {loading ? (
        <div className="flex h-full items-center justify-center space-x-2 text-slate-300">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-[10px] font-medium uppercase tracking-widest">Synchronizing</span>
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
