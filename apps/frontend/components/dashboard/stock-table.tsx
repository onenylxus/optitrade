import { ArrowUpDown, TrendingUp, TrendingDown } from 'lucide-react';
export interface Stock {
    id: string;
    symbol: string;
    quantity: number;
    avgPrice: number;
    currentPrice: number;
    sector: string;
}

export type SortField = 'symbol' | 'quantity' | 'currentPrice' | 'gainLoss';
export type SortDirection = 'asc' | 'desc';
interface StockTableProps {
    stocks: Stock[];
    sortField: SortField;
    sortDirection: SortDirection;
    onSort: (field: SortField) => void;
}

export function StockTable({ stocks = [], sortField, sortDirection, onSort }: StockTableProps) {
    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
        }).format(value);
    };

    const SortButton = ({ field, label }: { field: SortField; label: string }) => (
        <button
            onClick={() => onSort(field)}
            className="flex items-center gap-1 hover:text-white transition-colors"
        >
            {label}
            <ArrowUpDown className={`w-3 h-3 ${sortField === field ? 'text-blue-500' : 'text-slate-500'}`} />
        </button>
    );

    return (
        <div className="w-full overflow-x-auto">
            <table className="w-full text-xs">
                <thead className="bg-slate-900/80 sticky top-0 border-b border-slate-800">
                    <tr>
                        <th className="text-left py-3 px-4 text-slate-400 font-medium">
                            <SortButton field="symbol" label="Symbol" />
                        </th>
                        <th className="text-right py-3 px-4 text-slate-400 font-medium">
                            <SortButton field="quantity" label="Qty" />
                        </th>
                        <th className="text-right py-3 px-4 text-slate-400 font-medium">
                            <SortButton field="currentPrice" label="Price" />
                        </th>
                        <th className="text-right py-3 px-4 text-slate-400 font-medium">
                            <SortButton field="gainLoss" label="G/L" />
                        </th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                    {stocks.map((stock) => {
                        const gainLoss = (stock.currentPrice - stock.avgPrice) * stock.quantity;
                        const isPositive = gainLoss >= 0;

                        return (
                            <tr key={stock.id} className="hover:bg-slate-900/30 transition-colors">
                                <td className="py-3 px-4 font-semibold text-slate-200">{stock.symbol}</td>
                                <td className="text-right py-3 px-4 text-slate-400">{stock.quantity}</td>
                                <td className="text-right py-3 px-4 text-slate-300">{formatCurrency(stock.currentPrice)}</td>
                                <td className={`text-right py-3 px-4 font-medium ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                                    {isPositive ? '+' : ''}{formatCurrency(gainLoss)}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}