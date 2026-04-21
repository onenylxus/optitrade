'use client';

import { useState } from 'react';
import { BaseWidget } from './base-widget';
import { cn } from '@/lib/utils';

// 1. 定義內置的測試數據 (Static Data)
const mockNews = [
  {
    id: 1,
    title: "Tesla Faces New Safety Probe by US Regulators",
    source: "Reuters",
    sentiment: -0.85,
    sentimentReason: "Regulators expand investigation into FSD system.",
    summary: "NHTSA launches new probe into Tesla's Full Self-Driving system covering 2 million vehicles.",
    bullets: ["Safety concerns", "Potential recall"],
    risk: { level: "High", type: "Legal" }
  },
  {
    id: 2,
    title: "NVIDIA Q4 Earnings Beat Estimates, AI Demand Soars",
    source: "Bloomberg",
    sentiment: 0.92,
    sentimentReason: "Strong AI chip demand.",
    summary: "NVIDIA reports record revenue as data center sales jump 400%.",
    bullets: ["Record highs", "Bullish guidance"],
    risk: { level: "Low", type: "Market" }
  }
];

interface NewsWidgetProps {
  initialData?: any[]; // 改成選填 (?)
}

export function NewsWidget({ initialData }: NewsWidgetProps) {
  const [view, setView] = useState<'card' | 'list'>('card');

  // 2. 邏輯：如果有傳入數據就用傳入的，沒有就用 mockNews
  const newsToDisplay = (initialData && initialData.length > 0) ? initialData : mockNews;

  // 3. 計算平均情緒 (Gauge)
  const avgSentiment = newsToDisplay.reduce((acc, curr) => acc + curr.sentiment, 0) / newsToDisplay.length;
  const pointerPos = ((avgSentiment + 1) / 2) * 100;

  return (
    <BaseWidget title="FinNews AI Agent" summary="Static Data Testing Mode">
      {/* 儀表板 */}
      <div className="bg-slate-50 rounded-2xl p-4 mb-6 border border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-[10px] font-bold text-slate-500 uppercase">Market Sentiment</span>
          <div className="relative w-48 h-2 rounded-full bg-gradient-to-r from-red-500 via-yellow-400 to-emerald-500">
            <div
              className="absolute -top-1.5 w-4 h-4 bg-slate-900 border-2 border-white rounded-full shadow-md transition-all duration-500"
              style={{ left: `${pointerPos}%`, transform: 'translateX(-50%)' }}
            />
          </div>
          <span className="font-bold text-sm bg-white px-2 py-0.5 rounded border">
            {avgSentiment.toFixed(2)}
          </span>
        </div>
        <button
          onClick={() => setView(view === 'card' ? 'list' : 'card')}
          className="text-[10px] bg-white border px-2 py-1 rounded hover:bg-slate-50"
        >
          {view === 'card' ? '📋 List View' : '🃏 Card View'}
        </button>
      </div>

      {/* 新聞列表 */}
      <div className={cn(
        "grid gap-4",
        view === 'card' ? "grid-cols-1 md:grid-cols-2" : "flex flex-col"
      )}>
        {newsToDisplay.map((item, idx) => (
          <div
            key={item.id || idx}
            className={cn(
              "p-4 bg-white border border-slate-100 rounded-xl transition-all hover:shadow-md",
              item.sentiment > 0.2 ? "border-l-4 border-l-emerald-500" : item.sentiment < -0.2 ? "border-l-4 border-l-red-500" : ""
            )}
          >
            <div className="flex justify-between text-[10px] text-slate-400 mb-1">
              <span>{item.source}</span>
              <span>TEST DATA</span>
            </div>
            <h3 className="font-bold text-slate-900 text-sm leading-tight mb-2">{item.title}</h3>

            <p className="text-xs text-slate-600 line-clamp-2 mb-3 bg-slate-50 p-2 rounded">
              {item.summary}
            </p>

            <div className="flex gap-2">
              <span className={cn(
                "px-2 py-0.5 rounded-full text-[10px] font-bold",
                item.sentiment > 0 ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
              )}>
                {item.sentiment > 0 ? '📈' : '📉'} {item.sentiment.toFixed(2)}
              </span>
              <span className="px-2 py-0.5 bg-slate-100 rounded-full text-[10px] text-slate-500 font-medium">
                {item.risk?.type || 'General'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </BaseWidget>
  );
}
