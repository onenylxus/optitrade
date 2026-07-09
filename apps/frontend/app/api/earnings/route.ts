// apps/frontend/app/api/earnings/route.ts
// Returns upcoming earnings from FMP earnings-calendar. Caches for 6 hours.
// Annotates BMO/AMC timing for known tickers (FMP doesn't provide timing on
// the bulk endpoint). Falls back to a demo dataset if FMP is unreachable.

import { NextResponse } from 'next/server';

interface FmpEarningRow {
  symbol: string;
  date: string;
  epsActual: number | null;
  epsEstimated: number | null;
  revenueActual: number | null;
  revenueEstimated: number | null;
  fiscalDateEnding?: string;
  lastUpdated?: string;
}

interface EarningItem {
  ticker: string;
  companyName: string;
  date: string;
  time: 'BMO' | 'AMC' | '—';
  epsEstimate: number | null;
  epsActual: number | null;
  surprise: number | null;
  fiscalPeriod: string;
  source: 'fmp' | 'demo';
}

const KNOWN_TIME: Record<string, 'BMO' | 'AMC'> = {
  JPM: 'BMO', WFC: 'BMO', C: 'BMO', BAC: 'BMO', GS: 'BMO', MS: 'BMO', AXP: 'BMO', BLK: 'BMO',
  PFE: 'BMO', JNJ: 'BMO', MRK: 'BMO', ABT: 'BMO', UNH: 'BMO', HON: 'BMO', PG: 'BMO', KO: 'BMO',
  PEP: 'BMO', MCD: 'BMO', CAT: 'BMO', VZ: 'BMO', T: 'BMO', NKE: 'BMO', BA: 'BMO', CVX: 'BMO',
  AAPL: 'AMC', MSFT: 'AMC', GOOGL: 'AMC', GOOG: 'AMC', META: 'AMC', AMZN: 'AMC', NVDA: 'AMC',
  TSLA: 'AMC', NFLX: 'AMC', AMD: 'AMC', INTC: 'AMC', AVGO: 'AMC', MU: 'AMC', QCOM: 'AMC',
  CRM: 'AMC', ORCL: 'AMC', ADBE: 'AMC', SHOP: 'AMC', UBER: 'AMC', ABNB: 'AMC', PYPL: 'AMC',
  SQ: 'AMC', COIN: 'AMC', PLTR: 'AMC', SNOW: 'AMC', CRWD: 'AMC', ZS: 'AMC', DDOG: 'AMC',
  DIS: 'AMC', SBUX: 'AMC', HD: 'AMC', LOW: 'AMC', TGT: 'AMC', WMT: 'AMC', COST: 'AMC',
  FIG: 'AMC', RBLX: 'AMC', DASH: 'AMC', MAR: 'AMC', CMCSA: 'AMC',
};

const KNOWN_COMPANIES: Record<string, string> = {
  AAPL: 'Apple Inc', MSFT: 'Microsoft Corp', GOOGL: 'Alphabet Inc', META: 'Meta Platforms',
  AMZN: 'Amazon.com Inc', NVDA: 'NVIDIA Corp', TSLA: 'Tesla Inc', NFLX: 'Netflix Inc',
  JPM: 'JPMorgan Chase', BAC: 'Bank of America', GS: 'Goldman Sachs', MS: 'Morgan Stanley',
  AXP: 'American Express', WFC: 'Wells Fargo', C: 'Citigroup', BLK: 'BlackRock',
  V: 'Visa Inc', MA: 'Mastercard', PYPL: 'PayPal', SQ: 'Block Inc',
  AMD: 'Advanced Micro Devices', INTC: 'Intel Corp', AVGO: 'Broadcom Inc', MU: 'Micron Technology',
  QCOM: 'Qualcomm Inc', CRM: 'Salesforce', ORCL: 'Oracle Corp', ADBE: 'Adobe Inc',
  SHOP: 'Shopify Inc', UBER: 'Uber Technologies', ABNB: 'Airbnb Inc',
  COIN: 'Coinbase Global', MSTR: 'MicroStrategy', PLTR: 'Palantir Technologies',
  SNOW: 'Snowflake Inc', CRWD: 'CrowdStrike', ZS: 'Zscaler', DDOG: 'Datadog',
  DIS: 'Walt Disney Co', SBUX: 'Starbucks', HD: 'Home Depot', LOW: "Lowe's",
  TGT: 'Target Corp', WMT: 'Walmart', COST: 'Costco', NKE: 'Nike',
  KO: 'Coca-Cola', PEP: 'PepsiCo', MCD: "McDonald's", PG: 'Procter & Gamble',
  PFE: 'Pfizer', JNJ: 'Johnson & Johnson', MRK: 'Merck & Co', ABT: 'Abbott Labs',
  UNH: 'UnitedHealth', HON: 'Honeywell', VZ: 'Verizon', T: 'AT&T', BA: 'Boeing',
  CVX: 'Chevron', XOM: 'Exxon Mobil', CAT: 'Caterpillar', FIG: 'Figma Inc',
  MAR: 'Marriott Intl', CMCSA: 'Comcast', RBLX: 'Roblox', DASH: 'DoorDash',
  SONY: 'Sony Group', CSCO: 'Cisco Systems', FUBO: 'fuboTV',
};

