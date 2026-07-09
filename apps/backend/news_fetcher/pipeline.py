"""News Processing Pipeline - Integration of Fetching, Filtering, Deduplication, and AI Analysis"""
import time
import json
import re
import os
from datetime import datetime
from typing import List, Dict

from .fetcher import YahooNewsFetcher, EconomicTimesFetcher, NewsItem
from .analyzer import CloudAnalyzer
from .config import OUTPUT_FILE, CONFIDENCE_FACTOR_FILE


class Deduplicator:
    """News deduplicator - based on title similarity"""

    @staticmethod
    def normalize_title(title: str) -> str:
        """Normalize title for comparison"""
        normalized = title.lower()
        normalized = re.sub(r'[^\w\s]', '', normalized)
        normalized = re.sub(r'\s+', ' ', normalized).strip()
        return normalized

    @staticmethod
    def deduplicate(news_list: List[NewsItem]) -> List[NewsItem]:
        """Deduplicate and return unique news list"""
        seen = set()
        unique = []
        for news in news_list:
            key = Deduplicator.normalize_title(news.headline)
            if key not in seen:
                seen.add(key)
                unique.append(news)
        return unique


class FinanceNewsFilter:
    """Financial news filter"""

    KEYWORDS = [
        'stock', 'share', 'market', 'trading', 'investor', 'investment',
        'crypto', 'cryptocurrency', 'bitcoin', 'ethereum', 'blockchain',
        'defi', 'aave', 'lending', 'liquidity', 'withdraw',
        'earnings', 'revenue', 'profit', 'loss', 'quarter', 'fiscal',
        'acquisition', 'merger', 'buyout', 'partnership', 'contract',
        'upgrade', 'downgrade', 'target', 'analyst', 'rating',
        'fed', 'inflation', 'interest', 'economy', 'gdp',
        'surge', 'plunge', 'rally', 'crash', 'boom', 'ipo', 'dividend',
        'fund'
    ]

    @classmethod
    def is_finance_news(cls, title: str) -> bool:
        if not title:
            return False
        title_lower = title.lower()
        return any(kw in title_lower for kw in cls.KEYWORDS)

    @classmethod
    def filter_list(cls, news_list: List[NewsItem]) -> List[NewsItem]:
        return [n for n in news_list if cls.is_finance_news(n.headline)]


