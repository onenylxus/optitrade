'use client';

import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertCircle,
  Bot,
  ChevronDown,
  ChevronUp,
  Info,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';
import { BaseWidget } from './base-widget';
import type { PaperHistoryResponse, PaperStats, PaperTrade } from '@/lib/paper-trading';

type Tab = 'ALL' | 'OPEN' | 'CLOSED';

const REASON_BADGE: Record<string, string> = {
  STOP_LOSS: 'bg-red-500/20 text-red-400',
  TARGET_HIT: 'bg-green-500/20 text-green-400',
  TRAILING_STOP: 'bg-blue-500/20 text-blue-400',
  CLOSE: 'bg-gray-500/20 text-gray-400',
};

function fmtMoney(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  return `${sign}$${abs.toFixed(2)}`;
}

function fmtPct(n: number | null | undefined, digits = 2): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return `${n >= 0 ? '+' : ''}${n.toFixed(digits)}%`;
}

function fmtAbs(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  const sign = n >= 0 ? '+' : '-';
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fmtRelativeTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function TradeCard({ trade }: { trade: PaperTrade }) {
  const [expanded, setExpanded] = useState(false);
  const pnlPct = trade.pnl_pct ?? 0;
  const isWin = pnlPct >= 0;
  const pnlColor = isWin ? 'text-green-500' : 'text-red-500';
  const bgColor = isWin ? 'bg-green-500/5' : 'bg-red-500/5';
  const borderColor = isWin ? 'border-green-500/20' : 'border-red-500/20';
  const Icon = isWin ? TrendingUp : TrendingDown;
  const isClosed = trade.status === 'closed' || trade.close_reason != null;
  const displayPrice = isClosed ? trade.exit_price ?? trade.current_price : trade.live_price;
  const isStale = trade.status === 'open' && trade.price_stale;

  return (
    <div className={`flex flex-col gap-2 rounded-lg border ${borderColor} ${bgColor} p-3 transition-all`}>
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-sm font-bold">{trade.symbol}</span>
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
            trade.side === 'LONG' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
          }`}>
            {trade.side}
          </span>
          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary/70">
            {trade.strategy}
          </span>
          {isClosed && trade.close_reason ? (
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${REASON_BADGE[trade.close_reason] || 'bg-gray-500/20 text-gray-400'}`}>
              {trade.close_reason.replace('_', ' ')}
            </span>
          ) : (
            <span className="rounded bg-blue-500/20 px-1.5 py-0.5 text-[10px] font-bold text-blue-400">
              OPEN
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`flex items-center gap-0.5 ${pnlColor}`}>
            <Icon className="size-3" />
            <span className="font-mono text-sm font-bold">{fmtPct(pnlPct)}</span>
          </span>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center justify-center rounded p-0.5 text-muted-foreground hover:bg-muted/50"
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
          </button>
        </div>
      </div>

      {/* Why I entered — always visible */}
      <div className="flex items-start gap-2 rounded bg-primary/5 p-2">
        <Info className="mt-0.5 size-3 shrink-0 text-primary/60" />
        <p className="text-xs leading-relaxed text-foreground/80">{trade.notes || 'No notes available.'}</p>
      </div>

      {/* Quick stats */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>
          Entry: <span className="font-mono font-semibold text-foreground">{fmtMoney(trade.entry_price)}</span>
        </span>
        <span>
          {isClosed ? 'Exit' : 'Live'}:{' '}
          <span className={`font-mono font-semibold ${isClosed ? 'text-foreground' : pnlColor}`}>
            {fmtMoney(displayPrice)}
          </span>
          {!isClosed && isStale && (
            <span className="ml-1 text-[9px] text-yellow-500">(stale)</span>
          )}
        </span>
        <span>
          Target: <span className="font-mono font-semibold text-green-500">{fmtMoney(trade.target_price)}</span>
        </span>
        <span>
          Stop: <span className="font-mono font-semibold text-red-500">{fmtMoney(trade.stop_loss)}</span>
        </span>
        <span>
          Qty: <span className="font-mono font-semibold text-foreground">{trade.quantity}</span>
        </span>
        <span>
          Sector: <span className="font-semibold text-foreground">{trade.sector}</span>
        </span>
      </div>

      {/* Expanded: full rationale */}
      {expanded && (
        <div className="flex flex-col gap-1 border-t border-border/30 pt-2">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center justify-between rounded bg-muted/30 px-2 py-1">
              <span className="text-muted-foreground">Max Loss</span>
              <span className="font-mono font-semibold text-red-400">
                {fmtPct((trade.stop_loss / trade.entry_price - 1) * 100, 1)}
              </span>
            </div>
            <div className="flex items-center justify-between rounded bg-muted/30 px-2 py-1">
              <span className="text-muted-foreground">Upside</span>
              <span className="font-mono font-semibold text-green-400">
                +{(((trade.target_price / trade.entry_price) - 1) * 100).toFixed(1)}%
              </span>
            </div>
            <div className="flex items-center justify-between rounded bg-muted/30 px-2 py-1">
              <span className="text-muted-foreground">$ P&amp;L</span>
              <span className={`font-mono font-semibold ${pnlColor}`}>{fmtAbs(trade.pnl_abs)}</span>
            </div>
            <div className="flex items-center justify-between rounded bg-muted/30 px-2 py-1">
              <span className="text-muted-foreground">Opened</span>
              <span className="font-mono text-foreground">{fmtDate(trade.created_at)}</span>
            </div>
            {isClosed && (
              <div className="flex items-center justify-between rounded bg-muted/30 px-2 py-1">
                <span className="text-muted-foreground">Closed</span>
                <span className="font-mono text-foreground">{fmtDate(trade.closed_at)}</span>
              </div>
            )}
            <div className="flex items-center justify-between rounded bg-muted/30 px-2 py-1">
              <span className="text-muted-foreground">Source</span>
              <span className="font-mono text-foreground">{trade.price_source}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatsBar({ stats }: { stats: PaperStats | null }) {
  if (!stats) return null;
  return (
    <div className="mb-3 grid grid-cols-4 gap-2">
      <div className="flex flex-col items-center justify-center rounded-lg bg-card p-2">
        <span className="text-[10px] text-muted-foreground">Win Rate</span>
        <span className={`font-mono text-base font-bold ${stats.winRate >= 50 ? 'text-green-500' : 'text-red-500'}`}>
          {stats.winRate.toFixed(0)}%
        </span>
        <span className="text-[10px] text-muted-foreground">{stats.wins}W/{stats.losses}L</span>
      </div>
      <div className="flex flex-col items-center justify-center rounded-lg bg-card p-2">
        <span className="text-[10px] text-muted-foreground">Avg Win</span>
        <span className="font-mono text-base font-bold text-green-500">
          +{stats.avgWinPct.toFixed(1)}%
        </span>
      </div>
      <div className="flex flex-col items-center justify-center rounded-lg bg-card p-2">
        <span className="text-[10px] text-muted-foreground">Avg Loss</span>
        <span className="font-mono text-base font-bold text-red-500">
          {stats.avgLossPct.toFixed(1)}%
        </span>
      </div>
      <div className="flex flex-col items-center justify-center rounded-lg bg-card p-2">
        <span className="text-[10px] text-muted-foreground">Total P&amp;L</span>
        <span className={`font-mono text-base font-bold ${stats.totalPnlPct >= 0 ? 'text-green-500' : 'text-red-500'}`}>
          {stats.totalPnlPct >= 0 ? '+' : ''}{stats.totalPnlPct.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}

function loadData(setTrades: (t: PaperTrade[]) => void, setStats: (s: PaperStats | null) => void, setAsOf: (s: string) => void, setError: (e: string | null) => void, setLoading: (l: boolean) => void) {
  // Always hit the Next.js proxy — it has the live-price enrichment logic.
  fetch('/api/paper-trading/history', { cache: 'no-store' })
    .then(async (r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return (await r.json()) as PaperHistoryResponse;
    })
    .then((data) => {
      const positions = Array.isArray(data?.positions) ? data.positions : [];
      setTrades(positions);
      setStats(data?.stats ?? null);
      setAsOf(data?.asOf ?? new Date().toISOString());
      setError(null);
    })
    .catch((err) => {
      setError(err instanceof Error ? err.message : 'Failed to load');
      setTrades([]);
      setStats(null);
    })
    .finally(() => setLoading(false));
}

export function PaperTradingHistoryWidget() {
  const [trades, setTrades] = useState<PaperTrade[]>([]);
  const [stats, setStats] = useState<PaperStats | null>(null);
  const [asOf, setAsOf] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('ALL');

  useEffect(() => {
    loadData(setTrades, setStats, setAsOf, setError, setLoading);
  }, []);

  const openCount = trades.filter((t) => t.status !== 'closed' && !t.close_reason).length;
  const closedCount = trades.filter((t) => t.status === 'closed' || t.close_reason != null).length;

  const filtered = tab === 'ALL'
    ? trades
    : tab === 'OPEN'
      ? trades.filter((t) => t.status !== 'closed' && !t.close_reason)
      : trades.filter((t) => t.status === 'closed' || t.close_reason != null);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'ALL', label: `All (${trades.length})` },
    { key: 'OPEN', label: `Open (${openCount})` },
    { key: 'CLOSED', label: `Closed (${closedCount})` },
  ];

  const refresh = () => {
    setLoading(true);
    loadData(setTrades, setStats, setAsOf, setError, setLoading);
  };

  return (
    <BaseWidget
      title="Paper Trading History"
      summary={
        stats
          ? `${stats.wins}W/${stats.losses}L · ${stats.winRate.toFixed(0)}% win rate · ${openCount} open`
          : `${openCount} open · ${closedCount} closed`
      }
      contextData={{
        label: 'Paper Trading',
        text: stats
          ? `Win rate ${stats.winRate.toFixed(0)}% across ${stats.totalTrades} closed. ${openCount} open.`
          : `${openCount} open positions.`,
      }}
      createdByNanobot
    >
      {loading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Bot className="size-5 animate-pulse" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground">
          <AlertCircle className="size-6 text-red-500" />
          <p className="text-sm">Could not load history</p>
          <p className="text-xs">{error}</p>
          <button
            type="button"
            onClick={refresh}
            className="mt-1 flex items-center gap-1 rounded bg-primary/10 px-2 py-1 text-xs text-primary hover:bg-primary/20"
          >
            <RefreshCw className="size-3" />
            Retry
          </button>
        </div>
      ) : (
        <>
          <StatsBar stats={stats} />

          <div className="mb-3 flex items-center justify-between">
            <div className="flex gap-1">
              {tabs.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={`rounded px-2 py-0.5 text-xs transition-colors ${
                    tab === key
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              {asOf && (
                <span className="text-[10px] text-muted-foreground">
                  <Activity className="mr-0.5 inline size-2.5" />
                  {fmtRelativeTime(asOf)}
                </span>
              )}
              <button
                type="button"
                onClick={refresh}
                className="rounded p-0.5 text-muted-foreground hover:bg-muted/50"
                title="Refresh"
                aria-label="Refresh"
              >
                <RefreshCw className="size-3" />
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground">
                <X className="size-6" />
                <p className="text-sm">No trades in this tab</p>
              </div>
            ) : (
              filtered.map((trade) => <TradeCard key={trade.id} trade={trade} />)
            )}
          </div>
        </>
      )}
    </BaseWidget>
  );
}
