import React, { useState, useEffect, useCallback } from 'react';
import './FinNewsWidget.css'; 

// Types
interface NewsItem {
  id: number;
  title: string;
  source: string;
  region: string;
  sentiment: number;
  sentimentReason: string;
  summary: string;
  bullets: string[];
  risk: {
    level: 'High' | 'Medium' | 'Low';
    type: string;
  };
  eventLabel: string | null;
}

type FilterType = 'watchlist' | 'portfolio' | 'all';
type ViewType = 'list' | 'card';

// Mock News Data
const newsData: NewsItem[] = [
  {
    id: 1,
    title: "Tesla Faces New Safety Probe by US Regulators Over 'Full Self-Driving' Feature",
    source: "Reuters / Yahoo Finance",
    region: "US NYSE",
    sentiment: -0.85,
    sentimentReason: "Regulators expand investigation, potential fines and recalls. Market concerns over autonomous driving delays impact revenue outlook.",
    summary: "NHTSA launches new probe into Tesla's Full Self-Driving system, covering nearly 2 million vehicles.",
    bullets: ["NHTSA received multiple accident reports", "Potential mandatory software recall", "Analysts downgrade short-term rating"],
    risk: { level: "High", type: "Legal Risk / Operational Risk" },
    eventLabel: "Legal Risk"
  },
  {
    id: 2,
    title: "NVIDIA Q4 Earnings Beat Estimates, AI Demand Soars",
    source: "The Economic Times",
    region: "US NYSE",
    sentiment: 0.92,
    sentimentReason: "Revenue up over 200% YoY, data center business hits record highs, forward guidance exceeds expectations.",
    summary: "NVIDIA reports strong earnings, AI chip demand drives stock surge after hours, Wall Street raises price targets.",
    bullets: ["Data center revenue +409%", "Blackwell platform outlook bullish", "Multiple firms reiterate Buy rating"],
    risk: { level: "Low", type: "Market Risk" },
    eventLabel: null
  },
  {
    id: 3,
    title: "Tencent Music Revenue Misses Expectations Amid Regulatory Headwinds",
    source: "FUTU API / SCMP",
    region: "HKEX",
    sentiment: -0.45,
    sentimentReason: "Online music payment growth slows, regulatory pressure impacts ad revenue, market sentiment cautious.",
    summary: "Tencent Music's quarterly revenue slightly misses estimates, but paying users grow steadily with cost control.",
    bullets: ["Paying ratio increased to 17%", "Social entertainment business declines", "Stock volatility remains"],
    risk: { level: "Medium", type: "Operational Risk" },
    eventLabel: "Operational Risk"
  },
  {
    id: 4,
    title: "Alibaba Cloud Announces Major Price Cuts to Compete with Rivals",
    source: "Yahoo Finance",
    region: "HKEX",
    sentiment: 0.25,
    sentimentReason: "Price cuts pressure margins short-term but gain market share, long-term leader status remains neutral-positive.",
    summary: "Alibaba Cloud cuts core product prices up to 50% to compete with Tencent and Huawei, lowering customer acquisition costs.",
    bullets: ["Core products down 30-50%", "Market share expected to recover", "Short-term gross margin pressure"],
    risk: { level: "Low", type: "Market Risk" },
    eventLabel: null
  },
  {
    id: 5,
    title: "Goldman Sachs Upgrades Apple to Buy on Services Strength",
    source: "The Economic Times",
    region: "US NYSE",
    sentiment: 0.68,
    sentimentReason: "Services revenue at all-time highs, iPhone demand stable, AI integration set to debut.",
    summary: "Goldman Sachs report highlights Apple's ecosystem monetization strength, raises price target to $220.",
    bullets: ["Services gross margin above 70%", "AI features to drive upgrade cycle", "Buyback plan boosts confidence"],
    risk: { level: "Low", type: "Business Risk" },
    eventLabel: null
  },
  {
    id: 6,
    title: "Crypto Exchange Binance Faces $4B Fine: Major Legal Blow",
    source: "Bloomberg / FUTU",
    region: "Global",
    sentiment: -0.78,
    sentimentReason: "DOJ's massive fine and regulatory restrictions increase operational risk, market confidence shaken.",
    summary: "Binance agrees to pay $4.3 billion fine, founder steps down, compliance requirements全面 upgraded.",
    bullets: ["Unprecedented regulatory pressure", "Increased crypto market volatility", "Liquidity challenges for exchange"],
    risk: { level: "High", type: "Legal Risk / Compliance Risk" },
    eventLabel: "Legal Risk"
  }
];

