'use client';

import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Brain,
  Calendar,
  Eye,
  RefreshCw,
  Star,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { BaseWidget } from './base-widget';
import type { Prediction, Outlook, Impact } from '@/lib/prediction';

const outlookConfig: Record<Outlook, { color: string; bg: string; Icon: React.ElementType; label: string }> = {
  BULLISH: { color: 'text-green-500',  bg: 'bg-green-500/10  border-green-500/30',  Icon: ArrowUp,        label: 'Bullish' },
  BEARISH: { color: 'text-red-500',    bg: 'bg-red-500/10    border-red-500/30',    Icon: ArrowDown,      label: 'Bearish' },
  NEUTRAL: { color: 'text-yellow-500', bg: 'bg-yellow-500/10 border-yellow-500/30', Icon: ArrowRight,     label: 'Neutral' },
  VOLATILE:{ color: 'text-orange-500', bg: 'bg-orange-500/10 border-orange-500/30', Icon: AlertTriangle, label: 'Volatile' },
};

const stanceConfig = {
  OVERWEIGHT:  { color: 'text-green-500',  label: 'Overweight' },
  UNDERWEIGHT: { color: 'text-red-500',    label: 'Underweight' },
  NEUTRAL:     { color: 'text-yellow-500', label: 'Neutral' },
} as const;

const impactConfig: Record<Impact, string> = {
  HIGH:   'bg-red-500/20 text-red-400',
  MEDIUM: 'bg-yellow-500/20 text-yellow-400',
  LOW:    'bg-gray-500/20 text-gray-400',
};

function FearGreedBar({ value }: { value: number }) {
  const label =
    value >= 75 ? 'Extreme Greed' :
    value >= 55 ? 'Greed' :
    value >= 45 ? 'Neutral' :
    value >= 25 ? 'Fear' : 'Extreme Fear';

  const color =
    value >= 55 ? 'bg-green-500' :
    value >= 45 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Fear &amp; Greed</span>
        <span className={`font-mono font-bold ${value >= 55 ? 'text-green-500' : value >= 45 ? 'text-yellow-500' : 'text-red-500'}`}>
          {value} — {label}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}

function ConfidenceDots({ level }: { level: number }) {
  const safe = Math.max(0, Math.min(5, level));
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`size-2 ${i <= safe ? 'fill-yellow-400 text-yellow-400' : 'text-muted'}`}
        />
      ))}
    </div>
  );
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

function fetchPrediction(): Promise<Prediction | null> {
  return fetch('/api/prediction/daily', { cache: 'no-store' })
    .then(async (r) => {
      if (!r.ok) return null;
      return (await r.json()) as Prediction;
    })
    .catch(() => null);
}

