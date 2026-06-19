"""News Processing Pipeline - Integration of Fetching, Filtering, Deduplication, and AI Analysis"""
import time
import json
import re
import os
from datetime import datetime
from typing import List, Dict

from .fetcher import YahooNewsFetcher, EconomicTimesFetcher, NewsItem
from .analyzer import CloudAnalyzer
from .config import OUTPUT_FILE

class Deduplicator:
    @staticmethod
    def normalize_title(title: str) -> str:
        normalized = title.lower()
        normalized = re.sub(r'[^\w\s]', '', normalized)
        normalized = re.sub(r'\s+', ' ', normalized).strip()
        return normalized

    @staticmethod
    def deduplicate(news_list: List[NewsItem]) -> List[NewsItem]:
        seen = set()
        unique = []
        for news in news_list:
            key = Deduplicator.normalize_title(news.headline)
            if key not in seen:
                seen.add(key)
                unique.append(news)
        return unique

class FinanceNewsFilter:
    KEYWORDS = [
        'stock', 'share', 'market', 'trading', 'investor', 'investment',
        'crypto', 'cryptocurrency', 'bitcoin', 'ethereum', 'blockchain',
        'defi', 'aave', 'lending', 'liquidity', 'withdraw',
        'earnings', 'revenue', 'profit', 'loss', 'quarter', 'fiscal',
        'acquisition', 'merger', 'buyout', 'partnership', 'contract',
        'upgrade', 'downgrade', 'target', 'analyst', 'rating',
        'fed', 'inflation', 'interest', 'economy', 'gdp',
        'surge', 'plunge', 'rally', 'crash', 'boom', 'ipo', 'dividend', 'fund'
    ]

    @classmethod
    def is_finance_news(cls, title: str) -> bool:
        if not title: return False
        title_lower = title.lower()
        return any(kw in title_lower for kw in cls.KEYWORDS)

    @classmethod
    def filter_list(cls, news_list: List[NewsItem]) -> List[NewsItem]:
        return [n for n in news_list if cls.is_finance_news(n.headline)]

class NewsAnalysisPipeline:
    def __init__(self, limit_per_source: int = 50):
        self.limit_per_source = limit_per_source
        self.analyzer = CloudAnalyzer()
        self.processed_ids, self.processed_links = self._load_existing_history()

    def _load_existing_history(self) -> tuple[set, set]:
        ids, links = set(), set()
        if os.path.exists(OUTPUT_FILE):
            try:
                with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    for item in data.get("news", []):
                        if "id" in item: ids.add(item["id"])
                        if "link" in item: links.add(item["link"])
            except Exception as e:
                print(f"⚠️ [Pipeline] Failed to read historical data ({e})")
        return ids, links

    def _load_cached_file(self) -> List[Dict]:
        if os.path.exists(OUTPUT_FILE):
            try:
                with open(OUTPUT_FILE, 'r', encoding='utf-8') as f:
                    return json.load(f).get("news", [])
            except Exception:
                pass
        return []

    def _parse_date(self, pub_time: str) -> datetime:
        if not pub_time: return datetime.min
        if "T" in pub_time:
            try: return datetime.strptime(pub_time.split(".")[0].replace("Z", ""), "%Y-%m-%dT%H:%M:%S")
            except: pass
        if "," in pub_time:
            try: return datetime.strptime(pub_time.split(" +")[0].split(" -")[0], "%a, %d %b %Y %H:%M:%S")
            except: pass
        return datetime.min

    def run_once(self) -> List[Dict]:
        print("\n🚀 Step 1: Fetching News")
        all_news = []
        try:
            all_news.extend(YahooNewsFetcher.fetch(limit=self.limit_per_source))
            all_news.extend(EconomicTimesFetcher.fetch(limit=self.limit_per_source))
        except Exception as e:
            print(f"⚠️ Network Error: {e}")
            return self._load_cached_file()

        filtered_news = FinanceNewsFilter.filter_list(all_news)
        unique_news = Deduplicator.deduplicate(filtered_news)

        TARGET_STOCK_KEYWORDS = ['hfcl', 'nvda', 'nvidia', 'aapl', 'apple', 'tsla', 'tesla', 'msft', 'googl', 'google', 'amzn', 'amd', 'nifty', 'reliance', 'ril']
        new_news_to_analyze = [n for n in unique_news if any(kw in f"{n.headline} {n.summary}".lower() for kw in TARGET_STOCK_KEYWORDS)
                               and (datetime.now() - self._parse_date(n.published_at)).days <= 3
                               and n.id not in self.processed_ids and n.link not in self.processed_links]

        print(f"\n🤖 Step 4: AI Sentiment Analysis ({len(new_news_to_analyze)} new items)")
        new_results = []
        for i, news in enumerate(new_news_to_analyze, 1):
            print(f"   [{i}/{len(new_news_to_analyze)}] Analyzing: {news.headline[:40]}...")
            analysis = None
            try:

                analysis = self.analyzer.analyze(news.headline, news.summary)
                if not analysis or ('choices' in str(analysis) and not isinstance(analysis, dict)):
                  raise ValueError("Invalid API response format")
            except Exception as e:
                print(f"   ❌ AI Error: {e}")
                analysis = {"highlights": ["API error"], "sentiment": 0.0, "risk_tag": "Low Risk", "reasoning": "Error", "readiness_score": 20}

            # result = {
            #     "id": news.id, "source": news.source, "headline": news.headline, "link": news.link,
            #     "published_at": news.published_at, "summary": news.summary[:200],
            #     **analysis, "analyzed_at": datetime.now().isoformat()
            # }
            result = {
                  "id": news.id,
                  "source": news.source,
                  "headline": news.headline,
                  "link": news.link,
                  "published_at": news.published_at,
                  "summary": news.summary[:200],
                  "highlights": analysis.get("highlights", []),
                  "sentiment": analysis.get("sentiment", 0),
                  "risk_tag": analysis.get("risk_tag", "Neutral"),
                  "reasoning": analysis.get("reasoning", ""),
                  "related_symbols": analysis.get("related_symbols", []),
                  "readiness_score": analysis.get("readiness_score", 0),
                  "analyzed_at": datetime.now().isoformat()
              }
            new_results.append(result)
            self.processed_ids.add(news.id)
            self.processed_links.add(news.link)
            time.sleep(3)

        existing_news = self._load_cached_file()
        unique_combined = {item['link']: item for item in (new_results + existing_news)}.values()

        final_list = sorted(unique_combined, key=lambda x: x.get("readiness_score", 0), reverse=True)[:50]

        with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
            json.dump({"news": final_list}, f, indent=2, ensure_ascii=False)
        return final_list

    def start_automated_loop(self, interval_seconds: int = 900):
        while True:
            self.run_once()
            time.sleep(interval_seconds)
