// apps/frontend/app/api/paper-trading/history/route.ts
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

function loadPortfolio() {
  // Absolute path — avoids Next.js process.cwd() path resolution issues
  const jsonPath = '/root/optitrade-clone/apps/backend/data/paper_portfolios.json';
  if (!fs.existsSync(jsonPath)) return [];
  return JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
}

export async function GET() {
  try {
    const positions = loadPortfolio();

    const closed = positions.filter(
      (p: Record<string, unknown>) => p.status === 'closed' || (p as { close_reason?: string }).close_reason,
    );
    const open = positions.filter((p: Record<string, unknown>) => p.status === 'open');

    let stats = null;
    if (closed.length > 0) {
      const wins = closed.filter((p: Record<string, unknown>) => (p as { pnl_pct: number }).pnl_pct >= 0);
      const losses = closed.filter((p: Record<string, unknown>) => (p as { pnl_pct: number }).pnl_pct < 0);
      const winRates = wins.map((p: Record<string, unknown>) => (p as { pnl_pct: number }).pnl_pct);
      const lossRates = losses.map((p: Record<string, unknown>) => (p as { pnl_pct: number }).pnl_pct);
      stats = {
        totalTrades: closed.length,
        wins: wins.length,
        losses: losses.length,
        winRate: (wins.length / closed.length) * 100,
        avgWinPct: winRates.length > 0 ? winRates.reduce((a: number, b: number) => a + b, 0) / winRates.length : 0,
        avgLossPct: lossRates.length > 0 ? lossRates.reduce((a: number, b: number) => a + b, 0) / lossRates.length : 0,
        totalPnlPct: closed.reduce((sum: number, p: Record<string, unknown>) => sum + ((p as { pnl_pct: number }).pnl_pct || 0), 0),
      };
    }

    return NextResponse.json({ positions, open, closed, stats }, { status: 200 });
  } catch (err) {
    console.error('paper-trading/history error:', err);
    return NextResponse.json({ error: 'Failed to load history' }, { status: 500 });
  }
}
