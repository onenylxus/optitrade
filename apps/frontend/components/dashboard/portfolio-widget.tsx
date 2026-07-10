'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Loader2,
  Lock,
  Pencil,
  Plus,
  Save,
  Settings,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { Area, AreaChart, Cell, Pie, PieChart, XAxis, YAxis } from 'recharts';
import { BaseWidget } from './base-widget';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BACKEND_URL, getPortfolioAnalysis } from '@/lib/api/client';
import type { PortfolioStrategyAction } from '@/lib/api/client';
import type { PortfolioPositionSignal } from '@/lib/api/client';
import type {
  PortfolioBrokerOption,
  PortfolioChatContextValue,
} from '@/contexts/portfolio-context';
import { usePortfolioContext } from '@/contexts/portfolio-context';
import { requestStockChartSymbolSelection } from '@/lib/stock-chart-bridge';

export interface Stock {
  id: string;
  symbol: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  sector: string;
}

type PortfolioVariant = 'small' | 'medium' | 'large';
type PortfolioWidgetSource = 'backend' | 'paper';
type PortfolioPanelMode = 'broker' | 'editor' | null;

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
  source: PortfolioWidgetSource;
  sourceLabel: string;
  aiSignals: PortfolioAiSignals;
  isAiLoading?: boolean;
  signalLens: SignalLens;
  onSignalLensChange: (lens: SignalLens) => void;
  onOpenSettings: () => void;
  onOpenEditor: () => void;
}

interface PortfolioAiSignals {
  insight: string;
  riskLabel: string;
  riskTone: 'low' | 'medium' | 'high';
  strategy: PortfolioStrategyAction[];
  signals: PortfolioPositionSignal[];
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
    broker?: string;
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

interface PortfolioEditableResponse {
  name: string;
  positions: PortfolioApiPosition[];
  history: PortfolioDerivedData['history'];
  updatedAt: string;
}

interface PortfolioMappedSnapshot {
  stocks: Stock[];
  data: PortfolioDerivedData;
  chatContext: PortfolioChatContextValue;
  snapshot: PortfolioApiSnapshot;
}

interface BrokerOptionConfig {
  id: PortfolioBrokerOption;
  label: string;
  supported: boolean;
  description: string;
}

type SignalLens = 'technical' | 'day-trade' | 'buy-and-hold';
type SignalBias =
  | 'strong bullish'
  | 'strong bearish'
  | 'possible bullish'
  | 'possible bearish'
  | 'neutral';

interface SignalLensOption {
  value: SignalLens;
  label: string;
}

const portfolioApiBaseUrl = process.env.NEXT_PUBLIC_PORTFOLIO_API_BASE_URL ?? BACKEND_URL;

if (!portfolioApiBaseUrl) {
  throw new Error('Environment variable NEXT_PUBLIC_PORTFOLIO_API_BASE_URL is not defined');
}

const HOLDING_CHART_COLORS = ['#0f172a', '#334155', '#64748b', '#94a3b8', '#cbd5e1'];
const SIGNAL_LENS_STORAGE_KEY = 'optitrade-portfolio-signal-lens';
const SIGNAL_LENS_OPTIONS: SignalLensOption[] = [
  { value: 'technical', label: 'Technical' },
  { value: 'day-trade', label: 'Day Trade' },
  { value: 'buy-and-hold', label: 'Buy & Hold' },
];

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

const formatCurrency = (value: number, maxDigits = 0) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: maxDigits,
  }).format(value);

const percentClass = (value: number) => (value >= 0 ? 'text-emerald-600' : 'text-rose-600');

const stockLinkButtonClass =
  'flex w-full items-start gap-1.5 rounded-sm text-left transition-colors hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300';

function normalizeSignalBias(bias: string): SignalBias {
  const normalized = bias.trim().toLowerCase();
  if (
    normalized === 'strong bullish' ||
    normalized === 'strong bearish' ||
    normalized === 'possible bullish' ||
    normalized === 'possible bearish' ||
    normalized === 'neutral'
  ) {
    return normalized;
  }
  return 'neutral';
}

