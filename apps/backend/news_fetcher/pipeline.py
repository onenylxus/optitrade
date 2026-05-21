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
        'stock', 'market', 'fund', 'investment', 'crypto', 'earnings',
        'revenue', 'acquisition'
    ]

    @classmethod
    def is_finance_news(cls, title: str) -> bool:
        if not title:
            return False
        title_lower = title.lower()
        return any(kw.lower() in title_lower for kw in cls.KEYWORDS)

    @classmethod
    def filter_list(cls, news_list: List[NewsItem]) -> List[NewsItem]:
        return [n for n in news_list if cls.is_finance_news(n.headline)]


# class NewsAnalysisPipeline:
#     """News analysis pipeline - integrates fetching and AI analysis"""

#     def __init__(self, limit_per_source: int = 10):
#         self.limit_per_source = limit_per_source
#         self.analyzer = CloudAnalyzer()

#     def run(self) -> List[Dict]:
#         """Run the complete pipeline"""
#         print("\n" + "="*70)
#         print("🚀 OptiTrade News Analysis System (Fetching + Cloud AI Analysis)")
#         print(f"⏰ Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
#         print(f"🤖 AI Model: openrouter/free")
#         print(f"📊 Fetch limit per source: {self.limit_per_source}")
#         print("="*70)

#         # Step 1: Fetch news
#         print("\n📡 Step 1: Fetching News")
#         print("-"*50)

#         all_news = []

#         yahoo_news = YahooNewsFetcher.fetch(limit=self.limit_per_source)
#         all_news.extend(yahoo_news)

#         et_news = EconomicTimesFetcher.fetch(limit=self.limit_per_source)
#         all_news.extend(et_news)

#         print(f"\n📊 Fetch completed: {len(all_news)} raw news items")
#         print(f"   - Yahoo: {len(yahoo_news)} items")
#         print(f"   - Economic Times: {len(et_news)} items")

#         # Step 2: Filter financial news
#         print("\n🔍 Step 2: Filtering Financial News")
#         print("-"*50)

#         filtered_news = FinanceNewsFilter.filter_list(all_news)
#         print(f"   Before filter: {len(all_news)} items")
#         print(f"   After filter: {len(filtered_news)} items (non-financial news removed)")

#         # Step 3: Deduplication
#         print("\n🔄 Step 3: Deduplication")
#         print("-"*50)

#         unique_news = Deduplicator.deduplicate(filtered_news)
#         print(f"   Before dedup: {len(filtered_news)} items")
#         print(f"   After dedup: {len(unique_news)} items")

#         # Step 4: AI Analysis
#         print("\n🤖 Step 4: AI Sentiment Analysis")
#         print("-"*50)

#         results = []
#         for i, news in enumerate(unique_news, 1):
#             print(f"\n   [{i}/{len(unique_news)}] Analyzing: {news.headline[:50]}...")

#             try:
#                 analysis = self.analyzer.analyze(news.headline, news.summary)

#                 if not analysis or 'choices' in str(analysis) and not isinstance(analysis, dict):
#                     raise ValueError("Invalid API response format")

#             except Exception as e:
#                 print(f"       ❌ AI analysis failed ({e}), automatically assigning preset values ​​to continue...")
#                 analysis = {
#                     "highlights": ["API evaluation skipped"],
#                     "sentiment": 0.0,
#                     "risk_tag": "Low Risk",
#                     "reasoning": f"Skipped due to API error: {str(e)}"
#                 }

#             result = {
#                 "id": news.id,
#                 "source": news.source,
#                 "headline": news.headline,
#                 "link": news.link,
#                 "published_at": news.published_at,
#                 "summary": news.summary[:200],
#                 "highlights": analysis.get("highlights", []),
#                 "sentiment": analysis.get("sentiment", 0),
#                 "risk_tag": analysis.get("risk_tag", "Low Risk"),
#                 "reasoning": analysis.get("reasoning", ""),
#                 "analyzed_at": datetime.now().isoformat()
#             }

#             results.append(result)

#             # Display real-time results
#             emoji = "🟢" if result['sentiment'] > 0.2 else "🔴" if result['sentiment'] < -0.2 else "🟡"
#             print(f"       {emoji} Sentiment: {result['sentiment']:.2f} | Risk: {result['risk_tag']}")

#             time.sleep(2.5)

#         # for i, news in enumerate(unique_news, 1):
#         #     print(f"\n   [{i}/{len(unique_news)}] Analyzing: {news.headline[:50]}...")

