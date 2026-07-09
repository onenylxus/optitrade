# import yfinance as yf
# import pandas as pd
# import matplotlib.pyplot as plt
# import os
# import json

# # 1. 設定參數
# START_DATE = "2026-05-29"
# END_DATE = "2026-06-27"
# # SENTIMENT_DIR = "../news_result"
# # 取得目前這個檔案的絕對路徑
# current_file_dir = os.path.dirname(os.path.abspath(__file__))
# # 向上找一層並指向 news_result
# SENTIMENT_DIR = os.path.join(os.path.dirname(current_file_dir), "news_result")
# # ------------------

# print(f"DEBUG: 正在嘗試讀取路徑: {SENTIMENT_DIR}")

# def load_sentiment_data(directory):
#     """讀取資料夾內的所有 JSON 並轉為 DataFrame"""
#     data = []
#     if not os.path.exists(directory):
#         print(f"錯誤：找不到路徑 {directory}")
#         return pd.DataFrame()

#     for filename in os.listdir(directory):
#         if filename.endswith(".json"):
#             date_str = filename.replace("_result.json", "").replace(".json", "")
#             try:
#                 # 這裡加上了 encoding='utf-8'
#                 with open(os.path.join(directory, filename), 'r', encoding='utf-8') as f:
#                     content_list = json.load(f)

#                     # 處理 List 結構，計算當日所有新聞的平均情緒
#                     if isinstance(content_list, list) and len(content_list) > 0:
#                         total_sentiment = 0
#                         valid_count = 0
#                         for item in content_list:
#                             # 進入 ai_results 讀取 sentiment
#                             ai_res = item.get("ai_results", {})
#                             total_sentiment += ai_res.get("sentiment", 0)
#                             valid_count += 1

#                         avg_sentiment = total_sentiment / valid_count if valid_count > 0 else 0
#                         data.append({"Date": pd.to_datetime(date_str), "sentiment": avg_sentiment})
#             except Exception as e:
#                 print(f"解析 {filename} 時發生錯誤: {e}")

#     df = pd.DataFrame(data)
#     if df.empty: return df
#     return df.set_index('Date').sort_index()

# # 2. 獲取市場數據
# def get_market_data():
#     tickers = ["CL=F"]
#     # tickers = ["ES=F"]
#     data = yf.download(tickers, start=START_DATE, end=END_DATE)["Close"]
#     if isinstance(data, pd.DataFrame):
#         # data = data['ES=F']
#         data = data['CL=F']
#     # 計算 S&P 500 的日漲跌幅
#     market_returns = data.pct_change()
#     return market_returns

# # 3. 主程式
# sentiment_df = load_sentiment_data(SENTIMENT_DIR)
# market_returns = get_market_data()

# # 合併數據
# combined = sentiment_df.join(market_returns, how='inner')
# combined.columns = ['sentiment', 'market_return']

# # 4. 判斷背離：市場漲 (>0) 但情緒負 (<0)
# combined['divergence'] = (
#     ((combined['market_return'] > 0) & (combined['sentiment'] < 0)) |
#     ((combined['market_return'] < 0) & (combined['sentiment'] > 0))
# )

# # 5. 輸出結果與視覺化
# print("--- 情緒與市場背離檢測 ---")
# print(combined[combined['divergence']])

# # 繪圖
# plt.figure(figsize=(12, 6))
# plt.plot(combined.index, combined['market_return'] * 100, label='S&P 500 Daily Change (%)', color='blue')
# plt.bar(combined.index, combined['sentiment'] * 10, label='Sentiment Score (scaled)', color='red', alpha=0.3)
# plt.axhline(0, color='black', linestyle='--')
# plt.title("Market Return vs. News Sentiment")
# plt.legend()
# plt.show()


# import yfinance as yf
# import pandas as pd
# import matplotlib.pyplot as plt
# import os
# import json

# # 1. 設定參數
# START_DATE = "2026-05-29"
# END_DATE = "2026-06-27"
# current_file_dir = os.path.dirname(os.path.abspath(__file__))
# SENTIMENT_DIR = os.path.join(os.path.dirname(current_file_dir), "news_result")

