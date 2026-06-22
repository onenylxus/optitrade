'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronRight, Loader2, Send, Sparkles, Wifi, WifiOff } from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Renderer } from '@openuidev/react-lang';
import { openuiChatLibrary } from '@openuidev/react-ui/genui-lib';
import { useNanobot } from '@/lib/use-nanobot';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { useChatContextStore } from '@/contexts/chat-context-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { detectSlashCommand, expandSlashCommand, getFilteredCommands, getHelpMessage, type SlashCommand } from '@/lib/slash-commands';

function StatusDot({ status }: { status: ReturnType<typeof useNanobot>['status'] }) {
  if (status === 'connected')
    return <Wifi className="size-3.5 text-emerald-500" aria-label="Connected" />;
  if (status === 'connecting')
    return (
      <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-label="Connecting" />
    );
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
  th: ({ children }) => <th className="px-2 py-1.5 text-left font-semibold">{children}</th>,
  td: ({ children }) => <td className="px-2 py-1.5">{children}</td>,
  blockquote: ({ children }) => (
    <blockquote className="my-1.5 border-l-2 border-primary/50 pl-3 opacity-80 italic">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-2 border-border/50" />,
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-primary underline underline-offset-2"
    >
      {children}
    </a>
  ),
};

// Extracts the OpenUI Lang program (starting at `root = ...`) from an LLM
// response that may contain preamble text, reasoning blocks, or ```openui
// code fences. Returns { preamble, openui } where either may be empty.
function splitOpenUiResponse(raw: string): { preamble: string; openui: string } {
  // Strip a single ```openui ... ``` (or ``` ... ```) fence if present.
  const fenceMatch = raw.match(/```(?:openui|openui-lang)?\s*\n([\s\S]*?)(?:```|$)/);
  const candidate = fenceMatch ? fenceMatch[1] : raw;

  // Find the first `root =` at the start of a line.
  const rootMatch = candidate.match(/(^|\n)\s*root\s*=/);
  if (!rootMatch || rootMatch.index === undefined) {
    return { preamble: raw, openui: '' };
  }
  const sliceStart = rootMatch.index + (rootMatch[1] ? rootMatch[1].length : 0);
  const openui = candidate.slice(sliceStart);
  // Preamble is whatever appeared before the fence (or before root=).
  const preamble = fenceMatch
    ? raw.slice(0, raw.indexOf(fenceMatch[0])).trim()
    : candidate.slice(0, sliceStart).trim();
  return { preamble, openui };
}

function SmartRenderer({ text, isStreaming }: { text: string; isStreaming?: boolean }) {
  const { preamble, openui } = splitOpenUiResponse(text);

  if (openui) {
    return (
      <>
        {preamble && (
          <div className="mb-2">
            <Markdown remarkPlugins={[remarkGfm]} components={mdComponents}>
              {preamble}
            </Markdown>
          </div>
        )}
        <Renderer library={openuiChatLibrary} response={openui} isStreaming={isStreaming} />
      </>
    );
  }

  return (
    <Markdown remarkPlugins={[remarkGfm]} components={mdComponents}>
      {text}
    </Markdown>
  );
}