#         #     analysis = self.analyzer.analyze(news.headline, news.summary)

#         #     result = {
#         #         "id": news.id,
#         #         "source": news.source,
#         #         "headline": news.headline,
#         #         "link": news.link,
#         #         "published_at": news.published_at,
#         #         "summary": news.summary[:200],
#         #         "highlights": analysis.get("highlights", []),
#         #         "sentiment": analysis.get("sentiment", 0),
#         #         "risk_tag": analysis.get("risk_tag", "Low Risk"),
#         #         "reasoning": analysis.get("reasoning", ""),
#         #         "analyzed_at": datetime.now().isoformat()
#         #     }

#         #     results.append(result)

#         #     # Display real-time results
#         #     emoji = "🟢" if result['sentiment'] > 0.2 else "🔴" if result['sentiment'] < -0.2 else "🟡"
#         #     print(f"       {emoji} Sentiment: {result['sentiment']:.2f} | Risk: {result['risk_tag']}")

#         #     time.sleep(0.5)  # Avoid too many requests

#         # Step 5: Save results
#         print("\n💾 Step 5: Saving Results")
#         print("-"*50)

#         output = {
#             "metadata": {
#                 "total_news": len(results),
#                 "yahoo_count": len([r for r in results if r['source'] == 'yahoo']),
#                 "et_count": len([r for r in results if r['source'] == 'economic_times']),
#                 "analyzed_at": datetime.now().isoformat(),
#                 "model": "openrouter/free"
#             },
#             "news": results
#         }

#         # Ensure directory exists
#         os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)

#         with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
#             json.dump(output, f, indent=2, ensure_ascii=False)

#         print(f"   ✅ Results saved to: {OUTPUT_FILE}")

#         # Step 6: Display summary
#         print("\n" + "="*70)
#         print("📊 Analysis Summary")
#         print("="*70)

#         positive = [r for r in results if r['sentiment'] > 0.2]
#         neutral = [r for r in results if -0.2 <= r['sentiment'] <= 0.2]
#         negative = [r for r in results if r['sentiment'] < -0.2]

#         print(f"   🟢 Positive news: {len(positive)} items")
#         print(f"   🟡 Neutral news: {len(neutral)} items")
#         print(f"   🔴 Negative news: {len(negative)} items")

#         return results


