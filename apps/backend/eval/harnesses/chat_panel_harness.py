"""Frame-level harness for the OptiTrade chat panel.

The Nanobot service is out-of-process (ws://178.128.213.162:8765) and the eval
sandbox cannot reach it. This harness ports the production TypeScript parser
from apps/frontend/lib/use-nanobot.ts to Python and tests it against
synthetic WebSocket frames that match the documented wire protocol.

References:
  - apps/frontend/lib/use-nanobot.ts             (production parser + hook)
  - apps/frontend/components/home/chat-panel.tsx  (splitOpenUiResponse + SmartRenderer)

Wire protocol (extracted from the production hook, not the fake server):
  {"event": "ready",            "client_id", "status", "conversation_id"}
  {"event": "delta",            "stream_id", "chat_id"?, "text"}
  {"event": "reasoning_delta",  "stream_id"?, "chat_id"?, "text"}    # may carry no stream_id
  {"event": "reasoning_end",    "stream_id"?, "chat_id"?}
  {"event": "stream_end",       "stream_id"}
  {"event": "turn_end",         "chat_id"?}
  {"event": "message",          "text"}                              # non-streaming fallback
  {"event": "error",            "message"?}

Key behavioural details from the production code (use-nanobot.ts:46-215):
  1. RE_TAG_OPEN  = /<([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/i  -- name is captured
  2. RE_TAG_CLOSE = /<\/([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/i
  3. isThinkTagName(name) = /think/i.test(name)        -- case-insensitive
  4. Parser has TWO modes: 'answer' and 'thinking'.
  5. findSafeEnd in 'answer' mode: hold back from the last '<' followed by a
     letter (could be a tag opener).
  6. findSafeEnd in 'thinking' mode: hold back from the last '</' found; if
     that is a complete closing think-tag, commit through its end so the
     parser can switch back to 'answer'. Otherwise: hold back last 12 chars
     (worst case '</thinking>' is 11 chars).
  7. parseFinal walks the buffer once at end-of-stream to commit any
     still-held bytes; if an opening tag was held, it is treated as text
     (the matching close is already routed to reasoning).
  8. The hook's reasoningDelta path uses chat_id/stream_id/placeholder
     bookkeeping (placeholderByChatRef) so reasoning can render live before
     the answer 'delta' arrives.
  9. The message handler swallows JSON parse errors silently.

This harness exercises the parser and the message-handler state machine
directly against synthetic frames. It does NOT need a WebSocket server.
"""
from __future__ import annotations

import json
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


