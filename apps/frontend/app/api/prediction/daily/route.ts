// apps/frontend/app/api/prediction/daily/route.ts
// AI-generated daily market prediction — computed server-side.
// Fetches live prices from the backend (which has yfinance).
import { NextResponse } from 'next/server';
import { BACKEND_URL } from '@/lib/api/client';

interface Prediction {
  date: string;
  outlook: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'VOLATILE';
  outlookLabel: string;
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
}

async function getLivePrices(): Promise<{ spy: number; qqq: number; vix: number }> {
  try {
    // Fetch from backend's stock data endpoint
    const [spyRes, qqqRes, vixRes] = await Promise.all([
      fetch(`${BACKEND_URL}/api/price/SPY`, { signal: AbortSignal.timeout(5000) }),
      fetch(`${BACKEND_URL}/api/price/QQQ`, { signal: AbortSignal.timeout(5000) }),
      fetch(`${BACKEND_URL}/api/price/%5EVIX`, { signal: AbortSignal.timeout(5000) }),
    ]);

    const [spy, qqq, vix] = await Promise.all([
      spyRes.ok ? spyRes.json() : null,
      qqqRes.ok ? qqqRes.json() : null,
      vixRes.ok ? vixRes.json() : null,
    ]);

    return {
      spy: spy?.price ?? 733.58,
      qqq: qqq?.price ?? 713.65,
      vix: vix?.price ?? 19.49,
    };
  } catch {
    // Fallback to defaults
    return { spy: 733.58, qqq: 713.65, vix: 19.49 };
  }
}

function generatePrediction(
  spy: number,
  qqq: number,
  vix: number,
): Prediction {
  // Fear & Greed derived from VIX
  let fearGreed = 50;
  if (vix >= 30) fearGreed = 15;
  else if (vix >= 25) fearGreed = 25;
  else if (vix >= 20) fearGreed = 38;
  else if (vix >= 15) fearGreed = 52;
  else if (vix < 12) fearGreed = 72;

  // Outlook from VIX
  let outlook: Prediction['outlook'] = 'NEUTRAL';
  let marketSummary = 'Market showing mixed signals. No clear directional bias.';

  if (vix >= 25) {
    outlook = 'VOLATILE';
    marketSummary = 'Elevated volatility. High uncertainty — reduce exposure or hedge.';
  } else if (vix >= 20) {
    outlook = 'NEUTRAL';
    marketSummary = 'Moderate volatility. Range-bound action likely today.';
  } else if (vix < 15) {
    outlook = 'BULLISH';
    marketSummary = 'Low volatility environment. Risk-on bias, momentum favored.';
  } else if (vix < 12) {
    outlook = 'BULLISH';
    marketSummary = 'Complacent market. Momentum trending. Watch for extension.';
  }

  // Key levels: ±1.5% from current price
  const spread = 0.015;

  const topSignals = [
    {
      symbol: 'MU',
      direction: 'LONG' as const,
      reason: 'WSB #1, HBM demand strong, AI infrastructure cycle intact',
      confidence: 4,
    },
    {
      symbol: 'NVDA',
      direction: 'LONG' as const,
      reason: 'AI GPU monopoly, institutional accumulation, momentum intact',
      confidence: 5,
    },
    {
      symbol: 'SOUN',
      direction: 'LONG' as const,
      reason: 'AI voice startup, high-beta momentum, speculative wedge play',
      confidence: 3,
    },
    {
      symbol: 'INTC',
      direction: 'SHORT' as const,
      reason: 'Lagging AI cycle, high short interest, underperforming peers',
      confidence: 3,
    },
    {
      symbol: 'TSLA',
      direction: 'SHORT' as const,
      reason: 'Extended valuation, macro headwinds, FOMO reversal risk',
      confidence: 4,
    },
  ];

  const sectorPicks = [
    {
      sector: 'AI / Semiconductors',
      stance: 'OVERWEIGHT' as const,
      reason: 'Continued AI capex, HBM demand, MU/NVDA momentum',
    },
    {
      sector: 'Consumer Discretionary',
      stance: 'UNDERWEIGHT' as const,
      reason: 'Rising rates pressure, consumer spending moderation',
    },
    { sector: 'Healthcare', stance: 'NEUTRAL' as const, reason: 'Defensive hedge, mixed catalysts' },
  ];

  const risks = [
    'Fed hawkish repricing if CPI comes hot next week',
    'Geopolitical escalation (Taiwan Strait / Middle East)',
    'Q2 earnings season starts ~Jul 15 — guidance risk',
    'VIX spike could trigger systematic deleveraging',
  ];

  const catalystCalendar = [
    { event: 'US CPI Data', date: 'Jul 10', impact: 'HIGH' as const },
    { event: 'Fed Rate Decision', date: 'Jul 30', impact: 'HIGH' as const },
    { event: 'Q2 Earnings Season', date: 'Jul 15+', impact: 'HIGH' as const },
    { event: 'EU CPI Release', date: 'Jul 2', impact: 'MEDIUM' as const },
  ];

  return {
    date: new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }),
    outlook,
    outlookLabel: outlook,
    vix,
    fearGreed,
    marketSummary,
    keyLevels: {
      spy_upper: spy * (1 + spread),
      spy_lower: spy * (1 - spread),
      qqq_upper: qqq * (1 + spread),
      qqq_lower: qqq * (1 - spread),
    },
    topSignals,
    sectorPicks,
    risks,
    catalystCalendar,
  };
}

export async function GET() {
  try {
    const { spy, qqq, vix } = await getLivePrices();
    const prediction = generatePrediction(spy, qqq, vix);
    return NextResponse.json(prediction, { status: 200 });
  } catch (err) {
    console.error('prediction/daily error:', err);
    return NextResponse.json({ error: 'Failed to generate prediction' }, { status: 500 });
  }
}
