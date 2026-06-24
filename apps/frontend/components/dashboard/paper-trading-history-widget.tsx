'use client';

import React, { useEffect, useState } from 'react';
import { Bot, ChevronDown, ChevronUp, Info, TrendingDown, TrendingUp, X } from 'lucide-react';
import { BaseWidget } from './base-widget';
import { BACKEND_URL } from '@/lib/api/client';

type TradeStatus = 'open' | 'closed';
type CloseReason = 'STOP_LOSS' | 'TARGET_HIT' | 'TRAILING_STOP' | 'CLOSE' | null;

interface Trade {
  id: string;
  symbol: string;
  strategy: string;
  side: string;
  status: TradeStatus;
  avgPrice: number;
  entry_price: number;
  currentPrice: number;
  live_price?: number;
  quantity: number;
  target_price: number;
  stop_loss: number;
  pnl_pct: number;
  close_reason: CloseReason;
  closed_at: string | null;
  sector: string;
  notes: string;
  created_at: string;
}

interface HistoryStats {
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  avgWinPct: number;
  avgLossPct: number;
  totalPnlPct: number;
}

function computeStats(trades: Trade[]): HistoryStats | null {
  const closed = trades.filter((t) => t.status === 'closed' || t.close_reason);
  if (closed.length === 0) return null;
  const wins = closed.filter((t) => t.pnl_pct >= 0);
  const losses = closed.filter((t) => t.pnl_pct < 0);
  const winRates = wins.map((t) => t.pnl_pct);
  const lossRates = losses.map((t) => t.pnl_pct);
  return {
    totalTrades: closed.length,
    wins: wins.length,
    losses: losses.length,
    winRate: (wins.length / closed.length) * 100,
    avgWinPct: winRates.length > 0 ? winRates.reduce((a, b) => a + b, 0) / winRates.length : 0,
    avgLossPct: lossRates.length > 0 ? lossRates.reduce((a, b) => a + b, 0) / lossRates.length : 0,
    totalPnlPct: closed.reduce((sum, t) => sum + (t.pnl_pct || 0), 0),
  };
}

const REASON_BADGE: Record<string, string> = {
  STOP_LOSS: 'bg-red-500/20 text-red-400',
  TARGET_HIT: 'bg-green-500/20 text-green-400',
  TRAILING_STOP: 'bg-blue-500/20 text-blue-400',
  CLOSE: 'bg-gray-500/20 text-gray-400',
};