# ── Ported parser ─────────────────────────────────────────────────────────
# Faithful port of StreamingThinkParser from use-nanobot.ts. Each method
# mirrors the TS source line-for-line.
class StreamingThinkParser:
    RE_TAG_OPEN = re.compile(r"<([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>")
    RE_TAG_CLOSE = re.compile(r"</([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>")

    @staticmethod
    def _is_think_tag_name(name: str | None) -> bool:
        return bool(name) and "think" in name.lower()

    def __init__(self) -> None:
        self.buffer = ""
        self.processed_cursor = 0
        self.mode: str = "answer"  # 'answer' | 'thinking'

    def feed(self, chunk: str) -> dict:
        self.buffer += chunk
        result = self._commit_safe_region()
        # Drop the consumed prefix so flush() only re-scans held-back content.
        self.buffer = self.buffer[self.processed_cursor :]
        self.processed_cursor = 0
        return result

    def flush(self) -> dict:
        if not self.buffer:
            return {"deltaAnswer": "", "deltaThinking": ""}
        return self._parse_final()

    def is_thinking(self) -> bool:
        return self.mode == "thinking"

    def _commit_safe_region(self) -> dict:
        delta_answer = ""
        delta_thinking = ""
        cursor = self.processed_cursor
        for _ in range(64):  # safety bound
            next_safe = self._find_safe_end(cursor)
            if next_safe <= cursor:
                break
            new_text = self.buffer[cursor:next_safe]
            cursor = next_safe
            local_cursor = 0
            while local_cursor < len(new_text):
                if self.mode == "answer":
                    m = self.RE_TAG_OPEN.search(new_text, local_cursor)
                    if m and self._is_think_tag_name(m.group(1)):
                        delta_answer += new_text[local_cursor : m.start()]
                        local_cursor = m.end()
                        self.mode = "thinking"
                        continue
                    delta_answer += new_text[local_cursor:]
                    local_cursor = len(new_text)
                else:
                    m = self.RE_TAG_CLOSE.search(new_text, local_cursor)
                    if m and self._is_think_tag_name(m.group(1)):
                        delta_thinking += new_text[local_cursor : m.start()]
                        local_cursor = m.end()
                        self.mode = "answer"
                        continue
                    delta_thinking += new_text[local_cursor:]
                    local_cursor = len(new_text)
        self.processed_cursor = cursor
        return {"deltaAnswer": delta_answer, "deltaThinking": delta_thinking}

    def _find_safe_end(self, from_pos: int) -> int:
        if self.mode == "answer":
            safe_end = len(self.buffer)
            for i in range(len(self.buffer) - 1, from_pos - 1, -1):
                if self.buffer[i] != "<":
                    continue
                nxt = self.buffer[i + 1] if i + 1 < len(self.buffer) else ""
                if nxt and nxt.isalpha():
                    safe_end = i
                    break
            return safe_end
        # 'thinking' mode
        last_close_start = -1
        for i in range(len(self.buffer) - 1, from_pos - 1, -1):
            if self.buffer[i] == "<" and i + 1 < len(self.buffer) and self.buffer[i + 1] == "/":
                last_close_start = i
                break
        if last_close_start == -1:
            return max(from_pos, len(self.buffer) - 12)
        m = self.RE_TAG_CLOSE.search(self.buffer, last_close_start)
        if m and m.start() == last_close_start and self._is_think_tag_name(m.group(1)):
            return m.end()
        return last_close_start

    def _parse_final(self) -> dict:
        text = self.buffer
        delta_answer = ""
        delta_thinking = ""
        cursor = 0
        mode = self.mode
        while cursor < len(text):
            if mode == "answer":
                m = self.RE_TAG_OPEN.search(text, cursor)
                if m and self._is_think_tag_name(m.group(1)):
                    delta_answer += text[cursor : m.start()]
                    cursor = m.end()
                    mode = "thinking"
                    continue
                delta_answer += text[cursor:]
                cursor = len(text)
            else:
                m = self.RE_TAG_CLOSE.search(text, cursor)
                if m and self._is_think_tag_name(m.group(1)):
                    delta_thinking += text[cursor : m.start()]
                    cursor = m.end()
                    mode = "answer"
                    continue
                delta_thinking += text[cursor:]
                cursor = len(text)
        self.buffer = ""
        self.processed_cursor = 0
        self.mode = "answer"
        return {"deltaAnswer": delta_answer, "deltaThinking": delta_thinking}


# ── Ported splitOpenUiResponse (chat-panel.tsx:75-92) ─────────────────────
def split_open_ui_response(raw: str) -> dict:
    fence_match = re.search(r"```(?:openui|openui-lang)?\s*\n([\s\S]*?)(?:```|$)", raw)
    candidate = fence_match.group(1) if fence_match else raw
    root_match = re.search(r"(^|\n)\s*root\s*=", candidate)
    if not root_match or root_match.start() is None:
        return {"preamble": raw, "openui": "", "ok": False}
    slice_start = root_match.start() + (len(root_match.group(1)) if root_match.group(1) else 0)
    openui = candidate[slice_start:]
    preamble = (
        raw[: raw.find(fence_match.group(0))].strip()
        if fence_match
        else candidate[:slice_start].strip()
    )
    return {"preamble": preamble, "openui": openui, "ok": True}


