// apps/frontend/app/api/paper-trading/history/route.ts
// Returns paper-trading history enriched with live prices, derived strategy/sector/notes,
// and summary stats. Calls the FastAPI backend's /api/price/{symbol} for each open position
// so P&L reflects current market even between AI4Trade pushes.

import { NextResponse } from 'next/server';
import fs from 'fs';

const PORTFOLIO_PATH = '/root/optitrade-clone/apps/backend/data/paper_portfolios.json';
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
const PRICE_TIMEOUT_MS = 4000;

interface RawPosition {
  id: string;
  name?: string;
  status: 'open' | 'closed';
  side: 'LONG' | 'SHORT';
  symbol: string;
  entry_price: number;
  target_price: number;
  stop_loss: number;
  live_price?: number;
  quantity: number;
  agent?: string;
  agent_score?: number;
  market?: string;
  created_at: string;
  updated_at: string;
  current_price?: number;
  currentPrice?: number;
  pnl_pct?: number;
  close_reason?: string | null;
  closed_at?: string | null;
  _peak_price?: number;
  _orig_quantity?: number;
  _scaled?: boolean;
  _trailing_active?: boolean;
  _trail_stop?: number;
}

interface EnrichedPosition {
  id: string;
  symbol: string;
  name: string;
  status: 'open' | 'closed';
  side: 'LONG' | 'SHORT';
  entry_price: number;
  exit_price: number | null;
  current_price: number;
  live_price: number;
  target_price: number;
  stop_loss: number;
  quantity: number;
  pnl_pct: number;
  pnl_abs: number | null;
  strategy: string;
  sector: string;
  notes: string;
  close_reason: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  agent: string | null;
  agent_score: number | null;
  price_source: string;
  price_stale: boolean;
}

const SECTOR_BY_SYMBOL: Record<string, string> = {
  // AI / Semiconductors
  AMD: 'AI / Semiconductors',
  NVDA: 'AI / Semiconductors',
  AVGO: 'AI / Semiconductors',
  MU: 'AI / Semiconductors',
  INTC: 'AI / Semiconductors',
  SOUN: 'AI / Semiconductors',
  TSM: 'AI / Semiconductors',
  SMCI: 'AI / Semiconductors',
  ARM: 'AI / Semiconductors',
  // AI / Software & Internet
  GOOGL: 'Tech / Internet',
  META: 'Tech / Internet',
  MSFT: 'Tech / Software',
  AMZN: 'Tech / Internet',
  NFLX: 'Tech / Media',
  AAPL: 'Tech / Hardware',
  // Financials
  JPM: 'Financials',
  AXP: 'Financials',
  GS: 'Financials',
  BAC: 'Financials',
  V: 'Financials',
  MA: 'Financials',
  // Consumer
  TSLA: 'Consumer / Auto',
  WMT: 'Consumer / Retail',
  HD: 'Consumer / Retail',
  // Crypto-adjacent
  COIN: 'Crypto / Fintech',
  MSTR: 'Crypto / Fintech',
  // Other
  FIG: 'Tech / SaaS',
  UBER: 'Tech / Mobility',
  ABNB: 'Consumer / Travel',
  SHOP: 'Tech / SaaS',
  SQ: 'Fintech',
  PLTR: 'Tech / Software',
};

function sectorFor(symbol: string): string {
  return SECTOR_BY_SYMBOL[symbol.toUpperCase()] ?? 'Equity';
}

function strategyFor(p: RawPosition): string {
  if (p.agent) {
    return `AI4Trade — ${p.agent}`;
  }
  return 'AI4Trade';
}

function notesFor(p: RawPosition): string {
  const agent = p.agent ?? 'AI4Trade';
  const score = typeof p.agent_score === 'number' ? p.agent_score.toFixed(1) : '?';
  const openedDate = p.created_at ? new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'unknown';
  const side = p.side;
  const targetPct = p.entry_price && p.target_price ? (((p.target_price / p.entry_price) - 1) * 100).toFixed(1) : '?';
  const stopPct = p.entry_price && p.stop_loss ? (((p.stop_loss / p.entry_price) - 1) * 100).toFixed(1) : '?';
  return `${agent} entry on ${openedDate} (score ${score}/5). ${side} @ $${p.entry_price.toFixed(2)} → target +${targetPct}% / stop ${stopPct}%.`;
}

async function fetchLivePrice(symbol: string): Promise<{ price: number; source: string } | null> {
  const url = `${BACKEND_URL}/api/price/${encodeURIComponent(symbol)}`;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), PRICE_TIMEOUT_MS);
    const r = await fetch(url, { signal: ctrl.signal, cache: 'no-store' });
    clearTimeout(timer);
    if (!r.ok) return null;
    const data = (await r.json()) as { price?: number; source?: string };
    if (typeof data.price !== 'number' || data.price <= 0) return null;
    return { price: data.price, source: data.source ?? 'unknown' };
  } catch {
    return null;
  }
}

