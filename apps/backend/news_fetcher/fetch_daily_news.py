import json
import os
import time
import requests
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv()
NEWSAPI_KEY = os.getenv("NEWSAPI_KEY")

def fetch_news(start_date, end_date):
    url = "https://newsapi.org/v2/everything"
    params = {
        'q': 'gold OR inflation OR fed OR "interest rate"',
        'from': start_date,
        'to': end_date,
        'language': 'en',
        'sortBy': 'relevancy',
        'pageSize': 20,
        'apiKey': NEWSAPI_KEY
    }

    print(f"DEBUG: Request NewsAPI | Date: {start_date} to {end_date}")

    try:
        response = requests.get(url, params=params)
        print(f"DEBUG: API Response Status Code: {response.status_code}")

        if response.status_code == 200:
            data = response.json()
            articles = data.get('articles', [])
            print(f"DEBUG: Successfully fetched {len(articles)} raw news articles")
            return articles
        else:
            print(f"DEBUG: API Failure: {response.text}")
            return []

    except Exception as e:
        print(f"DEBUG: Connection error occurred: {str(e)}")
        return []

def run_fetch_pipeline():
    base_dir = "news_data"
    os.makedirs(base_dir, exist_ok=True)

    end_date = datetime.now()
    print(f"Start scraping pure financial news data from the past 30 days...")

    for i in range(30):
        target_date = end_date - timedelta(days=i)
        date_str = target_date.strftime('%Y-%m-%d')
        file_path = f"{base_dir}/{date_str}.json"

        if os.path.exists(file_path):
            print(f"ℹ️ {date_str}.json exists, skipping...")
            continue

        print(f"\n[progress bar] Date being processed: {date_str}...")

        articles = fetch_news(date_str, date_str)

        finance_keywords = [
            # General Economy and Interest Rates
            'fed', 'fomc', 'inflation', 'rate', 'interest', 'yield', 'cpi', 'macro',
            # Stock Market and Assets
            'stock', 'share', 'equity', 'market', 'nasdaq', 'qqq', 'index', 'etf',
            # Corporate Operations (Technology Stocks)
            'earnings', 'revenue', 'profit', 'tech', 'ai', 'nvidia', 'apple', 'microsoft'
        ]

        filtered = [
            a for a in articles
            if any(k in (a.get('title', '') + " " + (a.get('description') or '')).lower() for k in finance_keywords)
        ]

        # MAX 50 news each day
        final_list = filtered[:50]

        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(final_list, f, ensure_ascii=False, indent=4)

        print(f"Successfully saved {len(final_list)} articles to {file_path}")

        time.sleep(2)

    print("\n✅ All pure financial news data from the past 30 days has been downloaded!")
if __name__ == "__main__":
    run_fetch_pipeline()
