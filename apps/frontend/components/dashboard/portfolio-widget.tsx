import { useState, useMemo } from 'react';
import { RefreshCw, MessageSquare, TrendingUp, TrendingDown, CheckCircle2 } from 'lucide-react';
import { BaseWidget } from './base-widget';
import { Separator } from '../ui/separator';

// Temporary Types to ensure it builds
export interface Stock {
    id: string;
    symbol: string;
    quantity: number;
    avgPrice: number;
    currentPrice: number;
    sector: string;
}

const MOCK_STOCKS: Stock[] = [
    { id: '1', symbol: 'NVDA', quantity: 200, avgPrice: 120, currentPrice: 145.75, sector: 'Technology' },
    { id: '2', symbol: 'AAPL', quantity: 100, avgPrice: 175, currentPrice: 189.50, sector: 'Technology' },
    { id: '3', symbol: 'TSLA', quantity: 50, avgPrice: 160, currentPrice: 182.30, sector: 'Energy' },
];

export function PortfolioWidget({ size = 'large' }: { size: 'small' | 'medium' | 'large' }) {
    const [isSyncing, setIsSyncing] = useState(false);

    const portfolioSummary = useMemo(() => {
        const totalValue = MOCK_STOCKS.reduce((sum, s) => sum + s.currentPrice * s.quantity, 0);
        const totalCost = MOCK_STOCKS.reduce((sum, s) => sum + s.avgPrice * s.quantity, 0);
        return { totalValue, pnl: totalValue - totalCost, pnlPercent: ((totalValue - totalCost) / totalCost) * 100 };
    }, []);

    const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

    // 1x1 SMALL LAYOUT
    if (size === 'small') {
        return (
            <BaseWidget title="P/L" isAiWidget={false} className="flex items-center justify-center">
                <div className="text-center">
                    <div className={`text-3xl font-bold ${portfolioSummary.pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {portfolioSummary.pnlPercent.toFixed(2)}%
                    </div>
                    <button className="mt-2 text-slate-500 hover:text-white"><MessageSquare size={16} /></button>
                </div>
            </BaseWidget>
        );
    }

    // LARGE 4x5 LAYOUT (Matches your wireframe)
    return (
        <BaseWidget
            title="Portfolio Optimizer"
            description="Status: Connected (IBKR)"
            isAiWidget={true} // Adds the Sparkles icon from your BaseWidget
        >
            <div className="flex flex-col h-full gap-4">
                <div className="flex justify-between items-center px-1">
                    <div className="flex gap-4">
                        <div><p className="text-xs text-slate-500">Total Value</p><p className="font-bold">{formatCurrency(portfolioSummary.totalValue)}</p></div>
                        <div><p className="text-xs text-slate-500">Day P/L</p><p className="font-bold text-green-500">+{formatCurrency(portfolioSummary.pnl)}</p></div>
                    </div>
                    <button className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors">
                        <MessageSquare size={14} /> Add to Chat Context
                    </button>
                </div>

                <div className="flex-1 overflow-auto border rounded-md border-slate-800">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-900/50 sticky top-0">
                            <tr className="text-left text-slate-400 border-b border-slate-800">
                                <th className="p-2">Symbol</th>
                                <th className="p-2 text-right">Qty</th>
                                <th className="p-2 text-right">Total G/L</th>
                            </tr>
                        </thead>
                        <tbody>
                            {MOCK_STOCKS.map(stock => (
                                <tr key={stock.id} className="border-b border-slate-800/50">
                                    <td className="p-2 font-medium">{stock.symbol}</td>
                                    <td className="p-2 text-right">{stock.quantity}</td>
                                    <td className="p-2 text-right text-green-400">+{formatCurrency((stock.currentPrice - stock.avgPrice) * stock.quantity)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </BaseWidget>
    );
}