function pnlPct(entry: number, current: number, side: 'LONG' | 'SHORT'): number {
  if (side === 'LONG') {
    return ((current - entry) / entry) * 100;
  }
  return ((entry - current) / entry) * 100;
}

function loadPortfolio(): RawPosition[] {
  if (!fs.existsSync(PORTFOLIO_PATH)) return [];
  const raw = fs.readFileSync(PORTFOLIO_PATH, 'utf-8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) return [];
  return parsed as RawPosition[];
}

function buildStats(positions: EnrichedPosition[]) {
  const closed = positions.filter((p) => p.status === 'closed');
  if (closed.length === 0) return null;
  const wins = closed.filter((p) => p.pnl_pct >= 0);
  const losses = closed.filter((p) => p.pnl_pct < 0);
  const winRates = wins.map((p) => p.pnl_pct);
  const lossRates = losses.map((p) => p.pnl_pct);
  return {
    totalTrades: closed.length,
    wins: wins.length,
    losses: losses.length,
    winRate: (wins.length / closed.length) * 100,
    avgWinPct: winRates.length > 0 ? winRates.reduce((a, b) => a + b, 0) / winRates.length : 0,
    avgLossPct: lossRates.length > 0 ? lossRates.reduce((a, b) => a + b, 0) / lossRates.length : 0,
    totalPnlPct: closed.reduce((sum, p) => sum + (p.pnl_pct || 0), 0),
  };
}

export async function GET() {
  try {
    const raw = loadPortfolio();

    // Fetch live prices for all open positions in parallel
    const openSymbols = Array.from(new Set(raw.filter((p) => p.status === 'open').map((p) => p.symbol)));
    const livePriceMap = new Map<string, { price: number; source: string } | null>();
    await Promise.all(
      openSymbols.map(async (sym) => {
        const lp = await fetchLivePrice(sym);
        livePriceMap.set(sym, lp);
      }),
    );

    const enriched: EnrichedPosition[] = raw.map((p) => {
      const isOpen = p.status === 'open';
      let currentPrice: number;
      let priceSource: string;
      let priceStale = false;

      if (isOpen) {
        const lp = livePriceMap.get(p.symbol);
        if (lp) {
          currentPrice = lp.price;
          priceSource = lp.source;
        } else {
          // Fall back to whatever AI4Trade wrote
          currentPrice = p.currentPrice ?? p.current_price ?? p.live_price ?? p.entry_price;
          priceSource = 'snapshot';
          priceStale = true;
        }
      } else {
        // Closed positions: use currentPrice/exit price as-is
        currentPrice = p.currentPrice ?? p.current_price ?? p.entry_price;
        priceSource = 'snapshot';
      }

      const pnl_pct = pnlPct(p.entry_price, currentPrice, p.side);
      const pnl_abs = (currentPrice - p.entry_price) * p.quantity * (p.side === 'LONG' ? 1 : -1);

      return {
        id: p.id,
        symbol: p.symbol,
        name: p.name ?? `AI4Trade Copy — ${p.symbol}`,
        status: p.status,
        side: p.side,
        entry_price: p.entry_price,
        exit_price: !isOpen ? currentPrice : null,
        current_price: currentPrice,
        live_price: isOpen ? currentPrice : (p.live_price ?? currentPrice),
        target_price: p.target_price,
        stop_loss: p.stop_loss,
        quantity: p.quantity,
        pnl_pct,
        pnl_abs,
        strategy: strategyFor(p),
        sector: sectorFor(p.symbol),
        notes: notesFor(p),
        close_reason: p.close_reason ?? null,
        closed_at: p.closed_at ?? null,
        created_at: p.created_at,
        updated_at: p.updated_at,
        agent: p.agent ?? null,
        agent_score: p.agent_score ?? null,
        price_source: priceSource,
        price_stale: priceStale,
      };
    });

    const open = enriched.filter((p) => p.status === 'open');
    const closed = enriched.filter((p) => p.status === 'closed');
    const stats = buildStats(enriched);

    return NextResponse.json(
      {
        positions: enriched,
        open,
        closed,
        stats,
        asOf: new Date().toISOString(),
        source: 'paper_portfolios.json + live price enrichment',
      },
      { status: 200 },
    );
  } catch (err) {
    console.error('paper-trading/history error:', err);
    return NextResponse.json({ error: 'Failed to load history' }, { status: 500 });
  }
}
