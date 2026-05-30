'use client';

<<<<<<< Updated upstream
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Loader2,
=======
import React, { useEffect, useState, useMemo } from 'react';
import {
  Check,
  Loader2,
  Settings,
  ArrowLeft,
>>>>>>> Stashed changes
  Lock,
  Pencil,
  Plus,
  Save,
<<<<<<< Updated upstream
  Settings,
  Trash2,
} from 'lucide-react';
import { Area, AreaChart, XAxis, YAxis } from 'recharts';
=======
  Trash2,
  X,
} from 'lucide-react';
import { Area, AreaChart, Cell, Pie, PieChart, YAxis, XAxis } from 'recharts';
>>>>>>> Stashed changes
import { BaseWidget } from './base-widget';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import type {
  PortfolioBrokerOption,
  PortfolioChatContextValue,
} from '@/contexts/portfolio-context';
import { usePortfolioContext } from '@/contexts/portfolio-context';

export interface Stock {
  id: string;
  symbol: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  sector: string;
}

<<<<<<< Updated upstream
type PortfolioVariant = 'small' | 'medium' | 'large';
type PortfolioWidgetSource = 'backend' | 'paper';
type PortfolioPanelMode = 'broker' | 'editor' | null;
=======
type PortfolioVariant = 'full' | 'medium' | 'pl-tile' | 'top-mover-tile';
>>>>>>> Stashed changes

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
  totalCost: number;
  pnl: number;
  pnlPercent: number;
  dailyPnl: number;
  dailyPnlPercent: number;
  marginUsage: number;
  buyingPower: number;
  sectorValues: Array<{ sector: string; value: number; percent: number }>;
  history: Array<{ time: string; value: number }>;
  positions: Array<{
    id: string;
    symbol: string;
    quantity: number;
    avgPrice: number;
    currentPrice: number;
    sector: string;
    marketValue: number;
    costBasis: number;
    unrealizedPnl: number;
    unrealizedPnlPercent: number;
    dailyMovePercent: number;
    dailyPnl: number;
    weightPercent: number;
  }>;
  topMover: {
    symbol: string;
    movePercent: number;
    dailyPnl: number;
    directionLabel: string;
  } | null;
  health: {
    label: 'Healthy' | 'Watch' | 'Concentrated';
    diversification: string;
    topContributor: string;
    concentrationRisk: string;
  };
}

interface PortfolioVariantProps {
  stocks: Stock[];
  data: PortfolioDerivedData;
<<<<<<< Updated upstream
  source: PortfolioWidgetSource;
  sourceLabel: string;
  onOpenSettings: () => void;
  onOpenEditor: () => void;
=======
  source: 'backend' | 'demo';
  liveBrokerLabel: string;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  saveErrorMessage: string | null;
  isEditingPaperPortfolio: boolean;
  paperBuyingPower: number;
  onOpenSettings: () => void;
  onSavePaperPortfolio: () => void;
  onOpenPaperEditor: () => void;
  onClosePaperEditor: () => void;
  onPaperBuyingPowerChange: (value: string) => void;
  onPaperStockChange: (id: string, field: keyof Stock, value: string) => void;
  onAddPaperStock: () => void;
  onRemovePaperStock: (id: string) => void;
>>>>>>> Stashed changes
}

interface PortfolioApiPosition extends Stock {
  marketValue?: number;
  costBasis?: number;
  unrealizedPnl?: number;
  unrealizedPnlPercent?: number;
}

interface PortfolioApiSnapshot {
  asOf?: string;
  baseCurrency?: string;
  source?: 'backend' | 'paper';
  broker?: {
    id?: PortfolioBrokerOption;
    status: 'connected' | 'configured' | 'disconnected';
    name: string;
    settings?: Record<string, unknown>;
    host?: string;
    port?: number;
    clientId?: number;
    market?: string;
    testnet?: boolean;
    accountId?: string;
    syncedAt?: string;
    lastError?: string;
  };
  paperPortfolio?: {
    id?: string;
    name?: string;
    updatedAt?: string;
    isDefault?: boolean;
  };
  positions: PortfolioApiPosition[];
  summary: {
    totalValue: number;
    totalCost?: number;
    pnl: number;
    pnlPercent: number;
    dailyPnl: number;
    dailyPnlPercent: number;
    marginUsage: number;
    buyingPower?: number;
  };
  sectorValues: PortfolioDerivedData['sectorValues'];
  history: PortfolioDerivedData['history'];
}

interface PortfolioEditableResponse {
  name: string;
  positions: PortfolioApiPosition[];
  updatedAt: string;
}

interface PortfolioMappedSnapshot {
  stocks: Stock[];
  data: PortfolioDerivedData;
  chatContext: PortfolioChatContextValue;
}

interface PortfolioHealthApiResponse {
  label: PortfolioDerivedData['health']['label'];
  diversification: string;
  topContributor: string;
  concentrationRisk: string;
  model_id: string;
}

interface BrokerOptionConfig {
  id: PortfolioBrokerOption;
  label: string;
  supported: boolean;
  description: string;
}

const PORTFOLIO_API_BASE_URL =
  process.env.NEXT_PUBLIC_PORTFOLIO_API_BASE_URL ?? 'http://127.0.0.1:8000';

const BROKER_OPTIONS: BrokerOptionConfig[] = [
  { id: 'ibkr', label: 'IBKR', supported: true, description: 'TWS / Gateway' },
  { id: 'futu', label: 'Futu', supported: true, description: 'OpenAPI host + market' },
  { id: 'binance', label: 'Binance', supported: true, description: 'API key + secret' },
  {
    id: 'mock',
    label: 'Paper Portfolio',
    supported: true,
    description: 'Backend-stored editable positions',
  },
];

<<<<<<< Updated upstream
=======
const DONUT_COLORS = ['#0f766e', '#1d4ed8', '#b45309', '#475569', '#be123c', '#6d28d9'];

// --- Utilities ---

>>>>>>> Stashed changes
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

const getBrokerOption = (broker: PortfolioBrokerOption) =>
  BROKER_OPTIONS.find((option) => option.id === broker);

function mapPositionsToStocks(positions: PortfolioApiPosition[]): Stock[] {
  return positions.map((position, index) => ({
    id: position.id || `position-${index + 1}`,
    symbol: position.symbol,
    quantity: position.quantity,
    avgPrice: position.avgPrice,
    currentPrice: position.currentPrice,
    sector: position.sector,
  }));
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
<<<<<<< Updated upstream
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

function buildPaperChatContext(
  stocks: Stock[],
  broker?: PortfolioApiSnapshot['broker'],
): PortfolioChatContextValue {
  const data = buildPortfolioData(stocks);
=======
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
      totalCost:
        snapshot.summary.totalCost ??
        snapshot.positions.reduce(
          (sum, position) => sum + (position.costBasis ?? position.avgPrice * position.quantity),
          0,
        ),
      pnl: snapshot.summary.pnl,
      pnlPercent: snapshot.summary.pnlPercent,
      dailyPnl: snapshot.summary.dailyPnl,
      dailyPnlPercent: snapshot.summary.dailyPnlPercent,
      marginUsage: snapshot.summary.marginUsage,
      buyingPower: snapshot.summary.buyingPower ?? snapshot.summary.totalValue * 0.15,
      sectorValues: snapshot.sectorValues,
      history: snapshot.history,
      positions: snapshot.positions.map((position) => {
        const costBasis = position.costBasis ?? position.avgPrice * position.quantity;
        const marketValue = position.marketValue ?? position.currentPrice * position.quantity;
        const unrealizedPnl = position.unrealizedPnl ?? marketValue - costBasis;
        const unrealizedPnlPercent =
          position.unrealizedPnlPercent ??
          (costBasis === 0 ? 0 : (unrealizedPnl / costBasis) * 100);
        const dailyMovePercent = Number((unrealizedPnlPercent / 8).toFixed(2));
        return {
          id: position.id,
          symbol: position.symbol,
          quantity: position.quantity,
          avgPrice: position.avgPrice,
          currentPrice: position.currentPrice,
          sector: position.sector,
          marketValue,
          costBasis,
          unrealizedPnl,
          unrealizedPnlPercent,
          dailyMovePercent,
          dailyPnl: marketValue * (dailyMovePercent / 100),
          weightPercent:
            snapshot.summary.totalValue === 0
              ? 0
              : (marketValue / snapshot.summary.totalValue) * 100,
        };
      }),
      topMover: null,
      health: {
        label: 'Healthy',
        diversification: '',
        topContributor: '',
        concentrationRisk: '',
      },
    },
    chatContext: {
      asOf: snapshot.asOf ?? new Date().toISOString(),
      baseCurrency: snapshot.baseCurrency ?? 'USD',
      source: snapshot.source ?? 'backend',
      broker: snapshot.broker ?? {
        id: 'mock',
        status: 'disconnected',
        name: 'Mock Data',
      },
      summary: snapshot.summary,
      positions: snapshot.positions.map((position) => ({
        symbol: position.symbol,
        quantity: position.quantity,
        avgPrice: position.avgPrice,
        currentPrice: position.currentPrice,
        sector: position.sector,
        marketValue: position.marketValue ?? position.currentPrice * position.quantity,
        unrealizedPnl:
          position.unrealizedPnl ?? (position.currentPrice - position.avgPrice) * position.quantity,
        unrealizedPnlPercent:
          position.unrealizedPnlPercent ??
          (position.avgPrice === 0
            ? 0
            : ((position.currentPrice - position.avgPrice) / position.avgPrice) * 100),
      })),
      sectorValues: snapshot.sectorValues,
    },
  };
}

