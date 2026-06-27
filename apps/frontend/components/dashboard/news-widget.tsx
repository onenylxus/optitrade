'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { BaseWidget } from './base-widget';
import { usePortfolioContext } from '@/contexts/portfolio-context';

interface NewsItem {
  // id: string;
  // headline: string;
  // source: string;
  // link: string;
  // summary: string;
  // highlights: string[];
  // sentiment: number;
  // risk_tag: string;
  // reasoning: string;
  // published_at: string;
  id: string;
  source: string;
  headline: string;
  link: string;
  published_at: string;
  summary: string;
  highlights: string[];
  sentiment: number;
  risk_tag: string;
  reasoning: string;
  analyzed_at: string;
  related_symbols?: string[];
  readiness_score?: number;
}

interface NewsWidgetProps {
  title?: string;
  summary?: string;
  variant?: 'default' | 'medium' | 'large';
}

const AVAILABLE_STOCKS = [
  'NVDA',
  'AAPL',
  'TSLA',
  'META',
  'MSFT',
  'GOOGL',
  'AMD',
  'AMZN',
  'NFLX',
  'KO',
  'JPM',
  'V',
  'WMT',
  'JNJ',
  'PG',
  'DIS',
  'BAC',
  'NKE',
];

export const NewsWidget: React.FC<NewsWidgetProps> = ({
  title = 'Financial News',
  summary = 'AI-powered sentiment analysis',
}) => {
  const [newsData, setNewsData] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentFilter, setCurrentFilter] = useState<'watchlist' | 'portfolio' | 'all'>('all');
  const [currentView, setCurrentView] = useState<'card' | 'list'>('card');

  const [showWatchlistModal, setShowWatchlistModal] = useState(false);
  const [selectedWatchlist, setSelectedWatchlist] = useState<string[]>(['NVDA', 'AAPL', 'TSLA']);
  const [tempSelectedWatchlist, setTempSelectedWatchlist] = useState<string[]>([]);
  const { portfolio } = usePortfolioContext();

  const portfolioPositions = useMemo(() => {
    if (!portfolio) return [];
    if (Array.isArray(portfolio)) return portfolio;
    if (typeof portfolio === 'object' && 'stocks' in portfolio) {
      return (portfolio as { stocks: Array<{ symbol: string; sector?: string }> }).stocks || [];
    }
    if (typeof portfolio === 'object' && 'positions' in portfolio) {
      return (portfolio as { positions: Array<{ symbol: string; sector?: string }> }).positions || [];
    }
    return [];
  }, [portfolio]);

  const portfolioSymbols = useMemo(
    () => portfolioPositions.map((pos) => String(pos.symbol || '').toUpperCase()).filter(Boolean),
    [portfolioPositions],
  );

  const portfolioAwareWatchlist = useMemo(
    () => (portfolioSymbols.length > 0 ? portfolioSymbols : selectedWatchlist),
    [portfolioSymbols, selectedWatchlist],
  );

  const allInterestedSymbols = useMemo(() => {
    const combined = new Set([...portfolioSymbols, ...selectedWatchlist]);
    return Array.from(combined);
  }, [portfolioSymbols, selectedWatchlist]);

  useEffect(() => {
    const fetchNews = async () => {
      setLoading(true);
      try {
        let url = '/api/news';

        if (allInterestedSymbols.length > 0) {
          const symbolsParam = allInterestedSymbols.join(',');
          url = `/api/news?symbols=${symbolsParam}`;
        }

        console.log(`[API Request] Fetching news using all stock symbols, URL: ${url}`);
        const response = await fetch(url);

        if (response.status === 202) {
          console.log("Pipeline is still running...");
          setNewsData([]);
          return;
        }

        if (!response.ok) throw new Error('Network response was not ok');

        const data = await response.json();
        console.log("[API Response] Frontend has received the full news data package:", data);
        let rawNews: NewsItem[] = [];
        if (data && Array.isArray(data.news)) {
          rawNews = data.news;
        } else if (Array.isArray(data)) {
          rawNews = data;
        }

        const sortedNews = [...rawNews].sort((a, b) => {
          const dateA = new Date(a.published_at).getTime();
          const dateB = new Date(b.published_at).getTime();
          return (isNaN(dateB) ? 0 : dateB) - (isNaN(dateA) ? 0 : dateA);
        });

        setNewsData(sortedNews);
        // if (data && Array.isArray(data.news)) {
        //   setNewsData(data.news);
        // } else if (Array.isArray(data)) {
        //   setNewsData(data);
        // } else {
        //   setNewsData([]);
        // }

      } catch (err) {
        console.error('Failed to fetch news:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchNews();
  }, [allInterestedSymbols]);

  const matchesWatchlist = useCallback(
    (headline: string, summary?: string): boolean => {
      const text = `${headline} ${summary ?? ''}`.toLowerCase();
      return selectedWatchlist.some((symbol) => text.includes(symbol.toLowerCase()));
    },
    [selectedWatchlist],
  );

useEffect(() => {
    if (portfolioSymbols.length > 0) {
      console.log("==================================================");
      console.log(`📊 [Portfolio core filter activated]:`, portfolioSymbols);
      console.log(`Successfully identified a total of ${portfolioSymbols.length} holdings`);
      console.log("==================================================");
    } else {
      console.log("⚠️ [Note] The current Portfolio is empty; the front-end will switch to a pre-emptive mechanism.");
    }
  }, [portfolioSymbols]);
const matchesPortfolio = useCallback(
  (item: NewsItem): boolean => {
    if (portfolioSymbols.length === 0) {
      return true;
    }

  if (item.related_symbols && Array.isArray(item.related_symbols)) {
        const hasMatch = item.related_symbols.some((sym: string) =>
          portfolioSymbols.includes(sym.toUpperCase())
        );
        if (hasMatch) return true;
      }

    const itemHeadline = item.headline || "";
    const itemSummary = item.summary || "";
    const text = `${itemHeadline} ${itemSummary}`.toLowerCase();

    return portfolioSymbols.some((symbol) =>
      text.includes(symbol.toLowerCase())
    );
  },
  [portfolioSymbols],
);
  const getFilteredNews = useCallback(() => {
    let filtered = [...newsData];
    if (currentFilter === 'watchlist') {
      filtered = filtered.filter((item) => matchesWatchlist(item.headline, item.summary));
    } else if (currentFilter === 'portfolio') {
      filtered = filtered.filter((item) => matchesPortfolio(item));
    }
    return filtered;
  }, [newsData, currentFilter, matchesWatchlist, matchesPortfolio]);

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
    .map(
      (item) =>
        `• [${item.sentiment >= 0 ? '+' : ''}${item.sentiment.toFixed(2)}] ${item.headline} (${item.source})`,
    )
    .join('\n');
  const contextAvgSentiment =
    newsData.length > 0
      ? newsData.reduce((acc, curr) => acc + curr.sentiment, 0) / newsData.length
      : 0;
  const contextText = [
    `Market News (avg sentiment: ${contextAvgSentiment.toFixed(2)})`,
    portfolioSymbols.length > 0
      ? `Portfolio-linked symbols: ${portfolioSymbols.join(', ')}`
      : 'Portfolio-linked symbols: none',
    contextHeadlineList,
  ].join('\n');

  const formatSource = (source: string) => source === 'yahoo' ? 'Yahoo Finance' : 'Economic Times';
  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString(undefined, {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    } catch {
      return 'Recent';
    }
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
    setTempSelectedWatchlist((prev) =>
      prev.includes(stock) ? prev.filter((s) => s !== stock) : [...prev, stock],
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
              currentFilter === 'watchlist'
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-muted-foreground hover:bg-secondary/50'
            }`}
          >
            ⭐ Watchlist
          </button>
          <button
            onClick={() => setCurrentFilter('portfolio')}
            className={`rounded-md px-2 py-0.5 text-xs transition-colors ${
              currentFilter === 'portfolio'
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-muted-foreground hover:bg-secondary/50'
            }`}
            title={
              portfolioSymbols.length > 0
                ? `Portfolio symbols: ${portfolioAwareWatchlist.join(', ')}`
                : 'Uses positive sentiment when no portfolio is loaded'
            }
          >
            📁 Portfolio
          </button>
          <button
            onClick={() => setCurrentFilter('all')}
            className={`rounded-md px-2 py-0.5 text-xs transition-colors ${
              currentFilter === 'all'
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-muted-foreground hover:bg-secondary/50'
            }`}
          >
            🌐 All News
          </button>
        </div>
        {/* <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentView('list')}
            className={`rounded px-1.5 py-0.5 text-xs transition-colors ${
              currentView === 'list'
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-secondary/50'
            }`}
            title="List View"
          >
            📋
          </button>
          <button
            onClick={() => setCurrentView('card')}
            className={`rounded px-1.5 py-0.5 text-xs transition-colors ${
              currentView === 'card'
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-secondary/50'
            }`}
            title="Card View"
          >
            🃏
          </button>
        </div> */}
        <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentView('list')}
              className={`group relative rounded px-1.5 py-0.5 text-xs transition-colors ${
                currentView === 'list'
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-secondary/50'
              }`}
              aria-label="List View"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              <span className="absolute -bottom-8 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white group-hover:block">
                List View
              </span>
            </button>

            <button
              onClick={() => setCurrentView('card')}
              className={`group relative rounded px-1.5 py-0.5 text-xs transition-colors ${
                currentView === 'card'
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-secondary/50'
              }`}
              aria-label="Card View"
            >

              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" />
              </svg>
              <span className="absolute -bottom-8 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white group-hover:block">
                Card View
              </span>
            </button>
          </div>
      </div>

      {/* Sentiment Dashboard */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-secondary/30 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-foreground/70">📊 Market Sentiment</span>
          <div className="relative h-1.5 w-32 rounded-full bg-linear-to-r from-red-500 via-yellow-400 to-emerald-500">
            <div
              className="absolute -top-1.5 h-3 w-3 rounded-full bg-foreground shadow-sm transition-all duration-300"
              style={{ left: `${pointerPos}%`, transform: 'translateX(-50%)' }}
            />
          </div>
          <span className="text-xs font-mono font-medium">{avgSentiment.toFixed(2)}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground">🔄 15min</span>
          <span className="text-[10px] text-muted-foreground bg-secondary/50 px-1.5 py-0.5 rounded">
            🤖 Llama 3.2
          </span>
        </div>
      </div>

      {/* News List */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading news...</div>
        ) : filteredNews.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            📭 No news matches your filters.
          </div>
        ) : (
          <div
            className={
              currentView === 'list'
                ? 'flex flex-col gap-2'
                : 'grid grid-cols-1 md:grid-cols-2 gap-3'
            }
          >
            {filteredNews.map((news, idx) => {
              const sentimentLabel = getSentimentLabel(news.sentiment);
              return (
                <a
                  key={news.id || idx}
                  href={news.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`block rounded-lg border p-3 transition-all hover:shadow-md ${
                    sentimentLabel.class === 'bullish'
                      ? 'border-l-4 border-l-emerald-500'
                      : sentimentLabel.class === 'bearish'
                        ? 'border-l-4 border-l-red-500'
                        : 'border-border'
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
                    <div
                      className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                        sentimentLabel.text === 'Bullish'
                          ? 'bg-emerald-50 text-emerald-700'
                          : sentimentLabel.text === 'Bearish'
                            ? 'bg-red-50 text-red-700'
                            : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {sentimentLabel.emoji} {sentimentLabel.text}
                    </div>
                  </div>

                  {/* Card View 詳細內容 */}
                  {currentView === 'card' && (
                    <>
                      <div className="mt-2 text-xs text-muted-foreground line-clamp-2">
                        {news.summary}
                      </div>
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
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                            news.sentiment > 0.2
                              ? 'bg-emerald-50 text-emerald-700'
                              : news.sentiment < -0.2
                                ? 'bg-red-50 text-red-700'
                                : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {news.sentiment > 0 ? '📈' : news.sentiment < 0 ? '📉' : '⚖️'}
                          {news.sentiment > 0 ? '+' : ''}
                          {news.sentiment.toFixed(2)}
                        </span>

                        {/* AI Reason（hover 顯示） */}
                        <div className="relative group cursor-help">
                          <span className="text-[10px] text-muted-foreground">💡 AI</span>
                          <div className="absolute bottom-full left-0 mb-1 hidden max-w-62.5 truncate rounded bg-foreground px-2 py-1 text-[10px] text-background whitespace-nowrap z-10 group-hover:block">
                            {news.reasoning || 'Analysis completed.'}
                          </div>
                        </div>

                        {/* Risk Tag */}
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                            news.risk_tag === 'High Risk'
                              ? 'bg-red-100 text-red-700'
                              : news.risk_tag === 'Medium Risk'
                                ? 'bg-gray-100 text-gray-600'
                                : 'bg-green-100 text-green-700'
                          }`}
                        >
                          {news.risk_tag || 'Low Risk'}
                        </span>


  {/* 新增：準備率分數 */}
  {news.readiness_score !== undefined && (
    // <span
    //   className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary/50 text-muted-foreground border border-border"
    //   title={`Analysis Reliability Score: ${news.readiness_score}/100`}
    // >
    //   ✅ {news.readiness_score}%
    // </span>
      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary/50 text-muted-foreground border border-border">
        ✅ Reliability:{news.readiness_score}%
      </span>

  )}
                      </div>
                    </>
                  )}

                  {/* List View  */}
                  {currentView === 'list' && (
                    <div className="mt-1 flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                          news.sentiment > 0.2
                            ? 'bg-emerald-50 text-emerald-700'
                            : news.sentiment < -0.2
                              ? 'bg-red-50 text-red-700'
                              : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {news.sentiment > 0 ? '📈' : news.sentiment < 0 ? '📉' : '⚖️'}
                        {news.sentiment > 0 ? '+' : ''}
                        {news.sentiment.toFixed(2)}
                      </span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                          news.risk_tag === 'High Risk'
                            ? 'bg-red-100 text-red-700'
                            : news.risk_tag === 'Medium Risk'
                              ? 'bg-gray-100 text-gray-600'
                              : 'bg-green-100 text-green-700'
                        }`}
                      >
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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={cancelWatchlist}
        >
          <div
            className="flex max-h-[80vh] w-120 max-w-[90%] flex-col rounded-xl bg-background shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h3 className="font-medium">⭐ Select Watchlist Stocks</h3>
              <button
                onClick={cancelWatchlist}
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>
            <div className="p-4 flex-1 overflow-y-auto">
              <div className="flex gap-2 mb-3">
                <button
                  onClick={selectAll}
                  className="text-xs px-2 py-0.5 rounded bg-secondary hover:bg-secondary/80"
                >
                  Select All
                </button>
                <button
                  onClick={deselectAll}
                  className="text-xs px-2 py-0.5 rounded bg-secondary hover:bg-secondary/80"
                >
                  Deselect All
                </button>
                <span className="text-xs text-muted-foreground ml-auto">
                  {tempSelectedWatchlist.length} selected
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1">
                {AVAILABLE_STOCKS.map((stock) => (
                  <label
                    key={stock}
                    className="flex items-center gap-1 text-sm cursor-pointer hover:bg-secondary/50 rounded px-1 py-0.5"
                  >
                    <input
                      type="checkbox"
                      checked={tempSelectedWatchlist.includes(stock)}
                      onChange={() => toggleStock(stock)}
                    />
                    <span>{stock}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 px-4 py-3 border-t">
              <button
                onClick={cancelWatchlist}
                className="px-3 py-1 text-sm rounded-md hover:bg-secondary"
              >
                Cancel
              </button>
              <button
                onClick={saveWatchlist}
                className="px-3 py-1 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </BaseWidget>
  );
};

export default NewsWidget;
