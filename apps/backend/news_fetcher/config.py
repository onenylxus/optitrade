import os
from dotenv import load_dotenv

# Load .env file
current_dir = os.path.dirname(os.path.abspath(__file__))
dotenv_path = os.path.join(os.path.dirname(current_dir), ".env")
load_dotenv(dotenv_path)
# ============================================================
# API Configuration
# ============================================================

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")

OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"
CLOUD_MODEL_NAME = os.getenv("CLOUD_MODEL_NAME", "openrouter/free")
# CLOUD_MODEL_NAME = os.getenv("CLOUD_MODEL_NAME", "mistralai/mistral-nemo:free")

# USEDEEPSEEK
# OPENROUTER_API_URL = "https://api.deepseek.com/v1/chat/completions"
# CLOUD_MODEL_NAME = "deepseek-chat"

# USE OLLAMA
# OPENROUTER_API_URL = "http://localhost:11434/api/generate"
# CLOUD_MODEL_NAME = "qwen2.5:1.5b"
# CLOUD_MODEL_NAME = "qwen2:7b"
# CLOUD_MODEL_NAME = "llama3.2:3b"
# CLOUD_MODEL_NAME = "granite4.1:3b"
# CLOUD_MODEL_NAME = "gemini-3-flash-preview"
# CLOUD_MODEL_NAME = "mistral-nemo"

CALIBRATION_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "calibration_data.json")
CONFIDENCE_FACTOR_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "confidence_factor.json")
# ============================================================
# File Path Configuration
# ============================================================
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(CURRENT_DIR)))
FRONTEND_PUBLIC_DIR = os.path.join(PROJECT_ROOT, "apps", "frontend", "public")
OUTPUT_FILE = os.path.join(FRONTEND_PUBLIC_DIR, "news_data.json")
print(f"DEBUG: Loaded API Key: {OPENROUTER_API_KEY[:5]}***")
os.makedirs(FRONTEND_PUBLIC_DIR, exist_ok=True)
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