function signalPatternContext(signal: PortfolioPositionSignal): string {
  return (
    signal.explanation ??
    (signal.pattern
      ? `${signal.pattern}${signal.status ? ` • ${signal.status}` : ''}${signal.confidence ? ` • ${signal.confidence}%` : ''}`
      : signal.bias)
  );
}

function signalLensPayload(signal: PortfolioPositionSignal, lens: SignalLens) {
  return signal.lenses?.[lens] ?? null;
}

function describeSignalForLens(signal: PortfolioPositionSignal, lens: SignalLens) {
  const lensPayload = signalLensPayload(signal, lens);
  const rawBias =
    lensPayload?.bias ??
    (lens === 'technical' ? signal.bias : signal.lenses?.technical?.bias ?? signal.bias);
  const bias = normalizeSignalBias(rawBias);
  const lensExplanation = lensPayload?.explanation?.trim();
  const patternContext = lensExplanation || signalPatternContext(signal);

  if (lens === 'technical') {
    return {
      bias,
      label: rawBias,
      title: patternContext,
    };
  }

  const lensCopy: Record<
    SignalBias,
    Record<Exclude<SignalLens, 'technical'>, { label: string; helper: string }>
  > = {
    'strong bullish': {
      'day-trade': {
        label: 'Momentum Long',
        helper: 'Intraday momentum favors long setups if price confirms.',
      },
      'buy-and-hold': {
        label: 'Accumulate',
        helper: 'Longer-horizon posture supports building or keeping exposure.',
      },
    },
    'possible bullish': {
      'day-trade': {
        label: 'Long Setup',
        helper: 'Watch for a cleaner trigger before leaning long intraday.',
      },
      'buy-and-hold': {
        label: 'Watch to Add',
        helper: 'Constructive enough to monitor for adding on confirmation.',
      },
    },
    'strong bearish': {
      'day-trade': {
        label: 'Momentum Short',
        helper: 'Intraday pressure favors short setups if weakness continues.',
      },
      'buy-and-hold': {
        label: 'Trim / Review',
        helper: 'Longer-term holders may want to review position size and thesis.',
      },
    },
    'possible bearish': {
      'day-trade': {
        label: 'Short Setup',
        helper: 'A developing short setup is forming, but confirmation still matters.',
      },
      'buy-and-hold': {
        label: 'Monitor Risk',
        helper: 'Not a forced exit, but risk should be watched closely.',
      },
    },
    neutral: {
      'day-trade': {
        label: 'Wait',
        helper: 'No strong intraday edge stands out right now.',
      },
      'buy-and-hold': {
        label: 'Hold',
        helper: 'Nothing here argues strongly for adding or cutting exposure.',
      },
    },
  };

  const resolved = lensCopy[bias][lens];
  return {
    bias,
    label: resolved.label,
    title: lensExplanation || `${resolved.helper} ${patternContext}`.trim(),
  };
}

