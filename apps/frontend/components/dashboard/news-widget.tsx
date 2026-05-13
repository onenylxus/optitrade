'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { BaseWidget } from './base-widget';

interface NewsItem {
  id: string;
  headline: string;
  source: string;
  link: string;
  summary: string;
  highlights: string[];
  sentiment: number;
  risk_tag: string;
  reasoning: string;
  published_at: string;
}

interface ApiResponse {
  news: NewsItem[];
}

interface NewsWidgetProps {
  title?: string;
  summary?: string;
}

const AVAILABLE_STOCKS = [
  'NVDA', 'AAPL', 'TSLA', 'META', 'MSFT', 'GOOGL', 'AMD', 'AMZN',
  'NFLX', 'KO', 'JPM', 'V', 'WMT', 'JNJ', 'PG', 'DIS', 'BAC', 'NKE'
];

export const NewsWidget: React.FC<NewsWidgetProps> = ({
  title = "Financial News",
  summary = "AI-powered sentiment analysis"
}) => {
  const [newsData, setNewsData] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentFilter, setCurrentFilter] = useState<'watchlist' | 'portfolio' | 'all'>('all');
  const [currentView, setCurrentView] = useState<'card' | 'list'>('card');

  const [showWatchlistModal, setShowWatchlistModal] = useState(false);
  const [selectedWatchlist, setSelectedWatchlist] = useState<string[]>(['NVDA', 'AAPL', 'TSLA']);
  const [tempSelectedWatchlist, setTempSelectedWatchlist] = useState<string[]>([]);

  useEffect(() => {
    const fetchNews = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/news');
        if (!response.ok) throw new Error('Failed to fetch news');
        const data: ApiResponse = await response.json();
        setNewsData(data.news || []);
      } catch (err) {
        console.error('Failed to fetch news:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchNews();
  }, []);

  const matchesWatchlist = (headline: string): boolean => {
    const titleLower = headline.toLowerCase();
    return selectedWatchlist.some(symbol =>
      titleLower.includes(symbol.toLowerCase())
    );
  };

  const getFilteredNews = useCallback(() => {
    let filtered = [...newsData];
    if (currentFilter === 'watchlist') {
      filtered = filtered.filter(item => matchesWatchlist(item.headline));
    } else if (currentFilter === 'portfolio') {
      filtered = filtered.filter(item => item.sentiment > 0);
    }
    return filtered;
  }, [newsData, currentFilter, selectedWatchlist]);

  const getAverageSentiment = useCallback(() => {
    const items = getFilteredNews();
    if (items.length === 0) return 0;
    const sum = items.reduce((acc, item) => acc + (item.sentiment || 0), 0);
    return sum / items.length;
  }, [getFilteredNews]);

  const avgSentiment = getAverageSentiment();
  const pointerPos = ((avgSentiment + 1) / 2) * 100;
  const filteredNews = getFilteredNews();

  const contextHeadlineList = newsData
    .map(item => `• [${item.sentiment >= 0 ? '+' : ''}${item.sentiment.toFixed(2)}] ${item.headline} (${item.source})`)
    .join('\n');
  const contextAvgSentiment = newsData.length > 0 ? newsData.reduce((acc, curr) => acc + curr.sentiment, 0) / newsData.length : 0;
  const contextText = `Market News (avg sentiment: ${contextAvgSentiment.toFixed(2)}):\n${contextHeadlineList}`;

  const formatSource = (source: string) => source === 'yahoo' ? 'Yahoo Finance' : 'Economic Times';
  const formatDate = (dateStr: string) => {
    try { return new Date(dateStr).toLocaleDateString(); } catch { return 'Recent'; }
  };

  const getSentimentLabel = (sentiment: number) => {
    if (sentiment > 0.2) return { text: 'Bullish', emoji: '📈', class: 'bullish' };
    if (sentiment < -0.2) return { text: 'Bearish', emoji: '📉', class: 'bearish' };
    return { text: 'Neutral', emoji: '⚖️', class: 'neutral' };
  };

  const openWatchlistModal = () => {
    setTempSelectedWatchlist([...selectedWatchlist]);
    setShowWatchlistModal(true);
  };

  const saveWatchlist = () => {
    setSelectedWatchlist([...tempSelectedWatchlist]);
    setShowWatchlistModal(false);
  };

  const cancelWatchlist = () => {
    setShowWatchlistModal(false);
  };

  const toggleStock = (stock: string) => {
    setTempSelectedWatchlist(prev =>
      prev.includes(stock) ? prev.filter(s => s !== stock) : [...prev, stock]
    );
  };

  const selectAll = () => setTempSelectedWatchlist([...AVAILABLE_STOCKS]);
  const deselectAll = () => setTempSelectedWatchlist([]);

  return (
    <BaseWidget title={title} summary={summary} contextData={{ label: 'FinNews', text: contextText }}>
      {/* Filter Bar */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-1">
          <button
            onClick={openWatchlistModal}
            className="rounded-md p-1 text-muted-foreground hover:bg-secondary/50 transition-colors"
            title="Edit Watchlist"
          >
            ✏️
          </button>
          <button
            onClick={() => setCurrentFilter('watchlist')}
            className={`rounded-md px-2 py-0.5 text-xs transition-colors ${
              currentFilter === 'watchlist' ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-secondary/50'
            }`}
          >
            ⭐ Watchlist
          </button>
          <button
            onClick={() => setCurrentFilter('portfolio')}
            className={`rounded-md px-2 py-0.5 text-xs transition-colors ${
              currentFilter === 'portfolio' ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-secondary/50'
            }`}
          >
            📁 Portfolio
          </button>
          <button
            onClick={() => setCurrentFilter('all')}
            className={`rounded-md px-2 py-0.5 text-xs transition-colors ${
              currentFilter === 'all' ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-secondary/50'
            }`}
          >
            🌐 All News
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentView('list')}
            className={`rounded px-1.5 py-0.5 text-xs transition-colors ${
              currentView === 'list' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-secondary/50'
            }`}
            title="List View"
          >
            📋
          </button>
          <button
            onClick={() => setCurrentView('card')}
            className={`rounded px-1.5 py-0.5 text-xs transition-colors ${
              currentView === 'card' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-secondary/50'
            }`}
            title="Card View"
          >
            🃏
          </button>
        </div>
      </div>

      {/* Sentiment Dashboard */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-secondary/30 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-foreground/70">📊 Market Sentiment</span>
          <div className="relative w-32 h-1.5 rounded-full bg-gradient-to-r from-red-500 via-yellow-400 to-emerald-500">
            <div className="absolute -top-1.5 h-3 w-3 rounded-full bg-foreground shadow-sm transition-all duration-300" style={{ left: `${pointerPos}%`, transform: 'translateX(-50%)' }} />
          </div>
          <span className="text-xs font-mono font-medium">{avgSentiment.toFixed(2)}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground">🔄 15min</span>
          <span className="text-[10px] text-muted-foreground bg-secondary/50 px-1.5 py-0.5 rounded">🤖 Llama 3.2</span>
        </div>
      </div>

      {/* News List */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading news...</div>
        ) : filteredNews.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">📭 No news matches your filters.</div>
        ) : (
          <div className={currentView === 'list' ? 'flex flex-col gap-2' : 'grid grid-cols-1 md:grid-cols-2 gap-3'}>
            {filteredNews.map((news, idx) => {
              const sentimentLabel = getSentimentLabel(news.sentiment);
              return (
                <a
                  key={news.id || idx}
                  href={news.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`block rounded-lg border p-3 transition-all hover:shadow-md ${
                    sentimentLabel.class === 'bullish' ? 'border-l-4 border-l-emerald-500' :
                    sentimentLabel.class === 'bearish' ? 'border-l-4 border-l-red-500' : 'border-border'
                  }`}
                >
                  {/* 標題行 */}
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground mb-1">
                        <span>📰 {formatSource(news.source)}</span>
                        <span>🕒 {formatDate(news.published_at)}</span>
                      </div>
                      <div className="text-sm font-medium line-clamp-2">{news.headline}</div>
                    </div>
                    {/* 簡化情感標籤 */}
                    <div className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                      sentimentLabel.text === 'Bullish' ? 'bg-emerald-50 text-emerald-700' :
                      sentimentLabel.text === 'Bearish' ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {sentimentLabel.emoji} {sentimentLabel.text}
                    </div>
                  </div>

                  {/* Card View 詳細內容 */}
                  {currentView === 'card' && (
                    <>
                      <div className="mt-2 text-xs text-muted-foreground line-clamp-2">{news.summary}</div>
                      {news.highlights && news.highlights.length > 0 && (
                        <ul className="mt-2 list-disc pl-4 text-[10px] text-muted-foreground">
                          {news.highlights.slice(0, 2).map((point, i) => (
                            <li key={i}>{point}</li>
                          ))}
                        </ul>
                      )}

                      {/* Sentiment 分數 + AI Reason + Risk Tag */}
                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                        {/* Sentiment 分數 */}
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                          news.sentiment > 0.2 ? 'bg-emerald-50 text-emerald-700' :
                          news.sentiment < -0.2 ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {news.sentiment > 0 ? '📈' : news.sentiment < 0 ? '📉' : '⚖️'}
                          {news.sentiment > 0 ? '+' : ''}{news.sentiment.toFixed(2)}
                        </span>

                        {/* AI Reason（hover 顯示） */}
                        <div className="relative group cursor-help">
                          <span className="text-[10px] text-muted-foreground">💡 AI</span>
                          <div className="absolute bottom-full left-0 mb-1 hidden group-hover:block bg-foreground text-background text-[10px] rounded px-2 py-1 whitespace-nowrap z-10 max-w-[250px] truncate">
                            {news.reasoning || 'Analysis completed.'}
                          </div>
                        </div>

                        {/* Risk Tag */}
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                          news.risk_tag === 'High Risk' ? 'bg-red-100 text-red-700' :
                          news.risk_tag === 'Medium Risk' ? 'bg-gray-100 text-gray-600' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {news.risk_tag || 'Low Risk'}
                        </span>
                      </div>
                    </>
                  )}

                  {/* List View 簡化內容 */}
                  {currentView === 'list' && (
                    <div className="mt-1 flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                        news.sentiment > 0.2 ? 'bg-emerald-50 text-emerald-700' :
                        news.sentiment < -0.2 ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {news.sentiment > 0 ? '📈' : news.sentiment < 0 ? '📉' : '⚖️'}
                        {news.sentiment > 0 ? '+' : ''}{news.sentiment.toFixed(2)}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                        news.risk_tag === 'High Risk' ? 'bg-red-100 text-red-700' :
                        news.risk_tag === 'Medium Risk' ? 'bg-gray-100 text-gray-600' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {news.risk_tag || 'Low Risk'}
                      </span>
                    </div>
                  )}
                </a>
              );
            })}
          </div>
        )}
      </div>

      {/* Watchlist Modal Popup */}
      {showWatchlistModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={cancelWatchlist}>
          <div className="bg-background rounded-xl shadow-xl w-[480px] max-w-[90%] max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h3 className="font-medium">⭐ Select Watchlist Stocks</h3>
              <button onClick={cancelWatchlist} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>
            <div className="p-4 flex-1 overflow-y-auto">
              <div className="flex gap-2 mb-3">
                <button onClick={selectAll} className="text-xs px-2 py-0.5 rounded bg-secondary hover:bg-secondary/80">Select All</button>
                <button onClick={deselectAll} className="text-xs px-2 py-0.5 rounded bg-secondary hover:bg-secondary/80">Deselect All</button>
                <span className="text-xs text-muted-foreground ml-auto">{tempSelectedWatchlist.length} selected</span>
              </div>
              <div className="grid grid-cols-3 gap-1">
                {AVAILABLE_STOCKS.map(stock => (
                  <label key={stock} className="flex items-center gap-1 text-sm cursor-pointer hover:bg-secondary/50 rounded px-1 py-0.5">
                    <input type="checkbox" checked={tempSelectedWatchlist.includes(stock)} onChange={() => toggleStock(stock)} />
                    <span>{stock}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 px-4 py-3 border-t">
              <button onClick={cancelWatchlist} className="px-3 py-1 text-sm rounded-md hover:bg-secondary">Cancel</button>
              <button onClick={saveWatchlist} className="px-3 py-1 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90">Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </BaseWidget>
  );
};

export default NewsWidget;