# ── Ported message handler state machine (use-nanobot.ts:359-546) ─────────
@dataclass
class ChatState:
    """Mirrors the refs in useNanobot's connect() callback."""

    messages: list[dict] = field(default_factory=list)
    status: str = "connecting"
    is_processing: bool = False
    stream_msg_id: dict[str, str] = field(default_factory=dict)
    stream_buffer: dict[str, str] = field(default_factory=dict)
    parser_by_stream: dict[str, StreamingThinkParser] = field(default_factory=dict)
    pending_reasoning: dict[str, dict] = field(default_factory=dict)
    pending_reasoning_by_chat: dict[str, dict] = field(default_factory=dict)
    placeholder_by_chat: dict[str, str] = field(default_factory=dict)

    def _update_msg(self, msg_id: str, patch: dict) -> None:
        self.messages = [{**m, **patch} if m["id"] == msg_id else m for m in self.messages]

    def _ensure_answer_message(self, stream_id: str, chat_id: str | None) -> str:
        existing = self.stream_msg_id.get(stream_id)
        if existing:
            return existing
        # Adopt placeholder for this chat if reasoning arrived first.
        if chat_id and chat_id in self.placeholder_by_chat:
            placeholder_id = self.placeholder_by_chat.pop(chat_id)
            self.stream_msg_id[stream_id] = placeholder_id
            self.stream_buffer[placeholder_id] = ""
            self._update_msg(placeholder_id, {"isStreaming": True})
            self.pending_reasoning_by_chat.pop(chat_id, None)
            return placeholder_id
        msg_id = f"msg-{stream_id}"
        self.stream_msg_id[stream_id] = msg_id
        self.stream_buffer[msg_id] = ""
        # Claim pending reasoning if any.
        pending = self.pending_reasoning.pop(stream_id, None) or (
            self.pending_reasoning_by_chat.pop(chat_id, None) if chat_id else None
        )
        self.messages.append(
            {
                "id": msg_id,
                "role": "assistant",
                "text": "",
                "isStreaming": True,
                "reasoning": pending["text"] if pending else None,
                "reasoningStreaming": pending["streaming"] if pending else False,
            }
        )
        return msg_id

    def _ensure_reasoning_placeholder(self, chat_id: str | None, seed: str, streaming: bool) -> str | None:
        if not chat_id:
            return None
        if chat_id in self.placeholder_by_chat:
            return self.placeholder_by_chat[chat_id]
        msg_id = f"msg-placeholder-{chat_id}"
        self.placeholder_by_chat[chat_id] = msg_id
        self.stream_buffer[msg_id] = ""
        self.messages.append(
            {
                "id": msg_id,
                "role": "assistant",
                "text": "",
                "isStreaming": False,
                "reasoning": seed,
                "reasoningStreaming": streaming,
            }
        )
        return msg_id

    def _append_answer(self, msg_id: str, text: str) -> None:
        if not text:
            return
        nxt = self.stream_buffer.get(msg_id, "") + text
        self.stream_buffer[msg_id] = nxt
        self._update_msg(msg_id, {"text": nxt})

    def _append_reasoning(self, msg_id: str, text: str) -> None:
        if not text:
            return
        for m in self.messages:
            if m["id"] == msg_id:
                m["reasoning"] = (m.get("reasoning") or "") + text
                m["reasoningStreaming"] = True
                return

    def handle(self, frame: dict) -> None:
        """Dispatch a single WebSocket frame, exactly like ws.onmessage."""
        ev = frame.get("event")
        if ev == "ready":
            self.status = "connected"
        elif ev == "delta":
            self.is_processing = False
            stream_id = frame.get("stream_id")
            chat_id = frame.get("chat_id")
            text = frame.get("text", "")
            msg_id = self._ensure_answer_message(stream_id, chat_id)
            parser = self.parser_by_stream.get(stream_id)
            if parser is None:
                parser = StreamingThinkParser()
                self.parser_by_stream[stream_id] = parser
            r = parser.feed(text or "")
            if r["deltaAnswer"]:
                self._append_answer(msg_id, r["deltaAnswer"])
            if r["deltaThinking"]:
                self._append_reasoning(msg_id, r["deltaThinking"])
            elif parser.is_thinking():
                self._update_msg(msg_id, {"reasoningStreaming": True})
        elif ev == "stream_end":
            stream_id = frame.get("stream_id")
            msg_id = self.stream_msg_id.get(stream_id)
            parser = self.parser_by_stream.get(stream_id)
            if parser and msg_id:
                r = parser.flush()
                if r["deltaAnswer"]:
                    self._append_answer(msg_id, r["deltaAnswer"])
                if r["deltaThinking"]:
                    self._append_reasoning(msg_id, r["deltaThinking"])
            if msg_id:
                self._update_msg(msg_id, {"isStreaming": False, "reasoningStreaming": False})
                self.stream_msg_id.pop(stream_id, None)
                self.stream_buffer.pop(msg_id, None)
            self.parser_by_stream.pop(stream_id, None)
            if not msg_id:
                self.pending_reasoning.pop(stream_id, None)
        elif ev == "turn_end":
            chat_id = frame.get("chat_id")
            if chat_id:
                self.pending_reasoning_by_chat.pop(chat_id, None)
                self.placeholder_by_chat.pop(chat_id, None)
        elif ev == "reasoning_delta":
            self.is_processing = True
            stream_id = frame.get("stream_id")
            chat_id = frame.get("chat_id")
            text = frame.get("text", "")
            if not text:
                return
            # Fast path: answer stream already running.
            if stream_id and stream_id in self.stream_msg_id:
                self._append_reasoning(self.stream_msg_id[stream_id], text)
                return
            # Stream-keyed but no answer yet.
            if stream_id:
                prev = self.pending_reasoning.get(stream_id, {"text": "", "streaming": True})
                self.pending_reasoning[stream_id] = {"text": prev["text"] + text, "streaming": True}
                placeholder = self._ensure_reasoning_placeholder(chat_id, prev["text"], True)
                if placeholder:
                    self._append_reasoning(placeholder, text)
                return
            # No stream id (typical Nanobot). Attach to running placeholder or create one.
            for m in reversed(self.messages):
                if m["role"] == "assistant" and (m.get("isStreaming") or m.get("reasoningStreaming")):
                    self._append_reasoning(m["id"], text)
                    return
            self._ensure_reasoning_placeholder(chat_id, "", True)
            if chat_id and chat_id in self.placeholder_by_chat:
                self._append_reasoning(self.placeholder_by_chat[chat_id], text)
        elif ev == "reasoning_end":
            stream_id = frame.get("stream_id")
            chat_id = frame.get("chat_id")
            if stream_id:
                msg_id = self.stream_msg_id.get(stream_id)
                if msg_id:
                    self._update_msg(msg_id, {"reasoningStreaming": False})
                else:
                    pending = self.pending_reasoning.get(stream_id)
                    if pending:
                        self.pending_reasoning[stream_id] = {**pending, "streaming": False}
                return
            if chat_id:
                pending = self.pending_reasoning_by_chat.get(chat_id)
                if pending:
                    self.pending_reasoning_by_chat[chat_id] = {**pending, "streaming": False}
            for m in self.messages:
                if m["role"] == "assistant" and m.get("reasoningStreaming"):
                    m["reasoningStreaming"] = False
        elif ev == "message":
            self.is_processing = False
            parser = StreamingThinkParser()
            text = frame.get("text", "")
            r1 = parser.feed(text or "")
            r2 = parser.flush()
            self.messages.append(
                {
                    "id": f"msg-final-{len(self.messages)}",
                    "role": "assistant",
                    "text": (r1["deltaAnswer"] or "") + (r2["deltaAnswer"] or ""),
                    "reasoning": r1["deltaThinking"] or None,
                }
            )
        elif ev == "error":
            pass  # production hook ignores error payload