export function DailyPredictionWidget() {
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    fetchPrediction()
      .then((data) => {
        if (!data) {
          setError('Backend unreachable');
          setPrediction(null);
        } else {
          setPrediction(data);
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const outlook = prediction?.outlook ? outlookConfig[prediction.outlook] : outlookConfig.NEUTRAL;
  const OutlookIcon = outlook.Icon;

  return (
    <BaseWidget
      title="Daily Market Prediction"
      summary={
        prediction
          ? `${prediction.date} · ${outlook.label} · VIX ${prediction.vix.toFixed(2)}`
          : 'Heuristic daily outlook (VIX bracket)'
      }
      contextData={{
        label: 'Daily Prediction',
        text: prediction
          ? `${outlook.label} outlook. VIX ${prediction.vix.toFixed(2)} (Fear & Greed ${prediction.fearGreed}). ${prediction.marketSummary}`
          : 'Daily prediction not available',
      }}
      createdByNanobot
    >
      {loading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Brain className="size-5 animate-pulse" />
        </div>
      ) : error || !prediction ? (
        <div className="flex flex-col items-center justify-center gap-3 py-8 text-muted-foreground">
          <Brain className="size-8 opacity-30" />
          <p className="text-sm">No prediction available</p>
          <p className="text-xs">{error ?? 'Check back after market open'}</p>
          <button
            type="button"
            onClick={load}
            className="mt-1 flex items-center gap-1 rounded bg-primary/10 px-2 py-1 text-xs text-primary hover:bg-primary/20"
          >
            <RefreshCw className="size-3" />
            Retry
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4 overflow-y-auto pr-1">
          {/* Outlook banner */}
          <div className={`flex items-center gap-3 rounded-lg border p-3 ${outlook.bg}`}>
            <div className={`flex items-center justify-center rounded-full ${outlook.color}`}>
              <OutlookIcon className="size-5" />
            </div>
            <div className="flex-1">
              <p className={`font-bold ${outlook.color}`}>{outlook.label} Market</p>
              <p className="text-xs text-muted-foreground">{prediction.marketSummary}</p>
            </div>
          </div>

          {/* VIX + Fear/Greed */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between rounded-lg bg-card p-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="size-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">VIX</span>
              </div>
              <span className={`font-mono text-sm font-bold ${
                prediction.vix >= 20 ? 'text-orange-500' :
                prediction.vix >= 15 ? 'text-yellow-500' : 'text-green-500'
              }`}>
                {prediction.vix.toFixed(2)}
              </span>
            </div>
            <FearGreedBar value={prediction.fearGreed} />
          </div>

          {/* Key Levels */}
          {prediction.keyLevels && (
            <div className="rounded-lg border border-border/50 p-3">
              <div className="mb-2 flex items-center gap-2">
                <Eye className="size-3 text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground">KEY LEVELS</span>
                <span className="ml-auto text-[10px] text-muted-foreground">±1.5% from current</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  { label: 'SPY Upper', val: prediction.keyLevels.spy_upper, src: prediction.priceSource?.spy },
                  { label: 'SPY Lower', val: prediction.keyLevels.spy_lower, src: prediction.priceSource?.spy },
                  { label: 'QQQ Upper', val: prediction.keyLevels.qqq_upper, src: prediction.priceSource?.qqq },
                  { label: 'QQQ Lower', val: prediction.keyLevels.qqq_lower, src: prediction.priceSource?.qqq },
                ].map(({ label, val, src }) => (
                  <div key={label} className="flex items-center justify-between rounded bg-muted/50 px-2 py-1">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-mono font-semibold">${val.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top Signals */}
          {prediction.topSignals?.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Zap className="size-3 text-yellow-500" />
                <span className="text-xs font-semibold text-muted-foreground">TOP SIGNALS</span>
              </div>
              <div className="flex flex-col gap-1.5">
                {prediction.topSignals.map((sig, i) => (
                  <div key={`${sig.symbol}-${i}`} className="flex items-center justify-between rounded bg-muted/50 px-2 py-1.5">
                    <div className="flex items-center gap-2">
                      <span className={`rounded px-1 py-0.5 text-[10px] font-bold ${
                        sig.direction === 'LONG'
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}>
                        {sig.direction}
                      </span>
                      <span className="font-mono text-xs font-bold">{sig.symbol}</span>
                      <span className="hidden text-[10px] text-muted-foreground sm:inline">{sig.reason}</span>
                    </div>
                    <ConfidenceDots level={sig.confidence} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sector Picks */}
          {prediction.sectorPicks?.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Star className="size-3 text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground">SECTOR PICKS</span>
              </div>
              <div className="flex flex-col gap-1">
                {prediction.sectorPicks.map((s, i) => {
                  const sc = stanceConfig[s.stance];
                  return (
                    <div key={`${s.sector}-${i}`} className="flex items-center justify-between rounded bg-card px-2 py-1.5">
                      <span className="text-xs font-medium">{s.sector}</span>
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${sc.color}`}>
                        {sc.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Catalyst Calendar */}
          {prediction.catalystCalendar?.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Calendar className="size-3 text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground">CATALYST CALENDAR</span>
              </div>
              <div className="flex flex-col gap-1">
                {prediction.catalystCalendar.map((c, i) => (
                  <div key={`${c.event}-${i}`} className="flex items-center justify-between rounded bg-muted/50 px-2 py-1.5">
                    <span className="text-xs">{c.event}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground">{c.date}</span>
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${impactConfig[c.impact]}`}>
                        {c.impact}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Risks */}
          {prediction.risks?.length > 0 && (
            <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 p-3">
              <div className="mb-2 flex items-center gap-2">
                <AlertTriangle className="size-3 text-orange-500" />
                <span className="text-xs font-semibold text-orange-500">KEY RISKS</span>
              </div>
              <ul className="flex list-inside list-disc flex-col gap-0.5">
                {prediction.risks.map((r, i) => (
                  <li key={i} className="text-xs text-muted-foreground">{r}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Footer: data provenance + refresh */}
          <div className="flex items-center justify-between border-t border-border/30 pt-2 text-[10px] text-muted-foreground">
            <span>
              prices: SPY {prediction.priceSource?.spy ?? '—'} ·
              QQQ {prediction.priceSource?.qqq ?? '—'} ·
              VIX {prediction.priceSource?.vix ?? '—'}
            </span>
            <div className="flex items-center gap-2">
              <span>{fmtRelative(prediction.asOf)}</span>
              <button
                type="button"
                onClick={load}
                className="rounded p-0.5 hover:bg-muted/50"
                title="Refresh"
                aria-label="Refresh prediction"
              >
                <RefreshCw className="size-3" />
              </button>
            </div>
          </div>
        </div>
      )}
    </BaseWidget>
  );
}