# def load_sentiment_data(directory):
#     """讀取資料夾內的所有 JSON 並計算當日平均情緒"""
#     data = []
#     if not os.path.exists(directory):
#         print(f"錯誤：找不到路徑 {directory}")
#         return pd.DataFrame()

#     for filename in os.listdir(directory):
#         if filename.endswith(".json"):
#             date_str = filename.replace("_result.json", "").replace(".json", "")
#             try:
#                 with open(os.path.join(directory, filename), 'r', encoding='utf-8') as f:
#                     content_list = json.load(f)
#                     if isinstance(content_list, list) and len(content_list) > 0:
#                         total_sentiment = 0
#                         valid_count = 0
#                         for item in content_list:
#                             # 假設結構為 {'ai_results': {'sentiment': 0.0}}
#                             ai_res = item.get("ai_results", {})
#                             total_sentiment += ai_res.get("sentiment", 0)
#                             valid_count += 1
#                         avg_sentiment = total_sentiment / valid_count if valid_count > 0 else 0
#                         data.append({"Date": pd.to_datetime(date_str), "sentiment": avg_sentiment})
#             except Exception as e:
#                 print(f"解析 {filename} 時發生錯誤: {e}")

#     df = pd.DataFrame(data)
#     return df.set_index('Date').sort_index() if not df.empty else df

# def get_market_data():
#     """獲取 WTI 原油數據"""
#     tickers = ["QQQ"]
#     data = yf.download(tickers, start=START_DATE, end=END_DATE)["Close"]
#     if isinstance(data, pd.DataFrame):
#         data = data['QQQ']
#     return data.pct_change()

# # 2. 執行處理
# sentiment_df = load_sentiment_data(SENTIMENT_DIR)
# market_returns = get_market_data()

# # 合併並計算累積回報
# combined = sentiment_df.join(market_returns, how='inner')
# combined.columns = ['sentiment', 'market_return']
# combined['price_trend'] = (1 + combined['market_return'].fillna(0)).cumprod() * 100

# # 3. 定義雙向背離邏輯
# # 規則：價格漲+情緒負，或價格跌+情緒正
# combined['divergence'] = (
#     ((combined['market_return'] > 0) & (combined['sentiment'] < 0)) |
#     ((combined['market_return'] < 0) & (combined['sentiment'] > 0))
# )

# correlation = combined['sentiment'].corr(combined['market_return'])
# print(f"\n--- 統計分析 ---")
# print(f"情緒與市場漲跌幅的相關係數: {correlation:.4f}")

# # 相關性解讀說明
# if correlation > 0.3:
#     print("解讀: 呈現正相關，代表情緒越正面，市場越容易上漲 (情緒與市場走勢一致)。")
# elif correlation < -0.3:
#     print("解讀: 呈現負相關，代表情緒越正面，市場反而越容易下跌 (可能是反向指標)。")
# else:
#     print("解讀: 相關性較弱，代表市場走勢目前不受該新聞情緒直接支配。")

# # 4. 輸出與繪圖
# print("--- 情緒與市場背離檢測 ---")
# print(combined[combined['divergence']])

# fig, ax1 = plt.subplots(figsize=(12, 6))

# # 左軸：原油價格趨勢
# ax1.plot(combined.index, combined['price_trend'], color='tab:blue', linewidth=2, label='Oil Price Trend')
# ax1.set_ylabel('Oil Price (Indexed)', color='tab:blue')
# ax1.tick_params(axis='y', labelcolor='tab:blue')

# # 右軸：情緒柱狀圖
# ax2 = ax1.twinx()
# ax2.bar(combined.index, combined['sentiment'], color='tab:red', alpha=0.3, label='Sentiment Score')
# ax2.set_ylabel('Sentiment Score', color='tab:red')
# ax2.axhline(0, color='black', linestyle='--')

# # 標記背離點 (黃色圓點)
# div_points = combined[combined['divergence']]
# ax1.scatter(div_points.index, div_points['price_trend'], color='gold', s=100, label='Divergence', zorder=5)

# plt.title("WTI Crude Oil Price Trend vs. News Sentiment")
# plt.show()


