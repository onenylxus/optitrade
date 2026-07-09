"""Execute news fetching and analysis pipeline"""
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

# from news_fetcher import NewsAnalysisPipeline, OUTPUT_FILE
from news_fetcher.pipeline import NewsAnalysisPipeline
from .config import OUTPUT_FILE

def start_analysis():
    pipeline = NewsAnalysisPipeline(limit_per_source=50)
    results = pipeline.start_automated_loop(interval_seconds=900)
    # results = pipeline.run_once()

    print(f"\n✅ Analysis completed!")
    print(f"📁 Results saved to: {OUTPUT_FILE}")
    print(f"📊 Total analyzed: {len(results)} news items")

    # Display first 5 results
    print("\n📰 Latest News Summary:")
    for i, news in enumerate(results[:5], 1):
        emoji = "🟢" if news['sentiment'] > 0.2 else "🔴" if news['sentiment'] < -0.2 else "🟡"
        print(f"   {i}. {emoji} {news['headline'][:60]}...")
        print(f"      Sentiment: {news['sentiment']:.2f} | Risk: {news['risk_tag']}")

    return results


if __name__ == "__main__":
    # main()
    start_analysis()