function TradeCard({ trade }: { trade: Trade }) {
  const [expanded, setExpanded] = useState(false);
  const isWin = trade.pnl_pct >= 0;
  const pnlColor = isWin ? 'text-green-500' : 'text-red-500';
  const bgColor = isWin ? 'bg-green-500/5' : 'bg-red-500/5';
  const borderColor = isWin ? 'border-green-500/20' : 'border-red-500/20';
  const Icon = isWin ? TrendingUp : TrendingDown;
  const isClosed = trade.status === 'closed' || trade.close_reason != null;

  return (
    <div className={`flex flex-col gap-2 rounded-lg border ${borderColor} ${bgColor} p-3 transition-all`}>
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-bold">{trade.symbol}</span>
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
            trade.side === 'LONG' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
          }`}>
            {trade.side}
          </span>
          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary/70">
            {trade.strategy}
          </span>
          {isClosed && trade.close_reason && (
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${REASON_BADGE[trade.close_reason] || 'bg-gray-500/20 text-gray-400'}`}>
              {trade.close_reason?.replace('_', ' ')}
            </span>
          )}
          {!isClosed && (
            <span className="rounded bg-blue-500/20 px-1.5 py-0.5 text-[10px] font-bold text-blue-400">
              OPEN
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`flex items-center gap-0.5 ${pnlColor}`}>
            <Icon className="size-3" />
            <span className="font-mono text-sm font-bold">
              {isWin ? '+' : ''}{trade.pnl_pct.toFixed(2)}%
            </span>
          </span>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center justify-center rounded p-0.5 text-muted-foreground hover:bg-muted/50"
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
          Entry: <span className="font-mono font-semibold text-foreground">${trade.entry_price.toFixed(2)}</span>
        </span>
        {isClosed ? (
          <span>
            Exit: <span className="font-mono font-semibold text-foreground">${trade.currentPrice.toFixed(2)}</span>
          </span>
        ) : (
          <span>
            Live: <span className={`font-mono font-semibold ${pnlColor}`}>${(trade.live_price || trade.currentPrice).toFixed(2)}</span>
          </span>
        )}
        <span>
          Target: <span className="font-mono font-semibold text-green-500">${trade.target_price.toFixed(2)}</span>
        </span>
        <span>
          Stop: <span className="font-mono font-semibold text-red-500">${trade.stop_loss.toFixed(2)}</span>
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
                {((trade.stop_loss / trade.entry_price - 1) * 100).toFixed(1)}%
              </span>
            </div>
            <div className="flex items-center justify-between rounded bg-muted/30 px-2 py-1">
              <span className="text-muted-foreground">Upside</span>
              <span className="font-mono font-semibold text-green-400">
                +{((trade.target_price / trade.entry_price - 1) * 100).toFixed(1)}%
              </span>
            </div>
            <div className="flex items-center justify-between rounded bg-muted/30 px-2 py-1">
              <span className="text-muted-foreground">Opened</span>
              <span className="font-mono text-foreground">
                {trade.created_at ? new Date(trade.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
              </span>
            </div>
            {isClosed && (
              <div className="flex items-center justify-between rounded bg-muted/30 px-2 py-1">
                <span className="text-muted-foreground">Closed</span>
                <span className="font-mono text-foreground">
                  {trade.closed_at ? new Date(trade.closed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatsBar({ stats }: { stats: HistoryStats | null }) {
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
        <span className="text-[10px] text-muted-foreground">Total P&L</span>
        <span className={`font-mono text-base font-bold ${stats.totalPnlPct >= 0 ? 'text-green-500' : 'text-red-500'}`}>
          {stats.totalPnlPct >= 0 ? '+' : ''}{stats.totalPnlPct.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}

type Tab = 'ALL' | 'OPEN' | 'CLOSED';

export function PaperTradingHistoryWidget() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('ALL');

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/paper-trading/history`)
      .then((r) => r.json())
      .then((data) => {
        // Guard: API can return { error } on failure, or { positions } on success
        if (!data) { setTrades([]); return; }
        const positions: Trade[] = Array.isArray(data)
          ? data
          : Array.isArray(data.positions) ? data.positions : [];
        setTrades(positions);
      })
      .catch(() => {
        fetch('/api/paper-trading/history')
          .then((r) => r.json())
          .then((d) => {
            if (!d) { setTrades([]); return; }
            const positions: Trade[] = Array.isArray(d)
              ? d
              : Array.isArray(d.positions) ? d.positions : [];
            setTrades(positions);
          })
          .catch(() => setTrades([]));
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = Array.isArray(trades)
    ? tab === 'ALL'
      ? trades
      : tab === 'OPEN'
        ? trades.filter((t) => t.status !== 'closed' && !t.close_reason)
        : trades.filter((t) => t.status === 'closed' || t.close_reason)
    : [];

  const stats = Array.isArray(trades) ? computeStats(trades) : null;
  const tabs: { key: Tab; label: string }[] = [
    { key: 'ALL', label: `All (${trades.length})` },
    { key: 'OPEN', label: `Open (${filtered.filter((t) => t.status !== 'closed' && !t.close_reason).length})` },
    { key: 'CLOSED', label: `Closed (${filtered.filter((t) => t.status === 'closed' || t.close_reason).length})` },
  ];

  return (
    <BaseWidget
      title="Paper Trading History"
      summary={
        stats
          ? `${stats.wins}W/${stats.losses}L · ${stats.winRate.toFixed(0)}% win rate`
          : `${trades.length} position${trades.length !== 1 ? 's' : ''} open`
      }
      createdByNanobot
    >
      {loading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Bot className="size-5 animate-pulse" />
        </div>
      ) : (
        <>
          <StatsBar stats={stats} />

          {/* Tabs */}
          <div className="mb-3 flex gap-1">
            {tabs.map(({ key, label }) => (
              <button
                key={key}
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

          {/* Trade list */}
          <div className="flex flex-col gap-2 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground">
                <X className="size-6" />
                <p className="text-sm">No trades in this tab</p>
              </div>
            ) : (
              filtered.map((trade) => (
                <TradeCard key={trade.id} trade={trade} />
              ))
            )}
          </div>
        </>
      )}
    </BaseWidget>
  );
}
