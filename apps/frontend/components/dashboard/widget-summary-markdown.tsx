'use client';

import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { compactMarkdownComponents } from '@/lib/compact-markdown-components';

export function WidgetSummaryMarkdown({
  markdown,
  modelId,
}: {
  markdown: string;
  /** Shown as a muted footer chip when present. */
  modelId?: string | null;
}) {
  return (
    <div className="text-xs leading-relaxed text-primary/95">
      <Markdown remarkPlugins={[remarkGfm]} components={compactMarkdownComponents}>
        {markdown}
      </Markdown>
      {modelId ? (
        <p className="mt-2 border-t border-primary/15 pt-2 text-[10px] text-muted-foreground">
          Model: <span className="font-mono text-foreground/80">{modelId}</span>
        </p>
      ) : null}
    </div>
  );
}
