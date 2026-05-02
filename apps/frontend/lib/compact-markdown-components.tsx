import type { Components } from 'react-markdown';
import { cn } from '@/lib/utils';

/**
 * Shared styles for assistant-style markdown (GFM tables, lists, headings).
 * Used by chat bubbles and dashboard widget summaries.
 */
export const compactMarkdownComponents: Components = {
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
    <pre className="my-1.5 overflow-x-auto rounded-md bg-muted/80 p-2 text-xs">{children}</pre>
  ),
  code: ({ className, children }) => {
    const isFence = /\blanguage-/.test(String(className ?? ''));
    if (isFence) {
      return (
        <code className={cn('block font-mono text-[11px] leading-snug', className)}>
          {children}
        </code>
      );
    }
    return (
      <code className="rounded bg-muted px-1 font-mono text-[11px] text-foreground">{children}</code>
    );
  },
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto rounded-md border border-border/80 text-xs">
      <table className="w-full min-w-[12rem] border-collapse text-left">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-muted/60">{children}</thead>,
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => <tr className="border-b border-border/50 last:border-0">{children}</tr>,
  th: ({ children }) => (
    <th className="whitespace-nowrap px-2 py-1.5 font-semibold text-foreground">{children}</th>
  ),
  td: ({ children }) => <td className="px-2 py-1.5 align-top">{children}</td>,
  blockquote: ({ children }) => (
    <blockquote className="my-1.5 border-l-2 border-primary/50 pl-3 text-muted-foreground italic">
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
