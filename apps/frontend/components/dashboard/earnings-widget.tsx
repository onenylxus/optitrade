'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { BaseWidget } from './base-widget';
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

interface EarningItem {
  ticker: string;
  companyName: string;
  date: string;
  time: 'BMO' | 'AMC';
  epsEstimate: number | null;
  epsActual: number | null;
  surprise: number | null;
  fiscalPeriod: string;
}

// Demo data — fetched from yfinance 2026-05-23; real data via /api/earnings (Phase 2)
const DEMO_EARNINGS: EarningItem[] = [
  { ticker: 'NVDA', companyName: 'NVIDIA Corp',      date: '2026-05-21', time: 'AMC', epsEstimate: 2.09,  epsActual: null,  surprise: null,  fiscalPeriod: 'Q2 FY26' },
  { ticker: 'JPM',  companyName: 'JPMorgan Chase',  date: '2026-07-14', time: 'BMO', epsEstimate: 5.39,  epsActual: null,  surprise: null,  fiscalPeriod: 'Q2 FY26' },
  { ticker: 'NFLX', companyName: 'Netflix Inc',     date: '2026-07-17', time: 'AMC', epsEstimate: 0.79,  epsActual: null,  surprise: null,  fiscalPeriod: 'Q2 FY26' },
  { ticker: 'GOOGL',companyName: 'Alphabet Inc',    date: '2026-07-24', time: 'BMO', epsEstimate: 2.88,  epsActual: null,  surprise: null,  fiscalPeriod: 'Q2 FY26' },
  { ticker: 'META', companyName: 'Meta Platforms',  date: '2026-07-30', time: 'AMC', epsEstimate: 7.53,  epsActual: null,  surprise: null,  fiscalPeriod: 'Q2 FY26' },
  { ticker: 'MSFT', companyName: 'Microsoft Corp',  date: '2026-07-30', time: 'BMO', epsEstimate: 4.24,  epsActual: null,  surprise: null,  fiscalPeriod: 'Q4 FY26' },
  { ticker: 'AAPL', companyName: 'Apple Inc',        date: '2026-07-31', time: 'AMC', epsEstimate: 1.90,  epsActual: null,  surprise: null,  fiscalPeriod: 'Q3 FY26' },
  { ticker: 'AMZN', companyName: 'Amazon.com Inc',   date: '2026-07-31', time: 'AMC', epsEstimate: 1.81,  epsActual: null,  surprise: null,  fiscalPeriod: 'Q2 FY26' },
  { ticker: 'FIG',  companyName: 'Figma Inc',        date: '2026-08-15', time: 'AMC', epsEstimate: 0.04,  epsActual: null,  surprise: null,  fiscalPeriod: 'Q2 FY26' },
];

interface EarningsWidgetProps {
  title?: string;
  summary?: string;
}

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function daysUntil(iso: string): number {
  const now = new Date();
  const target = new Date(iso + 'T00:00:00');
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function urgencyClass(days: number): string {
  if (days <= 2)  return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
  if (days <= 5)  return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
  return 'bg-muted text-muted-foreground';
}

export function EarningsWidget({
  title = 'Earnings Calendar',
  summary = 'Upcoming earnings & results',
}: EarningsWidgetProps) {
  const { portfolio } = usePortfolioContext();
  const [filter, setFilter] = useState<'all' | 'portfolio'>('all');
  const [earningsData, setEarningsData] = useState<EarningItem[]>(DEMO_EARNINGS);
  const [loading, setLoading] = useState(false);

  // Phase 2: load from /api/earnings (populated by Python backend cron)
  useEffect(() => {
    setLoading(true);
    fetch('/api/earnings')
      .then((r) => r.json())
      .then((d) => { if (d.earnings?.length) setEarningsData(d.earnings); })
      .catch(() => { /* fallback to demo */ })
      .finally(() => setLoading(false));
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

  const upcomingCount = sorted.filter(
    (e) => e.epsActual === null && daysUntil(e.date) >= 0,
  ).length;

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

  return (
    <BaseWidget title={title} summary={summary} contextData={{ label: title, text: contextText }}>
      {/* Filter bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <div className="flex gap-1">
          {(['all', 'portfolio'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'px-3 py-1 rounded text-xs font-medium transition-colors capitalize',
                filter === f
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80',
              )}
            >
              {f === 'all' ? 'All Stocks' : 'Portfolio Only'}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground">{upcomingCount} upcoming</span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-28"><span className="text-sm text-muted-foreground">Loading…</span></div>
        ) : sorted.length === 0 ? (
          <div className="flex items-center justify-center h-28"><span className="text-sm text-muted-foreground">No earnings found</span></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[90px] text-xs">Date</TableHead>
                <TableHead className="w-[60px] text-xs">Ticker</TableHead>
                <TableHead className="text-xs">Company</TableHead>
                <TableHead className="w-[50px] text-xs text-center">Time</TableHead>
                <TableHead className="w-[75px] text-xs text-right">Est. EPS</TableHead>
                <TableHead className="w-[75px] text-xs text-right">Actual</TableHead>
                <TableHead className="w-[75px] text-xs text-right">Surprise</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((item) => {
                const days = daysUntil(item.date);
                const isUpcoming = item.epsActual === null;
                const isUrgent = isUpcoming && days >= 0 && days <= 5;
                return (
                  <TableRow
                    key={item.ticker + item.date}
                    className={cn('group', isUrgent && 'bg-red-50/50 dark:bg-red-950/20')}
                  >
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-medium">{formatDate(item.date)}</span>
                        {isUpcoming && (
                          <span className={cn('inline-block w-fit px-1.5 py-0.5 rounded text-[10px] font-medium', urgencyClass(days))}>
                            {days < 0 ? 'Reported' : days === 0 ? 'TODAY' : `${days}d`}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell><span className="font-mono text-xs font-bold">{item.ticker}</span></TableCell>
                    <TableCell>
                      <span className="text-xs truncate max-w-[120px] block" title={item.companyName}>{item.companyName}</span>
                    </TableCell>
                    <TableCell className="text-center"><span className="text-[10px] font-mono font-semibold">{item.time}</span></TableCell>
                    <TableCell className="text-right">
                      <span className="font-mono text-xs">
                        {item.epsEstimate != null ? `$${item.epsEstimate.toFixed(2)}` : '—'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {item.epsActual != null ? (
                        <span className="font-mono text-xs font-semibold">${item.epsActual.toFixed(2)}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.surprise != null ? (
                        <span className={cn(
                          'font-mono text-xs font-semibold',
                          item.surprise > 0 ? 'text-green-600 dark:text-green-400' :
                          item.surprise < 0 ? 'text-red-600 dark:text-red-400' : '',
                        )}>
                          {item.surprise > 0 ? '+' : ''}{item.surprise.toFixed(1)}%
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