function ThinkingBlock({
  text,
  streaming,
}: {
  text: string;
  streaming: boolean;
}) {
  // Always show the model's reasoning. Default open so the chain-of-thought
  // is visible the moment it starts arriving — mirrors the official nanobot
  // webui's ``ReasoningBubble`` (open while streaming, stays open on end so
  // the user can re-read what the model considered).
  const [open, setOpen] = useState(true);
  const hasText = text.trim().length > 0;
  if (!hasText && !streaming) return null;
  return (
    <div className="mb-1.5 w-full">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="text-muted-foreground hover:bg-muted/40 hover:text-foreground/80 flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium transition-colors"
      >
        <Sparkles className={`size-3 shrink-0 ${streaming ? 'animate-pulse' : ''}`} aria-hidden />
        <span>{streaming ? 'Thinking…' : 'Thought process'}</span>
        <ChevronRight
          className={`ml-auto size-3 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
          aria-hidden
        />
      </button>
      {open && hasText && (
        <div className="border-muted-foreground/20 mt-1 border-l pl-3 text-[11.5px] leading-relaxed">
          <div className="text-muted-foreground/90 whitespace-pre-wrap italic">
            {text}
            {streaming && (
              <span className="ml-0.5 inline-block h-2 w-1 animate-pulse rounded-sm bg-current opacity-60" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MessageBubble({
  role,
  text,
  isStreaming,
  reasoning,
  reasoningStreaming,
}: {
  role: string;
  text: string;
  isStreaming?: boolean;
  reasoning?: string;
  reasoningStreaming?: boolean;
}) {
  const isUser = role === 'user';
  // Hide phantom empty assistant bubbles (e.g. whitespace-only streams or
  // reasoning/tool channels with no user-visible text). The global typing
  // indicator already conveys "assistant is working", so an empty card adds
  // no signal — drop it whether streaming or finished.
  if (!isUser && !text.trim() && !(reasoningStreaming || (reasoning && reasoning.trim()))) {
    return null;
  }
  const showThinking = !isUser && (Boolean(reasoningStreaming) || Boolean(reasoning?.trim()));
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start w-full'}`}>
      <div
        className={`rounded-2xl px-3 py-2 text-sm leading-5 ${
          isUser
            ? 'max-w-[80%] rounded-br-sm bg-primary text-primary-foreground whitespace-pre-wrap wrap-break-word'
            : 'w-full rounded-bl-sm border border-border bg-card text-card-foreground overflow-hidden wrap-break-word'
        }`}
      >
        {showThinking && (
          <ThinkingBlock text={reasoning ?? ''} streaming={Boolean(reasoningStreaming)} />
        )}
        {isUser ? text : <SmartRenderer text={text} isStreaming={isStreaming} />}
        {isStreaming && (
          <span className="ml-0.5 inline-block h-3 w-1.5 animate-pulse rounded-sm bg-current opacity-60" />
        )}
      </div>
    </div>
  );
}