class NewsAnalysisPipeline:
    """News analysis pipeline - integrates fetching, persistence, and automated polling"""
    def __init__(self, limit_per_source: int = 50):
        self.limit_per_source = limit_per_source
        self.analyzer = CloudAnalyzer()
        self.processed_ids, self.processed_links = self._load_existing_history()
        self.confidence_factor = self._load_confidence_factor()

    def _load_confidence_factor(self) -> float:
        if os.path.exists(CONFIDENCE_FACTOR_FILE):
            try:
                with open(CONFIDENCE_FACTOR_FILE, 'r') as f:
                    data = json.load(f)
                    return data.get("hit_rate", 0.5)
            except:
                return 0.5
        return 0.5

    def _load_existing_history(self) -> tuple[set, set]:
        """Load analyzed news IDs and links from existing JSON archive, preventing duplicate token consumption"""
        ids = set()
        links = set()
        if os.path.exists(OUTPUT_FILE):
            try:
                with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    for item in data.get("news", []):
                        if "id" in item:
                            ids.add(item["id"])
                        if "link" in item:
                            links.add(item["link"])
            except Exception as e:
                print(f"⚠️ [Pipeline] Failed to read historical data ({e})")
        return ids, links
    def _load_cached_file(self) -> List[Dict]:
        """Safely read cache file"""
        if os.path.exists(OUTPUT_FILE):
            try:
                with open(OUTPUT_FILE, 'r', encoding='utf-8') as f:
                    return json.load(f).get("news", [])
            except Exception:
                pass
        return []

    def _parse_date(self, pub_time: str) -> datetime:
        """Parse various RSS date strings into datetime objects"""
        if not pub_time:
            return datetime.min

        if "T" in pub_time:
            try:
                clean_time = pub_time.split(".")[0].replace("Z", "")
                return datetime.strptime(clean_time, "%Y-%m-%dT%H:%M:%S")
            except Exception:
                pass

        if "," in pub_time:
            try:
                clean_time = pub_time.split(" +")[0].split(" -")[0]
                return datetime.strptime(clean_time, "%a, %d %b %Y %H:%M:%S")
            except Exception:
                pass

        return datetime.min

    def run_once(self) -> List[Dict]:
        if not os.path.exists(OUTPUT_FILE):
            print("⚠️ [Pipeline] Automatically reset memory cache records...")
            self.processed_ids = set()

        print("\n" + "="*70)
        print("🚀 OptiTrade News Analysis System (Flow Core)")
        print(f"⏰ Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("="*70)

        # ------------------------------------------------------------------
        # Step 1: Fetch news
        # ------------------------------------------------------------------
        print("\n📡 Step 1: Fetching News")
        print("-"*50)
        all_news = []
        try:
            yahoo_news = YahooNewsFetcher.fetch(limit=self.limit_per_source)
            all_news.extend(yahoo_news)
            et_news = EconomicTimesFetcher.fetch(limit=self.limit_per_source)
            all_news.extend(et_news)
            print(f"\n📊 Fetch completed: {len(all_news)} raw news items")
        except Exception as e:
            print(f"⚠️ [Network/API Error] Unable to retrieve news: {e}")
            return self._load_cached_file()

        if not all_news:
            return self._load_cached_file()

        # ------------------------------------------------------------------
        # Step 2 & 3: Filter & Deduplicate
        # ------------------------------------------------------------------
        filtered_news = FinanceNewsFilter.filter_list(all_news)
        unique_news = Deduplicator.deduplicate(filtered_news)
        print(f"🔄 After basic filtering and deduplication, {len(unique_news)} financial news items remain.")

        # ------------------------------------------------------------------
        # Step 3.5: Dual Filter (Keywords & 3-Day Window)
        # ------------------------------------------------------------------
        TARGET_STOCK_KEYWORDS = [
            'hfcl', 'nvda', 'nvidia', 'aapl', 'apple', 'tsla', 'tesla',
            'msft', 'googl', 'google', 'amzn', 'amd',
            'nifty', 'reliance', 'ril', 'shares', 'stock'
        ]
        now = datetime.now()
        strict_stock_news = []

        for news in unique_news:
            text_to_check = f"{news.headline} {news.summary}".lower()
            has_keyword = any(kw in text_to_check for kw in TARGET_STOCK_KEYWORDS)
            news_time = self._parse_date(news.published_at)
            days_age = (now - news_time).days

            if has_keyword and days_age <= 3:
                strict_stock_news.append(news)
            else:
                if days_age > 3 and has_keyword:
                    print(f"🗑️ [Time Filter]  ({news.published_at}): {news.headline[:40]}...")

        print(f"[Token Saver] Filter and retain {len(strict_stock_news)} of the latest stock news items.")

        # Exclude already processed IDs
        # new_news_to_analyze = [n for n in strict_stock_news if n.id not in self.processed_ids]
        new_news_to_analyze = []
        for n in strict_stock_news:
            if n.id in self.processed_ids or n.link in self.processed_links:
                continue
            new_news_to_analyze.append(n)
        if not new_news_to_analyze:
            print("\nNo new news containing the target stock; skip the AI ​​request.")
            return self._load_cached_file()

        # if len(new_news_to_analyze) > 2:
        #     print(f"\n⚠️ [Limit] 偵測到 {len(new_news_to_analyze)} 條新新聞，為節省資源，僅強制分析前 2 條。")
        #     new_news_to_analyze = new_news_to_analyze[:2]
        print(f"\nDetected {len(new_news_to_analyze)} *NEW* items! Preparing for AI analysis...")

        # ------------------------------------------------------------------
        # Step 4: AI Sentiment Analysis
        # ------------------------------------------------------------------
        print("\n🤖 Step 4: AI Sentiment Analysis")
        print("-"*50)

        new_results = []
        for i, news in enumerate(new_news_to_analyze, 1):
            headline = news.headline or "No Headline"
            summary = news.summary or ""
            print(f"\n   [{i}/{len(new_news_to_analyze)}] Analyzing: {news.headline[:50]}...")

            try:
                analysis = self.analyzer.analyze(news.headline, news.summary, mode="realtime")
                if not analysis or ('choices' in str(analysis) and not isinstance(analysis, dict)):
                    raise ValueError("Invalid API response format")
            except Exception as e:
                print(f"   ❌ AI analysis failed ({e}), using preset fallback values...")
                analysis = {
                    "highlights": ["API evaluation skipped"],
                    "sentiment": 0.0,
                    "risk_tag": "Low Risk",
                    "reasoning": f"Skipped due to API error: {str(e)}",
                    "related_symbols": []
                }

            # Regex Backup for Symbols
            ai_symbols = analysis.get("related_symbols", [])
            if not isinstance(ai_symbols, list):
                ai_symbols = []

            MASTER_STOCK_KEYWORDS = {
                'RELIANCE': ['reliance', 'ril', 'mukesh ambani'],
                'NIFTY': ['nifty', 'nifty50', 'nse'],
                'HFCL': ['hfcl'],
                'NVDA': ['nvda', 'nvidia', '黃仁勳'],
                'AAPL': ['aapl', 'apple', 'iphone'],
                'TSLA': ['tsla', 'tesla', 'musk'],
                'MSFT': ['msft', 'microsoft'],
                'GOOGL': ['googl', 'google', 'alphabet'],
                'AMD': ['amd', 'advanced micro devices'],
                'AMZN': ['amzn', 'amazon'],
                'META': ['meta', 'facebook', 'instagram'],
                'INFY': ['infosys', 'infy'],
                'TCS': ['tcs', 'tata consultancy'],
                'WIPRO': ['wipro'],
                'DELL': ['dell'],
                'IBM': ['ibm']
            }

            headline_lower = news.headline.lower()
            summary_lower = news.summary.lower()
            combined_text = f"{headline_lower} {summary_lower}"

            extracted_symbols = list(ai_symbols) if isinstance(ai_symbols, list) else []

            for stock_sym, keywords in MASTER_STOCK_KEYWORDS.items():
                if any(kw in combined_text for kw in keywords):
                    if stock_sym not in extracted_symbols:
                        extracted_symbols.append(stock_sym)
            result = {
                "id": news.id,
                "source": news.source,
                "headline": news.headline,
                "link": news.link,
                "published_at": news.published_at,
                "summary": news.summary[:200],
                "highlights": analysis.get("highlights", []),
                "sentiment": analysis.get("sentiment", 0),
                "risk_tag": analysis.get("risk_tag", "Low Risk"),
                "reasoning": analysis.get("reasoning", ""),
                "related_symbols": extracted_symbols,
                "readiness_score": analysis.get("readiness_score", 0),
                "analyzed_at": datetime.now().isoformat()
            }

            new_results.append(result)
            self.processed_ids.add(news.id)
            self.processed_links.add(news.link)

            emoji = "🟢" if result['sentiment'] > 0.2 else "🔴" if result['sentiment'] < -0.2 else "🟡"
            print(f"       {emoji} Sentiment: {result['sentiment']:.2f} | Risk: {result['risk_tag']} | Symbols: {extracted_symbols}")
            time.sleep(2.5)

        # ------------------------------------------------------------------
        # Step 5: Merging, Absolute Deduplication, and Saving
        # ------------------------------------------------------------------
        print("\n💾 Step 5: Merging and Saving Results")
        print("-"*50)

        existing_news = self._load_cached_file()

        seen_links = set()
        unique_combined = []

        for item in new_results + existing_news:
            link = item.get("link")
            if link not in seen_links:
                seen_links.add(link)
                unique_combined.append(item)

        unique_combined.sort(key=lambda item: self._parse_date(item.get("published_at", "")), reverse=True)

        unique_combined = unique_combined[:50]
        unique_combined.sort(
            key=lambda item: (
                item.get("readiness_score", 0),
                abs(item.get("sentiment", 0)),
                self._parse_date(item.get("published_at", ""))
            ),
            reverse=True
        )
        output = {
            "metadata": {
                "total_news": len(unique_combined),
                "yahoo_count": len([r for r in unique_combined if r['source'] == 'yahoo']),
                "et_count": len([r for r in unique_combined if r['source'] == 'economic_times']),
                "analyzed_at": datetime.now().isoformat(),
                "model": "openrouter/free"
            },
            "news": unique_combined
        }

        os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
        with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
            json.dump(output, f, indent=2, ensure_ascii=False)

        print(f"   ✅ Merged results saved successfully to: {OUTPUT_FILE}")
        return unique_combined

    def start_automated_loop(self, interval_seconds: int = 900):
      """Start automated monitoring loop with countdown"""
      LOG_FILE = "pipeline.log"

      def log_both(message: str):
          timestamped_msg = f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {message}"
          print(timestamped_msg, flush=True)
          try:
              with open(LOG_FILE, "a", encoding="utf-8") as f:
                  f.write(timestamped_msg + "\n")
          except Exception:
              pass

      log_both("="*60)
      log_both("OptiTrade Background News Pipeline Started")
      log_both(f"Interval: {interval_seconds // 60} minutes ({interval_seconds} seconds)")
      log_both("="*60)

      while True:
          try:
              log_both("Starting new fetch and analysis cycle...")
              self.run_once()
              log_both("Cycle completed successfully.")
          except Exception as e:
              log_both(f"Error in pipeline: {e}")

          # Count down before next run
          log_both(f"Sleeping for {interval_seconds} seconds...")

          remaining = interval_seconds
          while remaining > 0:
              mins, secs = divmod(remaining, 60)
              if remaining % 15 == 0 or remaining <= 10:
                  print(f"⏳ Next run in: {mins:02d}:{secs:02d}", flush=True)
              time.sleep(1)
              remaining -= 1

          print("\n⏰ Timer finished! Waking up pipeline...\n", flush=True)

