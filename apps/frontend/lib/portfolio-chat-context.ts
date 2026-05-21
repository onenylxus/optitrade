import type { PortfolioChatContextValue } from '@/contexts/portfolio-context';

function roundNumber(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

export function buildPortfolioChatContextBlock(portfolio: PortfolioChatContextValue | null) {
  if (!portfolio) return '';

  const topPositions = [...portfolio.positions]
    .sort((left, right) => right.marketValue - left.marketValue)
    .slice(0, 8)
    .map((position) => ({
      symbol: position.symbol,
      quantity: roundNumber(position.quantity, 4),
      avgPrice: roundNumber(position.avgPrice),
      currentPrice: roundNumber(position.currentPrice),
      marketValue: roundNumber(position.marketValue),
      unrealizedPnl: roundNumber(position.unrealizedPnl),
      unrealizedPnlPercent: roundNumber(position.unrealizedPnlPercent, 4),
      sector: position.sector,
    }));

  const payload = {
    asOf: portfolio.asOf,
    baseCurrency: portfolio.baseCurrency,
    source: portfolio.source,
    broker: portfolio.broker,
    summary: {
      totalValue: roundNumber(portfolio.summary.totalValue),
      pnl: roundNumber(portfolio.summary.pnl),
      pnlPercent: roundNumber(portfolio.summary.pnlPercent, 4),
      dailyPnl: roundNumber(portfolio.summary.dailyPnl),
      dailyPnlPercent: roundNumber(portfolio.summary.dailyPnlPercent, 4),
      marginUsage: roundNumber(portfolio.summary.marginUsage),
    },
    sectorValues: portfolio.sectorValues
      .slice(0, 6)
      .map((sector) => ({
        sector: sector.sector,
        value: roundNumber(sector.value),
        percent: roundNumber(sector.percent, 4),
      })),
    topPositions,
  };

  return `Portfolio context for the current user. Use it when relevant and mention when data is demo or IBKR-connected.\n${JSON.stringify(payload, null, 2)}`;
}