// Helper functions
const escapeHtml = (str: string): string => {
  if (!str) return '';
  return str.replace(/[&<>]/g, (m) => {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  });
};

const getBorderClass = (sentiment: number): string => {
  if (sentiment > 0.2) return 'bullish';
  if (sentiment < -0.2) return 'bearish';
  return '';
};

// Sub-components
interface SentimentTagProps {
  sentiment: number;
  reason: string;
}

const SentimentTag: React.FC<SentimentTagProps> = ({ sentiment, reason }) => {
  const getSentimentLabel = () => {
    if (sentiment > 0) return '📈 Bullish';
    if (sentiment < 0) return '📉 Bearish';
    return '⚖️ Neutral';
  };

  const sign = sentiment > 0 ? '+' : '';

  return (
    <div className="sentiment-tag">
      {getSentimentLabel()} {sign}{sentiment.toFixed(2)}
      <span className="tooltip-text">🤖 AI Reasoning: {escapeHtml(reason)}</span>
    </div>
  );
};

interface RiskTagProps {
  risk: NewsItem['risk'];
  eventLabel: string | null;
}

const RiskTag: React.FC<RiskTagProps> = ({ risk, eventLabel }) => {
  if (risk.level === 'High') {
    return <span className="risk-tag">⚠️ High Risk · {risk.type}</span>;
  }
  if (risk.level === 'Medium') {
    return <span className="risk-tag medium-risk">⚡ Medium Risk · {risk.type}</span>;
  }
  if (eventLabel) {
    return <span className="risk-tag event-risk">🔍 {eventLabel}</span>;
  }
  return null;
};

interface NewsCardProps {
  news: NewsItem;
  view: ViewType;
}

const NewsCard: React.FC<NewsCardProps> = ({ news, view }) => {
  const borderClass = getBorderClass(news.sentiment);

  return (
    <div className={`news-card ${borderClass}`}>
      <div className="news-meta">
        <span>📰 {escapeHtml(news.source)}</span>
        <span>🕒 Just now</span>
      </div>
      <div className="news-title">{escapeHtml(news.title)}</div>
      <div className="ai-summary">
        ✨ <strong>AI Summary & Key Highlights</strong><br />
        {escapeHtml(news.summary)}
        <ul className="bullet-points">
          {news.bullets.map((bullet, idx) => (
            <li key={idx}>{escapeHtml(bullet)}</li>
          ))}
        </ul>
      </div>
      <div className="card-footer">
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <SentimentTag sentiment={news.sentiment} reason={news.sentimentReason} />
          <RiskTag risk={news.risk} eventLabel={news.eventLabel} />
        </div>
        <span style={{ fontSize: '0.7rem', color: '#6c7a91' }}>
          📌 {news.risk.type?.split(' ')[0] || 'Event'}
        </span>
      </div>
    </div>
  );
};

