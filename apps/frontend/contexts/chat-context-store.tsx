'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useState, useCallback } from 'react';

export interface WidgetContext {
  widgetId: string;
  label: string;
  text: string;
}

interface ChatContextStore {
  contexts: WidgetContext[];
  addContext(ctx: WidgetContext): void;
  removeContext(widgetId: string): void;
  clearAll(): void;
}

const ChatContextStoreContext = createContext<ChatContextStore | null>(null);

interface ChatContextStoreProviderProps {
  children: ReactNode;
}

export function ChatContextStoreProvider({ children }: ChatContextStoreProviderProps) {
  const [contexts, setContexts] = useState<WidgetContext[]>([]);

  const addContext = useCallback((ctx: WidgetContext) => {
    setContexts((prev) => {
      // Upsert by widgetId
      const filtered = prev.filter((c) => c.widgetId !== ctx.widgetId);
      return [...filtered, ctx];
    });
  }, []);

  const removeContext = useCallback((widgetId: string) => {
    setContexts((prev) => prev.filter((c) => c.widgetId !== widgetId));
  }, []);

  const clearAll = useCallback(() => {
    setContexts([]);
  }, []);

  return (
    <ChatContextStoreContext.Provider value={{ contexts, addContext, removeContext, clearAll }}>
      {children}
    </ChatContextStoreContext.Provider>
  );
}

export function useChatContextStore(): ChatContextStore {
  const ctx = useContext(ChatContextStoreContext);
  if (!ctx) {
    throw new Error('useChatContextStore must be used within ChatContextStoreProvider');
  }
  return ctx;
}
