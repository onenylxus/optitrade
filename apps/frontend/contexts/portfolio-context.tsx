'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useState } from 'react';

export interface PortfolioChatPosition {
  symbol: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  sector: string;
  marketValue: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
}

export interface PortfolioChatSummary {
  totalValue: number;
  pnl: number;
  pnlPercent: number;
  dailyPnl: number;
  dailyPnlPercent: number;
  marginUsage: number;
  buyingPower?: number;
}

export interface PortfolioChatContextValue {
  asOf: string;
  baseCurrency: string;
  source: 'backend' | 'paper';
  broker: {
    id?: PortfolioBrokerOption;
    status: 'connected' | 'configured' | 'disconnected';
    name: string;
    host?: string;
    port?: number;
    clientId?: number;
    market?: string;
    testnet?: boolean;
    accountId?: string;
    syncedAt?: string;
    lastError?: string;
  };
  summary: PortfolioChatSummary;
  positions: PortfolioChatPosition[];
  sectorValues: Array<{ sector: string; value: number; percent: number }>;
}

export type PortfolioBrokerOption = 'ibkr' | 'futu' | 'binance' | 'mock';

interface PortfolioContextState {
  portfolio: PortfolioChatContextValue | null;
  includeInChatContext: boolean;
  setPortfolio: (portfolio: PortfolioChatContextValue | null) => void;
  setIncludeInChatContext: (include: boolean) => void;
}

const PortfolioContext = createContext<PortfolioContextState>({
  portfolio: null,
  includeInChatContext: false,
  setPortfolio: () => undefined,
  setIncludeInChatContext: () => undefined,
});

export function PortfolioProvider({ children }: { children: ReactNode }) {
  const [portfolio, setPortfolio] = useState<PortfolioChatContextValue | null>(null);
  const [includeInChatContext, setIncludeInChatContext] = useState(false);

  return (
    <PortfolioContext.Provider
      value={{ portfolio, includeInChatContext, setPortfolio, setIncludeInChatContext }}
    >
      {children}
    </PortfolioContext.Provider>
  );
}

export function usePortfolioContext() {
  return useContext(PortfolioContext);
}
