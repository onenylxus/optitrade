'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { openuiChatLibrary, openuiChatPromptOptions } from '@openuidev/react-ui/genui-lib';

export type MessageRole = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  text: string;
  isStreaming?: boolean;
  /** Model chain-of-thought. Surfaced in the collapsible "Thinking" block. */
  reasoning?: string;
  /** True while ``reasoning_delta`` frames are still arriving — or while a
   * streaming `` tag is still open and the parser is actively
   * accumulating reasoning text from the answer stream. */
  reasoningStreaming?: boolean;
}

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

const WS_URL = 'ws://178.128.213.162:8765/?client_id=OptiTrade&token=capstone';

const OPENUI_SYSTEM_PROMPT = openuiChatLibrary.prompt(openuiChatPromptOptions);

// Match an opening tag whose name contains "think" (case-insensitive).
// Captures the tag name into group 1; we re-check the captured name below
// to decide whether this is a real think-open tag or an unrelated match
// (the regex itself is name-agnostic so we can keep ``lastIndex`` semantics).
const RE_TAG_OPEN = /<([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/i;
const RE_TAG_CLOSE = /<\/([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/i;

const isThinkTagName = (name: string | undefined): boolean =>
  !!name && /think/i.test(name);

/**
 * Incrementally parse a model response stream so ``...``
 * regions are routed into the "reasoning" channel and everything else into
 * the "answer" channel. Naive `replace(/<think[\s\S]*?<\/think>/gi, '')`
 * looks fine until a tag boundary lands in the middle of a chunk — e.g.
 * `delta1 = "<thi"`, `delta2 = "nk>reasoning...</thi"`, `delta3 = "nk>answer"`.
 * This parser keeps a small uncommitted tail so each chunk can be processed
 * safely without ever splitting a tag.
 */
class StreamingThinkParser {
  private buffer = '';
  private processedCursor = 0;
  private mode: 'answer' | 'thinking' = 'answer';

  feed(chunk: string): { deltaAnswer: string; deltaThinking: string } {
    this.buffer += chunk;
    const result = this.commitSafeRegion();
    // Drop the consumed prefix so flush() only re-scans held-back content.
    this.buffer = this.buffer.slice(this.processedCursor);
    this.processedCursor = 0;
    return result;
  }

  /** Force-commit the remaining buffer (called when the stream ends). */
  flush(): { deltaAnswer: string; deltaThinking: string } {
    // No more data will arrive. Whatever's still in the buffer belongs to
    // the current mode. If we were holding back a leading opening tag in
    // answer mode, strip its tag delimiters so the user doesn't see raw
    // ``<think>`` markup; the matching content (between open and close) was
    // already routed to the thinking channel while we were in 'thinking'.
    if (!this.buffer) return { deltaAnswer: '', deltaThinking: '' };
    return this.parseFinal();
  }

  isThinking(): boolean {
    return this.mode === 'thinking';
  }

  private commitSafeRegion(): { deltaAnswer: string; deltaThinking: string } {
    // Decide how much of the buffer is safe to commit *given the current
    // parser mode*:
    //   - 'answer': hold back from the last ``<`` that *could* start an
    //     opening tag (``<`` followed by a letter). ``<`` followed by ``/``
    //     is a closing tag opener; harmless in answer mode (just emit it
    //     as text if it turns out to be stray).
    //   - 'thinking': hold back from the last ``</`` at or after the cursor.
    //     If a complete closing think-tag is already fully present, commit
    //     through its end so the parser transitions back to 'answer' and
    //     can emit the answer text that follows.
    let deltaAnswer = '';
    let deltaThinking = '';
    let cursor = this.processedCursor;

    // Loop while we keep making progress (each iteration either commits
    // new bytes or, in 'thinking' mode, may discover that a closing tag has
    // now become complete and emit the answer bytes after it).
    let safety = 0;
    while (safety++ < 64) {
      const nextSafe = this.findSafeEnd(cursor);
      if (nextSafe <= cursor) break;
      const newText = this.buffer.slice(cursor, nextSafe);
      cursor = nextSafe;

      let localCursor = 0;
      while (localCursor < newText.length) {
        if (this.mode === 'answer') {
          RE_TAG_OPEN.lastIndex = localCursor;
          const m = RE_TAG_OPEN.exec(newText);
          if (m && m.index !== undefined && isThinkTagName(m[1])) {
            deltaAnswer += newText.slice(localCursor, m.index);
            localCursor = m.index + m[0].length;
            this.mode = 'thinking';
            continue;
          }
          deltaAnswer += newText.slice(localCursor);
          localCursor = newText.length;
        } else {
          RE_TAG_CLOSE.lastIndex = localCursor;
          const m = RE_TAG_CLOSE.exec(newText);
          if (m && m.index !== undefined && isThinkTagName(m[1])) {
            deltaThinking += newText.slice(localCursor, m.index);
            localCursor = m.index + m[0].length;
            this.mode = 'answer';
            continue;
          }
          deltaThinking += newText.slice(localCursor);
          localCursor = newText.length;
        }
      }
    }

    this.processedCursor = cursor;
    return { deltaAnswer, deltaThinking };
  }

  /** Return the largest cursor position ≥ ``from`` such that committing
   *  ``buffer[from..safeEnd]`` cannot leave the parser stranded mid-tag. */
  private findSafeEnd(from: number): number {
    if (this.mode === 'answer') {
      let safeEnd = this.buffer.length;
      for (let i = this.buffer.length - 1; i >= from; i--) {
        if (this.buffer[i] !== '<') continue;
        const next = i + 1 < this.buffer.length ? this.buffer[i + 1] : '';
        if (/[a-zA-Z]/.test(next)) {
          safeEnd = i;
          break;
        }
      }
      return safeEnd;
    }
    // 'thinking' mode
    let lastCloseStart = -1;
    for (let i = this.buffer.length - 1; i >= from; i--) {
      if (this.buffer[i] === '<' && i + 1 < this.buffer.length && this.buffer[i + 1] === '/') {
        lastCloseStart = i;
        break;
      }
    }
    if (lastCloseStart === -1) {
      // No ``</`` anywhere — hold back the last 12 chars so a closing tag
      // arriving later can still be detected (worst case ``</thinking>`` = 11).
      return Math.max(from, this.buffer.length - 12);
    }
    RE_TAG_CLOSE.lastIndex = lastCloseStart;
    const m = RE_TAG_CLOSE.exec(this.buffer);
    if (m && m.index === lastCloseStart && isThinkTagName(m[1])) {
      return m.index + m[0].length;
    }
    return lastCloseStart;
  }

  /** Definitive end-to-end parse of the entire buffer. Called by ``flush``
   *  when no more chunks are coming. Walks the buffer looking for the
   *  next opening or closing think-tag from the current position. If a
   *  tag is found, routes the bytes before it into the current channel,
   *  switches mode, and continues. If no tag is found in the rest of the
   *  buffer, emits the rest into the current channel and stops. */
  private parseFinal(): { deltaAnswer: string; deltaThinking: string } {
    const text = this.buffer;
    let deltaAnswer = '';
    let deltaThinking = '';
    let cursor = 0;
    let mode: 'answer' | 'thinking' = this.mode;

    while (cursor < text.length) {
      if (mode === 'answer') {
        // Look for next ``<think...>`` from cursor.
        const slice = text.slice(cursor);
        // Re-scan the slice manually (since RE_TAG_OPEN has no ``g`` flag
        // and ``lastIndex`` would otherwise be ignored).
        const m = RE_TAG_OPEN.exec(slice);
        if (m && m.index !== undefined && isThinkTagName(m[1])) {
          deltaAnswer += slice.slice(0, m.index);
          cursor += m.index + m[0].length;
          mode = 'thinking';
          continue;
        }
        deltaAnswer += slice;
        cursor = text.length;
      } else {
        const slice = text.slice(cursor);
        const m = RE_TAG_CLOSE.exec(slice);
        if (m && m.index !== undefined && isThinkTagName(m[1])) {
          deltaThinking += slice.slice(0, m.index);
          cursor += m.index + m[0].length;
          mode = 'answer';
          continue;
        }
        deltaThinking += slice;
        cursor = text.length;
      }
    }

    this.buffer = '';
    this.processedCursor = 0;
    this.mode = 'answer';
    return { deltaAnswer, deltaThinking };
  }
}

export function useNanobot() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [isProcessing, setIsProcessing] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const streamBufferRef = useRef<Map<string, string>>(new Map());
  const streamMsgIdRef = useRef<Map<string, string>>(new Map());
  /** Per-stream parser so each answer stream independently routes its
   * ``...`` regions into the reasoning channel. */
  const parserByStreamRef = useRef<Map<string, StreamingThinkParser>>(new Map());
  /** Per-stream reasoning that arrived with a ``stream_id`` BEFORE the answer
   * ``delta`` stream opened — we hold it until ``ensureAnswerMessage`` claims
   * it for that stream. */
  const pendingReasoningRef = useRef<Map<string, { text: string; streaming: boolean }>>(
    new Map(),
  );
  /** Per-chat reasoning that arrived with NO ``stream_id`` (the typical shape
   * of nanobot's reasoning stream — it carries ``chat_id`` only). Claimed by
   * the first ``delta`` for that chat. */
  const pendingReasoningByChatRef = useRef<Map<string, { text: string; streaming: boolean }>>(
    new Map(),
  );
  /** When ``reasoning_delta`` arrives *before* the answer ``delta`` and there's
   * no streaming assistant message yet, we create a placeholder immediately
   * so the thinking renders live — then the answer ``delta`` attaches to the
   * same message by looking it up here keyed by ``chat_id``. */
  const placeholderByChatRef = useRef<Map<string, string>>(new Map());
  const isFirstMessageRef = useRef(true);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => setStatus('connected');
    ws.onclose = () => setStatus('disconnected');
    ws.onerror = () => setStatus('error');

    /** Find or create the assistant message currently streaming the *answer*
     * for this stream, and seed any pending reasoning that arrived before the
     * answer stream opened. Returns the message id. */
    const ensureAnswerMessage = (streamId: string, chatId?: string): string => {
      const existingId = streamMsgIdRef.current.get(streamId);
      if (existingId) return existingId;
      const msgId = `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      streamMsgIdRef.current.set(streamId, msgId);
      streamBufferRef.current.set(streamId, '');

      // If reasoning already opened a placeholder for this chat, adopt it
      // (and its accumulated reasoning) instead of creating a new bubble.
      if (chatId) {
        const placeholderId = placeholderByChatRef.current.get(chatId);
        if (placeholderId) {
          placeholderByChatRef.current.delete(chatId);
          // Adopt the placeholder: map our streamId to its id and clear the
          // placeholder's still-streaming flag (the answer is now what's
          // streaming, not the reasoning).
          streamMsgIdRef.current.set(streamId, placeholderId);
          updateMsg(placeholderId, { isStreaming: true });
          pendingReasoningByChatRef.current.delete(chatId);
          return placeholderId;
        }
      }

      // Claim any pending reasoning that arrived for this stream or this chat
      // before the first answer ``delta``. Prefer per-stream pending (carried
      // a ``stream_id``); fall back to per-chat pending (typical nanobot
      // reasoning payload, only ``chat_id``).
      const streamPending = pendingReasoningRef.current.get(streamId);
      const chatPending = chatId
        ? pendingReasoningByChatRef.current.get(chatId)
        : undefined;
      const pending = streamPending ?? chatPending;
      setMessages((prev) => [
        ...prev,
        {
          id: msgId,
          role: 'assistant',
          text: '',
          isStreaming: true,
          reasoning: pending?.text,
          reasoningStreaming: pending ? pending.streaming : false,
        },
      ]);
      if (streamPending) pendingReasoningRef.current.delete(streamId);
      if (chatPending && chatId) pendingReasoningByChatRef.current.delete(chatId);
      return msgId;
    };

    /** Create an assistant message placeholder pre-populated with reasoning
     *  text, so the Thinking block renders live as reasoning_delta frames
     *  stream in (before any answer ``delta`` arrives). Returns the id. */
    const ensureReasoningPlaceholder = (
      chatId: string | undefined,
      seedText: string,
      streaming: boolean,
    ): string | undefined => {
      if (!chatId) return undefined;
      const existing = placeholderByChatRef.current.get(chatId);
      if (existing) return existing;
      const msgId = `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      placeholderByChatRef.current.set(chatId, msgId);
      streamBufferRef.current.set(msgId, '');
      setMessages((prev) => [
        ...prev,
        {
          id: msgId,
          role: 'assistant',
          text: '',
          isStreaming: false,
          reasoning: seedText,
          reasoningStreaming: streaming,
        },
      ]);
      return msgId;
    };

    const updateMsg = (msgId: string, patch: Partial<ChatMessage>) => {
      setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, ...patch } : m)));
    };

    const appendAnswer = (msgId: string, text: string) => {
      if (!text) return;
      const next = (streamBufferRef.current.get(msgId) ?? '') + text;
      streamBufferRef.current.set(msgId, next);
      updateMsg(msgId, { text: next });
    };

    const appendReasoning = (msgId: string, text: string) => {
      if (!text) return;
      // Use a separate side buffer keyed by msgId so reasoning can race ahead
      // of the answer text. We store it on the message itself via updateMsg.
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? { ...m, reasoning: (m.reasoning ?? '') + text, reasoningStreaming: true }
            : m,
        ),
      );
    };

    ws.onmessage = (event: MessageEvent<string>) => {
      try {
        const data = JSON.parse(event.data);

        if (data.event === 'ready') {
          setStatus('connected');
        } else if (data.event === 'delta') {
          setIsProcessing(false);
          const { stream_id, chat_id, text } = data as {
            stream_id: string;
            chat_id?: string;
            text: string;
          };
          const msgId = ensureAnswerMessage(stream_id, chat_id);

          // Route the chunk through the streaming parser so `` regions
          // populate the reasoning channel rather than the answer.
          let parser = parserByStreamRef.current.get(stream_id);
          if (!parser) {
            parser = new StreamingThinkParser();
            parserByStreamRef.current.set(stream_id, parser);
          }
          const { deltaAnswer, deltaThinking } = parser.feed(text ?? '');
          if (deltaAnswer) appendAnswer(msgId, deltaAnswer);
          if (deltaThinking) {
            appendReasoning(msgId, deltaThinking);
          } else if (parser.isThinking()) {
            // We just transitioned INTO a think region on this chunk — make
            // sure reasoningStreaming is true so the ThinkingBlock shows the
            // streaming indicator even before any bytes have arrived.
            setMessages((prev) =>
              prev.map((m) => (m.id === msgId ? { ...m, reasoningStreaming: true } : m)),
            );
          }
        } else if (data.event === 'stream_end') {
          const { stream_id } = data as { stream_id: string };
          const msgId = streamMsgIdRef.current.get(stream_id);
          // Flush any remaining buffer through the parser so trailing text
          // (and any unclosed think region) is committed.
          const parser = parserByStreamRef.current.get(stream_id);
          if (parser && msgId) {
            const { deltaAnswer, deltaThinking } = parser.flush();
            if (deltaAnswer) appendAnswer(msgId, deltaAnswer);
            if (deltaThinking) appendReasoning(msgId, deltaThinking);
          }
          if (msgId) {
            updateMsg(msgId, { isStreaming: false, reasoningStreaming: false });
            streamMsgIdRef.current.delete(stream_id);
            streamBufferRef.current.delete(stream_id);
          }
          parserByStreamRef.current.delete(stream_id);
          // Stream closed without ever opening — drop any pending reasoning.
          if (!msgId) {
            pendingReasoningRef.current.delete(stream_id);
          }
        } else if (data.event === 'turn_end') {
          // Turn is fully done. Clear any per-chat pending reasoning or
          // placeholder that never got claimed (e.g. the model thought but
          // never produced an answer, or the answer ``delta`` already adopted
          // the placeholder in ``ensureAnswerMessage``).
          const { chat_id } = data as { chat_id?: string };
          if (chat_id) {
            pendingReasoningByChatRef.current.delete(chat_id);
            placeholderByChatRef.current.delete(chat_id);
          }
        } else if (data.event === 'reasoning_delta') {
          // Backend-side reasoning stream. Nanobot typically emits these with
          // only ``chat_id`` (no ``stream_id``), arriving BEFORE the first
          // ``delta`` for that turn. To show the thinking live, we create a
          // placeholder assistant message immediately (keyed by chat_id) and
          // stream reasoning into it; the answer ``delta`` later adopts the
          // same message via ``ensureAnswerMessage``.
          setIsProcessing(true);
          const { stream_id, chat_id, text } = data as {
            stream_id?: string;
            chat_id?: string;
            text: string;
          };
          const chunk = text ?? '';
          if (!chunk) return;

          // Fast path: a stream-keyed answer is already running.
          if (stream_id && streamMsgIdRef.current.has(stream_id)) {
            appendReasoning(streamMsgIdRef.current.get(stream_id)!, chunk);
            return;
          }

          // Stream-keyed reasoning but answer stream hasn't opened yet —
          // stash for later claim.
          if (stream_id) {
            const prev = pendingReasoningRef.current.get(stream_id) ?? {
              text: '',
              streaming: true,
            };
            pendingReasoningRef.current.set(stream_id, {
              text: prev.text + chunk,
              streaming: true,
            });
            // Make the placeholder visible now too (so thinking renders live).
            const placeholderId = ensureReasoningPlaceholder(chat_id, prev.text, true);
            if (placeholderId) appendReasoning(placeholderId, chunk);
            return;
          }

          // No stream id (typical nanobot shape). Two cases:
          //   (a) A streaming assistant already exists → attach to it.
          //   (b) No streaming assistant → create the placeholder NOW so
          //       the Thinking block renders live, then stream chunks into it.
          let attached = false;
          setMessages((prevList) => {
            for (let i = prevList.length - 1; i >= 0; i--) {
              const m = prevList[i];
              if (m.role === 'assistant' && (m.isStreaming || m.reasoningStreaming)) {
                attached = true;
                return prevList.map((mm) =>
                  mm.id === m.id
                    ? {
                        ...mm,
                        reasoning: (mm.reasoning ?? '') + chunk,
                        reasoningStreaming: true,
                      }
                    : mm,
                );
              }
            }
            return prevList;
          });
          if (attached) return;

          // Create placeholder on first chunk, then stream into it.
          ensureReasoningPlaceholder(chat_id, '', true);
          if (chat_id) {
            const placeholderId = placeholderByChatRef.current.get(chat_id);
            if (placeholderId) appendReasoning(placeholderId, chunk);
          }
        } else if (data.event === 'reasoning_end') {
          const { stream_id, chat_id } = data as {
            stream_id?: string;
            chat_id?: string;
          };
          if (stream_id) {
            const msgId = streamMsgIdRef.current.get(stream_id);
            if (msgId) {
              updateMsg(msgId, { reasoningStreaming: false });
            } else {
              const pending = pendingReasoningRef.current.get(stream_id);
              if (pending) {
                pendingReasoningRef.current.set(stream_id, { ...pending, streaming: false });
              }
            }
            return;
          }
          // No stream id — mark the per-chat pending reasoning as no longer
          // streaming (the first ``delta`` will pick it up with the right flag).
          if (chat_id) {
            const pending = pendingReasoningByChatRef.current.get(chat_id);
            if (pending) {
              pendingReasoningByChatRef.current.set(chat_id, { ...pending, streaming: false });
            }
          }
          // Also clear the flag on any already-streaming assistant.
          setMessages((prevList) =>
            prevList.map((m) =>
              m.role === 'assistant' && m.reasoningStreaming
                ? { ...m, reasoningStreaming: false }
                : m,
            ),
          );
        } else if (data.event === 'message') {
          // Non-streaming final answer — also parse out `` regions.
          setIsProcessing(false);
          const parser = new StreamingThinkParser();
          const { deltaAnswer, deltaThinking } = parser.feed((data.text as string) ?? '');
          const { deltaAnswer: flushedAnswer } = parser.flush();
          setMessages((prev) => [
            ...prev,
            {
              id: `msg-${Date.now()}`,
              role: 'assistant',
              text: (deltaAnswer || '') + (flushedAnswer || ''),
              reasoning: deltaThinking || undefined,
            },
          ]);
        }
      } catch {
        // ignore malformed frames
      }
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
    };
  }, [connect]);

  const send = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed || wsRef.current?.readyState !== WebSocket.OPEN) return;

    setMessages((prev) => [...prev, { id: `msg-${Date.now()}-user`, role: 'user', text: trimmed }]);

    let payload = trimmed;
    if (isFirstMessageRef.current) {
      payload = `${OPENUI_SYSTEM_PROMPT}\n\nUser: ${trimmed}`;
      isFirstMessageRef.current = false;
    }

    setIsProcessing(true);
    wsRef.current?.send(payload);
  }, []);

  const reconnect = useCallback(() => {
    setStatus('connecting');
    wsRef.current?.close();
    wsRef.current = null;
    connect();
  }, [connect]);

  return { messages, status, isProcessing, send, reconnect };
}
