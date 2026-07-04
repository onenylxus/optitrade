'use client';

import { useState, useEffect, useMemo } from 'react';
import { AlertCircle, Bot, RefreshCw } from 'lucide-react';
import { BaseWidget } from './base-widget';
import type { ComponentProps } from 'react';
import { usePortfolioContext } from '@/contexts/portfolio-context';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { EarningItem, EarningsResponse, EarningsSource } from '@/lib/earnings';

interface EarningsWidgetProps extends Omit<ComponentProps<typeof BaseWidget>, 'title' | 'children'> {
  title?: string;
  summary?: string;
}

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function daysUntil(iso: string): number {
  const now = new Date();
  const target = new Date(iso + 'T00:00:00');
  if (Number.isNaN(target.getTime())) return Number.NaN;
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function urgencyClass(days: number): string {
  if (days <= 2) return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
  if (days <= 5) return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
  return 'bg-muted text-muted-foreground';
}

function fmtRelative(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

const SOURCE_BADGE: Record<EarningsSource, { label: string; className: string }> = {
  fmp:  { label: 'FMP',  className: 'bg-green-500/15 text-green-400' },
  demo: { label: 'DEMO', className: 'bg-yellow-500/15 text-yellow-400' },
};

export function EarningsWidget({
  title = 'Earnings Calendar',
  summary = 'Upcoming earnings & results',
  ...props
}: EarningsWidgetProps) {
  const { portfolio } = usePortfolioContext();
  const [filter, setFilter] = useState<'all' | 'portfolio'>('all');
  const [earningsData, setEarningsData] = useState<EarningItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<EarningsSource>('fmp');
  const [asOf, setAsOf] = useState<string>('');
  const [warning, setWarning] = useState<string | undefined>(undefined);

  const load = () => {
    setLoading(true);
    setError(null);
    fetch('/api/earnings', { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return (await r.json()) as EarningsResponse;
      })
      .then((d) => {
        setEarningsData(Array.isArray(d?.earnings) ? d.earnings : []);
        setSource(d?.source ?? 'demo');
        setAsOf(d?.asOf ?? new Date().toISOString());
        setWarning(d?.warning);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load');
        setEarningsData([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const portfolioSymbols = useMemo(
    () => portfolio?.positions.map((p) => p.symbol.toUpperCase()) ?? [],
    [portfolio],
  );

  const filtered = useMemo(() => {
    return filter === 'portfolio'
      ? earningsData.filter((e) => portfolioSymbols.includes(e.ticker))
      : earningsData;
  }, [earningsData, filter, portfolioSymbols]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const aDone = a.epsActual !== null;
      const bDone = b.epsActual !== null;
      if (aDone !== bDone) return aDone ? 1 : -1;
      return a.date.localeCompare(b.date);
    });
  }, [filtered]);

  const upcomingCount = sorted.filter((e) => e.epsActual === null && daysUntil(e.date) >= 0).length;
  const portfolioHitCount = sorted.filter((e) => portfolioSymbols.includes(e.ticker)).length;

  const contextItems = sorted
    .filter((e) => e.epsActual === null && daysUntil(e.date) >= 0)
    .slice(0, 6)
    .map((e) => {
      const d = daysUntil(e.date);
      return `${e.ticker} (${e.time} ${formatDate(e.date)}${d >= 0 ? `, ${d}d` : ''})`;
    });

  const contextText =
    contextItems.length > 0
      ? `Earnings Calendar: ${contextItems.join(' | ')}`
      : 'Earnings Calendar: No upcoming earnings in range';

  const sourceBadge = SOURCE_BADGE[source];

  return (
    <BaseWidget
      title={title}
      summary={summary}
      contextData={{ label: title, text: contextText }}
      createdByNanobot
      {...props}
    >
      {/* Filter bar */}
      <div className="flex items-center justify-between gap-2 px-4 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {(['all', 'portfolio'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={cn(
                  'px-3 py-1 rounded text-xs font-medium transition-colors capitalize',
                  filter === f
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80',
                )}
              >
                {f === 'all' ? `All (${sorted.length})` : `Portfolio (${portfolioHitCount})`}
              </button>
            ))}
          </div>
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${sourceBadge.className}`}>
            {sourceBadge.label}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {asOf && <span className="text-[10px] text-muted-foreground">{fmtRelative(asOf)}</span>}
          <button
            type="button"
            onClick={load}
            className="rounded p-0.5 text-muted-foreground hover:bg-muted/50"
            title="Refresh"
            aria-label="Refresh earnings"
          >
            <RefreshCw className="size-3" />
          </button>
          <span className="text-xs text-muted-foreground">{upcomingCount} upcoming</span>
        </div>
      </div>

      {warning && (
        <div className="flex items-center gap-2 border-b border-border bg-yellow-500/10 px-4 py-2 text-xs text-yellow-400">
          <AlertCircle className="size-3" />
          {warning}
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-28">
            <Bot className="size-5 animate-pulse text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center gap-2 h-28 text-muted-foreground">
            <AlertCircle className="size-5 text-red-500" />
            <p className="text-sm">Could not load earnings</p>
            <p className="text-xs">{error}</p>
            <button
              type="button"
              onClick={load}
              className="mt-1 flex items-center gap-1 rounded bg-primary/10 px-2 py-1 text-xs text-primary hover:bg-primary/20"
            >
              <RefreshCw className="size-3" />
              Retry
            </button>
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex items-center justify-center h-28">
            <span className="text-sm text-muted-foreground">No earnings found</span>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-22.5 text-xs">Date</TableHead>
                <TableHead className="w-15 text-xs">Ticker</TableHead>
                <TableHead className="text-xs">Company</TableHead>
                <TableHead className="w-12.5 text-xs text-center">Time</TableHead>
                <TableHead className="w-18.75 text-xs text-right">Est. EPS</TableHead>
                <TableHead className="w-18.75 text-xs text-right">Actual</TableHead>
                <TableHead className="w-18.75 text-xs text-right">Surprise</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((item) => {
                const days = daysUntil(item.date);
                const isUpcoming = item.epsActual === null;
                const isUrgent = isUpcoming && days >= 0 && days <= 5;
                const inPortfolio = portfolioSymbols.includes(item.ticker);
                return (
                  <TableRow
                    key={item.ticker + item.date}
                    className={cn(
                      'group',
                      isUrgent && 'bg-red-50/50 dark:bg-red-950/20',
                      inPortfolio && 'border-l-2 border-l-primary/40',
                    )}
                  >
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-medium">{formatDate(item.date)}</span>
                        {isUpcoming && Number.isFinite(days) && (
                          <span
                            className={cn(
                              'inline-block w-fit px-1.5 py-0.5 rounded text-[10px] font-medium',
                              urgencyClass(days),
                            )}
                          >
                            {days < 0 ? 'Reported' : days === 0 ? 'TODAY' : `${days}d`}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs font-bold">{item.ticker}</span>
                    </TableCell>
                    <TableCell>
                      <span className="block max-w-30 truncate text-xs" title={item.companyName}>
                        {item.companyName}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-[10px] font-mono font-semibold">{item.time}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-mono text-xs">
                        {item.epsEstimate != null ? `$${item.epsEstimate.toFixed(2)}` : '—'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {item.epsActual != null ? (
                        <span className="font-mono text-xs font-semibold">
                          ${item.epsActual.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.surprise != null ? (
                        <span
                          className={cn(
                            'font-mono text-xs font-semibold',
                            item.surprise > 0
                              ? 'text-green-600 dark:text-green-400'
                              : item.surprise < 0
                                ? 'text-red-600 dark:text-red-400'
                                : '',
                          )}
                        >
                          {item.surprise > 0 ? '+' : ''}
                          {item.surprise.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </BaseWidget>
  );
}