# ── Test scenarios: feed the state machine synthetic Nanobot frames ───────
def scenario_clean(state: ChatState) -> None:
    """Simple 'delta' path with reasoning emitted in a single reasoning_delta."""
    state.handle({"event": "ready", "client_id": "OptiTrade", "status": "connected", "conversation_id": "c1"})
    state.handle({"event": "reasoning_delta", "chat_id": "c1", "text": "The user wants a quick read. "})
    state.handle({"event": "reasoning_end", "chat_id": "c1"})
    state.handle({"event": "delta", "stream_id": "s1", "chat_id": "c1", "text": "Your portfolio is up 12%."})
    state.handle({"event": "stream_end", "stream_id": "s1"})
    state.handle({"event": "turn_end", "chat_id": "c1"})


def scenario_chunked_think(state: ChatState) -> None:
    """Reasoning text arrives interleaved with delta text; tags split across chunks."""
    state.handle({"event": "ready"})
    state.handle({"event": "reasoning_delta", "chat_id": "c2", "text": "<thi"})
    state.handle({"event": "reasoning_delta", "chat_id": "c2", "text": "nk>think then answer</thi"})
    state.handle({"event": "reasoning_delta", "chat_id": "c2", "text": "nk>"})
    state.handle({"event": "reasoning_end", "chat_id": "c2"})
    state.handle({"event": "delta", "stream_id": "s2", "chat_id": "c2", "text": "NVDA RSI is 62.3."})
    state.handle({"event": "stream_end", "stream_id": "s2"})
    state.handle({"event": "turn_end", "chat_id": "c2"})


