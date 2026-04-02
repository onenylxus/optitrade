import { useState, useMemo } from 'react';
import {
    RefreshCw,
    MessageSquare,
    TrendingUp,
    TrendingDown,
    Sparkles
} from 'lucide-react';
import { ChartWidget } from './chart-widget';
import { ChartConfig } from '@/components/ui/chart';

// --- Internal Types ---
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
            { label: 'Cash', value: total * 0.1 },
        ];
    }, [stocks, portfolioSummary.totalValue]);

    const formatCurrency = (val: number) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

    const handleSync = () => {
        setIsSyncing(true);
        setTimeout(() => setIsSyncing(false), 1500);
    };

    // --- 1. SMALL LAYOUT (1x1) ---
    if (size === 'small') {
        return (
            <div className="h-full bg-white border border-slate-200 rounded-2xl p-6 flex flex-col items-center justify-center shadow-sm">
                <div className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-2 text-center">Total P/L</div>
                <div className={`text-4xl font-black ${portfolioSummary.pnl >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {portfolioSummary.pnl >= 0 ? '+' : ''}{portfolioSummary.pnlPercent.toFixed(1)}%
                </div>
            </div>
        );
    }

    // --- 2. MEDIUM LAYOUT (Light List View) ---
    if (size === 'medium') {
        return (
            <div className="h-full bg-white border border-slate-200 rounded-2xl flex flex-col overflow-hidden shadow-lg">
                {/* Header */}
                <div className="p-5 flex justify-between items-center border-b border-slate-100 bg-slate-50/50">
                    <div className="flex items-center gap-2">
                        <h2 className="text-lg font-bold text-slate-800">Portfolio</h2>
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-100 text-[10px] text-emerald-700 font-bold uppercase">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Connected
                        </div>
                    </div>
                    <button onClick={handleSync} className="text-slate-400 hover:text-slate-600 transition-colors">
                        <RefreshCw size={18} className={isSyncing ? 'animate-spin' : ''} />
                    </button>
                </div>

                {/* Summary Row */}
                <div className="px-6 py-6 grid grid-cols-2 gap-4 border-b border-slate-100">
                    <div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Total Value</p>
                        <p className="text-2xl font-black text-slate-900 tracking-tight">{formatCurrency(portfolioSummary.totalValue)}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Unrealized P/L</p>
                        <p className="text-2xl font-black text-emerald-600 tracking-tight">+{formatCurrency(portfolioSummary.pnl)}</p>
                    </div>
                </div>

                {/* Stock List - No Pie Chart */}
                <div className="flex-1 overflow-y-auto px-6 py-2">
                    {stocks.map((s) => (
                        <div key={s.id} className="py-4 border-b border-slate-50 flex justify-between items-center last:border-0 hover:bg-slate-50 -mx-2 px-2 rounded-xl transition-colors group">
                            <div>
                                <p className="font-bold text-slate-800 group-hover:text-blue-600 transition-colors">{s.symbol}</p>
                                <p className="text-[11px] text-slate-400 font-medium">{s.quantity} shares</p>
                            </div>
                            <div className="text-right">
                                <p className="font-bold text-slate-700">{formatCurrency(s.currentPrice)}</p>
                                <p className="text-[10px] text-emerald-600 font-bold">+{((s.currentPrice / s.avgPrice - 1) * 100).toFixed(1)}%</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // --- 3. LARGE LAYOUT (Dashboard View) ---
    return (
        <div className="h-full bg-white border border-slate-200 rounded-3xl flex flex-col overflow-hidden shadow-2xl">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-4">
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">Portfolio Optimizer</h2>
                    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-[10px] text-emerald-700 font-bold uppercase tracking-wider">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Connected
                    </div>
                </div>
                <button className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-200 transition-transform active:scale-95">
                    <MessageSquare size={16} /> Add to Context
                </button>
            </div>

            <div className="flex flex-1 min-h-0 overflow-hidden">
                <div className="flex-1 overflow-y-auto p-8 bg-white custom-scrollbar">
                    <table className="w-full text-xs text-left border-separate border-spacing-y-3">
                        <thead className="text-slate-400 uppercase font-bold tracking-widest sticky top-0 bg-white z-10">
                            <tr>
                                <th className="px-4 py-2">Symbol</th>
                                <th className="px-4 py-2 text-right">Price</th>
                                <th className="px-4 py-2 text-right">Day Change</th>
                            </tr>
                        </thead>
                        <tbody>
                            {stocks.map(s => (
                                <tr key={s.id} className="group">
                                    <td className="py-5 px-5 font-bold text-slate-800 bg-slate-50/50 rounded-l-2xl group-hover:bg-slate-100 transition-colors border-y border-l border-transparent">
                                        {s.symbol}
                                    </td>
                                    <td className="py-5 px-5 text-right text-slate-600 font-medium bg-slate-50/50 group-hover:bg-slate-100 transition-colors border-y border-transparent">
                                        {formatCurrency(s.currentPrice)}
                                    </td>
                                    <td className={`py-5 px-5 text-right font-black bg-slate-50/50 rounded-r-2xl group-hover:bg-slate-100 transition-colors border-y border-r border-transparent ${s.currentPrice > s.avgPrice ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        <div className="flex items-center justify-end gap-1.5">
                                            {s.currentPrice > s.avgPrice ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                                            {((s.currentPrice / s.avgPrice - 1) * 100).toFixed(1)}%
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="w-80 flex flex-col bg-slate-50/40 border-l border-slate-100 overflow-y-auto p-8 gap-8 custom-scrollbar">
                    <div className="shrink-0 flex flex-col items-center">
                        <h3 className="text-[11px] font-bold text-slate-400 uppercase mb-4 tracking-widest">Sector Allocation</h3>
                        <div className="w-full aspect-square">
                            <ChartWidget
                                chartType="pie"
                                config={chartConfig}
                                data={allocationData}
                                valueKey="value"
                                categoryKey="label"
                                showLegend={false}
                            />
                        </div>
                    </div>

                    <div className="shrink-0 p-6 bg-white border border-blue-50 rounded-2xl shadow-sm ring-1 ring-black/5">
                        <div className="flex items-center gap-2 mb-4 text-blue-600">
                            <Sparkles size={18} />
                            <span className="text-[11px] font-black uppercase tracking-widest">AI Insights</span>
                        </div>
                        <ul className="text-[11px] text-slate-600 space-y-4 leading-relaxed">
                            <li className="flex gap-3 items-start">
                                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1 shrink-0 shadow-[0_0_8px_rgba(251,191,36,0.4)]" />
                                <span>High <span className="font-bold text-slate-900 text-xs">Tech</span> concentration (85%).</span>
                            </li>
                            <li className="flex gap-3 items-start">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1 shrink-0 shadow-[0_0_8px_rgba(52,211,153,0.4)]" />
                                <span>Portfolio beta is within optimal range.</span>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}