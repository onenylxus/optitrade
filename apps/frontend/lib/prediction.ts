/**
 * Shared types for the daily-prediction widget and its API route.
 */

export type Outlook = 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'VOLATILE';
export type SignalDirection = 'LONG' | 'SHORT';
export type SectorStance = 'OVERWEIGHT' | 'UNDERWEIGHT' | 'NEUTRAL';
export type Impact = 'HIGH' | 'MEDIUM' | 'LOW';

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
    direction: SignalDirection;
    reason: string;
    confidence: number;
  }[];
  sectorPicks: {
    sector: string;
    stance: SectorStance;
    reason: string;
  }[];
  risks: string[];
  catalystCalendar: {
    event: string;
    date: string;
    impact: Impact;
  }[];
  priceSource: {
    spy: string;
    qqq: string;
    vix: string;
  };
  asOf: string;
}