def scenario_openui_card(state: ChatState) -> None:
    """Model emits a ```openui root = ...``` block as the answer."""
    state.handle({"event": "ready"})
    state.handle({"event": "delta", "stream_id": "s3", "chat_id": "c3",
                  "text": "Here is the comparison card.\n\n```openui\nroot = (\n"})
    state.handle({"event": "delta", "stream_id": "s3", "chat_id": "c3", "text": "  Card(...)\n)\n```\n"})
    state.handle({"event": "stream_end", "stream_id": "s3"})
    state.handle({"event": "turn_end", "chat_id": "c3"})


def scenario_thinking_in_answer(state: ChatState) -> None:
    """Model streams a <think>...</think> inside the answer (no separate reasoning_delta)."""
    state.handle({"event": "ready"})
    state.handle({"event": "delta", "stream_id": "s4", "chat_id": "c4",
                  "text": "Reasoning first: <think>I need to look at SMA-20. </think>"})
    state.handle({"event": "delta", "stream_id": "s4", "chat_id": "c4", "text": "NVDA is above SMA-20."})
    state.handle({"event": "stream_end", "stream_id": "s4"})
    state.handle({"event": "turn_end", "chat_id": "c4"})


def scenario_non_streaming_message(state: ChatState) -> None:
    """A single 'message' frame (non-streaming final answer path)."""
    state.handle({"event": "ready"})
    state.handle({"event": "message", "text": "<think>Just a fallback.</think>This is a direct answer."})
    state.handle({"event": "turn_end", "chat_id": "c5"})


def scenario_reasoning_before_delta(state: ChatState) -> None:
    """reasoning_delta arrives before the first delta; placeholder is adopted."""
    state.handle({"event": "ready"})
    state.handle({"event": "reasoning_delta", "chat_id": "c6", "text": "Building up a long thought."})
    state.handle({"event": "reasoning_end", "chat_id": "c6"})
    state.handle({"event": "delta", "stream_id": "s6", "chat_id": "c6", "text": "Here is my answer."})
    state.handle({"event": "stream_end", "stream_id": "s6"})
    state.handle({"event": "turn_end", "chat_id": "c6"})


def scenario_hallucination(state: ChatState) -> None:
    """Assistant fabricates a number (faithfulness axis would catch this upstream)."""
    state.handle({"event": "ready"})
    state.handle({"event": "delta", "stream_id": "s7", "chat_id": "c7",
                  "text": "NVDA's 5-year CAGR is 84.2% and Q4 revenue was $28.7B."})
    state.handle({"event": "stream_end", "stream_id": "s7"})
    state.handle({"event": "turn_end", "chat_id": "c7"})


def scenario_case_insensitive_think(state: ChatState) -> None:
    """isThinkTagName uses /think/i so <Thinking> and <think> both work."""
    state.handle({"event": "ready"})
    state.handle({"event": "delta", "stream_id": "s8", "chat_id": "c8",
                  "text": "<Thinking>Capitalized</Thinking>plain answer"})
    state.handle({"event": "stream_end", "stream_id": "s8"})
    state.handle({"event": "turn_end", "chat_id": "c8"})


