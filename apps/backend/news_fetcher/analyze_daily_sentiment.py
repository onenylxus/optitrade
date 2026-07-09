import json
import os
import time
import glob
from .analyzer import CloudAnalyzer


def process_single_file(file_path, output_filename, analyzer):
    try:
      with open(file_path, 'r', encoding='utf-8') as f:
          articles = json.load(f)
    except json.JSONDecodeError as e:
        print(f"\nA corrupted JSON file was found: {file_path}")
        return

    print(f"\nProcessing: {os.path.basename(file_path)} ({len(articles)} News Articles)")

    cleaned_data = []
    sentiments = []

    for i, art in enumerate(articles, 1):
        title = art.get('title', '')
        summary = art.get('description') or title
        content = art.get('content', '')

        source_name = art.get("source", {}).get("name", "")
        if source_name in ["Nature.com", "Marginalrevolution.com"]:
            print(f"  [{i}/{len(articles)}] Skip {source_name}...")
            continue

        print(f"  [{i}/{len(articles)}] {title[:40]}...", end=" ", flush=True)
        try:

            res = analyzer.analyze(title, summary, content, mode="batch")
            print(f"DEBUG - AI Reasoning: {res.get('reasoning')}")
            print(f"✅ {res.get('sentiment')}")
            filtered_entry = {
                "source": art.get("source"),
                "author": art.get("author"),
                "title": title,
                "description": art.get("description"),
                "publishedAt": art.get("publishedAt"),
                "content": art.get("content"),
                "ai_results": {
                    "sentiment": res.get("sentiment", 0.0),
                    "risk_tag": res.get("risk_tag", "Neutral"),
                    "reasoning": res.get("reasoning", ""),
                    "highlights": res.get("highlights", [])
                }
            }
            cleaned_data.append(filtered_entry)
            sentiments.append(res.get("sentiment", 0.0))
            print(f"✅ {res.get('sentiment', 0.0):.2f}")

        except Exception as e:
            print(f"❌ AI analysis failed: {e}")
            time.sleep(2)

    with open(output_filename, 'w', encoding='utf-8') as f:
        json.dump(cleaned_data, f, ensure_ascii=False, indent=4)
    print(f"Saved: {os.path.basename(output_filename)}")

def run_batch_processing():
    current_dir = os.path.dirname(os.path.abspath(__file__))
    base_dir = os.path.join(os.path.dirname(current_dir), "news_data")
    result_dir = os.path.join(os.path.dirname(current_dir), "news_result")
    os.makedirs(result_dir, exist_ok=True)

    analyzer = CloudAnalyzer()

    files = sorted(glob.glob(os.path.join(base_dir, "*.json")))

    for file_path in files:
        filename = os.path.basename(file_path)
        output_filename = os.path.join(result_dir, filename.replace(".json", "_result.json"))

        if os.path.exists(output_filename):
            print(f"Skip completed files: {filename}")
            continue

        process_single_file(file_path, output_filename, analyzer)

if __name__ == "__main__":
    run_batch_processing()
