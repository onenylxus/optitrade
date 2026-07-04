/**
 * Shared types for the earnings widget and its API route.
 */

export type EarningsTime = 'BMO' | 'AMC' | '—';
export type EarningsSource = 'fmp' | 'demo';

export interface EarningItem {
  ticker: string;
  companyName: string;
  date: string; // YYYY-MM-DD
  time: EarningsTime;
  epsEstimate: number | null;
  epsActual: number | null;
  surprise: number | null;
  fiscalPeriod: string;
  source: EarningsSource;
}

export interface EarningsResponse {
  earnings: EarningItem[];
  source: EarningsSource;
  warning?: string;
  asOf: string;
}