class NewsAnalysisPipeline:
    """News analysis pipeline - integrates fetching, persistence, and automated polling"""

    def __init__(self, limit_per_source: int = 10):
        self.limit_per_source = limit_per_source
        self.analyzer = CloudAnalyzer()

        # 🎯 慳 Token 核心核心：開機時讀取歷史紀錄，避免重啟後重複分析
        self.processed_ids = self._load_existing_ids()

    def _load_existing_ids(self) -> set:
        """從現有的 JSON 檔案中載入已經分析過的新聞 ID，防止重複扣 Token"""
        if os.path.exists(OUTPUT_FILE):
            try:
                with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    # 提取歷史新聞中所有的 id
                    return {item["id"] for item in data.get("news", []) if "id" in item}
            except Exception as e:
                print(f"⚠️ [Pipeline] 讀取舊數據失敗 ({e})，將使用全新狀態開始。")
                return set()
        return set()

    def run_once(self) -> List[Dict]:
        """執行單次完整 Flow（加入了及時攔截省 Token 邏輯）"""
        print("\n" + "="*70)
        print("🚀 OptiTrade News Analysis System (Flow Core)")
        print(f"⏰ Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("="*70)

        # Step 1: Fetch news
        print("\n📡 Step 1: Fetching News")
        print("-"*50)
        all_news = []
        yahoo_news = YahooNewsFetcher.fetch(limit=self.limit_per_source)
        all_news.extend(yahoo_news)
        et_news = EconomicTimesFetcher.fetch(limit=self.limit_per_source)
        all_news.extend(et_news)

        print(f"\n📊 Fetch completed: {len(all_news)} raw news items")

        # Step 2: Filter financial news
        filtered_news = FinanceNewsFilter.filter_list(all_news)

        # Step 3: Deduplication (基礎去重：防止同一輪抓取到重複內容)
        unique_news = Deduplicator.deduplicate(filtered_news)
        print(f"🔄 經基礎篩選與去重後，剩餘 {len(unique_news)} 條財經新聞。")

        # -----------------------------------------------------------------
        # ⚡ 慳 Token 攔截防線：比對歷史 Processed IDs，只留真正「全新」的新聞
        # -----------------------------------------------------------------
        new_news_to_analyze = [n for n in unique_news if n.id not in self.processed_ids]

        # 🛑 即時 Return 機制：如果完全沒有全新新聞，直接收工，不調用 AI！
        if not new_news_to_analyze:
            print("\n✨ [省 Token 盾牌] 偵測完畢：全數新聞皆已分析過，沒有任何新頭條！")
            print("🛑 立即中止本輪 Flow，完美省下 AI Token！")
            return []

        print(f"\n🔥 偵測到有 {len(new_news_to_analyze)} 條全新新聞！準備送往 Cloud AI 分析...")
        # -----------------------------------------------------------------

        # Step 4: AI Analysis (只跑真正全新的新聞)
        print("\n🤖 Step 4: AI Sentiment Analysis")
        print("-"*50)

        new_results = []
        for i, news in enumerate(new_news_to_analyze, 1):
            print(f"\n   [{i}/{len(new_news_to_analyze)}] Analyzing: {news.headline[:50]}...")

            try:
                analysis = self.analyzer.analyze(news.headline, news.summary)
                if not analysis or 'choices' in str(analysis) and not isinstance(analysis, dict):
                    raise ValueError("Invalid API response format")
            except Exception as e:
                print(f"       ❌ AI analysis failed ({e}), automatically assigning preset values...")
                analysis = {
                    "highlights": ["API evaluation skipped"],
                    "sentiment": 0.0,
                    "risk_tag": "Low Risk",
                    "reasoning": f"Skipped due to API error: {str(e)}"
                }

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
                "analyzed_at": datetime.now().isoformat()
            }

            new_results.append(result)

            # 🎯 成功分析後，立刻把 ID 記錄到記憶體中
            self.processed_ids.add(news.id)

            # Display real-time results
            emoji = "🟢" if result['sentiment'] > 0.2 else "🔴" if result['sentiment'] < -0.2 else "🟡"
            print(f"       {emoji} Sentiment: {result['sentiment']:.2f} | Risk: {result['risk_tag']}")

            time.sleep(2.5) # 遵守你的頻率限制

        # Step 5: Save & Merge Results (合併新舊數據)
        print("\n💾 Step 5: Merging and Saving Results")
        print("-"*50)

        # 讀取舊 JSON 內的歷史數據，把新的貼在最前面（讓前端顯示最新）
        existing_news = []
        if os.path.exists(OUTPUT_FILE):
            try:
                with open(OUTPUT_FILE, 'r', encoding='utf-8') as f:
                    old_data = json.load(f)
                    existing_news = old_data.get("news", [])
            except Exception:
                existing_news = []

        # 合併：最新分析的放前面 + 歷史舊數據
        combined_news = new_results + existing_news

        # 選擇性防禦：如果檔案太大，可以限制最新 50-100 條（自由決定是否保留這行）
        # combined_news = combined_news[:100]

        output = {
            "metadata": {
                "total_news": len(combined_news),
                "yahoo_count": len([r for r in combined_news if r['source'] == 'yahoo']),
                "et_count": len([r for r in combined_news if r['source'] == 'economic_times']),
                "analyzed_at": datetime.now().isoformat(),
                "model": "openrouter/free"
            },
            "news": combined_news
        }

        os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
        with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
            json.dump(output, f, indent=2, ensure_ascii=False)

        print(f"   ✅ Merged results saved to: {OUTPUT_FILE}")
        return new_results

    # -----------------------------------------------------------------
    # 🕒 核心擴充：每隔 1 小時自動執行的無盡守護進程 (背景輪詢器)
    # -----------------------------------------------------------------
    def start_hourly_loop(self):
        """啟動定時自動輪詢器，每 1 小時 (3600秒) 自動呼叫一次 run_once"""
        print("\n" + "⚡"*35)
        print("🕒 OptiTrade 背景自動新聞監聽進程已啟動...")
        print("🕒 系統將會每隔 1 小時自動檢查最新市場消息。")
        print("⚡"*35 + "\n")

        while True:
            try:
                self.run_once()
            except Exception as e:
                print(f"❌ [Loop Error] 本輪自動執行發生非預期錯誤: {e}")

            # 1 小時 = 3600 秒
            print(f"\n💤 本輪檢查結束。進入休眠，1 小時後自動醒來檢查... (Next run at: 約 1 小時後)")
            time.sleep(3600)
