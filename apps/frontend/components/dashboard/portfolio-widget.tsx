import { useState, useMemo } from 'react';
import { RefreshCw, MessageSquare, TrendingUp, TrendingDown, CheckCircle2, Sparkles } from 'lucide-react';
import { ChartWidget } from './chart-widget'; // Adjust path if necessary
import { ChartConfig } from '@/components/ui/chart';

// --- Internal Types (Fixes 'Module Not Found' errors) ---
export interface Stock {
    id: string;
    symbol: string;
    quantity: number;
    avgPrice: number;
    currentPrice: number;
    sector: string;
}

interface PortfolioWidgetProps {
    size: 'small' | 'medium' | 'large';
}

// --- Chart Configuration ---
const chartConfig = {
    Technology: { label: 'Tech', color: '#3B82F6' },
    Energy: { label: 'Energy', color: '#F59E0B' },
    Cash: { label: 'Cash', color: '#10B981' },
} satisfies ChartConfig;

const MOCK_STOCKS: Stock[] = [
    { id: '1', symbol: 'NVDA', quantity: 200, avgPrice: 120, currentPrice: 145.75, sector: 'Technology' },
    { id: '2', symbol: 'AAPL', quantity: 100, avgPrice: 175, currentPrice: 189.50, sector: 'Technology' },
    { id: '3', symbol: 'TSLA', quantity: 50, avgPrice: 160, currentPrice: 182.30, sector: 'Energy' },
];

export function PortfolioWidget({ size }: PortfolioWidgetProps) {
    const [stocks] = useState<Stock[]>(MOCK_STOCKS);
    const [isSyncing, setIsSyncing] = useState(false);

    // --- Calculations ---
    const portfolioSummary = useMemo(() => {
        const totalValue = stocks.reduce((sum, s) => sum + s.currentPrice * s.quantity, 0);
        const totalCost = stocks.reduce((sum, s) => sum + s.avgPrice * s.quantity, 0);
        const pnl = totalValue - totalCost;
        const pnlPercent = totalCost > 0 ? (pnl / totalCost) * 100 : 0;
        return { totalValue, pnl, pnlPercent };
    }, [stocks]);

    const allocationData = useMemo(() => {
        const total = portfolioSummary.totalValue || 1;
        const techVal = stocks.filter(s => s.sector === 'Technology').reduce((sum, s) => sum + s.currentPrice * s.quantity, 0);
        const energyVal = stocks.filter(s => s.sector === 'Energy').reduce((sum, s) => sum + s.currentPrice * s.quantity, 0);

        return [
            { label: 'Technology', value: techVal },
            { label: 'Energy', value: energyVal },
            { label: 'Cash', value: total * 0.1 }, // 10% Cash buffer
        ];
    }, [stocks, portfolioSummary.totalValue]);

    const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

    const handleSync = () => {
        setIsSyncing(true);
        setTimeout(() => setIsSyncing(false), 1500);
    };

    // --- 1. SMALL LAYOUT (1x1) ---
    if (size === 'small') {
        return (
            <div className="h-full bg-white border border-slate-200 rounded-xl p-6 flex flex-col items-center justify-center relative shadow-sm">
                <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-2">Total P/L</div>
                <div className={`text-4xl font-black ${portfolioSummary.pnl >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {portfolioSummary.pnl >= 0 ? '+' : ''}{portfolioSummary.pnlPercent.toFixed(1)}%
                </div>
            </div>
        );
    }

    // --- 2. MEDIUM LAYOUT (2x3) ---
    if (size === 'medium') {
        return (
            <div className="h-full bg-white border border-slate-200 rounded-xl flex flex-col overflow-hidden shadow-sm">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <span className="text-sm font-bold text-slate-700">Portfolio Summary</span>
                    <button onClick={handleSync} disabled={isSyncing}>
                        <RefreshCw size={14} className={`text-slate-400 ${isSyncing ? 'animate-spin' : ''}`} />
                    </button>
                </div>
                <div className="p-6 flex-1 flex flex-col justify-start gap-8">
                    <div>
                        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">Total Value</p>
                        <p className="text-3xl font-extrabold text-slate-900">{formatCurrency(portfolioSummary.totalValue)}</p>
                    </div>
                    <div className="flex-1 flex items-center justify-center">
                        <ChartWidget
                            chartType="pie"
                            config={chartConfig}
                            data={allocationData}
                            valueKey="value"
                            categoryKey="label"
                            showLegend={true}
                            title="" // BaseWidget might expect these
                        />
                    </div>
                </div>
            </div>
        );
    }

    // --- 3. LARGE LAYOUT (4x5) ---
    return (
        <div className="h-full bg-white border border-slate-200 rounded-xl flex flex-col overflow-hidden shadow-md">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-white">
                <div className="flex items-center gap-3">
                    <h2 className="text-xl font-bold text-slate-900">Portfolio Optimizer</h2>
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-100 text-[10px] text-emerald-600 font-bold">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> IBKR CONNECTED
                    </div>
                </div>
                <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs px-4 py-2 rounded-lg font-bold shadow-sm shadow-blue-100 transition-all">
                    <MessageSquare size={14} /> Add to Context
                </button>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Table Section */}
                <div className="flex-1 overflow-auto border-r border-slate-100 p-6">
                    <table className="w-full text-xs text-left">
                        <thead className="text-slate-400 uppercase font-bold border-b border-slate-100">
                            <tr>
                                <th className="pb-4 px-2">Symbol</th>
                                <th className="pb-4 px-2 text-right">Price</th>
                                <th className="pb-4 px-2 text-right">G/L</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {stocks.map(s => (
                                <tr key={s.id} className="hover:bg-slate-50 transition-colors group">
                                    <td className="py-4 px-2 font-bold text-slate-700">{s.symbol}</td>
                                    <td className="py-4 px-2 text-right text-slate-600 font-medium">{formatCurrency(s.currentPrice)}</td>
                                    <td className={`py-4 px-2 text-right font-bold ${s.currentPrice > s.avgPrice ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        <div className="flex items-center justify-end gap-1">
                                            {s.currentPrice > s.avgPrice ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                                            {((s.currentPrice / s.avgPrice - 1) * 100).toFixed(1)}%
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Sidebar Insights */}
                <div className="w-80 p-8 flex flex-col gap-10 bg-slate-50/40">
                    <div className="flex flex-col items-center">
                        <h3 className="text-[11px] font-bold text-slate-400 uppercase mb-6 tracking-widest">Allocation</h3>
                        <div className="w-full h-48">
                            <ChartWidget
                                chartType="pie"
                                config={chartConfig}
                                data={allocationData}
                                valueKey="value"
                                categoryKey="label"
                                showLegend={false}
                                title=""
                            />
                        </div>
                    </div>

                    <div className="p-5 bg-white border border-blue-100 rounded-2xl shadow-sm">
                        <div className="flex items-center gap-2 mb-4 text-blue-600">
                            <Sparkles size={18} />
                            <span className="text-[11px] font-bold uppercase tracking-tight">AI Health Check</span>
                        </div>
                        <ul className="text-[11px] text-slate-600 space-y-4">
                            <li className="flex gap-2 leading-relaxed">
                                <span className="text-amber-500 font-bold">•</span>
                                <span>High Tech concentration <span className="font-bold text-slate-900">(85%)</span></span>
                            </li>
                            <li className="flex gap-2 leading-relaxed">
                                <span className="text-emerald-500 font-bold">•</span>
                                <span>Beta-weighted delta is within optimal range.</span>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}