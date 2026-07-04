// apps/frontend/app/api/prediction/daily/route.ts
// AI-generated daily market prediction — computed server-side.
// Fetches live SPY, QQQ, ^VIX prices from the FastAPI backend's /api/price route
// (which itself uses FMP first and yfinance as a fallback).
//
// Outlook / F&G logic matches the table in docs/widgets/nanobot-widgets.md.

import { NextResponse } from 'next/server';
import { BACKEND_URL } from '@/lib/api/client';

export type Outlook = 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'VOLATILE';

export interface Prediction {
  date: string;
  outlook: Outlook;
  vix: number;
  fearGreed: number;
  marketSummary: string;
  keyLevels: {
    spy_upper: number;
    spy_lower: number;
    qqq_upper: number;
    qqq_lower: number;
  };
  topSignals: {
    symbol: string;
    direction: 'LONG' | 'SHORT';
    reason: string;
    confidence: number;
  }[];
  sectorPicks: {
    sector: string;
    stance: 'OVERWEIGHT' | 'UNDERWEIGHT' | 'NEUTRAL';
    reason: string;
  }[];
  risks: string[];
  catalystCalendar: {
    event: string;
    date: string;
    impact: 'HIGH' | 'MEDIUM' | 'LOW';
  }[];
  priceSource: {
    spy: string;
    qqq: string;
    vix: string;
  };
  asOf: string;
}

interface PriceResponse {
  symbol: string;
  price: number;
  source: string;
}

async function getLivePrices(): Promise<{ spy: number; qqq: number; vix: number; sources: { spy: string; qqq: string; vix: string } }> {
  const defaults = {
    spy: 645.0,
    qqq: 575.0,
    vix: 18.0,
    sources: { spy: 'fallback', qqq: 'fallback', vix: 'fallback' },
  };

  if (!BACKEND_URL) return defaults;

  const symbols: Array<keyof typeof defaults.sources> = ['spy', 'qqq', 'vix'];
  const tickers: Record<string, string> = { spy: 'SPY', qqq: 'QQQ', vix: '%5EVIX' };
  const results: Record<string, PriceResponse | null> = {};

  await Promise.all(
    symbols.map(async (k) => {
      const url = `${BACKEND_URL}/api/price/${tickers[k]}`;
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 5000);
        const r = await fetch(url, { signal: ctrl.signal, cache: 'no-store' });
        clearTimeout(timer);
        if (r.ok) {
          const data = (await r.json()) as PriceResponse;
          if (typeof data.price === 'number' && data.price > 0) {
            results[k] = data;
            return;
          }
        }
      } catch {
        /* fall through to default */
      }
      results[k] = null;
    }),
  );

  return {
    spy: results.spy?.price ?? defaults.spy,
    qqq: results.qqq?.price ?? defaults.qqq,
    vix: results.vix?.price ?? defaults.vix,
    sources: {
      spy: results.spy?.source ?? defaults.sources.spy,
      qqq: results.qqq?.source ?? defaults.sources.qqq,
      vix: results.vix?.source ?? defaults.sources.vix,
    },
  };
}

interface VixBracket {
  outlook: Outlook;
  fearGreed: number;
  marketSummary: string;
}

function bracketForVix(vix: number): VixBracket {
  if (vix >= 25) {
    return {
      outlook: 'VOLATILE',
      fearGreed: 15,
      marketSummary: 'Elevated volatility. High uncertainty — reduce exposure or hedge.',
    };
  }
  if (vix >= 20) {
    return {
      outlook: 'NEUTRAL',
      fearGreed: 38,
      marketSummary: 'Moderate volatility. Range-bound action likely today.',
    };
  }
  if (vix >= 15) {
    return {
      outlook: 'BULLISH',
      fearGreed: 52,
      marketSummary: 'Calm tape. Risk-on bias, momentum strategies favored.',
    };
  }
  if (vix >= 12) {
    return {
      outlook: 'BULLISH',
      fearGreed: 52,
      marketSummary: 'Quiet market. Trend continuation, watch for reversals.',
    };
  }
  // vix < 12
  return {
    outlook: 'BULLISH',
    fearGreed: 72,
    marketSummary: 'Complacent tape. Excessive calm — watch for volatility expansion.',
  };
}

function generatePrediction(
  spy: number,
  qqq: number,
  vix: number,
  sources: { spy: string; qqq: string; vix: string },
): Prediction {
  const { outlook, fearGreed, marketSummary } = bracketForVix(vix);
  const spread = 0.015;

  // Top signals — anchored to the highest-conviction AI/momentum names.
  // Refreshed manually; could be wired to Nanobot in a future iteration.
  const topSignals: Prediction['topSignals'] = [
    { symbol: 'NVDA', direction: 'LONG',  reason: 'AI GPU monopoly, institutional accumulation, momentum intact', confidence: 5 },
    { symbol: 'MU',   direction: 'LONG',  reason: 'HBM demand strong, AI infrastructure cycle intact, WSB favourite', confidence: 4 },
    { symbol: 'AVGO', direction: 'LONG',  reason: 'Custom AI silicon ramp, networking share gains', confidence: 4 },
    { symbol: 'INTC', direction: 'SHORT', reason: 'Lagging AI cycle, foundry burn, underperforming peers', confidence: 3 },
    { symbol: 'TSLA', direction: 'SHORT', reason: 'Extended valuation, macro headwinds, momentum exhaustion', confidence: 3 },
  ];

  const sectorPicks: Prediction['sectorPicks'] = [
    { sector: 'AI / Semiconductors',    stance: 'OVERWEIGHT',  reason: 'Continued AI capex, HBM demand, NVDA/MU/AVGO momentum' },
    { sector: 'Consumer Discretionary', stance: 'UNDERWEIGHT', reason: 'Rising rates pressure, consumer spending moderation' },
    { sector: 'Healthcare',             stance: 'NEUTRAL',     reason: 'Defensive hedge, mixed catalysts' },
  ];

  const risks: string[] = [
    'Fed hawkish repricing if CPI comes hot',
    'Geopolitical escalation (Taiwan Strait / Middle East)',
    'Q2 earnings season guidance risk',
    'VIX spike could trigger systematic deleveraging',
  ];

  const catalystCalendar: Prediction['catalystCalendar'] = [
    { event: 'US CPI Data',        date: 'next Wed', impact: 'HIGH'   },
    { event: 'Fed Rate Decision',  date: '~30 days', impact: 'HIGH'   },
    { event: 'Q2 Earnings Season', date: 'this week', impact: 'HIGH'  },
    { event: 'Jobless Claims',     date: 'this Thu', impact: 'MEDIUM' },
  ];

  return {
    date: new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }),
    outlook,
    vix,
    fearGreed,
    marketSummary,
    keyLevels: {
      spy_upper: round2(spy * (1 + spread)),
      spy_lower: round2(spy * (1 - spread)),
      qqq_upper: round2(qqq * (1 + spread)),
      qqq_lower: round2(qqq * (1 - spread)),
    },
    topSignals,
    sectorPicks,
    risks,
    catalystCalendar,
    priceSource: sources,
    asOf: new Date().toISOString(),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function GET() {
  try {
    const { spy, qqq, vix, sources } = await getLivePrices();
    const prediction = generatePrediction(spy, qqq, vix, sources);
    return NextResponse.json(prediction, { status: 200 });
  } catch (err) {
    console.error('prediction/daily error:', err);
    return NextResponse.json({ error: 'Failed to generate prediction' }, { status: 500 });
  }
}
