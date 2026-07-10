'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect } from 'react';

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

export type PortfolioBrokerOption = 'ibkr' | 'futu' | 'mock';

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

  // Load portfolio from backend on mount
  useEffect(() => {
    fetch('/api/portfolio')
      .then((r) => r.json())
      .then((data) => {
        if (data && data.positions?.length) {
          setPortfolio({
            asOf: data.asOf ?? new Date().toISOString(),
            baseCurrency: data.baseCurrency ?? 'USD',
            source: data.source ?? 'backend',
            broker: {
              id: data.broker?.id,
              status: data.broker?.status ?? 'connected',
              name: data.broker?.name ?? 'OptiTrade',
              host: data.broker?.host,
              port: data.broker?.port,
              clientId: data.broker?.clientId,
              market: data.broker?.market,
              testnet: data.broker?.testnet,
              accountId: data.broker?.accountId,
              syncedAt: data.broker?.syncedAt,
              lastError: data.broker?.lastError,
            },
            summary: {
              totalValue: data.summary?.totalValue ?? 0,
              pnl: data.summary?.pnl ?? 0,
              pnlPercent: data.summary?.pnlPercent ?? 0,
              dailyPnl: data.summary?.dailyPnl ?? 0,
              dailyPnlPercent: data.summary?.dailyPnlPercent ?? 0,
              marginUsage: data.summary?.marginUsage ?? 0,
            },
            positions: (data.positions ?? []).map((p: {
              symbol: string;
              quantity: number;
              avgPrice: number;
              currentPrice: number;
              sector?: string;
              marketValue?: number;
              unrealizedPnl?: number;
              unrealizedPnlPercent?: number;
            }) => ({
              symbol: p.symbol,
              quantity: p.quantity,
              avgPrice: p.avgPrice,
              currentPrice: p.currentPrice,
              sector: p.sector ?? 'Unknown',
              marketValue: p.marketValue ?? p.quantity * p.currentPrice,
              unrealizedPnl: p.unrealizedPnl ?? 0,
              unrealizedPnlPercent: p.unrealizedPnlPercent ?? 0,
            })),
            sectorValues: data.sectorValues ?? [],
          });
        }
      })
      .catch(() => {
        // Backend not reachable — portfolio stays null
      });
  }, []);

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
