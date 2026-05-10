'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, Send, Wifi, WifiOff } from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Renderer } from '@openuidev/react-lang';
import { openuiLibrary } from '@openuidev/react-ui/genui-lib';
import { useNanobot } from '@/lib/use-nanobot';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { usePortfolioContext } from '@/contexts/portfolio-context';

function StatusDot({ status }: { status: ReturnType<typeof useNanobot>['status'] }) {
  if (status === 'connected')
    return <Wifi className="size-3.5 text-emerald-500" aria-label="Connected" />;
  if (status === 'connecting')
    return <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-label="Connecting" />;
  return <WifiOff className="size-3.5 text-destructive" aria-label="Disconnected" />;
}

const mdComponents: React.ComponentProps<typeof Markdown>['components'] = {
  p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  ul: ({ children }) => <ul className="my-1 ml-4 list-disc space-y-0.5">{children}</ul>,
  ol: ({ children }) => <ol className="my-1 ml-4 list-decimal space-y-0.5">{children}</ol>,
  li: ({ children }) => <li className="leading-5">{children}</li>,
  h1: ({ children }) => <h1 className="mb-1 text-sm font-semibold">{children}</h1>,
  h2: ({ children }) => <h2 className="mb-1 text-sm font-semibold">{children}</h2>,
  h3: ({ children }) => <h3 className="mb-0.5 text-xs font-semibold">{children}</h3>,
  pre: ({ children }) => (
    <pre className="my-1.5 overflow-x-auto rounded bg-black/10 p-2 text-xs">{children}</pre>
  ),
  code: ({ children }) => (
    <code className="rounded bg-black/10 px-1 font-mono text-xs">{children}</code>
  ),
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto rounded border border-border text-xs">
      <table className="w-full border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-muted/60">{children}</thead>,
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => <tr className="border-b border-border/50 last:border-0">{children}</tr>,
  th: ({ children }) => (
    <th className="px-2 py-1.5 text-left font-semibold">{children}</th>
  ),
  td: ({ children }) => <td className="px-2 py-1.5">{children}</td>,
  blockquote: ({ children }) => (
    <blockquote className="my-1.5 border-l-2 border-primary/50 pl-3 opacity-80 italic">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-2 border-border/50" />,
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2">
      {children}
    </a>
  ),
};

function SmartRenderer({ text, isStreaming }: { text: string; isStreaming?: boolean }) {
  if (text.trimStart().startsWith('root =')) {
    return <Renderer library={openuiLibrary} response={text} isStreaming={isStreaming} />;
  }
  return (
    <Markdown remarkPlugins={[remarkGfm]} components={mdComponents}>
      {text}
    </Markdown>
  );
}

function MessageBubble({ role, text, isStreaming }: { role: string; text: string; isStreaming?: boolean }) {
  const isUser = role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start w-full'}`}>
      <div
        className={`rounded-2xl px-3 py-2 text-sm leading-5 ${
          isUser
            ? 'max-w-[80%] bg-primary text-primary-foreground rounded-br-sm whitespace-pre-wrap break-words'
            : 'w-full bg-card text-card-foreground border border-border rounded-bl-sm break-words overflow-hidden'
        }`}
      >
        {isUser ? (
          text
        ) : (
          <SmartRenderer text={text} isStreaming={isStreaming} />
        )}
        {isStreaming && (
          <span className="ml-0.5 inline-block h-3 w-1.5 animate-pulse rounded-sm bg-current opacity-60" />
        )}
      </div>
    </div>
  );
}

export function ChatPanel() {
  const { portfolio, includeInChatContext } = usePortfolioContext();
  const { messages, status, isProcessing, send, reconnect } = useNanobot(
    includeInChatContext ? portfolio : null,
  );
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isProcessing]);

  function handleSend() {
    if (!input.trim()) return;
    send(input);
    setInput('');
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const isConnected = status === 'connected';

  return (
    <aside className="h-full min-h-0 p-3 sm:p-4">
      <Card className="flex h-full min-h-0 flex-col">
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle>Chat</CardTitle>
          <div className="flex items-center gap-3">
            <div className="text-[11px] text-muted-foreground">
              {includeInChatContext
                ? portfolio
                  ? `Context: ${portfolio.source === 'backend' ? portfolio.broker.status === 'connected' ? 'IBKR portfolio' : 'portfolio loaded' : 'demo portfolio'}`
                  : 'Context: unavailable'
                : 'Context: off'}
            </div>
            <button
              onClick={status === 'disconnected' || status === 'error' ? reconnect : undefined}
              className="flex items-center gap-1.5 text-xs text-muted-foreground"
              title={status}
            >
              <StatusDot status={status} />
              <span className="capitalize">{status}</span>
            </button>
          </div>
        </CardHeader>

        <CardContent className="flex min-h-0 flex-1 flex-col gap-3 px-4">
          <ScrollArea className="bg-muted/20 h-full min-h-0 rounded-lg">
            <div className="space-y-3 p-2 pr-3">
              {messages.length === 0 && isConnected && (
                <p className="text-muted-foreground py-4 text-center text-xs">
                  Connected to OptiTrade assistant. Ask anything.
                </p>
              )}
              {messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  role={message.role}
                  text={message.text}
                  isStreaming={message.isStreaming}
                />
              ))}
              {isProcessing && (
                <div className="flex justify-start">
                  <div className="bg-card text-card-foreground border-border rounded-2xl rounded-bl-sm border px-4 py-3">
                    <div className="flex items-center gap-1">
                      <span className="bg-muted-foreground/60 size-1.5 animate-bounce rounded-full [animation-delay:-0.3s]" />
                      <span className="bg-muted-foreground/60 size-1.5 animate-bounce rounded-full [animation-delay:-0.15s]" />
                      <span className="bg-muted-foreground/60 size-1.5 animate-bounce rounded-full" />
                    </div>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>

          <div className="bg-muted/20 border-input focus-within:border-ring focus-within:ring-ring/50 flex flex-col rounded-3xl border transition-colors focus-within:ring-2">
            <Textarea
              placeholder={isConnected ? 'Ask anything… (Enter to send)' : 'Connecting…'}
              rows={3}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={!isConnected}
              className="max-h-20 min-h-12 resize-none overflow-y-auto border-0 bg-transparent px-4 pt-4 pb-2 shadow-none focus-visible:border-0 focus-visible:ring-0"
            />

            <div className="flex items-center justify-end px-3 pb-1">
              <Button
                size="icon"
                variant="ghost"
                aria-label="Send message"
                onClick={handleSend}
                disabled={!isConnected || !input.trim()}
                className="text-foreground size-7 rounded-full border-0 bg-transparent p-0 shadow-none hover:bg-transparent disabled:opacity-30"
              >
                <Send className="size-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </aside>
  );
}