function fiscalPeriod(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return '';
  const month = d.getMonth(); // 0-11
  const year = d.getFullYear();
  const fy = month >= 9 ? year + 1 : year;
  const q = month <= 2 ? 1 : month <= 5 ? 2 : month <= 8 ? 3 : 4;
  return `Q${q} FY${String(fy).slice(-2)}`;
}

let _cache: { ts: number; data: EarningItem[]; source: EarningItem['source'] } | null = null;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

async function fetchFromFmp(): Promise<EarningItem[] | null> {
  const key = process.env.FMP_API_KEY;
  if (!key) return null;
  const today = new Date();
  const from = today.toISOString().slice(0, 10);
  const toDate = new Date(today.getTime() + 21 * 86400000);
  const to = toDate.toISOString().slice(0, 10);
  const url = `https://financialmodelingprep.com/stable/earnings-calendar?from=${from}&to=${to}&apikey=${key}`;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(url, { signal: ctrl.signal, cache: 'no-store' });
    clearTimeout(timer);
    if (!r.ok) return null;
    const data = (await r.json()) as FmpEarningRow[];
    if (!Array.isArray(data)) return null;

    // Dedupe by ticker (FMP sometimes returns multiple rows for same ticker)
    const byTicker = new Map<string, FmpEarningRow>();
    for (const row of data) {
      if (!row?.symbol || !row?.date) continue;
      const existing = byTicker.get(row.symbol);
      if (!existing || row.date < existing.date) {
        byTicker.set(row.symbol, row);
      }
    }

    const items: EarningItem[] = Array.from(byTicker.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((row) => {
        const ticker = row.symbol.toUpperCase();
        const timeKnown = KNOWN_TIME[ticker];
        return {
          ticker,
          companyName: KNOWN_COMPANIES[ticker] ?? ticker,
          date: row.date,
          time: timeKnown ?? '—',
          epsEstimate: row.epsEstimated ?? null,
          epsActual: row.epsActual ?? null,
          surprise: null,
          fiscalPeriod: fiscalPeriod(row.date),
          source: 'fmp',
        } satisfies EarningItem;
      });

    return items;
  } catch {
    return null;
  }
}

const DEMO_EARNINGS: EarningItem[] = [
  { ticker: 'NVDA', companyName: 'NVIDIA Corp', date: '2026-05-21', time: 'AMC', epsEstimate: 2.09, epsActual: null, surprise: null, fiscalPeriod: 'Q2 FY26', source: 'demo' },
  { ticker: 'JPM', companyName: 'JPMorgan Chase', date: '2026-07-14', time: 'BMO', epsEstimate: 5.39, epsActual: null, surprise: null, fiscalPeriod: 'Q2 FY26', source: 'demo' },
  { ticker: 'NFLX', companyName: 'Netflix Inc', date: '2026-07-17', time: 'AMC', epsEstimate: 0.79, epsActual: null, surprise: null, fiscalPeriod: 'Q2 FY26', source: 'demo' },
  { ticker: 'GOOGL', companyName: 'Alphabet Inc', date: '2026-07-24', time: 'BMO', epsEstimate: 2.88, epsActual: null, surprise: null, fiscalPeriod: 'Q2 FY26', source: 'demo' },
  { ticker: 'META', companyName: 'Meta Platforms', date: '2026-07-30', time: 'AMC', epsEstimate: 7.53, epsActual: null, surprise: null, fiscalPeriod: 'Q2 FY26', source: 'demo' },
  { ticker: 'MSFT', companyName: 'Microsoft Corp', date: '2026-07-30', time: 'BMO', epsEstimate: 4.24, epsActual: null, surprise: null, fiscalPeriod: 'Q4 FY26', source: 'demo' },
  { ticker: 'AAPL', companyName: 'Apple Inc', date: '2026-07-31', time: 'AMC', epsEstimate: 1.9, epsActual: null, surprise: null, fiscalPeriod: 'Q3 FY26', source: 'demo' },
  { ticker: 'AMZN', companyName: 'Amazon.com Inc', date: '2026-07-31', time: 'AMC', epsEstimate: 1.81, epsActual: null, surprise: null, fiscalPeriod: 'Q2 FY26', source: 'demo' },
  { ticker: 'FIG', companyName: 'Figma Inc', date: '2026-08-15', time: 'AMC', epsEstimate: 0.04, epsActual: null, surprise: null, fiscalPeriod: 'Q2 FY26', source: 'demo' },
];

export async function GET() {
  const now = Date.now();
  if (_cache && now - _cache.ts < CACHE_TTL_MS) {
    return NextResponse.json(
      { earnings: _cache.data, source: _cache.source, asOf: new Date(_cache.ts).toISOString() },
      { status: 200 },
    );
  }

  const fmpData = await fetchFromFmp();
  if (fmpData && fmpData.length > 0) {
    _cache = { ts: now, data: fmpData, source: 'fmp' };
    return NextResponse.json(
      { earnings: fmpData, source: 'fmp', asOf: new Date(now).toISOString() },
      { status: 200 },
    );
  }

  // Fallback to demo. Mark the source clearly so the widget can surface it.
  _cache = { ts: now, data: DEMO_EARNINGS, source: 'demo' };
  return NextResponse.json(
    {
      earnings: DEMO_EARNINGS,
      source: 'demo',
      warning: 'FMP unreachable; serving demo data',
      asOf: new Date(now).toISOString(),
    },
    { status: 200 },
  );
}