// Main Component
const FinNewsWidget: React.FC = () => {
  const [currentFilter, setCurrentFilter] = useState<FilterType>('portfolio');
  const [currentView, setCurrentView] = useState<ViewType>('card');
  const [newsItems, setNewsItems] = useState<NewsItem[]>(newsData);

  const getFilteredNews = useCallback((): NewsItem[] => {
    let filtered = [...newsItems];

    if (currentFilter === 'watchlist') {
      filtered = filtered.filter(item => [1, 2, 5].includes(item.id));
    } else if (currentFilter === 'portfolio') {
      filtered = filtered.filter(item => [2, 3, 4, 5].includes(item.id));
    }
    return filtered;
  }, [newsItems, currentFilter]);

  const updateSentimentGauge = useCallback(() => {
    const items = getFilteredNews();
    const sentimentPointer = document.getElementById('sentimentPointer');
    const sentimentScoreText = document.getElementById('sentimentScoreText');

    if (!items.length) {
      if (sentimentPointer) sentimentPointer.style.left = '50%';
      if (sentimentScoreText) sentimentScoreText.innerText = '0.00';
      return;
    }

    const avg = items.reduce((a, b) => a + b.sentiment, 0) / items.length;
    let percent = ((avg + 1) / 2) * 100;
    percent = Math.min(100, Math.max(0, percent));

    if (sentimentPointer) sentimentPointer.style.left = `${percent}%`;
    if (sentimentScoreText) sentimentScoreText.innerText = avg.toFixed(2);
  }, [getFilteredNews]);

  // Simulate periodic AI updates every 15 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setNewsItems(prev => {
        const randomIdx = Math.floor(Math.random() * prev.length);
        const old = prev[randomIdx].sentiment;
        let delta = (Math.random() - 0.5) * 0.2;
        let newVal = old + delta;
        newVal = Math.min(1.0, Math.max(-1.0, newVal));

        const updated = [...prev];
        updated[randomIdx] = {
          ...updated[randomIdx],
          sentiment: parseFloat(newVal.toFixed(3)),
          sentimentReason: `🔄 Dynamic AI update: Sentiment ${delta > 0 ? 'increased' : 'decreased'} based on latest news flow.`
        };
        return updated;
      });
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  // Update sentiment gauge when filtered news changes
  useEffect(() => {
    updateSentimentGauge();
  }, [newsItems, currentFilter, updateSentimentGauge]);

  const filteredNews = getFilteredNews();

  return (
    <div className="finance-widget">
      <div className="widget-header">
        <div className="filter-bar">
          <div className="filter-group">
            <button
              className={`filter-btn ${currentFilter === 'watchlist' ? 'active' : ''}`}
              onClick={() => setCurrentFilter('watchlist')}
            >
              ⭐ Watchlist
            </button>
            <button
              className={`filter-btn ${currentFilter === 'portfolio' ? 'active' : ''}`}
              onClick={() => setCurrentFilter('portfolio')}
            >
              📁 Portfolio
            </button>
            <button
              className={`filter-btn ${currentFilter === 'all' ? 'active' : ''}`}
              onClick={() => setCurrentFilter('all')}
            >
              🌐 All News
            </button>
          </div>
          <div className="view-toggle">
            <button
              className={`view-icon ${currentView === 'list' ? 'active' : ''}`}
              onClick={() => setCurrentView('list')}
            >
              📋 List View
            </button>
            <button
              className={`view-icon ${currentView === 'card' ? 'active' : ''}`}
              onClick={() => setCurrentView('card')}
            >
              🃏 Card View
            </button>
          </div>
        </div>
      </div>

      <div className="sentiment-dashboard">
        <div className="gauge-area">
          <span className="gauge-label">📊 Market Sentiment Gauge</span>
          <div className="sentiment-bar-container">
            <div className="sentiment-indicator" id="sentimentPointer"></div>
          </div>
          <span className="sentiment-value" id="sentimentScoreText">0.00</span>
          <span className="update-badge">🔄 AI inference every 15 min</span>
        </div>
        <div className="update-badge">🤖 LLM: GPT-4o-mini · Sentiment & Risk Engine Active</div>
      </div>

      <div className={`news-container ${currentView === 'list' ? 'list-view' : 'card-view'}`}>
        {filteredNews.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#5e6f8d' }}>
            📭 No news matches your filters. Try adjusting criteria.
          </div>
        ) : (
          filteredNews.map(news => (
            <NewsCard key={news.id} news={news} view={currentView} />
          ))
        )}
      </div>
    </div>
  );
};

export default FinNewsWidget;