def scenario_unrelated_tag(state: ChatState) -> None:
    """A non-think tag should NOT be treated as a think region."""
    state.handle({"event": "ready"})
    state.handle({"event": "delta", "stream_id": "s9", "chat_id": "c9",
                  "text": "<b>bold</b> not a think region"})
    state.handle({"event": "stream_end", "stream_id": "s9"})
    state.handle({"event": "turn_end", "chat_id": "c9"})


SCENARIOS: list[tuple[str, Any, dict]] = [
    ("clean",                     scenario_clean,                      {"has_reasoning": True,  "has_openui": False, "expected_text_contains": "portfolio is up 12%"}),
    ("chunked_think",             scenario_chunked_think,              {"has_reasoning": True,  "has_openui": False, "expected_text_contains": "NVDA RSI"}),
    ("openui_card",               scenario_openui_card,                {"has_reasoning": False, "has_openui": True,  "expected_text_contains": "Card("}),
    ("thinking_in_answer",        scenario_thinking_in_answer,         {"has_reasoning": True,  "has_openui": False, "expected_text_contains": "above SMA-20"}),
    ("non_streaming_message",     scenario_non_streaming_message,      {"has_reasoning": False, "has_openui": False, "expected_text_contains": "direct answer"}),
    ("reasoning_before_delta",    scenario_reasoning_before_delta,     {"has_reasoning": True,  "has_openui": False, "expected_text_contains": "my answer"}),
    ("hallucination",             scenario_hallucination,              {"has_reasoning": False, "has_openui": False, "expected_text_contains": "CAGR is 84.2%"}),
    ("case_insensitive_think",    scenario_case_insensitive_think,     {"has_reasoning": True,  "has_openui": False, "expected_text_contains": "plain answer"}),
    ("unrelated_tag",             scenario_unrelated_tag,              {"has_reasoning": False, "has_openui": False, "expected_text_contains": "<b>bold</b>"}),
]


def run() -> dict:
    results: list[dict] = []
    for name, fn, expect in SCENARIOS:
        s = ChatState()
        fn(s)
        msgs = s.messages
        assistant_msgs = [m for m in msgs if m["role"] == "assistant"]
        last = assistant_msgs[-1] if assistant_msgs else None
        text = last["text"] if last else ""
        reasoning = last.get("reasoning") if last else None
        has_reasoning = bool(reasoning and reasoning.strip())
        openui = split_open_ui_response(text)
        has_openui = openui["ok"]
        results.append(
            {
                "scenario": name,
                "n_assistant_messages": len(assistant_msgs),
                "status": s.status,
                "text_first120": text[:120],
                "text_len": len(text),
                "reasoning_len": len(reasoning) if reasoning else 0,
                "has_reasoning": has_reasoning,
                "has_openui": has_openui,
                "openui_chars": len(openui["openui"]),
                "expected_text_contains": expect["expected_text_contains"],
                "text_passed": expect["expected_text_contains"] in text,
                "reasoning_passed": (has_reasoning == expect["has_reasoning"]),
                "openui_passed": (has_openui == expect["has_openui"]),
            }
        )
    summary = {
        "scenarios_run": len(results),
        "all_text_passed":      all(r["text_passed"] for r in results),
        "all_reasoning_passed": all(r["reasoning_passed"] for r in results),
        "all_openui_passed":    all(r["openui_passed"] for r in results),
        "results": results,
    }
    return summary