export function ChatPanel({ onClose }: { onClose?: () => void }) {
  const { messages, status, isProcessing, send, reconnect } = useNanobot();
  const { contexts, removeContext, clearAll } = useChatContextStore();
  const [input, setInput] = useState('');
  const [detectedCommand, setDetectedCommand] = useState<string | null>(null);
  const [showCommandMenu, setShowCommandMenu] = useState(false);
  const [filteredCommands, setFilteredCommands] = useState<SlashCommand[]>([]);
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isProcessing]);

  function handleSend() {
    if (!input.trim()) return;
    let messagePayload = input.trim();
    if (contexts.length > 0) {
      const contextBlock = contexts.map((c) => `${c.label}: ${c.text}`).join('\n');
      messagePayload = `[Widget Context]\n${contextBlock}\n\nUser: ${messagePayload}`;
      clearAll();
    }
    send(messagePayload);
    setInput('');
  }

  function selectCommand(command: SlashCommand) {
    const expanded = command.command === '/help' ? getHelpMessage() : command.prompt;
    if (expanded) {
      setInput(expanded + ' ');
      setShowCommandMenu(false);
      setDetectedCommand(null);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (showCommandMenu && filteredCommands.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedCommandIndex((prev) => (prev + 1) % filteredCommands.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedCommandIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length);
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        selectCommand(filteredCommands[selectedCommandIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowCommandMenu(false);
        return;
      }
    }

    if (e.key === ' ' && detectedCommand) {
      e.preventDefault();
      const expanded = expandSlashCommand(input.trim());
      if (expanded) {
        setInput(expanded + ' ');
        setDetectedCommand(null);
        setShowCommandMenu(false);
      }
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (showCommandMenu && filteredCommands.length > 0) {
        selectCommand(filteredCommands[selectedCommandIndex]);
      } else {
        const trimmed = input.trim();
        const expanded = expandSlashCommand(trimmed);
        if (expanded) {
          setInput(expanded);
          setTimeout(() => handleSend(), 0);
        } else {
          handleSend();
        }
      }
    }
  }

  const isConnected = status === 'connected';

  return (
    <aside className="flex h-full min-h-0 flex-col">
      <Card className="flex h-full min-h-0 flex-col">
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle>Chat</CardTitle>
          <div className="flex items-center gap-3">
            <button
              onClick={status === 'disconnected' || status === 'error' ? reconnect : undefined}
              className="flex items-center gap-1.5 text-xs text-muted-foreground"
              title={status}
            >
              <StatusDot status={status} />
              <span className="capitalize">{status}</span>
            </button>
            {onClose && (
              <Button
                size="icon"
                variant="ghost"
                aria-label="Close chat"
                onClick={onClose}
                className="size-7 rounded-full"
              >
                <X className="size-4" />
              </Button>
            )}
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
                  reasoning={message.reasoning}
                  reasoningStreaming={message.reasoningStreaming}
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

          {contexts.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {contexts.map((ctx) => (
                <div
                  key={ctx.widgetId}
                  className="bg-primary/10 border-primary/30 text-primary flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs"
                >
                  <span className="font-medium">{ctx.label}</span>
                  <button
                    type="button"
                    onClick={() => removeContext(ctx.widgetId)}
                    className="hover:text-primary-foreground/80 text-primary-foreground/60 transition-colors"
                    aria-label={`Remove ${ctx.label} from context`}
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="relative">
            {showCommandMenu && filteredCommands.length > 0 && (
              <div className="absolute bottom-full left-0 right-0 mb-2 rounded-lg border border-border bg-card shadow-lg overflow-hidden">
                <div className="max-h-60 overflow-y-auto">
                  {filteredCommands.map((cmd, index) => (
                    <button
                      key={cmd.command}
                      type="button"
                      onClick={() => selectCommand(cmd)}
                      className={`w-full px-4 py-2.5 text-left transition-colors ${
                        index === selectedCommandIndex
                          ? 'bg-primary/10 text-primary'
                          : 'hover:bg-muted/50'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <span className="font-mono text-sm font-semibold">{cmd.command}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">{cmd.description}</p>
                    </button>
                  ))}
                </div>
                <div className="border-t border-border bg-muted/30 px-3 py-1.5 text-[10px] text-muted-foreground">
                  <kbd className="rounded bg-background px-1 py-0.5">↑↓</kbd> navigate •{' '}
                  <kbd className="rounded bg-background px-1 py-0.5">Enter</kbd> or{' '}
                  <kbd className="rounded bg-background px-1 py-0.5">Tab</kbd> select •{' '}
                  <kbd className="rounded bg-background px-1 py-0.5">Esc</kbd> close
                </div>
              </div>
            )}
          </div>
          <div className="bg-muted/20 border-input focus-within:border-ring focus-within:ring-ring/50 flex flex-col rounded-3xl border transition-colors focus-within:ring-2">
            <Textarea
              placeholder={isConnected ? 'Ask anything… (Enter to send, type / for commands)' : 'Connecting…'}
              rows={3}
              value={input}
              onChange={(e) => {
                const value = e.target.value;
                setInput(value);
                const command = detectSlashCommand(value.trim());
                setDetectedCommand(command ? command.command : null);

                const filtered = getFilteredCommands(value);
                setFilteredCommands(filtered);
                setShowCommandMenu(filtered.length > 0);
                setSelectedCommandIndex(0);
              }}
              onKeyDown={handleKeyDown}
              disabled={!isConnected}
              className="max-h-20 min-h-12 resize-none overflow-y-auto border-0 bg-transparent px-4 pt-4 pb-2 shadow-none focus-visible:border-0 focus-visible:ring-0"
            />
            {detectedCommand && !showCommandMenu && (
              <div className="px-4 pb-2">
                <span className="text-xs text-muted-foreground">
                  Press <kbd className="rounded bg-muted px-1 py-0.5 text-[10px] font-mono">Space</kbd> or{' '}
                  <kbd className="rounded bg-muted px-1 py-0.5 text-[10px] font-mono">Enter</kbd> to use{' '}
                  <span className="font-medium text-primary">{detectedCommand}</span>
                </span>
              </div>
            )}

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