function buildMockChatContext(stocks: Stock[], buyingPower?: number): PortfolioChatContextValue {
  const data = buildPortfolioData(stocks, { buyingPower });
>>>>>>> Stashed changes
  return {
    asOf: new Date().toISOString(),
    baseCurrency: 'USD',
    source: 'paper',
    broker: broker ?? {
      id: 'mock',
      status: 'disconnected',
      name: 'Paper Portfolio',
    },
    summary: {
      totalValue: data.totalValue,
      pnl: data.pnl,
      pnlPercent: data.pnlPercent,
      dailyPnl: data.dailyPnl,
      dailyPnlPercent: data.dailyPnlPercent,
      marginUsage: data.marginUsage,
      buyingPower: data.buyingPower,
    },
    positions: stocks.map((stock) => ({
      symbol: stock.symbol,
      quantity: stock.quantity,
      avgPrice: stock.avgPrice,
      currentPrice: stock.currentPrice,
      sector: stock.sector,
      marketValue: stock.currentPrice * stock.quantity,
      unrealizedPnl: (stock.currentPrice - stock.avgPrice) * stock.quantity,
      unrealizedPnlPercent:
        stock.avgPrice === 0 ? 0 : ((stock.currentPrice - stock.avgPrice) / stock.avgPrice) * 100,
    })),
    sectorValues: data.sectorValues,
  };
}