import yfinance as yf
import pandas as pd
import matplotlib.pyplot as plt
import os
import json

# 1. 設定參數
START_DATE = "2026-05-29"
END_DATE = "2026-07-07"
current_file_dir = os.path.dirname(os.path.abspath(__file__))
SENTIMENT_DIR = os.path.join(os.path.dirname(current_file_dir), "news_result")

def load_sentiment_data(directory):
    """讀取資料夾內的所有 JSON 並計算當日平均情緒"""
    data = []
    if not os.path.exists(directory):
        print(f"錯誤：找不到路徑 {directory}")
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
                            # 假設結構為 {'ai_results': {'sentiment': 0.0}}
                            ai_res = item.get("ai_results", {})
                            total_sentiment += ai_res.get("sentiment", 0)
                            valid_count += 1
                        avg_sentiment = total_sentiment / valid_count if valid_count > 0 else 0
                        data.append({"Date": pd.to_datetime(date_str), "sentiment": avg_sentiment})
            except Exception as e:
                print(f"解析 {filename} 時發生錯誤: {e}")

    df = pd.DataFrame(data)
    return df.set_index('Date').sort_index() if not df.empty else df

def get_market_data():
    """獲取 QQQ 數據"""
    tickers = ["QQQ"]
    data = yf.download(tickers, start=START_DATE, end=END_DATE)["Close"]
    if isinstance(data, pd.DataFrame):
        data = data['QQQ']
    return data.pct_change()

# 2. 執行處理
sentiment_df = load_sentiment_data(SENTIMENT_DIR)
market_returns = get_market_data()

# 合併並計算累積回報
combined = sentiment_df.join(market_returns, how='inner')
combined.columns = ['sentiment', 'market_return']
combined['price_trend'] = (1 + combined['market_return'].fillna(0)).cumprod() * 100

# 3. 定義雙向背離邏輯
# 規則：價格漲+情緒負，或價格跌+情緒正
combined['divergence'] = (
    ((combined['market_return'] > 0) & (combined['sentiment'] < 0)) |
    ((combined['market_return'] < 0) & (combined['sentiment'] > 0))
)

correlation = combined['sentiment'].corr(combined['market_return'])
print(f"\n--- 統計分析 ---")
print(f"情緒與市場漲跌幅的相關係數: {correlation:.4f}")

# 相關性解讀說明
if correlation > 0.3:
    print("解讀: 呈現正相關，代表情緒越正面，市場越容易上漲 (情緒與市場走勢一致)。")
elif correlation < -0.3:
    print("解讀: 呈現負相關，代表情緒越正面，市場反而越容易下跌 (可能是反向指標)。")
else:
    print("解讀: 相關性較弱，代表市場走勢目前不受該新聞情緒直接支配。")

# 4. 輸出與繪圖
print("--- 情緒與市場背離檢測 ---")
print(combined[combined['divergence']])

fig, ax1 = plt.subplots(figsize=(12, 6))

# 左軸：QQQ 價格趨勢 (標籤已修正)
ax1.plot(combined.index, combined['price_trend'], color='tab:blue', linewidth=2, label='QQQ Price Trend')
ax1.set_ylabel('QQQ Price (Indexed)', color='tab:blue')
ax1.tick_params(axis='y', labelcolor='tab:blue')

# 右軸：情緒柱狀圖
ax2 = ax1.twinx()
ax2.bar(combined.index, combined['sentiment'], color='tab:red', alpha=0.3, label='Sentiment Score')
ax2.set_ylabel('Sentiment Score', color='tab:red')
ax2.axhline(0, color='black', linestyle='--')

# 標記背離點 (黃色圓點)
div_points = combined[combined['divergence']]
ax1.scatter(div_points.index, div_points['price_trend'], color='gold', s=100, label='Divergence', zorder=5)

# 整合圖例 (將左右軸的 Label 放在一起)
lines_1, labels_1 = ax1.get_legend_handles_labels()
lines_2, labels_2 = ax2.get_legend_handles_labels()
ax1.legend(lines_1 + lines_2, labels_1 + labels_2, loc='upper left')

# 標題修正
plt.title("QQQ Price Trend vs. News Sentiment")
plt.show()