# ── Direct parser tests ───────────────────────────────────────────────────
def test_parser_directly() -> dict:
    cases = [
        ("clean",            ["<think>I think this through.</think>Answer is 42."],
            {"reasoning": "I think this through.", "body": "Answer is 42."}),
        ("split_open",       ["<thi", "nk>I think this through.</think>Answer is 42."],
            {"reasoning": "I think this through.", "body": "Answer is 42."}),
        ("split_close",      ["<think>I think this through.</thi", "nk>Answer is 42."],
            {"reasoning": "I think this through.", "body": "Answer is 42."}),
        ("split_both",       ["<thi", "nk>I think ", "this through.</thi", "nk>Answer is 42."],
            {"reasoning": "I think this through.", "body": "Answer is 42."}),
        ("multi_block",      ["<think>first</think>mid<think>second</think>end"],
            {"reasoning": "firstsecond", "body": "midend"}),
        ("case_insensitive", ["<Thinking>Capitalized</Thinking>body"],
            {"reasoning": "Capitalized", "body": "body"}),
        ("unrelated",        ["<b>bold</b> stays"],
            {"reasoning": "", "body": "<b>bold</b> stays"}),
    ]
    out = []
    for name, chunks, expected in cases:
        p = StreamingThinkParser()
        r_total = ""
        a_total = ""
        for c in chunks:
            r = p.feed(c)
            r_total += r["deltaThinking"]
            a_total += r["deltaAnswer"]
        r2 = p.flush()
        r_total += r2["deltaThinking"]
        a_total += r2["deltaAnswer"]
        out.append({
            "name": name,
            "expected_reasoning": expected["reasoning"],
            "actual_reasoning":   r_total,
            "expected_body":      expected["body"],
            "actual_body":        a_total,
            "passed":             r_total == expected["reasoning"] and a_total == expected["body"],
        })
    return {"cases": out, "all_passed": all(c["passed"] for c in out)}


# ── Documented production limitation: the 'message' event drops reasoning ─
# The non-streaming 'message' event path in use-nanobot.ts:531-538 only saves
# deltaThinking from the FIRST parser.feed() call. Reasoning held back by
# findSafeEnd is silently lost on flush(). This is a real behaviour the
# harness documents — it would surface as a regression only if a future
# commit fixes the production code.
def test_message_event_reasoning_loss() -> dict:
    """The 'message' path drops reasoning that the parser held back across
    the feed→flush boundary — a faithful reproduction of the production bug."""
    state = ChatState()
    state.handle({"event": "ready"})
    state.handle({"event": "message", "text": "<think>Just a fallback.</think>Direct answer."})
    state.handle({"event": "turn_end", "chat_id": "c5"})
    msgs = [m for m in state.messages if m["role"] == "assistant"]
    last = msgs[-1] if msgs else None
    return {
        "production_drops_reasoning": (last.get("reasoning") or "") == "",
        "body_preserved":             "Direct answer." in (last["text"] if last else ""),
        "notes":                      "use-nanobot.ts:531-538 — `reasoning: deltaThinking || undefined` "
                                      "only reads the first feed() result. Reasoning held back by "
                                      "findSafeEnd is lost. Same faithful behaviour in this port.",
    }


def main() -> int:
    print("=== Direct parser tests (chunked-tag boundary cases) ===")
    direct = test_parser_directly()
    for c in direct["cases"]:
        flag = "✓" if c["passed"] else "✗"
        print(f"  [{flag}] {c['name']:<20}  reason={c['actual_reasoning']!r:<40}  body={c['actual_body']!r}")
    print(f"  → {direct['cases'].__len__()} cases, all_passed={direct['all_passed']}")

    print("\n=== End-to-end scenario harness (synthetic frames) ===")
    summary = run()
    for r in summary["results"]:
        flag_t = "✓" if r["text_passed"] else "✗"
        flag_r = "✓" if r["reasoning_passed"] else "✗"
        flag_o = "✓" if r["openui_passed"] else "✗"
        print(
            f"  [{flag_t}{flag_r}{flag_o}] {r['scenario']:<25}  "
            f"text={r['text_len']:>3}c  reasoning={r['reasoning_len']:>3}c  "
            f"openui={r['has_openui']}({r['openui_chars']}c)  status={r['status']}"
        )
    print(f"\n  → {summary['scenarios_run']} scenarios, "
          f"text_passed={summary['all_text_passed']}, "
          f"reasoning_passed={summary['all_reasoning_passed']}, "
          f"openui_passed={summary['all_openui_passed']}")

    out = {
        "parser_direct":        direct,
        "scenarios":            summary,
        "message_event_bug":    test_message_event_reasoning_loss(),
    }
    Path("/tmp/chat_harness.json").write_text(json.dumps(out, indent=2, default=str))
    print("\nWritten to /tmp/chat_harness.json")
    return 0 if (direct["all_passed"] and summary["all_text_passed"]
                 and summary["all_reasoning_passed"] and summary["all_openui_passed"]) else 1


if __name__ == "__main__":
    sys.exit(main())