<<<<<<< Updated upstream
function mapPortfolioSnapshot(snapshot: PortfolioApiSnapshot): PortfolioMappedSnapshot {
  const source = snapshot.source === 'backend' ? 'backend' : 'paper';
  return {
    stocks: mapPositionsToStocks(snapshot.positions),
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
    chatContext: {
      asOf: snapshot.asOf ?? new Date().toISOString(),
      baseCurrency: snapshot.baseCurrency ?? 'USD',
      source,
      broker: snapshot.broker ?? {
        id: 'mock',
        status: 'disconnected',
        name: 'Paper Portfolio',
      },
      summary: snapshot.summary,
      positions: snapshot.positions.map((position) => ({
        symbol: position.symbol,
        quantity: position.quantity,
        avgPrice: position.avgPrice,
        currentPrice: position.currentPrice,
        sector: position.sector,
        marketValue: position.marketValue ?? position.currentPrice * position.quantity,
        unrealizedPnl:
          position.unrealizedPnl ?? (position.currentPrice - position.avgPrice) * position.quantity,
        unrealizedPnlPercent:
          position.unrealizedPnlPercent ??
          (position.avgPrice === 0
            ? 0
            : ((position.currentPrice - position.avgPrice) / position.avgPrice) * 100),
      })),
      sectorValues: snapshot.sectorValues,
=======
function buildPortfolioData(
  stocks: Stock[],
  options?: { buyingPower?: number | null },
): PortfolioDerivedData {
  const totalValue = stocks.reduce((sum, stock) => sum + stock.currentPrice * stock.quantity, 0);
  const totalCost = stocks.reduce((sum, stock) => sum + stock.avgPrice * stock.quantity, 0);
  const pnl = totalValue - totalCost;
  const pnlPercent = totalCost > 0 ? (pnl / totalCost) * 100 : 0;

  const dailyPnl = totalValue * 0.012;
  const dailyPnlPercent = 1.2;
  const marginUsage = totalValue * 0.25;
  const buyingPower =
    typeof options?.buyingPower === 'number' && Number.isFinite(options.buyingPower)
      ? Math.max(0, options.buyingPower)
      : totalValue * 0.15;

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

  const positions = stocks
    .map((stock) => {
      const marketValue = stock.currentPrice * stock.quantity;
      const costBasis = stock.avgPrice * stock.quantity;
      const unrealizedPnl = marketValue - costBasis;
      const unrealizedPnlPercent = costBasis === 0 ? 0 : (unrealizedPnl / costBasis) * 100;
      const dailyMovePercent = Number((unrealizedPnlPercent / 8).toFixed(2));
      return {
        id: stock.id,
        symbol: stock.symbol,
        quantity: stock.quantity,
        avgPrice: stock.avgPrice,
        currentPrice: stock.currentPrice,
        sector: stock.sector,
        marketValue,
        costBasis,
        unrealizedPnl,
        unrealizedPnlPercent,
        dailyMovePercent,
        dailyPnl: marketValue * (dailyMovePercent / 100),
        weightPercent: totalValue > 0 ? (marketValue / totalValue) * 100 : 0,
      };
    })
    .sort((a, b) => b.marketValue - a.marketValue);

  const topMoverPosition =
    positions.length > 0
      ? [...positions].sort(
          (left, right) => Math.abs(right.dailyMovePercent) - Math.abs(left.dailyMovePercent),
        )[0]
      : null;

  const topWeight = positions[0]?.weightPercent ?? 0;
  const techExposure = sectorValues
    .filter((sector) => sector.sector.toLowerCase().includes('tech'))
    .reduce((sum, sector) => sum + sector.percent, 0);

  const healthLabel: PortfolioDerivedData['health']['label'] =
    topWeight >= 45 || techExposure >= 60 ? 'Concentrated' : topWeight >= 30 ? 'Watch' : 'Healthy';
  const topContributor = positions[0];

  return {
    totalValue,
    totalCost,
    pnl,
    pnlPercent,
    dailyPnl,
    dailyPnlPercent,
    marginUsage,
    buyingPower,
    sectorValues,
    history,
    positions,
    topMover: topMoverPosition
      ? {
          symbol: topMoverPosition.symbol,
          movePercent: topMoverPosition.dailyMovePercent,
          dailyPnl: topMoverPosition.dailyPnl,
          directionLabel: topMoverPosition.dailyMovePercent >= 0 ? 'Leading gains' : 'Largest drag',
        }
      : null,
    health: {
      label: healthLabel,
      diversification:
        sectorValues.length >= 4
          ? `${sectorValues.length} sectors represented with ${topWeight.toFixed(0)}% max single-position weight.`
          : `Sector mix is narrow at ${sectorValues.length} sectors; consider broader diversification.`,
      topContributor: topContributor
        ? `${topContributor.symbol} is the largest position at ${topContributor.weightPercent.toFixed(0)}% of portfolio value.`
        : 'No active positions loaded.',
      concentrationRisk:
        healthLabel === 'Concentrated'
          ? `Concentration risk is elevated: largest position ${topWeight.toFixed(0)}%, technology exposure ${techExposure.toFixed(0)}%.`
          : `Concentration risk is manageable with ${topWeight.toFixed(0)}% largest-position weight.`,
>>>>>>> Stashed changes
    },
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
  const baseline = data[0]?.value ?? 0;
  const latest = data[data.length - 1]?.value ?? 0;
  const chartColor = latest >= baseline ? 'var(--emerald-500)' : 'var(--rose-500)';

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

<<<<<<< Updated upstream
function PortfolioSourceBadge({ source, label }: { source: PortfolioWidgetSource; label: string }) {
=======
function AllocationDonut({ data }: { data: PortfolioDerivedData['sectorValues'] }) {
  return (
    <ChartContainer
      config={Object.fromEntries(
        data.map((sector, index) => [
          sector.sector,
          { label: sector.sector, color: DONUT_COLORS[index % DONUT_COLORS.length] },
        ]),
      )}
      className="h-[136px] w-full"
    >
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="sector"
          innerRadius={28}
          outerRadius={56}
          paddingAngle={2}
          strokeWidth={0}
        >
          {data.map((sector, index) => (
            <Cell key={sector.sector} fill={DONUT_COLORS[index % DONUT_COLORS.length]} />
          ))}
        </Pie>
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(_, __, item) => {
                const payload = item.payload as { sector: string; value: number; percent: number };
                return (
                  <div className="flex w-full items-center justify-between gap-3">
                    <span>{payload.sector}</span>
                    <span className="font-mono">
                      {payload.percent.toFixed(1)}% / {formatCurrency(payload.value)}
                    </span>
                  </div>
                );
              }}
            />
          }
        />
      </PieChart>
    </ChartContainer>
  );
}

function CompactStat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2">
      <div className="text-[9px] uppercase tracking-[0.18em] text-slate-400">{label}</div>
      <div className={`mt-1 text-sm font-semibold ${tone ?? 'text-slate-900'}`}>{value}</div>
    </div>
  );
}

function PaperPortfolioEditor({
  stocks,
  buyingPower,
  onClose,
  onBuyingPowerChange,
  onChange,
  onAdd,
  onRemove,
  onSave,
  saveStatus,
  saveErrorMessage,
}: {
  stocks: Stock[];
  buyingPower: number;
  onClose: () => void;
  onBuyingPowerChange: (value: string) => void;
  onChange: (id: string, field: keyof Stock, value: string) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onSave: () => void;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  saveErrorMessage: string | null;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">Edit Paper Portfolio</div>
          <div className="text-xs text-slate-500">
            Adjust positions and buying power, then save to backend.
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          <X size={14} />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-[minmax(0,1fr)_140px] gap-3 rounded-xl border border-slate-100 bg-slate-50/40 p-3">
        <div>
          <div className="text-[9px] uppercase tracking-[0.18em] text-slate-400">Paper Cash</div>
          <div className="mt-1 text-xs text-slate-500">
            Saved with the mock portfolio and restored on load.
          </div>
        </div>
        <label className="space-y-1">
          <div className="text-[9px] uppercase tracking-[0.18em] text-slate-400">Buying Power</div>
          <input
            value={buyingPower}
            onChange={(event) => onBuyingPowerChange(event.target.value)}
            className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-right text-xs outline-none focus:border-slate-400"
          />
        </label>
      </div>

      <div className="mt-3 flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="grid grid-cols-[minmax(84px,1fr)_64px_72px_72px_minmax(88px,0.9fr)_32px] gap-2 px-1 text-[9px] uppercase tracking-[0.18em] text-slate-400">
          <span className="truncate">Symbol</span>
          <span className="text-center">Qty</span>
          <span className="text-center">Avg</span>
          <span className="text-center">Price</span>
          <span className="truncate">Sector</span>
          <span />
        </div>
        <div className="mt-2 flex-1 space-y-2 overflow-y-auto pr-1">
          {stocks.map((stock) => (
            <div
              key={stock.id}
              className="grid grid-cols-[minmax(84px,1fr)_64px_72px_72px_minmax(88px,0.9fr)_32px] gap-2 rounded-xl border border-slate-100 bg-slate-50/40 p-2"
            >
              <input
                value={stock.symbol}
                onChange={(event) => onChange(stock.id, 'symbol', event.target.value)}
                className="min-w-0 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs uppercase outline-none focus:border-slate-400"
              />
              <input
                value={stock.quantity}
                onChange={(event) => onChange(stock.id, 'quantity', event.target.value)}
                className="min-w-0 rounded-md border border-slate-200 bg-white px-2 py-1 text-center text-xs outline-none focus:border-slate-400"
              />
              <input
                value={stock.avgPrice}
                onChange={(event) => onChange(stock.id, 'avgPrice', event.target.value)}
                className="min-w-0 rounded-md border border-slate-200 bg-white px-2 py-1 text-center text-xs outline-none focus:border-slate-400"
              />
              <input
                value={stock.currentPrice}
                onChange={(event) => onChange(stock.id, 'currentPrice', event.target.value)}
                className="min-w-0 rounded-md border border-slate-200 bg-white px-2 py-1 text-center text-xs outline-none focus:border-slate-400"
              />
              <input
                value={stock.sector}
                onChange={(event) => onChange(stock.id, 'sector', event.target.value)}
                className="min-w-0 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs outline-none focus:border-slate-400"
              />
              <button
                onClick={() => onRemove(stock.id)}
                className="flex h-8 w-8 items-center justify-center self-center rounded-md p-0 text-slate-400 hover:bg-white hover:text-rose-600"
                title="Remove position"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
        <button
          onClick={onAdd}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          <Plus size={12} />
          Add Stock
        </button>
        <button
          onClick={onSave}
          disabled={saveStatus === 'saving'}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {saveStatus === 'saving' ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Save size={12} />
          )}
          {saveStatus === 'saved' ? 'Saved' : 'Save Portfolio'}
        </button>
      </div>
      {saveStatus === 'error' && saveErrorMessage ? (
        <div className="mt-2 text-[11px] text-rose-600">{saveErrorMessage}</div>
      ) : null}
    </div>
  );
}

function PortfolioSourceBadge({
  source,
  brokerName,
}: {
  source: 'backend' | 'demo';
  brokerName?: string;
}) {
  const label = source === 'backend' ? (brokerName ?? 'Live') : 'Mock';
>>>>>>> Stashed changes
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-medium tracking-wide ${
        source === 'backend' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
      }`}
      title={source === 'backend' ? `Live ${label} portfolio` : 'Backend-stored paper portfolio'}
    >
      {label}
    </span>
  );
}

function BrokerConnectionPanel({
  onBack,
  onConnected,
  onUsePaperPortfolio,
  selectedBroker,
  initialConnection,
  onBrokerChange,
}: {
  onBack: () => void;
  onConnected: () => Promise<void>;
<<<<<<< Updated upstream
  onUsePaperPortfolio: () => Promise<void>;
=======
  onUseMockData: () => Promise<void>;
>>>>>>> Stashed changes
  selectedBroker: PortfolioBrokerOption;
  initialConnection: PortfolioApiSnapshot['broker'];
  onBrokerChange: (broker: PortfolioBrokerOption) => void;
}) {
  const [connecting, setConnecting] = useState(false);
  const [selectedBrokerState, setSelectedBrokerState] =
    useState<PortfolioBrokerOption>(selectedBroker);
  const [host, setHost] = useState('127.0.0.1');
  const [port, setPort] = useState('7497');
  const [clientId, setClientId] = useState('1');
  const [market, setMarket] = useState('US');
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [testnet, setTestnet] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const selectedOption = getBrokerOption(selectedBrokerState);

  useEffect(() => {
<<<<<<< Updated upstream
    void (async () => {
      const settings = initialConnection?.settings ?? {};
      const brokerId = initialConnection?.id ?? selectedBroker;
      setSelectedBrokerState(brokerId);
      setHost(String(initialConnection?.host ?? settings.host ?? '127.0.0.1'));
      setPort(
        String(initialConnection?.port ?? settings.port ?? (brokerId === 'futu' ? 11111 : 7497)),
      );
      setClientId(String(initialConnection?.clientId ?? settings.clientId ?? 1));
      setMarket(String(initialConnection?.market ?? settings.market ?? 'US'));
      setApiKey('');
      setApiSecret('');
      setTestnet(Boolean(initialConnection?.testnet ?? settings.testnet ?? true));
      setError(initialConnection?.lastError ?? null);
    })();
  }, [initialConnection, selectedBroker]);
=======
    const settings = initialConnection?.settings ?? {};
    const brokerId = initialConnection?.id ?? selectedBroker;
    setSelectedBrokerState(brokerId);
    setHost(String(initialConnection?.host ?? settings.host ?? '127.0.0.1'));
    setPort(
      String(initialConnection?.port ?? settings.port ?? (brokerId === 'futu' ? 11111 : 7497)),
    );
    setClientId(String(initialConnection?.clientId ?? settings.clientId ?? 1));
    setMarket(String(initialConnection?.market ?? settings.market ?? 'US'));
    setApiKey('');
    setApiSecret('');
    setTestnet(Boolean(initialConnection?.testnet ?? settings.testnet ?? true));
    setError(initialConnection?.lastError ?? null);
  }, []);
>>>>>>> Stashed changes

  const handleConnect = async () => {
    setError(null);
    setConnecting(true);

    if (selectedBrokerState === 'mock') {
<<<<<<< Updated upstream
      setConnecting(true);
      try {
        await onUsePaperPortfolio();
        onBack();
      } catch (connectError) {
        setError(
          connectError instanceof Error ? connectError.message : 'Unable to use paper portfolio',
=======
      try {
        await onUseMockData();
        onBack();
      } catch (connectError) {
        setError(
          connectError instanceof Error
            ? connectError.message
            : 'Unable to switch to mock portfolio',
>>>>>>> Stashed changes
        );
      } finally {
        setConnecting(false);
      }
      return;
    }

    try {
      const payload =
        selectedBrokerState === 'ibkr'
          ? { broker: selectedBrokerState, host, port: Number(port), clientId: Number(clientId) }
          : selectedBrokerState === 'futu'
            ? { broker: selectedBrokerState, host, port: Number(port), market }
            : { broker: selectedBrokerState, apiKey, apiSecret, testnet };
      const response = await fetch(portfolioApiUrl('/api/portfolio/connect'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
          detail?: string;
        } | null;
        throw new Error(
<<<<<<< Updated upstream
          payload?.detail ?? payload?.error ?? `Broker connection API returned ${response.status}`,
=======
          payload?.detail ?? payload?.error ?? `IBKR connection API returned ${response.status}`,
>>>>>>> Stashed changes
        );
      }
      onBrokerChange(selectedBrokerState);
      await onConnected();
      onBack();
    } catch (connectError) {
      setError(
        connectError instanceof Error ? connectError.message : 'Unable to connect to broker',
      );
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-center gap-3 border-b border-slate-50 py-3">
        <button onClick={onBack} className="text-slate-400 transition-colors hover:text-slate-900">
          <ArrowLeft size={16} />
        </button>
        <div className="text-[11px] font-medium uppercase tracking-tight text-slate-500">
          Broker Connection
        </div>
      </div>
<<<<<<< Updated upstream
      <div className="flex-1 space-y-4 py-5">
=======
      <div className="flex-1 py-5 space-y-4">
>>>>>>> Stashed changes
        <div className="grid grid-cols-2 gap-2">
          {BROKER_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                setSelectedBrokerState(option.id);
                setError(null);
              }}
              className={`rounded-lg border px-3 py-2 text-xs transition-colors ${
                selectedBrokerState === option.id
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <div>{option.label}</div>
              <div className="text-[9px] opacity-70">{option.description}</div>
            </button>
          ))}
        </div>
<<<<<<< Updated upstream

=======
>>>>>>> Stashed changes
        {selectedBrokerState === 'ibkr' && (
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <div className="text-[10px] uppercase text-slate-400">Host</div>
              <input
                type="text"
                value={host}
                onChange={(event) => setHost(event.target.value)}
                className="w-full border-b border-slate-200 py-1 text-xs outline-none focus:border-slate-900"
              />
            </div>
            <div className="space-y-1">
              <div className="text-[10px] uppercase text-slate-400">Port</div>
              <input
                type="text"
                value={port}
                onChange={(event) => setPort(event.target.value)}
                className="w-full border-b border-slate-200 py-1 text-xs outline-none focus:border-slate-900"
              />
            </div>
            <div className="space-y-1">
              <div className="text-[10px] uppercase text-slate-400">Client ID</div>
              <input
                type="text"
                value={clientId}
                onChange={(event) => setClientId(event.target.value)}
                className="w-full border-b border-slate-200 py-1 text-xs outline-none focus:border-slate-900"
              />
            </div>
          </div>
        )}

        {selectedBrokerState === 'futu' && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="text-[10px] uppercase text-slate-400">Host</div>
              <input
                type="text"
                value={host}
                onChange={(event) => setHost(event.target.value)}
                className="w-full border-b border-slate-200 py-1 text-xs outline-none focus:border-slate-900"
              />
            </div>
            <div className="space-y-1">
              <div className="text-[10px] uppercase text-slate-400">Port</div>
              <input
                type="text"
                value={port}
                onChange={(event) => setPort(event.target.value)}
                className="w-full border-b border-slate-200 py-1 text-xs outline-none focus:border-slate-900"
              />
            </div>
            <div className="space-y-1">
              <div className="text-[10px] uppercase text-slate-400">Market</div>
              <input
                type="text"
                value={market}
                onChange={(event) => setMarket(event.target.value)}
                className="w-full border-b border-slate-200 py-1 text-xs outline-none focus:border-slate-900"
              />
            </div>
          </div>
        )}

        {selectedBrokerState === 'binance' && (
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1">
              <div className="text-[10px] uppercase text-slate-400">API Key</div>
              <input
                type="password"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                className="w-full border-b border-slate-200 py-1 text-xs outline-none focus:border-slate-900"
              />
            </div>
            <div className="col-span-2 space-y-1">
              <div className="text-[10px] uppercase text-slate-400">API Secret</div>
              <input
                type="password"
                value={apiSecret}
                onChange={(event) => setApiSecret(event.target.value)}
                className="w-full border-b border-slate-200 py-1 text-xs outline-none focus:border-slate-900"
              />
            </div>
            <label className="col-span-2 flex items-center gap-2 text-[11px] text-slate-500">
              <input
                type="checkbox"
                checked={testnet}
                onChange={(event) => setTestnet(event.target.checked)}
              />
              Testnet
            </label>
          </div>
        )}
<<<<<<< Updated upstream

        {error && <div className="text-[11px] leading-4 text-rose-600">{error}</div>}

=======
        {selectedBrokerState !== 'ibkr' &&
          selectedBrokerState !== 'futu' &&
          selectedBrokerState !== 'binance' &&
          selectedBrokerState !== 'mock' && (
            <div className="text-[11px] text-slate-500 leading-4">
              {selectedOption?.label} is not configured.
            </div>
          )}
        {error && <div className="text-[11px] text-rose-600 leading-4">{error}</div>}
>>>>>>> Stashed changes
        <button
          onClick={handleConnect}
          disabled={connecting}
          className="flex w-full items-center justify-center gap-2 bg-slate-900 py-2.5 text-xs text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {connecting ? <Loader2 size={12} className="animate-spin" /> : <Lock size={12} />}
          {selectedBrokerState === 'mock'
            ? 'Use Paper Portfolio'
            : connecting
              ? 'Syncing...'
              : `Connect ${selectedOption?.label ?? 'Broker'}`}
        </button>

        {selectedBrokerState !== 'mock' && (
          <button
<<<<<<< Updated upstream
            onClick={async () => {
              setConnecting(true);
              setError(null);
              try {
                await onUsePaperPortfolio();
                onBack();
              } catch (connectError) {
                setError(
                  connectError instanceof Error
                    ? connectError.message
                    : 'Unable to use paper portfolio',
                );
              } finally {
                setConnecting(false);
              }
=======
            onClick={() => {
              void (async () => {
                try {
                  setConnecting(true);
                  setError(null);
                  await onUseMockData();
                  onBack();
                } catch (connectError) {
                  setError(
                    connectError instanceof Error
                      ? connectError.message
                      : 'Unable to switch to mock portfolio',
                  );
                } finally {
                  setConnecting(false);
                }
              })();
>>>>>>> Stashed changes
            }}
            disabled={connecting}
            className="w-full border border-slate-200 bg-white py-2.5 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Use Paper Portfolio
          </button>
        )}
      </div>
    </div>
  );
}

<<<<<<< Updated upstream
function PortfolioEditorPanel({
  initialName,
  initialStocks,
  saveStatus,
  isLiveSnapshot,
  onBack,
  onSave,
}: {
  initialName: string;
  initialStocks: Stock[];
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  isLiveSnapshot: boolean;
  onBack: () => void;
  onSave: (payload: { name: string; positions: Stock[] }) => Promise<void>;
}) {
  const [name, setName] = useState(initialName);
  const [draftStocks, setDraftStocks] = useState<Stock[]>(initialStocks);
  const [error, setError] = useState<string | null>(null);

  const updateStock = (stockId: string, patch: Partial<Stock>) => {
    setDraftStocks((current) =>
      current.map((stock) => (stock.id === stockId ? { ...stock, ...patch } : stock)),
    );
  };

  const addStock = () => {
    setDraftStocks((current) => [
      ...current,
      {
        id: `draft-${Date.now()}-${current.length + 1}`,
        symbol: '',
        quantity: 0,
        avgPrice: 0,
        currentPrice: 0,
        sector: 'Uncategorized',
      },
    ]);
  };

  const removeStock = (stockId: string) => {
    setDraftStocks((current) => current.filter((stock) => stock.id !== stockId));
  };

  const handleSave = async () => {
    setError(null);
    try {
      await onSave({
        name,
        positions: draftStocks.map((stock) => ({
          ...stock,
          symbol: stock.symbol.trim().toUpperCase(),
          sector: stock.sector.trim() || 'Uncategorized',
        })),
      });
      onBack();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save portfolio');
    }
  };

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-center gap-3 border-b border-slate-50 py-3">
        <button onClick={onBack} className="text-slate-400 transition-colors hover:text-slate-900">
          <ArrowLeft size={16} />
        </button>
        <div>
          <div className="text-[11px] font-medium uppercase tracking-tight text-slate-500">
            Paper Portfolio Editor
          </div>
          {isLiveSnapshot && (
            <div className="text-[10px] text-slate-400">
              Live broker data is active. Saved edits will appear when you switch back to Paper
              Portfolio.
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto py-4">
        <div className="space-y-1">
          <div className="text-[10px] uppercase text-slate-400">Portfolio Name</div>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </div>

        <div className="space-y-3">
          {draftStocks.map((stock) => (
            <div key={stock.id} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                  Position
                </div>
                <button
                  type="button"
                  onClick={() => removeStock(stock.id)}
                  className="text-slate-300 transition-colors hover:text-rose-600"
                  title="Remove position"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                <label className="space-y-1">
                  <span className="text-[10px] uppercase text-slate-400">Symbol</span>
                  <input
                    type="text"
                    value={stock.symbol}
                    onChange={(event) => updateStock(stock.id, { symbol: event.target.value })}
                    className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs uppercase outline-none focus:border-slate-900"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[10px] uppercase text-slate-400">Quantity</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={stock.quantity}
                    onChange={(event) =>
                      updateStock(stock.id, {
                        quantity: event.target.value === '' ? 0 : Number(event.target.value),
                      })
                    }
                    className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs outline-none focus:border-slate-900"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[10px] uppercase text-slate-400">Avg Price</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={stock.avgPrice}
                    onChange={(event) =>
                      updateStock(stock.id, {
                        avgPrice: event.target.value === '' ? 0 : Number(event.target.value),
                      })
                    }
                    className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs outline-none focus:border-slate-900"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[10px] uppercase text-slate-400">Current Price</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={stock.currentPrice}
                    onChange={(event) =>
                      updateStock(stock.id, {
                        currentPrice: event.target.value === '' ? 0 : Number(event.target.value),
                      })
                    }
                    className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs outline-none focus:border-slate-900"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[10px] uppercase text-slate-400">Sector</span>
                  <input
                    type="text"
                    value={stock.sector}
                    onChange={(event) => updateStock(stock.id, { sector: event.target.value })}
                    className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs outline-none focus:border-slate-900"
                  />
                </label>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addStock}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 py-2 text-xs text-slate-600 transition-colors hover:border-slate-900 hover:text-slate-900"
        >
          <Plus size={14} />
          Add Position
        </button>

        {error && <div className="text-[11px] text-rose-600">{error}</div>}
        {saveStatus === 'saved' && (
          <div className="text-[11px] text-emerald-600">Portfolio saved.</div>
        )}
        {saveStatus === 'error' && !error && (
          <div className="text-[11px] text-rose-600">Unable to save portfolio.</div>
        )}
      </div>

      <div className="border-t border-slate-50 py-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saveStatus === 'saving'}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 py-2.5 text-xs text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
        >
          {saveStatus === 'saving' ? (
            <Loader2 size={12} className="animate-spin" />
          ) : saveStatus === 'saved' ? (
            <Check size={12} />
          ) : (
            <Save size={12} />
          )}
          {saveStatus === 'saving' ? 'Saving...' : 'Save Paper Portfolio'}
        </button>
=======
function PortfolioWidgetPnlTile({
  data,
  source,
  liveBrokerLabel,
  onOpenSettings,
}: PortfolioVariantProps) {
  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-white">
      <div className="flex w-full items-center justify-between">
        <PortfolioSourceBadge
          source={source}
          brokerName={source === 'backend' ? liveBrokerLabel : undefined}
        />
        <button onClick={onOpenSettings} className="text-slate-200 hover:text-slate-400">
          <Settings size={12} />
        </button>
      </div>
      <div className="flex flex-1 items-center justify-center">
        <div className="mx-auto flex w-[10.5rem] max-w-full -translate-y-2 flex-col items-center justify-center text-center">
          <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Day P/L</div>
          <div
            className={`mt-2 text-2xl font-semibold tracking-tight ${percentClass(data.dailyPnl)}`}
          >
            {data.dailyPnl >= 0 ? '+' : ''}
            {formatCurrency(data.dailyPnl)}
          </div>
          <div className={`mt-1 text-sm font-medium ${percentClass(data.dailyPnlPercent)}`}>
            {data.dailyPnlPercent >= 0 ? '+' : ''}
            {data.dailyPnlPercent.toFixed(1)}%
          </div>
        </div>
>>>>>>> Stashed changes
      </div>
    </div>
  );
}

<<<<<<< Updated upstream
function PortfolioWidgetSmall({
  data,
  source,
  sourceLabel,
  onOpenSettings,
  onOpenEditor,
}: PortfolioVariantProps) {
  return (
    <div className="absolute inset-0 bg-white">
      <div className="absolute left-0 top-0 z-10">
        <PortfolioSourceBadge source={source} label={sourceLabel} />
      </div>

      <div className="absolute right-0 top-0 z-10 flex items-center gap-1">
        <button
          onClick={onOpenEditor}
          className="text-slate-200 transition-colors hover:text-slate-400"
        >
          <Pencil size={12} />
        </button>
        <button
          onClick={onOpenSettings}
          className="text-slate-200 transition-colors hover:text-slate-400"
        >
          <Settings size={12} />
        </button>
      </div>

      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
        <div className={`text-xl font-medium tracking-tight ${percentClass(data.pnlPercent)}`}>
          {data.pnlPercent >= 0 ? '+' : ''}
          {data.pnlPercent.toFixed(1)}%
        </div>
        <div className="mt-0.5 text-[10px] text-slate-400">{formatCurrency(data.pnl)}</div>
=======
function PortfolioWidgetTopMoverTile({
  stocks,
  data,
  source,
  liveBrokerLabel,
  onOpenSettings,
}: PortfolioVariantProps) {
  const topMover =
    data.topMover ??
    (stocks[0]
      ? {
          symbol: stocks[0].symbol,
          movePercent: 0,
          dailyPnl: 0,
          directionLabel: 'No move',
        }
      : null);

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-white px-3">
      <div className="flex w-full items-center justify-between">
        <PortfolioSourceBadge
          source={source}
          brokerName={source === 'backend' ? liveBrokerLabel : undefined}
        />
        <button onClick={onOpenSettings} className="text-slate-200 hover:text-slate-400">
          <Settings size={12} />
        </button>
      </div>
      <div className="flex flex-1 items-center justify-center">
        <div className="mx-auto flex w-[10.5rem] max-w-full -translate-y-2 flex-col items-center justify-center text-center">
          <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Top Mover</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">
            {topMover?.symbol ?? '--'}
          </div>
          <div className={`mt-1 text-xl font-medium ${percentClass(topMover?.movePercent ?? 0)}`}>
            {(topMover?.movePercent ?? 0) >= 0 ? '+' : ''}
            {(topMover?.movePercent ?? 0).toFixed(2)}%
          </div>
          <div className="mt-1 text-xs text-slate-400">{topMover?.directionLabel}</div>
          <div className={`mt-1 text-base font-medium ${percentClass(topMover?.dailyPnl ?? 0)}`}>
            {(topMover?.dailyPnl ?? 0) >= 0 ? '+' : ''}
            {formatCurrency(topMover?.dailyPnl ?? 0)}
          </div>
        </div>
>>>>>>> Stashed changes
      </div>
    </div>
  );
}

function PortfolioWidgetMedium({
  stocks,
  data,
  source,
  sourceLabel,
  onOpenSettings,
  onOpenEditor,
}: PortfolioVariantProps) {
  return (
    <div className="flex h-full w-full min-w-0 flex-col overflow-hidden bg-white">
      <div className="flex items-center justify-between py-2.5">
<<<<<<< Updated upstream
        <PortfolioSourceBadge source={source} label={sourceLabel} />
=======
        <div className="flex items-center gap-2">
          <PortfolioSourceBadge
            source={source}
            brokerName={source === 'backend' ? liveBrokerLabel : undefined}
          />
        </div>
>>>>>>> Stashed changes
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenEditor}
            className="text-slate-300 transition-colors hover:text-slate-500"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={onOpenSettings}
            className="text-slate-300 transition-colors hover:text-slate-500"
          >
            <Settings size={14} />
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between border-b border-slate-50 py-3">
        <div>
          <div className="mb-0.5 text-[9px] uppercase text-slate-400">Total Value</div>
<<<<<<< Updated upstream
          <div className="text-lg font-medium text-slate-900">
            {formatCurrency(data.totalValue)}
          </div>
=======
          <div className="text-lg font-medium text-slate-900">{formatCurrency(data.totalValue)}</div>
>>>>>>> Stashed changes
        </div>
        <div className="w-24">
          <PerformanceChart data={data.history} height={32} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
<<<<<<< Updated upstream
        {stocks.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400">
            No positions yet. Open the editor to build your paper portfolio.
=======
        {stocks.map((stock) => (
          <div
            key={stock.id}
            className="flex items-center justify-between border-b border-slate-50 px-1 py-2 transition-colors last:border-0 hover:bg-slate-50"
          >
            <div className="flex flex-col">
              <div className="text-xs font-bold text-slate-800">{stock.symbol}</div>
              <div className="text-[8px] uppercase tracking-tighter text-slate-400">
                {stock.quantity} shs
              </div>
            </div>
            <div className="flex flex-col items-end">
              <div
                className={`text-[10px] font-bold ${percentClass(stock.currentPrice - stock.avgPrice)}`}
              >
                {formatCurrency(stock.currentPrice, 1)}
              </div>
              <div className="font-mono text-[8px] text-slate-400">
                Avg: {formatCurrency(stock.avgPrice, 0)}
              </div>
            </div>
>>>>>>> Stashed changes
          </div>
        ) : (
          stocks.map((stock) => (
            <div
              key={stock.id}
              className="flex items-center justify-between border-b border-slate-50 px-1 py-2 transition-colors last:border-0 hover:bg-slate-50"
            >
              <div className="flex flex-col">
                <div className="text-xs font-bold text-slate-800">{stock.symbol}</div>
                <div className="text-[8px] uppercase tracking-tighter text-slate-400">
                  {stock.quantity} shs
                </div>
              </div>
              <div className="flex flex-col items-end">
                <div
                  className={`text-[10px] font-bold ${percentClass(stock.currentPrice - stock.avgPrice)}`}
                >
                  {formatCurrency(stock.currentPrice, 1)}
                </div>
                <div className="text-[8px] font-mono text-slate-400">
                  Avg: {formatCurrency(stock.avgPrice, 0)}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function PortfolioWidgetFull({
  stocks,
  data,
  source,
<<<<<<< Updated upstream
  sourceLabel,
  onOpenSettings,
  onOpenEditor,
=======
  liveBrokerLabel,
  saveStatus,
  saveErrorMessage,
  isEditingPaperPortfolio,
  paperBuyingPower,
  onOpenSettings,
  onSavePaperPortfolio,
  onOpenPaperEditor,
  onClosePaperEditor,
  onPaperBuyingPowerChange,
  onPaperStockChange,
  onAddPaperStock,
  onRemovePaperStock,
>>>>>>> Stashed changes
}: PortfolioVariantProps) {
  if (isEditingPaperPortfolio) {
    return (
      <PaperPortfolioEditor
        stocks={stocks}
        buyingPower={paperBuyingPower}
        onClose={onClosePaperEditor}
        onBuyingPowerChange={onPaperBuyingPowerChange}
        onChange={onPaperStockChange}
        onAdd={onAddPaperStock}
        onRemove={onRemovePaperStock}
        onSave={onSavePaperPortfolio}
        saveStatus={saveStatus}
        saveErrorMessage={saveErrorMessage}
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-white text-slate-900">
<<<<<<< Updated upstream
      <div className="flex items-center justify-between border-b border-slate-50 py-3">
        <PortfolioSourceBadge source={source} label={sourceLabel} />
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenEditor}
            className="text-slate-300 transition-colors hover:text-slate-600"
            title="Edit paper portfolio"
=======
      <div className="flex items-center justify-between border-b border-slate-50 py-2.5">
        <div className="flex items-center gap-2">
          <PortfolioSourceBadge
            source={source}
            brokerName={source === 'backend' ? liveBrokerLabel : undefined}
          />
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-medium text-slate-600">
            {data.health.label}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenPaperEditor}
            className="text-slate-300 hover:text-slate-600 transition-colors"
            title="Edit paper portfolio"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={onSavePaperPortfolio}
            disabled={saveStatus === 'saving'}
            className="text-slate-300 hover:text-slate-600 disabled:opacity-50 transition-colors"
            title="Save paper portfolio"
>>>>>>> Stashed changes
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={onOpenSettings}
<<<<<<< Updated upstream
            className="text-slate-300 transition-colors hover:text-slate-600"
            title="Broker settings"
=======
            className="text-slate-300 hover:text-slate-600 transition-colors"
            title="Connect / disconnect / sync settings"
>>>>>>> Stashed changes
          >
            <Settings size={14} />
          </button>
        </div>
      </div>
      {saveStatus === 'error' && saveErrorMessage ? (
        <div className="border-b border-slate-50 pb-2 text-[11px] text-rose-600">
          {saveErrorMessage}
        </div>
      ) : null}

<<<<<<< Updated upstream
      <div className="grid grid-cols-4 gap-4 border-b border-slate-50 bg-slate-50/40 px-1 py-4">
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
        ].map((metric) => (
          <div key={metric.label}>
            <div className="mb-0.5 text-[9px] uppercase tracking-wide text-slate-400">
              {metric.label}
            </div>
            <div className={`text-xs font-semibold ${metric.class || ''}`}>{metric.val}</div>
          </div>
        ))}
      </div>

      <div className="border-b border-slate-50 bg-white py-2">
        <PerformanceChart data={data.history} height={60} showAxis />
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="w-3/5 overflow-y-auto pr-3 scrollbar-thin scrollbar-thumb-slate-100">
          {stocks.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-400">
              No positions yet. Open the editor to build your paper portfolio.
            </div>
          ) : (
            <table className="w-full border-collapse text-left text-[10px]">
              <thead className="sticky top-0 z-10 bg-white text-[8px] uppercase tracking-wider text-slate-400 shadow-[0_1px_0_0_rgba(0,0,0,0.05)]">
                <tr>
                  <th className="bg-white py-2 font-semibold first:pl-0">Instrument</th>
                  <th className="bg-white py-2 text-right font-semibold">Avg</th>
                  <th className="bg-white py-2 text-right font-semibold">Price</th>
                  <th className="bg-white py-2 text-right font-semibold last:pr-0">Return</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {stocks.map((stock) => {
                  const stockPnl =
                    stock.avgPrice === 0 ? 0 : (stock.currentPrice / stock.avgPrice - 1) * 100;
                  return (
                    <tr key={stock.id} className="group transition-colors hover:bg-slate-50/50">
                      <td className="py-2 first:pl-0">
                        <div className="font-bold leading-tight text-slate-900">{stock.symbol}</div>
                        <div className="font-mono text-[8px] tracking-tighter text-slate-400">
                          {stock.quantity} <span className="text-[7px] opacity-70">shs</span>
                        </div>
                      </td>
                      <td className="py-2 text-right font-mono text-[9px] text-slate-400">
                        {formatCurrency(stock.avgPrice, 0)}
                      </td>
                      <td className="py-2 text-right text-[9px] font-bold text-slate-800">
                        {formatCurrency(stock.currentPrice, 0)}
                      </td>
                      <td
                        className={`py-2 text-right text-[9px] font-bold last:pr-0 ${percentClass(stockPnl)}`}
                      >
                        {stockPnl >= 0 ? '+' : ''}
                        {stockPnl.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="w-2/5 overflow-y-auto border-l border-slate-50 bg-slate-50/30 p-3">
          <div className="mb-3 border-b border-slate-100 pb-1 text-[8px] font-bold uppercase tracking-widest text-slate-400">
            Allocation
          </div>
          <div className="space-y-4">
            {data.sectorValues.map((sector) => (
              <div key={sector.sector} className="group">
                <div className="mb-1 flex items-center justify-between text-[8px] font-bold uppercase tracking-tighter text-slate-500">
                  <span className="truncate pr-1 transition-colors group-hover:text-slate-900">
                    {sector.sector}
                  </span>
                  <span className="font-mono">{sector.percent.toFixed(0)}%</span>
                </div>
                <div className="h-1 w-full overflow-hidden rounded-full bg-slate-200/60">
                  <div
                    className="h-full bg-slate-400 transition-all group-hover:bg-slate-700"
                    style={{ width: `${sector.percent}%` }}
                  />
                </div>
              </div>
            ))}
            {data.sectorValues.length === 0 && (
              <div className="text-[10px] text-slate-400">
                Sector allocation will appear after you add positions.
              </div>
            )}
          </div>
        </div>
=======
      <div className="grid grid-cols-5 gap-2 border-b border-slate-50 py-2">
        <CompactStat label="Net Liq" value={formatCurrency(data.totalValue)} />
        <CompactStat label="Cost Basis" value={formatCurrency(data.totalCost)} />
        <CompactStat
          label="Daily P/L"
          value={formatCurrency(data.dailyPnl)}
          tone={percentClass(data.dailyPnl)}
        />
        <CompactStat
          label="Unrealized"
          value={`${data.pnlPercent >= 0 ? '+' : ''}${data.pnlPercent.toFixed(2)}%`}
          tone={percentClass(data.pnl)}
        />
        <CompactStat label="Buying Power" value={formatCurrency(data.buyingPower)} />
      </div>

      <div className="grid grid-cols-[minmax(0,1.25fr)_minmax(220px,0.95fr)] gap-3 border-b border-slate-50 py-2">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-[9px] uppercase tracking-[0.18em] text-slate-400">
                  AI Health
                </div>
                <div className="mt-1 text-xs text-slate-600">{data.health.diversification}</div>
              </div>
              <div className="max-w-[42%] text-right text-[11px] text-slate-500">
                {data.health.concentrationRisk}
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-slate-100 bg-white px-3 py-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[9px] uppercase tracking-[0.18em] text-slate-400">
                  Performance
                </div>
                <div className="mt-1 text-xs text-slate-500">{data.health.topContributor}</div>
              </div>
              <div className="w-36 shrink-0">
                <PerformanceChart data={data.history} height={42} />
              </div>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white px-3 py-2">
          <div className="text-[9px] uppercase tracking-[0.18em] text-slate-400">Allocation</div>
          <div className="mt-2 flex flex-col items-center gap-3">
            <div className="w-[140px] shrink-0">
              <AllocationDonut data={data.sectorValues} />
            </div>
            <div className="w-full space-y-1.5 px-1">
              {data.sectorValues.slice(0, 4).map((sector, index) => (
                <div
                  key={sector.sector}
                  className="flex items-center justify-between gap-3 text-[11px]"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: DONUT_COLORS[index % DONUT_COLORS.length] }}
                    />
                    <span className="text-slate-600">{sector.sector}</span>
                  </div>
                  <span className="font-mono text-slate-500">{sector.percent.toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="w-full overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-100">
          <table className="w-full text-[10px] text-left border-collapse">
            <thead className="sticky top-0 z-10 bg-white shadow-[0_1px_0_0_rgba(0,0,0,0.05)] text-slate-400 uppercase text-[8px] tracking-wider">
              <tr>
                <th className="py-2 font-semibold first:pl-0 bg-white">Instrument</th>
                <th className="py-2 text-right font-semibold bg-white">Qty</th>
                <th className="py-2 text-right font-semibold bg-white">Price</th>
                <th className="py-2 text-right font-semibold bg-white">Unrealized</th>
                <th className="py-2 text-right font-semibold last:pr-0 bg-white">Return</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {data.positions.map((position) => {
                return (
                  <tr key={position.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="py-2 first:pl-0">
                      <div className="font-bold text-slate-900 leading-tight">
                        {position.symbol}
                      </div>
                      <div className="text-[8px] text-slate-400 font-mono tracking-tighter">
                        {position.sector}
                      </div>
                    </td>
                    <td className="py-2 text-right font-mono text-slate-500 text-[9px]">
                      {position.quantity}
                    </td>
                    <td className="py-2 text-right font-bold text-slate-800 text-[9px]">
                      {formatCurrency(position.currentPrice, 0)}
                    </td>
                    <td
                      className={`py-2 text-right font-bold text-[9px] ${percentClass(position.unrealizedPnl)}`}
                    >
                      {position.unrealizedPnl >= 0 ? '+' : ''}
                      {formatCurrency(position.unrealizedPnl)}
                    </td>
                    <td
                      className={`py-2 text-right font-bold last:pr-0 text-[9px] ${percentClass(position.unrealizedPnlPercent)}`}
                    >
                      {position.unrealizedPnlPercent >= 0 ? '+' : ''}
                      {position.unrealizedPnlPercent.toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
>>>>>>> Stashed changes
      </div>
    </div>
  );
}

const PortfolioWidgetRoot = ({
  variant,
  size,
  title = 'Portfolio',
  ...props
}: PortfolioWidgetProps) => {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [backendData, setBackendData] = useState<PortfolioDerivedData | null>(null);
  const [editablePortfolioName, setEditablePortfolioName] = useState('Portfolio Widget Portfolio');
  const [editableStocks, setEditableStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<PortfolioWidgetSource>('paper');
  const [sourceLabel, setSourceLabel] = useState('Paper Portfolio');
  const [panelMode, setPanelMode] = useState<PortfolioPanelMode>(null);
  const [selectedBroker, setSelectedBroker] = useState<PortfolioBrokerOption>('mock');
  const [brokerConnection, setBrokerConnection] = useState<PortfolioApiSnapshot['broker']>({
    id: 'mock',
    status: 'disconnected',
    name: 'Paper Portfolio',
  });
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);
  const [paperPortfolioId, setPaperPortfolioId] = useState<string | null>(null);
  const [paperBuyingPower, setPaperBuyingPower] = useState<number>(
    buildPortfolioData(DEFAULT_STOCKS).buyingPower,
  );
  const [portfolioHealth, setPortfolioHealth] = useState<PortfolioDerivedData['health'] | null>(
    null,
  );
  const [isEditingPaperPortfolio, setIsEditingPaperPortfolio] = useState(false);
  const { setPortfolio } = usePortfolioContext();

  const resolvedVariant = variant ?? size ?? 'full';
  const normalizedVariant: PortfolioVariant =
    resolvedVariant === 'full' ||
    resolvedVariant === 'medium' ||
    resolvedVariant === 'pl-tile' ||
    resolvedVariant === 'top-mover-tile'
      ? resolvedVariant
      : 'full';

<<<<<<< Updated upstream
  const loadPortfolio = useCallback(async () => {
=======
  const useMockData = () => {
    const defaultBuyingPower = buildPortfolioData(DEFAULT_STOCKS).buyingPower;
    setStocks(DEFAULT_STOCKS);
    setBackendData(null);
    setPaperBuyingPower(defaultBuyingPower);
    setPortfolioHealth(null);
    setSaveErrorMessage(null);
    setPortfolio(buildMockChatContext(DEFAULT_STOCKS, defaultBuyingPower));
    setSelectedBroker('mock');
    setBrokerConnection({
      id: 'mock',
      status: 'disconnected',
      name: 'Mock Data',
    });
    setSource('demo');
    setLiveBrokerLabel('Mock');
    setPaperPortfolioId(null);
    setIsEditingPaperPortfolio(false);
    setLoading(false);
  };

  const loadPortfolio = async () => {
>>>>>>> Stashed changes
    try {
      setLoading(true);
      const [snapshotResponse, editableResponse] = await Promise.all([
        fetch(portfolioApiUrl('/api/portfolio'), { headers: { Accept: 'application/json' } }),
        fetch(portfolioApiUrl('/api/portfolio/editable'), {
          headers: { Accept: 'application/json' },
        }),
      ]);

      if (!snapshotResponse.ok) {
        throw new Error(`Portfolio API returned ${snapshotResponse.status}`);
      }

      const snapshot = (await snapshotResponse.json()) as PortfolioApiSnapshot;
      const mappedSnapshot = mapPortfolioSnapshot(snapshot);
      const broker = mappedSnapshot.chatContext.broker;
      const isLiveBroker = snapshot.source === 'backend' && broker.status === 'connected';

      setStocks(mappedSnapshot.stocks);
<<<<<<< Updated upstream
      setBackendData(mappedSnapshot.data);
      setBrokerConnection(broker);
      setSelectedBroker(broker.id ?? 'mock');

=======
      setPaperPortfolioId(snapshot.paperPortfolio?.id ?? null);
      setPaperBuyingPower(mappedSnapshot.data.buyingPower);
      setPortfolioHealth(null);
      setSaveErrorMessage(null);
      const brokerStatus = mappedSnapshot.chatContext.broker.status;
      const brokerId = mappedSnapshot.chatContext.broker.id ?? 'mock';
      const isLiveBroker = brokerStatus === 'connected';
      setBackendData(isLiveBroker ? mappedSnapshot.data : null);
>>>>>>> Stashed changes
      if (isLiveBroker) {
        setSource('backend');
        setSourceLabel(broker.name || 'Live Broker');
        setPortfolio({ ...mappedSnapshot.chatContext, source: 'backend' });
      } else {
<<<<<<< Updated upstream
        setSource('paper');
        setSourceLabel('Paper Portfolio');
        setPortfolio({
          ...buildPaperChatContext(mappedSnapshot.stocks, broker),
          asOf: mappedSnapshot.chatContext.asOf,
          baseCurrency: mappedSnapshot.chatContext.baseCurrency,
        });
=======
        const mockContext = buildMockChatContext(
          mappedSnapshot.stocks,
          mappedSnapshot.data.buyingPower,
        );
        mockContext.broker = mappedSnapshot.chatContext.broker;
        setPortfolio(mockContext);
>>>>>>> Stashed changes
      }

      if (editableResponse.ok) {
        const editable = (await editableResponse.json()) as PortfolioEditableResponse;
        setEditablePortfolioName(editable.name);
        setEditableStocks(mapPositionsToStocks(editable.positions));
      } else {
        setEditablePortfolioName('Portfolio Widget Portfolio');
        setEditableStocks(mappedSnapshot.stocks);
      }
    } catch {
      const emptyData = buildPortfolioData([]);
      setStocks([]);
      setBackendData(emptyData);
      setEditablePortfolioName('Portfolio Widget Portfolio');
      setEditableStocks([]);
      setBrokerConnection({
        id: 'mock',
        status: 'disconnected',
        name: 'Paper Portfolio',
      });
      setSelectedBroker('mock');
      setSource('paper');
      setSourceLabel('Paper Portfolio');
      setPortfolio(buildPaperChatContext([]));
    } finally {
      setLoading(false);
    }
  }, [setPortfolio]);

  const disconnectToMock = async () => {
    const response = await fetch(portfolioApiUrl('/api/portfolio/connect'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ broker: 'mock' }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        detail?: string;
      } | null;
      throw new Error(
        payload?.detail ?? payload?.error ?? `Mock portfolio API returned ${response.status}`,
      );
    }

    await loadPortfolio();
  };

  useEffect(() => {
    queueMicrotask(() => {
      void loadPortfolio();
    });
  }, [loadPortfolio]);

  const activatePaperPortfolio = async () => {
    const response = await fetch(portfolioApiUrl('/api/portfolio/connect'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ broker: 'mock' }),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        detail?: string;
      } | null;
      throw new Error(
        payload?.detail ?? payload?.error ?? `Portfolio API returned ${response.status}`,
      );
    }
    await loadPortfolio();
  };

  const saveEditablePortfolio = async (payload: { name: string; positions: Stock[] }) => {
    setSaveStatus('saving');
    try {
      const response = await fetch(portfolioApiUrl('/api/portfolio/editable'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const errorPayload = (await response.json().catch(() => null)) as {
          error?: string;
          detail?: string;
        } | null;
        throw new Error(
          errorPayload?.detail ??
            errorPayload?.error ??
            `Portfolio API returned ${response.status}`,
        );
      }

      const editable = (await response.json()) as PortfolioEditableResponse;
      setEditablePortfolioName(editable.name);
      setEditableStocks(mapPositionsToStocks(editable.positions));
      await loadPortfolio();
      setSaveStatus('saved');
      window.setTimeout(() => setSaveStatus('idle'), 1600);
    } catch (error) {
      setSaveStatus('error');
      window.setTimeout(() => setSaveStatus('idle'), 1600);
      throw error;
    }
  };

  const basePortfolioData = useMemo(() => {
    const baseData = backendData ?? buildPortfolioData(stocks, { buyingPower: paperBuyingPower });
    if (baseData.topMover && baseData.health.diversification) {
      return baseData;
    }

    return buildPortfolioData(stocks, { buyingPower: baseData.buyingPower });
  }, [backendData, paperBuyingPower, stocks]);

  const portfolioData = useMemo(
    () =>
      portfolioHealth
        ? {
            ...basePortfolioData,
            health: portfolioHealth,
          }
        : basePortfolioData,
    [basePortfolioData, portfolioHealth],
  );

<<<<<<< Updated upstream
=======
  useEffect(() => {
    if (normalizedVariant !== 'full' || loading || isEditingPaperPortfolio || stocks.length === 0) {
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await fetch(portfolioApiUrl('/api/ai/widget/portfolio-health'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            asOf: new Date().toISOString(),
            baseCurrency: 'USD',
            source,
            positions: basePortfolioData.positions.map((position) => ({
              id: position.id,
              symbol: position.symbol,
              quantity: position.quantity,
              avgPrice: position.avgPrice,
              currentPrice: position.currentPrice,
              sector: position.sector,
              marketValue: position.marketValue,
              costBasis: position.costBasis,
              unrealizedPnl: position.unrealizedPnl,
              unrealizedPnlPercent: position.unrealizedPnlPercent,
            })),
            summary: {
              totalValue: basePortfolioData.totalValue,
              totalCost: basePortfolioData.totalCost,
              pnl: basePortfolioData.pnl,
              pnlPercent: basePortfolioData.pnlPercent,
              dailyPnl: basePortfolioData.dailyPnl,
              dailyPnlPercent: basePortfolioData.dailyPnlPercent,
              marginUsage: basePortfolioData.marginUsage,
              buyingPower: basePortfolioData.buyingPower,
            },
            sectorValues: basePortfolioData.sectorValues,
          }),
        });

        if (!response.ok) {
          throw new Error(`Portfolio AI returned ${response.status}`);
        }

        const payload = (await response.json()) as PortfolioHealthApiResponse;
        setPortfolioHealth({
          label: payload.label,
          diversification: payload.diversification,
          topContributor: payload.topContributor,
          concentrationRisk: payload.concentrationRisk,
        });
      } catch {
        if (controller.signal.aborted) {
          return;
        }
        setPortfolioHealth(null);
      }
    }, 450);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [
    basePortfolioData,
    isEditingPaperPortfolio,
    loading,
    normalizedVariant,
    source,
    stocks.length,
  ]);

  const savePaperPortfolio = async () => {
    setSaveStatus('saving');
    setSaveErrorMessage(null);
    try {
      const response = await fetch(portfolioApiUrl('/api/portfolio/paper-portfolio'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: paperPortfolioId ?? undefined,
          name: 'Portfolio Widget Paper Portfolio',
          buyingPower: paperBuyingPower,
          positions: stocks,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
          detail?: string;
        } | null;
        throw new Error(
          payload?.detail ?? payload?.error ?? `Paper portfolio API returned ${response.status}`,
        );
      }

      const payload = (await response.json()) as { id?: string };
      setPaperPortfolioId(payload.id ?? paperPortfolioId);
      setIsEditingPaperPortfolio(false);
      await loadPortfolio();

      setSaveStatus('saved');
      window.setTimeout(() => setSaveStatus('idle'), 1600);
    } catch (error) {
      setSaveErrorMessage(
        error instanceof Error ? error.message : 'Unable to save paper portfolio',
      );
      setSaveStatus('error');
      window.setTimeout(() => setSaveStatus('idle'), 1600);
    }
  };

>>>>>>> Stashed changes
  const variantProps: PortfolioVariantProps = {
    stocks,
    data: portfolioData,
    source,
<<<<<<< Updated upstream
    sourceLabel,
    onOpenSettings: () => setPanelMode('broker'),
    onOpenEditor: () => setPanelMode('editor'),
=======
    liveBrokerLabel: liveBrokerLabel ?? 'IBKR',
    saveStatus,
    saveErrorMessage,
    isEditingPaperPortfolio,
    paperBuyingPower,
    onOpenSettings: () => setShowBrokerPanel(true),
    onSavePaperPortfolio: savePaperPortfolio,
    onOpenPaperEditor: () => {
      setSaveErrorMessage(null);
      setIsEditingPaperPortfolio(true);
    },
    onClosePaperEditor: () => setIsEditingPaperPortfolio(false),
    onPaperBuyingPowerChange: (value) => {
      setPaperBuyingPower(Number(value) || 0);
      setBackendData(null);
      setPortfolioHealth(null);
    },
    onPaperStockChange: (id, field, value) => {
      setStocks((current) =>
        current.map((stock) =>
          stock.id === id
            ? {
                ...stock,
                [field]:
                  field === 'quantity' || field === 'avgPrice' || field === 'currentPrice'
                    ? Number(value) || 0
                    : value,
              }
            : stock,
        ),
      );
      setBackendData(null);
      setPortfolioHealth(null);
    },
    onAddPaperStock: () => {
      setStocks((current) => [
        ...current,
        {
          id: `paper-${Date.now()}`,
          symbol: 'NEW',
          quantity: 0,
          avgPrice: 0,
          currentPrice: 0,
          sector: 'Uncategorized',
        },
      ]);
      setBackendData(null);
      setPortfolioHealth(null);
    },
    onRemovePaperStock: (id) => {
      setStocks((current) => current.filter((stock) => stock.id !== id));
      setBackendData(null);
      setPortfolioHealth(null);
    },
>>>>>>> Stashed changes
  };

  const contextText = [
    `Total Value: $${portfolioData.totalValue.toFixed(2)}`,
    `Unrealized PnL: ${portfolioData.pnlPercent >= 0 ? '+' : ''}${portfolioData.pnlPercent.toFixed(2)}%`,
    `Daily PnL: $${portfolioData.dailyPnl.toFixed(2)}`,
<<<<<<< Updated upstream
    `Positions: ${
      stocks.length > 0
        ? stocks
            .map(
              (stock) => `${stock.symbol} x${stock.quantity} @ $${stock.currentPrice.toFixed(2)}`,
            )
            .join(', ')
        : 'none'
    }`,
=======
    `Positions: ${stocks
      .map((s) => `${s.symbol} ×${s.quantity} @ $${s.currentPrice.toFixed(2)}`)
      .join(', ')}`,
>>>>>>> Stashed changes
  ].join('. ');

  const contextTitle =
    normalizedVariant === 'pl-tile'
      ? 'Portfolio P/L Tile'
      : normalizedVariant === 'top-mover-tile'
        ? 'Portfolio Top Mover Tile'
        : title;

  return (
    <BaseWidget
      title={title}
      {...props}
<<<<<<< Updated upstream
      contextData={{ label: title, text: `Portfolio Snapshot: ${contextText}` }}
=======
      contextData={{ label: contextTitle, text: `Portfolio Snapshot: ${contextText}` }}
>>>>>>> Stashed changes
      className="overflow-hidden"
    >
      {loading ? (
        <div className="flex h-full items-center justify-center space-x-2 text-slate-300">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-[10px] font-medium uppercase tracking-widest">Synchronizing</span>
        </div>
      ) : panelMode === 'broker' ? (
        <BrokerConnectionPanel
          onBack={() => setPanelMode(null)}
          onConnected={loadPortfolio}
<<<<<<< Updated upstream
          onUsePaperPortfolio={activatePaperPortfolio}
=======
          onUseMockData={disconnectToMock}
>>>>>>> Stashed changes
          selectedBroker={selectedBroker}
          initialConnection={brokerConnection}
          onBrokerChange={setSelectedBroker}
        />
      ) : panelMode === 'editor' ? (
        <PortfolioEditorPanel
          key={`${editablePortfolioName}:${JSON.stringify(editableStocks)}`}
          initialName={editablePortfolioName}
          initialStocks={editableStocks}
          saveStatus={saveStatus}
          isLiveSnapshot={source === 'backend'}
          onBack={() => setPanelMode(null)}
          onSave={saveEditablePortfolio}
        />
      ) : (
        <>
          {normalizedVariant === 'medium' && <PortfolioWidgetMedium {...variantProps} />}
          {normalizedVariant === 'pl-tile' && <PortfolioWidgetPnlTile {...variantProps} />}
          {normalizedVariant === 'top-mover-tile' && (
            <PortfolioWidgetTopMoverTile {...variantProps} />
          )}
          {normalizedVariant === 'full' && <PortfolioWidgetFull {...variantProps} />}
        </>
      )}
    </BaseWidget>
  );
};

export const PortfolioWidget = Object.assign(PortfolioWidgetRoot, {
  Full: PortfolioWidgetFull,
  Medium: PortfolioWidgetMedium,
  PnlTile: PortfolioWidgetPnlTile,
  TopMoverTile: PortfolioWidgetTopMoverTile,
});
