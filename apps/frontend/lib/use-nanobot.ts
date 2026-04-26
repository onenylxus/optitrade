'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type MessageRole = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  text: string;
  isStreaming?: boolean;
}

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

const WS_URL = 'ws://178.128.213.162:8765/?client_id=OptiTrade';

export function useNanobot() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const wsRef = useRef<WebSocket | null>(null);
  const streamBufferRef = useRef<Map<string, string>>(new Map());
  const streamMsgIdRef = useRef<Map<string, string>>(new Map());

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => setStatus('connected');
    ws.onclose = () => setStatus('disconnected');
    ws.onerror = () => setStatus('error');

    ws.onmessage = (event: MessageEvent<string>) => {
      try {
        const data = JSON.parse(event.data);

        if (data.event === 'ready') {
          setStatus('connected');
        } else if (data.event === 'delta') {
          const { stream_id, text } = data as { stream_id: string; text: string };

          if (!streamMsgIdRef.current.has(stream_id)) {
            const msgId = `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`;
            streamMsgIdRef.current.set(stream_id, msgId);
            streamBufferRef.current.set(stream_id, text);
            setMessages((prev) => [
              ...prev,
              { id: msgId, role: 'assistant', text, isStreaming: true },
            ]);
          } else {
            const msgId = streamMsgIdRef.current.get(stream_id);
            if (!msgId) return;

            const accumulated = (streamBufferRef.current.get(stream_id) ?? '') + text;
            streamBufferRef.current.set(stream_id, accumulated);
            setMessages((prev) =>
              prev.map((m) => (m.id === msgId ? { ...m, text: accumulated } : m)),
            );
          }
        } else if (data.event === 'stream_end') {
          const { stream_id } = data as { stream_id: string };
          const msgId = streamMsgIdRef.current.get(stream_id);
          if (msgId) {
            setMessages((prev) =>
              prev.map((m) => (m.id === msgId ? { ...m, isStreaming: false } : m)),
            );
            streamMsgIdRef.current.delete(stream_id);
            streamBufferRef.current.delete(stream_id);
          }
        } else if (data.event === 'message') {
          setMessages((prev) => [
            ...prev,
            { id: `msg-${Date.now()}`, role: 'assistant', text: data.text as string },
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
    wsRef.current?.send(trimmed);
  }, []);

  const reconnect = useCallback(() => {
    setStatus('connecting');
    wsRef.current?.close();
    wsRef.current = null;
    connect();
  }, [connect]);

  return { messages, status, send, reconnect };
}