const portfolioApiUrl = (path: string) => {
  const baseUrl = portfolioApiBaseUrl.endsWith('/')
    ? portfolioApiBaseUrl.slice(0, -1)
    : portfolioApiBaseUrl;
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
    currentPrice:
      position.currentPrice ||
      (position.marketValue != null && position.quantity !== 0
        ? position.marketValue / position.quantity
        : position.avgPrice),
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

function buildTopHoldings(stocks: Stock[]) {
  const totalValue = stocks.reduce((sum, stock) => sum + stock.currentPrice * stock.quantity, 0);
  return stocks
    .map((stock) => {
      const value = stock.currentPrice * stock.quantity;
      return {
        id: stock.id,
        symbol: stock.symbol,
        value,
        weight: totalValue > 0 ? (value / totalValue) * 100 : 0,
      };
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);
}

function buildPortfolioAiSignals(stocks: Stock[], data: PortfolioDerivedData): PortfolioAiSignals {
  if (stocks.length === 0 || data.totalValue <= 0) {
    return {
      insight: 'Add a few holdings to unlock portfolio insight.',
      riskLabel: 'No active exposure yet',
      riskTone: 'low',
      strategy: [],
      signals: [],
    };
  }

  const holdings = buildTopHoldings(stocks);
  const largest = holdings[0];
  const topTwoWeight = holdings.slice(0, 2).reduce((sum, holding) => sum + holding.weight, 0);
  const topTwoSymbols = holdings.slice(0, 2).map((holding) => holding.symbol);

  let insight = `${largest.symbol} is the largest position at ${largest.weight.toFixed(0)}% of portfolio value, so it still carries the most influence over the portfolio's behavior.`;
  if (topTwoWeight >= 55) {
    insight = `${topTwoSymbols.join(' and ')} make up ${topTwoWeight.toFixed(0)}% of the portfolio, so near-term performance is being driven by a relatively narrow core.`;
  } else if (data.pnlPercent < 0) {
    insight = `The portfolio is below cost basis by ${Math.abs(data.pnlPercent).toFixed(1)}%, so weakness in the larger holdings is still outweighing the rest of the book.`;
  } else {
    insight = `Exposure looks fairly balanced across ${stocks.length} holdings, although the larger names still set the tone for short-term portfolio movement.`;
  }

  if (largest.weight >= 35) {
    return {
      insight,
      riskLabel: `High concentration in ${largest.symbol}`,
      riskTone: 'high',
      strategy: [],
      signals: [],
    };
  }
  if (topTwoWeight >= 55) {
    return {
      insight,
      riskLabel: 'Top-two concentration is elevated',
      riskTone: 'medium',
      strategy: [],
      signals: [],
    };
  }
  if (stocks.length <= 3) {
    return {
      insight,
      riskLabel: 'Limited diversification across holdings',
      riskTone: 'medium',
      strategy: [],
      signals: [],
    };
  }
  return {
    insight,
    riskLabel: 'Risk is relatively balanced',
    riskTone: 'low',
    strategy: [],
    signals: [],
  };
}

function SignalLensPicker({
  value,
  onChange,
}: {
  value: SignalLens;
  onChange: (lens: SignalLens) => void;
}) {
  return (
    <label className="flex items-center gap-1.5 text-[8px] font-semibold uppercase tracking-[0.14em] text-slate-400">
      <span>Signal Lens</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as SignalLens)}
        className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-600 outline-none transition focus:border-slate-300"
        aria-label="Signal lens"
      >
        {SIGNAL_LENS_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function PositionSignalTag({
  signal,
  lens,
}: {
  signal: PortfolioPositionSignal;
  lens: SignalLens;
}) {
  const display = describeSignalForLens(signal, lens);
  const bias = display.bias;
  const toneClasses =
    bias === 'strong bullish'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : bias === 'strong bearish'
        ? 'border-rose-200 bg-rose-50 text-rose-700'
        : bias === 'possible bullish'
          ? 'border-teal-200 bg-teal-50 text-teal-700'
          : bias === 'possible bearish'
            ? 'border-amber-200 bg-amber-50 text-amber-700'
            : bias === 'neutral'
              ? 'border-slate-200 bg-slate-100 text-slate-500'
            : 'border-slate-200 bg-slate-100 text-slate-500';

  return (
    <span className="group/label relative inline-flex">
      <span
        className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[7px] font-semibold uppercase tracking-[0.14em] ${toneClasses}`}
      >
        {display.label}
      </span>
      <span className="pointer-events-none absolute left-0 top-full z-20 mt-1.5 w-44 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[9px] font-medium normal-case tracking-normal text-slate-600 opacity-0 shadow-lg transition duration-100 ease-out group-hover/label:translate-y-0 group-hover/label:opacity-100">
        {display.title}
      </span>
    </span>
  );
}

function RiskFlag({ label, tone }: { label: string; tone: PortfolioAiSignals['riskTone'] }) {
  const toneClasses =
    tone === 'high'
      ? 'border-rose-200 bg-rose-50 text-rose-700'
      : tone === 'medium'
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : 'border-emerald-200 bg-emerald-50 text-emerald-700';

  return (
    <div className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium ${toneClasses}`}>
      <AlertTriangle size={12} />
      <span>{label}</span>
    </div>
  );
}

function PortfolioInsightCard({
  insight,
  isLoading = false,
}: {
  insight: string;
  isLoading?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2">
      <div className="mb-1 flex items-center gap-1.5 text-[8px] font-bold uppercase tracking-[0.18em] text-slate-500">
        <Sparkles size={11} />
        Portfolio Insight
      </div>
      {isLoading ? (
        <div className="space-y-2 py-1">
          <div className="h-2.5 w-24 animate-pulse rounded bg-slate-200" />
          <div className="h-2.5 w-full animate-pulse rounded bg-slate-200" />
          <div className="h-2.5 w-5/6 animate-pulse rounded bg-slate-200" />
          <div className="pt-1 text-[9px] uppercase tracking-[0.14em] text-slate-400">
            Analyzing portfolio...
          </div>
        </div>
      ) : (
        <>
          <div className="text-justify text-[10px] leading-4 text-slate-700">{insight}</div>
        </>
      )}
    </div>
  );
}

const PAPER_BROKER: NonNullable<PortfolioApiSnapshot['broker']> = {
  id: 'mock',
  status: 'disconnected',
  broker: 'Paper Portfolio',
  name: 'Paper Portfolio',
  settings: {},
};

const PAPER_CHAT_BROKER: PortfolioChatContextValue['broker'] = {
  id: 'mock',
  status: 'disconnected',
  name: 'Paper Portfolio',
};

function buildPaperChatContext(stocks: Stock[]): PortfolioChatContextValue {
  const data = buildPortfolioData(stocks);
  return {
    asOf: new Date().toISOString(),
    baseCurrency: 'USD',
    source: 'paper',
    broker: PAPER_CHAT_BROKER,
    summary: {
      totalValue: data.totalValue,
      pnl: data.pnl,
      pnlPercent: data.pnlPercent,
      dailyPnl: data.dailyPnl,
      dailyPnlPercent: data.dailyPnlPercent,
      marginUsage: data.marginUsage,
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

function mapPortfolioSnapshot(snapshot: PortfolioApiSnapshot): PortfolioMappedSnapshot {
  const source = snapshot.source === 'backend' ? 'backend' : 'paper';
  const stocks = mapPositionsToStocks(snapshot.positions);
  const positions = snapshot.positions.map((position, index) => {
    const stock = stocks[index];
    const currentPrice = stock?.currentPrice ?? position.currentPrice;
    return {
      ...position,
      currentPrice,
      marketValue: position.marketValue ?? currentPrice * position.quantity,
      unrealizedPnl:
        position.unrealizedPnl ?? (currentPrice - position.avgPrice) * position.quantity,
      unrealizedPnlPercent:
        position.unrealizedPnlPercent ??
        (position.avgPrice === 0
          ? 0
          : ((currentPrice - position.avgPrice) / position.avgPrice) * 100),
    };
  });
  const broker =
    source === 'backend'
      ? snapshot.broker ?? PAPER_BROKER
      : {
          ...PAPER_BROKER,
          syncedAt: snapshot.broker?.syncedAt,
          lastError: snapshot.broker?.lastError,
        };
  const sectorValues = snapshot.sectorValues.filter(
    (sector) => sector.sector.trim() && sector.sector !== 'Uncategorized',
  );
  const normalizedSnapshot: PortfolioApiSnapshot = {
    ...snapshot,
    source,
    broker,
    positions,
    sectorValues,
  };
  return {
    stocks,
    data: {
      totalValue: snapshot.summary.totalValue,
      pnl: snapshot.summary.pnl,
      pnlPercent: snapshot.summary.pnlPercent,
      dailyPnl: snapshot.summary.dailyPnl,
      dailyPnlPercent: snapshot.summary.dailyPnlPercent,
      marginUsage: snapshot.summary.marginUsage,
      sectorValues,
      history: snapshot.history,
    },
    chatContext: {
      asOf: snapshot.asOf ?? new Date().toISOString(),
      baseCurrency: snapshot.baseCurrency ?? 'USD',
      source,
      broker,
      summary: snapshot.summary,
      positions: positions.map((position) => ({
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
      sectorValues,
    },
    snapshot: normalizedSnapshot,
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

function PortfolioSourceBadge({ source, label }: { source: PortfolioWidgetSource; label: string }) {
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
  onUsePaperPortfolio: () => Promise<void>;
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

  const handleConnect = async () => {
    setError(null);

    if (selectedBrokerState === 'mock') {
      setConnecting(true);
      try {
        await onUsePaperPortfolio();
        onBack();
      } catch (connectError) {
        setError(
          connectError instanceof Error ? connectError.message : 'Unable to use paper portfolio',
        );
      } finally {
        setConnecting(false);
      }
      return;
    }

    setConnecting(true);
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
          payload?.detail ?? payload?.error ?? `Broker connection API returned ${response.status}`,
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
      <div className="flex-1 space-y-4 py-5">
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

        {error && <div className="text-[11px] leading-4 text-rose-600">{error}</div>}

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

              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
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
      </div>
    </div>
  );
}

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
      </div>
    </div>
  );
}

function PortfolioWidgetMedium({
  stocks,
  data,
  source,
  sourceLabel,
  aiSignals,
  signalLens,
  onSignalLensChange,
  onOpenSettings,
  onOpenEditor,
}: PortfolioVariantProps) {
  const signalBySymbol = new Map(
    aiSignals.signals.map((signal) => [signal.symbol.toUpperCase(), signal] as const),
  );
  const handleSelectStock = useCallback((symbol: string) => {
    requestStockChartSymbolSelection(symbol);
  }, []);
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-white text-slate-900">
      <div className="flex items-center justify-between py-2.5">
        <PortfolioSourceBadge source={source} label={sourceLabel} />
        <div className="flex items-center gap-2">
          <SignalLensPicker value={signalLens} onChange={onSignalLensChange} />
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
          <div className="text-lg font-medium text-slate-900">
            {formatCurrency(data.totalValue)}
          </div>
        </div>
        <div className="w-24">
          <PerformanceChart data={data.history} height={32} />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pt-2">
        {stocks.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400">
            No positions yet. Open the editor to build your paper portfolio.
          </div>
        ) : (
          <table className="w-full border-collapse text-left text-[10px]">
            <thead className="sticky top-0 z-10 bg-white text-[8px] uppercase tracking-wider text-slate-400 shadow-[0_1px_0_0_rgba(0,0,0,0.05)]">
              <tr>
                <th className="bg-white py-1.5 font-semibold first:pl-0">Instrument</th>
                <th className="bg-white py-1.5 text-right font-semibold">Avg</th>
                <th className="bg-white py-1.5 text-right font-semibold">Price</th>
                <th className="bg-white py-1.5 text-right font-semibold last:pr-0">Return</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {stocks.map((stock) => {
                const stockPnl =
                  stock.avgPrice === 0 ? 0 : (stock.currentPrice / stock.avgPrice - 1) * 100;

                return (
                  <tr key={stock.id} className="transition-colors hover:bg-slate-50/50">
                    <td className="py-1.5 first:pl-0">
                      <button
                        type="button"
                        className={stockLinkButtonClass}
                        onClick={() => handleSelectStock(stock.symbol)}
                        title={`Show ${stock.symbol} in stock chart`}
                      >
                        <div>
                          <div className="flex items-center gap-1.5">
                            <div className="text-[11px] font-bold leading-tight text-slate-900">
                              {stock.symbol}
                            </div>
                            {signalBySymbol.get(stock.symbol.toUpperCase()) ? (
                              <PositionSignalTag
                                signal={signalBySymbol.get(stock.symbol.toUpperCase())!}
                                lens={signalLens}
                              />
                            ) : null}
                          </div>
                          <div className="font-mono text-[7px] tracking-tight text-slate-400">
                            {stock.quantity} <span className="opacity-70">shs</span>
                          </div>
                        </div>
                      </button>
                    </td>
                    <td className="py-1.5 text-right font-mono text-[8px] text-slate-400">
                      {formatCurrency(stock.avgPrice, 0)}
                    </td>
                    <td className="py-1.5 text-right text-[9px] font-bold text-slate-800">
                      {formatCurrency(stock.currentPrice, 0)}
                    </td>
                    <td
                      className={`py-1.5 text-right text-[8px] font-bold last:pr-0 ${percentClass(stockPnl)}`}
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
    </div>
  );
}

function PortfolioWidgetLarge({
  stocks,
  data,
  source,
  sourceLabel,
  aiSignals,
  isAiLoading,
  signalLens,
  onSignalLensChange,
  onOpenSettings,
  onOpenEditor,
}: PortfolioVariantProps) {
  const topHoldings = buildTopHoldings(stocks);
  const signalBySymbol = new Map(
    aiSignals.signals.map((signal) => [signal.symbol.toUpperCase(), signal] as const),
  );
  const handleSelectStock = useCallback((symbol: string) => {
    requestStockChartSymbolSelection(symbol);
  }, []);
  const chartConfig = Object.fromEntries(
    topHoldings.map((holding, index) => [
      holding.symbol,
      {
        label: holding.symbol,
        color: HOLDING_CHART_COLORS[index % HOLDING_CHART_COLORS.length],
      },
    ]),
  );
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-white text-slate-900">
      <div className="flex items-center justify-between border-b border-slate-50 py-3">
        <PortfolioSourceBadge source={source} label={sourceLabel} />
        <div className="flex items-center gap-2">
          <SignalLensPicker value={signalLens} onChange={onSignalLensChange} />
          <button
            onClick={onOpenEditor}
            className="text-slate-300 transition-colors hover:text-slate-600"
            title="Edit paper portfolio"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={onOpenSettings}
            className="text-slate-300 transition-colors hover:text-slate-600"
            title="Broker settings"
          >
            <Settings size={14} />
          </button>
        </div>
      </div>

      <div className="relative overflow-hidden border-b border-slate-50 bg-slate-50/40 px-1 py-3">
        <div className="pointer-events-none absolute inset-x-0 top-2 bottom-0 opacity-30">
          <PerformanceChart data={data.history} height={64} showAxis />
        </div>
        <div className="relative grid grid-cols-3 gap-3">
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
          ].map((metric) => (
            <div key={metric.label}>
              <div className="mb-0.5 text-[8px] uppercase tracking-wide text-slate-400">
                {metric.label}
              </div>
              <div className={`text-xs font-semibold ${metric.class || ''}`}>{metric.val}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-[auto,1fr] items-start gap-3 border-b border-slate-50 bg-white py-2">
        <div>
          <RiskFlag label={aiSignals.riskLabel} tone={aiSignals.riskTone} />
        </div>
        <PortfolioInsightCard
          insight={aiSignals.insight}
          isLoading={Boolean(isAiLoading)}
        />
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div
          className={`overflow-y-auto scrollbar-thin scrollbar-thumb-slate-100 ${
            topHoldings.length > 0 ? 'w-3/5 pr-3' : 'w-full'
          }`}
        >
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
                        <button
                          type="button"
                          className={stockLinkButtonClass}
                          onClick={() => handleSelectStock(stock.symbol)}
                          title={`Show ${stock.symbol} in stock chart`}
                        >
                          <div>
                            <div className="flex items-center gap-1.5">
                              <div className="font-bold leading-tight text-slate-900">
                                {stock.symbol}
                              </div>
                              {signalBySymbol.get(stock.symbol.toUpperCase()) ? (
                                <PositionSignalTag
                                  signal={signalBySymbol.get(stock.symbol.toUpperCase())!}
                                  lens={signalLens}
                                />
                              ) : null}
                            </div>
                            <div className="font-mono text-[8px] tracking-tighter text-slate-400">
                              {stock.quantity} <span className="text-[7px] opacity-70">shs</span>
                            </div>
                          </div>
                        </button>
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

        {topHoldings.length > 0 && (
          <div className="flex w-2/5 flex-col overflow-hidden border-l border-slate-50 bg-slate-50/30 px-3 py-3">
            <div className="mb-2 border-b border-slate-100 pb-1 text-[8px] font-bold uppercase tracking-widest text-slate-400">
              Top Holdings
            </div>
            <div className="flex flex-1 items-center justify-center px-2 py-2">
              <div className="aspect-square w-full max-w-[128px]">
                <ChartContainer config={chartConfig} className="h-full w-full">
                  <PieChart width={128} height={128}>
                    <Pie
                      data={topHoldings}
                      dataKey="weight"
                      nameKey="symbol"
                      cx="50%"
                      cy="50%"
                      innerRadius={28}
                      outerRadius={46}
                      paddingAngle={0}
                      strokeWidth={0}
                    >
                      {topHoldings.map((holding, index) => (
                        <Cell
                          key={holding.id}
                          fill={HOLDING_CHART_COLORS[index % HOLDING_CHART_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          hideLabel
                          formatter={(value, name, item) => {
                            const payload = item?.payload as
                              | { symbol?: string; value?: number; weight?: number }
                              | undefined;
                            const symbol =
                              typeof payload?.symbol === 'string' ? payload.symbol : String(name);
                            const holdingValue =
                              typeof payload?.value === 'number' ? payload.value : 0;
                            const holdingWeight =
                              typeof payload?.weight === 'number'
                                ? payload.weight
                                : Number(value);
                            return (
                              <div className="space-y-0.5">
                                <div className="font-semibold text-slate-900">{symbol}</div>
                                <div>{formatCurrency(holdingValue)}</div>
                                <div>{holdingWeight.toFixed(1)}%</div>
                              </div>
                            );
                          }}
                        />
                      }
                    />
                  </PieChart>
                </ChartContainer>
              </div>
            </div>
          </div>
        )}
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
  const [portfolioSnapshot, setPortfolioSnapshot] = useState<PortfolioApiSnapshot | null>(null);
  const [editablePortfolioName, setEditablePortfolioName] = useState('Portfolio Widget Portfolio');
  const [editableStocks, setEditableStocks] = useState<Stock[]>([]);
  const [editableHistory, setEditableHistory] = useState<PortfolioDerivedData['history']>([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<PortfolioWidgetSource>('paper');
  const [sourceLabel, setSourceLabel] = useState('Paper Portfolio');
  const [panelMode, setPanelMode] = useState<PortfolioPanelMode>(null);
  const [selectedBroker, setSelectedBroker] = useState<PortfolioBrokerOption>('mock');
  const [brokerConnection, setBrokerConnection] = useState<PortfolioApiSnapshot['broker']>({
    ...PAPER_BROKER,
  });
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [signalLens, setSignalLens] = useState<SignalLens>('technical');
  const { setPortfolio } = usePortfolioContext();
  const loadRequestIdRef = useRef(0);

  const resolvedVariant = variant ?? size ?? 'medium';

  const loadPortfolio = useCallback(async () => {
    const requestId = ++loadRequestIdRef.current;
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

      if (requestId !== loadRequestIdRef.current) {
        return;
      }

      setStocks(mappedSnapshot.stocks);
      setBackendData(mappedSnapshot.data);
      setPortfolioSnapshot(mappedSnapshot.snapshot);
      setBrokerConnection(broker);
      setSelectedBroker(isLiveBroker ? (broker.id ?? 'mock') : 'mock');

      if (isLiveBroker) {
        setSource('backend');
        setSourceLabel(broker.name || 'Live Broker');
        setPortfolio({ ...mappedSnapshot.chatContext, source: 'backend' });
      } else {
        setSource('paper');
        setSourceLabel('Paper Portfolio');
        setPortfolio({
          ...buildPaperChatContext(mappedSnapshot.stocks),
          asOf: mappedSnapshot.chatContext.asOf,
          baseCurrency: mappedSnapshot.chatContext.baseCurrency,
        });
      }

      if (editableResponse.ok) {
        const editable = (await editableResponse.json()) as PortfolioEditableResponse;
        if (requestId !== loadRequestIdRef.current) {
          return;
        }
        setEditablePortfolioName(editable.name);
        setEditableStocks(mapPositionsToStocks(editable.positions));
        setEditableHistory(editable.history);
      } else {
        setEditablePortfolioName('Portfolio Widget Portfolio');
        setEditableStocks(mappedSnapshot.stocks);
        setEditableHistory(mappedSnapshot.data.history);
      }
    } catch {
      if (requestId !== loadRequestIdRef.current) {
        return;
      }
      const emptyData = buildPortfolioData([]);
      setStocks([]);
      setBackendData(emptyData);
      setPortfolioSnapshot(null);
      setEditablePortfolioName('Portfolio Widget Portfolio');
      setEditableStocks([]);
      setEditableHistory([]);
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
      if (requestId === loadRequestIdRef.current) {
        setLoading(false);
      }
    }
  }, [setPortfolio]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadPortfolio();
    });
  }, [loadPortfolio]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedLens = window.localStorage.getItem(SIGNAL_LENS_STORAGE_KEY);
    if (
      storedLens === 'technical' ||
      storedLens === 'day-trade' ||
      storedLens === 'buy-and-hold'
    ) {
      setSignalLens(storedLens);
    } else if (storedLens === 'hft') {
      setSignalLens('day-trade');
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(SIGNAL_LENS_STORAGE_KEY, signalLens);
  }, [signalLens]);

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
        body: JSON.stringify({ ...payload, history: editableHistory }),
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
      setEditableHistory(editable.history);
      await loadPortfolio();
      setSaveStatus('saved');
      window.setTimeout(() => setSaveStatus('idle'), 1600);
    } catch (error) {
      setSaveStatus('error');
      window.setTimeout(() => setSaveStatus('idle'), 1600);
      throw error;
    }
  };

  const portfolioData = useMemo(
    () => backendData ?? buildPortfolioData(stocks),
    [backendData, stocks],
  );
  const fallbackAiSignals = useMemo(
    () => buildPortfolioAiSignals(stocks, portfolioData),
    [stocks, portfolioData],
  );
  const [aiSignals, setAiSignals] = useState<PortfolioAiSignals>(fallbackAiSignals);
  const [isAiLoading, setIsAiLoading] = useState(false);

  useEffect(() => {
    if (stocks.length === 0 || portfolioData.totalValue <= 0) {
      setIsAiLoading(false);
      setAiSignals(fallbackAiSignals);
      return;
    }

    setIsAiLoading(true);
    const controller = new AbortController();
    void getPortfolioAnalysis(controller.signal, portfolioSnapshot)
      .then((response) => {
        setAiSignals({
          insight: response.insight,
          riskLabel: response.riskLabel,
          riskTone: response.riskTone,
          strategy: response.strategy ?? [],
          signals: response.signals ?? [],
        });
        setIsAiLoading(false);
      })
      .catch(() => {
        setAiSignals(fallbackAiSignals);
        setIsAiLoading(false);
      });

    return () => controller.abort();
  }, [fallbackAiSignals, portfolioData.totalValue, portfolioSnapshot, stocks.length]);

  const variantProps: PortfolioVariantProps = {
    stocks,
    data: portfolioData,
    source,
    sourceLabel,
    aiSignals,
    isAiLoading,
    signalLens,
    onSignalLensChange: setSignalLens,
    onOpenSettings: () => setPanelMode('broker'),
    onOpenEditor: () => setPanelMode('editor'),
  };

  const contextText = [
    `Total Value: $${portfolioData.totalValue.toFixed(2)}`,
    `Unrealized PnL: ${portfolioData.pnlPercent >= 0 ? '+' : ''}${portfolioData.pnlPercent.toFixed(2)}%`,
    `Daily PnL: $${portfolioData.dailyPnl.toFixed(2)}`,
    `Risk: ${aiSignals.riskLabel}`,
    `Insight: ${aiSignals.insight}`,
    `Positions: ${
      stocks.length > 0
        ? stocks
            .map(
              (stock) => `${stock.symbol} x${stock.quantity} @ $${stock.currentPrice.toFixed(2)}`,
            )
            .join(', ')
        : 'none'
    }`,
  ].join('. ');

  return (
    <BaseWidget
      title={title}
      {...props}
      contextData={{ label: title, text: `Portfolio Snapshot: ${contextText}` }}
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
          onUsePaperPortfolio={activatePaperPortfolio}
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
