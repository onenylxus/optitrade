"""AI Analysis Module - Using OpenRouter Cloud API"""
import requests
import json
import re
from typing import Dict, Optional

from .config import OPENROUTER_API_KEY, OPENROUTER_API_URL, CLOUD_MODEL_NAME
import time

class CloudAnalyzer:
    """Financial news analyzer using OpenRouter Cloud API"""
    def __init__(self, api_key: str = None, model_name: str = None):
        # self.api_key = api_key or OPENROUTER_API_KEY
        # self.model_name = model_name or CLOUD_MODEL_NAME
        # self._check_api_key()
        # ===========ollama=============================
        self.url = "http://localhost:11434/api/generate"
        self.model_name = model_name or CLOUD_MODEL_NAME
        print(f"llm Model: {self.model_name}")

    def _check_api_key(self):
        """Check if API key is configured"""
        if not self.api_key or self.api_key == "":
            print("⚠️ OpenRouter API Key not set")
            print("   Please set OPENROUTER_API_KEY in .env file")

    def _call_ollama(self, prompt: str) -> Optional[str]:
      url = "http://localhost:11434/api/generate"
      payload = {
          "model": self.model_name,
          "prompt": prompt,
          "stream": False,
          "options": {
              "num_ctx": 2048,
              "num_thread": 2,
              "temperature": 0.1
          }
      }

      for attempt in range(2):
          try:
              response = requests.post(url, json=payload, timeout=90)
              if response.status_code == 200:
                  return response.json().get('response', '')
          except Exception as e:
              print(f"Ollama failed on the {attempt+1} attempt and is retrying...")
              time.sleep(2)
      return None

    def _call_openrouter(self, prompt: str, max_tokens: int) -> Optional[str]:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self.model_name,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.1,
            "max_tokens": max_tokens,
        }
        try:
            response = requests.post(OPENROUTER_API_URL, json=payload, headers=headers, timeout=60)
            if response.status_code == 200:
                return response.json()['choices'][0]['message']['content']
            else:
                print(f"    ❌ API Error ({response.status_code}): {response.text[:200]}")
                return None
        except Exception as e:
            print(f"    ❌ API call failed: {e}")
            return None
    def _call_api(self, prompt: str, max_tokens: int = 1000) -> Optional[str]:
        return self._call_ollama(prompt)
        # return self._call_openrouter(prompt, max_tokens)

    def analyze(self, title: str, summary: str, content: str = "", mode: str = "batch"):
            """Analyze a single news article, returning sentiment, risk_tag, reasoning, highlights, and readiness_score"""
            # content = summary if summary else ""
            # if not content or len(content) < 50:
            #     content = title

            # if len(content) > 1500:
            #     content = content[:1500] + "..."
            full_text = f"Title: {title}\nSummary: {summary}\nContent: {content}"

            if len(full_text) > 2000:
                full_text = full_text[:2000] + "..."

            if mode == "realtime":
              prompt = f"""You are a professional financial news analyst. Analyze the following news and output ONLY valid JSON.

              News Title: {title}
              News Content: {content}

              IMPORTANT CRITICAL RULES:
              1. If the title contains words like "beat", "surge", "rally", "jump", "upgrade", "strong" → sentiment MUST BE POSITIVE (> 0.3)
              2. If the title contains words like "disappointing", "withdraw", "crisis", "risk", "shutdown", "crash", "tumble", "investigation" → sentiment MUST BE NEGATIVE (< -0.3)
              3. If the content has specific numbers (EPS, revenue, percentage), use them in highlights.
              4. If the content lacks specifics, base on title only.
              5. ⚠️ SENTIMENT & RISK CORRELATION RULE (CRITICAL):
                - If sentiment is EXACTLY 0.0 (Neutral), the risk_tag MUST BE "Low Risk". A purely neutral news cannot have elevated risks.

              Return ONLY a JSON object with EXACTLY these fields:
              - sentiment: Float between -1.0 and +1.0
              - risk_tag: "High Risk", "Medium Risk", or "Low Risk"
              - reasoning: Brief 2-sentence explanation
              - highlights: Array of 3 specific bullet points (each 5-12 words) extracting KEY FACTS from the news
              - confidence_score: Integer 0-100, representing your confidence in this analysis.

              Example for earnings beat:
              {{"sentiment": 0.85, "risk_tag": "Low Risk", "reasoning": "Strong earnings beat and raised guidance indicate healthy momentum.", "highlights": ["EPS grew 25% YoY", "Revenue beat consensus by $200M", "Guidance raised for FY2026"]}}

              Example for negative news:
              {{"sentiment": -0.65, "risk_tag": "High Risk", "reasoning": "Regulatory probe and potential fines create significant uncertainty.", "highlights": ["SEC launches investigation", "Possible recall of 2M vehicles", "Analysts downgrade to sell"]}}

              Now analyze Return ONLY valid JSON. No other text."""
            else:

             prompt = f"""You are a professional financial news analyst. Analyze the following news and output ONLY valid JSON.

              News Title: {title}
              News Content: {content}

              IMPORTANT CRITICAL RULES:
              1. If the title contains words like "beat", "surge", "rally", "jump", "upgrade", "strong" → sentiment MUST BE POSITIVE (> 0.3)
              2. If the title contains words like "disappointing", "withdraw", "crisis", "risk", "shutdown", "crash", "tumble", "investigation" → sentiment MUST BE NEGATIVE (< -0.3)
              3. If the content has specific numbers (EPS, revenue, percentage), use them in highlights.
              4. If the content lacks specifics, base on title only.
              5. ⚠️ SENTIMENT & RISK CORRELATION RULE (CRITICAL):
                - If sentiment is EXACTLY 0.0 (Neutral), the risk_tag MUST BE "Low Risk". A purely neutral news cannot have elevated risks.

              Return ONLY a JSON object with EXACTLY these fields:
              - sentiment: Float between -1.0 and +1.0
              - risk_tag: "High Risk", "Medium Risk", or "Low Risk"
              - reasoning: Brief 2-sentence explanation
              - highlights: Array of 3 specific bullet points (each 5-12 words) extracting KEY FACTS from the news
              - confidence_score: Integer 0-100, representing your confidence in this analysis.

              Example for earnings beat:
              {{"sentiment": 0.85, "risk_tag": "Low Risk", "reasoning": "Strong earnings beat and raised guidance indicate healthy momentum.", "highlights": ["EPS grew 25% YoY", "Revenue beat consensus by $200M", "Guidance raised for FY2026"]}}

              Example for negative news:
              {{"sentiment": -0.65, "risk_tag": "High Risk", "reasoning": "Regulatory probe and potential fines create significant uncertainty.", "highlights": ["SEC launches investigation", "Possible recall of 2M vehicles", "Analysts downgrade to sell"]}}

              Now analyze Return ONLY valid JSON. No other text."""

            response_text = self._call_api(prompt, max_tokens=500)

            if response_text:
                print(f"DEBUG: response_text: {len(response_text)}", flush=True)
                try:
                    clean_text = re.sub(r'^```json\s*', '', response_text.strip())
                    clean_text = re.sub(r'\s*```$', '', clean_text)
                    json_match = re.search(r'\{[\s\S]*\}', clean_text, re.DOTALL)
                    if json_match:
                        result = json.loads(json_match.group())
                        ai_score = result.get("confidence_score", 0)
                        sentiment = max(-1.0, min(1.0, float(result.get("sentiment", 0))))
                        risk_tag = result.get("risk_tag", "Low Risk")
                        highlights = result.get("highlights", ["No highlights"])
                        local_score = self.calculate_readiness_score(result)

                        sentiment = max(-1.0, min(1.0, sentiment))

                        # diff = abs(ai_score - local_score)
                        # if diff > 40:
                        #     final_score = local_score
                        #     warning = "AI confidence mismatched with system criteria."
                        # else:
                        #     final_score = (ai_score + local_score) // 2
                        #     warning = None


                        if abs(sentiment) < 0.01 and risk_tag in ["Medium Risk", "High Risk"]:
                            risk_tag = "Low Risk"
                        elif risk_tag == "High Risk" and sentiment >= 0:
                            sentiment = -0.50
                        elif risk_tag == "Low Risk" and sentiment <= -0.5:
                            risk_tag = "Medium Risk"

                        if risk_tag not in ["High Risk", "Medium Risk", "Low Risk"]:
                            risk_tag = "Low Risk"

                        highlights = result.get("highlights", [])
                        reasoning = result.get("reasoning", "AI analysis based on news content.")

                        if not highlights or len(highlights) == 0:
                            highlights = ["AI analysis completed", "Sentiment score calculated", "Risk assessment performed"]

                        final_result = {
                            "sentiment": sentiment,
                            "risk_tag": risk_tag,
                            "reasoning": reasoning[:300],
                            "highlights": highlights[:3],
                            # "readiness_score": final_score,
                            # "quality_warning": warning
                        }

                        final_result["readiness_score"] = self.calculate_readiness_score(final_result)

                        return final_result

                except json.JSONDecodeError as e:
                    print(f"    JSON parsing failed: {e}")
                    print(f"    Raw response: {response_text[:200]}...")
            fallback = self._mock_analysis(title)
            fallback["readiness_score"] = 50
            return fallback

    def _mock_analysis(self, title: str) -> Dict:
        """Keyword-based fallback analysis (used when API fails)"""
        t = title.lower()

        if any(x in t for x in ['aave', 'withdraw', 'crypto', 'defi', 'shutdown', 'risk', 'probe', 'investigation']):
            return {
                "sentiment": -0.65,
                "risk_tag": "High Risk",
                "reasoning": "Negative sentiment due to risk concerns and potential systemic impact.",
                "highlights": ["Risk event detected", "Monitor closely", "Potential market impact"]
            }
        # Positive keywords
        elif any(x in t for x in ['beat', 'surge', 'rally', 'strong', 'jump', 'upgrade', 'buyback']):
            return {
                "sentiment": 0.75,
                "risk_tag": "Low Risk",
                "reasoning": "Positive sentiment driven by strong performance and favorable indicators.",
                "highlights": ["Positive momentum detected", "Favorable fundamentals", "Market reacts positively"]
            }

        else:
            if any(x in t for x in ['raise', 'upbeat', 'profit', 'growth', 'advance']):
                return {
                    "sentiment": 0.45,
                    "risk_tag": "Low Risk",
                    "reasoning": "Fallback: Detected positive keywords in title during API backup.",
                    "highlights": ["Positive indicators noted", "Growth keywords detected", "Market expectations upbeat"]
                }

            return {
                "sentiment": 0.0,
                "risk_tag": "Low Risk",
                "reasoning": "Neutral sentiment, standard market activity without clear directional signal.",
                "highlights": ["Standard market event", "No clear directional catalysts", "Monitor standard developments"]
            }

    def calculate_readiness_score(self, analysis_result: Dict) -> int:
        score = 100
        sentiment = analysis_result.get("sentiment", 0)
        risk_tag = analysis_result.get("risk_tag", "Low Risk")

        if abs(sentiment) < 0.01 and risk_tag in ["Medium Risk", "High Risk"]:
            score -= 50

        if risk_tag == "High Risk" and sentiment >= 0:
            score -= 40

        if risk_tag == "Low Risk" and sentiment <= -0.5:
            score -= 30

        if len(analysis_result.get("reasoning", "")) < 20:
            score -= 20

        if "AI analysis completed" in str(analysis_result.get("highlights", [])):
            score -= 30

        return max(0, score)

    @staticmethod
    def parse_json_safely(text: str) -> Dict:
        try:
            start_index = text.find('{')
            end_index = text.rfind('}')

            if start_index == -1 or end_index == -1:
                raise ValueError("The JSON format is incorrect; parentheses cannot be found.")

            json_str = text[start_index : end_index + 1]
            return json.loads(json_str)

        except Exception as e:
            print(f"Parse failed, reason: {e}")
            return {
                "sentiment": 0.0,
                "risk_tag": "Low Risk",
                "reasoning": "Parse error, defaulted to neutral.",
                "highlights": ["Analysis unavailable"]
            }


