import yfinance as yf
import pandas as pd
import matplotlib.pyplot as plt
import os
import json

START_DATE = "2026-05-29"
END_DATE = "2026-07-07"
current_file_dir = os.path.dirname(os.path.abspath(__file__))
SENTIMENT_DIR = os.path.join(os.path.dirname(current_file_dir), "news_result")

def load_sentiment_data(directory):
    data = []
    if not os.path.exists(directory):
        print(f"Error: Path not found {directory}")
        return pd.DataFrame()

    for filename in os.listdir(directory):
        if filename.endswith(".json"):
            date_str = filename.replace("_result.json", "").replace(".json", "")
            try:
                with open(os.path.join(directory, filename), 'r', encoding='utf-8') as f:
                    content_list = json.load(f)
                    if isinstance(content_list, list) and len(content_list) > 0:
                        total_sentiment = 0
                        valid_count = 0
                        for item in content_list:
                            ai_res = item.get("ai_results", {})
                            total_sentiment += ai_res.get("sentiment", 0)
                            valid_count += 1
                        avg_sentiment = total_sentiment / valid_count if valid_count > 0 else 0
                        data.append({"Date": pd.to_datetime(date_str), "sentiment": avg_sentiment})
            except Exception as e:
                print(f"Error parsing {filename}: {e}")

    df = pd.DataFrame(data)
    return df.set_index('Date').sort_index() if not df.empty else df

def get_market_data():
    tickers = ["QQQ"]
    data = yf.download(tickers, start=START_DATE, end=END_DATE)["Close"]
    if isinstance(data, pd.DataFrame):
        data = data['QQQ']
    return data.pct_change()

# 2. Execution processing
sentiment_df = load_sentiment_data(SENTIMENT_DIR)
market_returns = get_market_data()

# Combine and calculate cumulative returns
combined = sentiment_df.join(market_returns, how='inner')
combined.columns = ['sentiment', 'market_return']
combined['price_trend'] = (1 + combined['market_return'].fillna(0)).cumprod() * 100

# 3. Define the logic of two-way divergence
# Rule: Price rises + negative sentiment, or price falls + positive sentiment
combined['divergence'] = (
    ((combined['market_return'] > 0) & (combined['sentiment'] < 0)) |
    ((combined['market_return'] < 0) & (combined['sentiment'] > 0))
)

correlation = combined['sentiment'].corr(combined['market_return'])
print(f"\n--- Statistical analysis ---")
print(f"Correlation coefficient between sentiment and market fluctuations: {correlation:.4f}")

# Interpretation of Correlation
if correlation > 0.3:
    print("Interpretation: Positive correlation, indicating that more positive sentiment is associated with upward market movement (sentiment and market trend are aligned).")
elif correlation < -0.3:
    print("Interpretation: Negative correlation, indicating that more positive sentiment is associated with downward market movement (could be a reverse indicator).")
else:
    print("Interpretation: Weak correlation, suggesting that the market trend is currently not directly driven by this news sentiment.")
# 4. Output and plotting
print("--- Statistical analysis ---")
print(combined[combined['divergence']])

fig, ax1 = plt.subplots(figsize=(12, 6))

# Left axis: QQQ price trend
ax1.plot(combined.index, combined['price_trend'], color='tab:blue', linewidth=2, label='QQQ Price Trend')
ax1.set_ylabel('QQQ Price (Indexed)', color='tab:blue')
ax1.tick_params(axis='y', labelcolor='tab:blue')

# Right axis: Sentiment bar chart
ax2 = ax1.twinx()
ax2.bar(combined.index, combined['sentiment'], color='tab:red', alpha=0.3, label='Sentiment Score')
ax2.set_ylabel('Sentiment Score', color='tab:red')
ax2.axhline(0, color='black', linestyle='--')

# Mark divergence points (yellow dots)
div_points = combined[combined['divergence']]
ax1.scatter(div_points.index, div_points['price_trend'], color='gold', s=100, label='Divergence', zorder=5)

# Combine legends (put the labels from both axes together)
lines_1, labels_1 = ax1.get_legend_handles_labels()
lines_2, labels_2 = ax2.get_legend_handles_labels()
ax1.legend(lines_1 + lines_2, labels_1 + labels_2, loc='upper left')

plt.title("QQQ Price Trend vs. News Sentiment")
plt.show()


