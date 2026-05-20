"""Configuration module"""
import os
from dotenv import load_dotenv

# Load .env file
load_dotenv()

# ============================================================
# API Configuration
# ============================================================

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"
CLOUD_MODEL_NAME = os.getenv("CLOUD_MODEL_NAME", "openrouter/free")

# ============================================================
# File Path Configuration
# ============================================================

# Get backend root directory
BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BACKEND_ROOT, "data")
OUTPUT_FILE = os.path.join(DATA_DIR, "news_analysis_result.json")

# ============================================================
# News Source Configuration
# ============================================================

YAHOO_RSS_URL = "https://finance.yahoo.com/rss/topfinstories"
ET_RSS_URL = "https://economictimes.indiatimes.com/news/rssfeeds/2146843.cms"

# ============================================================
# HTTP Headers
# ============================================================

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}
