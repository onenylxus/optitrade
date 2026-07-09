"""News Fetcher Module - Yahoo Finance + Economic Times"""
import requests
from bs4 import BeautifulSoup
import re
import time
from datetime import datetime
from typing import List, Dict, Optional
from dataclasses import dataclass

from .config import HEADERS, YAHOO_RSS_URL, ET_RSS_URL

@dataclass
class NewsItem:
    """Unified news data structure"""
    id: str
    source: str
    headline: str
    link: str
    summary: str
    content: str
    published_at: str
    sentiment: Optional[float] = None
    risk_tag: Optional[str] = None
    reasoning: Optional[str] = None

    def to_dict(self) -> Dict:
        return {
            "id": self.id,
            "source": self.source,
            "headline": self.headline,
            "link": self.link,
            "summary": self.summary,
            "content": self.content,
            "published_at": self.published_at,
            "sentiment": self.sentiment,
            "risk_tag": self.risk_tag,
            "reasoning": self.reasoning,
        }

# def is_relevant_to_gold(text: str) -> bool:
#     """Debug mode: print everything so we can see what's happening"""
#     text_lower = text.lower()

#     # 暫時放寬到極致：只有「這幾個垃圾詞」才擋掉
#     junk_keywords = ["renters", "insurance", "recipe", "horoscope"]

#     for junk in junk_keywords:
#         if junk in text_lower:
#             print(f"    DEBUG: Filter blocked: {text}") # 印出被擋掉的標題
#             return False

#     print(f"    DEBUG: Filter accepted: {text}") # 印出通過的標題
#     return True

class YahooNewsFetcher:
    """Yahoo Finance RSS news fetcher"""

    @staticmethod
    def fetch(limit: int = 10) -> List[NewsItem]:
        """Fetch news from Yahoo Finance RSS with filtering"""
        print(f"  📰 [Yahoo] Fetching RSS news...")

        try:
            response = requests.get(YAHOO_RSS_URL, headers=HEADERS, timeout=15)
            response.raise_for_status()
            soup = BeautifulSoup(response.content, "xml")
            items = soup.find_all('item')

            news_list = []
            for i, item in enumerate(items[:limit], 1):
                title = item.title.text.strip() if item.title else ""

                # Apply filter before processing
                # if not is_relevant_to_gold(title):
                #     continue

                link = item.link.text.strip() if item.link else ""
                description = item.description.text.strip() if item.description else ""
                pub_date = item.pubDate.text.strip() if item.pubDate else datetime.now().isoformat()

                news_item = NewsItem(
                    id=f"yahoo_{int(time.time())}_{i}",
                    source="yahoo",
                    headline=title,
                    link=link,
                    summary=description[:300] if description else title[:200],
                    content="",
                    published_at=pub_date
                )
                news_list.append(news_item)

            print(f"    ✅ [Yahoo] Successfully fetched {len(news_list)} filtered news items")
            return news_list
        except Exception as e:
            print(f"    ❌ [Yahoo] Fetch failed: {e}")
            return []

class EconomicTimesFetcher:
    """The Economic Times RSS news fetcher"""

    @staticmethod
    def fetch(limit: int = 10) -> List[NewsItem]:
        """Fetch news from Economic Times RSS with filtering"""
        print(f"  📰 [Economic Times] Fetching RSS news...")

        try:
            response = requests.get(ET_RSS_URL, headers=HEADERS, timeout=15)
            response.raise_for_status()
            soup = BeautifulSoup(response.content, "xml")
            items = soup.find_all('item')

            news_list = []
            for i, item in enumerate(items[:limit], 1):
                title = item.title.text.strip() if item.title else ""

                # Apply filter before processing
                # if not is_relevant_to_gold(title):
                #     continue

                link = item.link.text.strip() if item.link else ""
                description = item.description.text.strip() if item.description else ""
                pub_date = item.pubDate.text.strip() if item.pubDate else datetime.now().isoformat()

                # Clean HTML tags
                description = re.sub(r'<[^>]+>', '', description)

                news_item = NewsItem(
                    id=f"et_{int(time.time())}_{i}",
                    source="economic_times",
                    headline=title,
                    link=link,
                    summary=description[:300] if description else title[:200],
                    content="",
                    published_at=pub_date
                )
                news_list.append(news_item)

            print(f"    ✅ [Economic Times] Successfully fetched {len(news_list)} filtered news items")
            return news_list
        except Exception as e:
            print(f"    ❌ [Economic Times] Fetch failed: {e}")
            return []
