/**
 * Shared types for the paper-trading-history widget and its API route.
 */

export type TradeStatus = 'open' | 'closed';
export type TradeSide = 'LONG' | 'SHORT';
export type CloseReason = 'STOP_LOSS' | 'TARGET_HIT' | 'TRAILING_STOP' | 'CLOSE' | null;

export interface PaperTrade {
  id: string;
  symbol: string;
  name: string;
  status: TradeStatus;
  side: TradeSide;
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
  close_reason: CloseReason;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  agent: string | null;
  agent_score: number | null;
  price_source: string;
  price_stale: boolean;
}

export interface PaperStats {
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  avgWinPct: number;
  avgLossPct: number;
  totalPnlPct: number;
}

export interface PaperHistoryResponse {
  positions: PaperTrade[];
  open: PaperTrade[];
  closed: PaperTrade[];
  stats: PaperStats | null;
  asOf: string;
  source: string;
}
