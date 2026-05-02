'use client';

import { ChevronDown, ChevronUp } from 'lucide-react';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { splitStockAnalysisMarkdown } from '@/lib/split-stock-analysis-markdown';
import { cn } from '@/lib/utils';
import { WidgetSummaryMarkdown } from './widget-summary-markdown';

export function CollapsibleStockAnalysis({
  markdown,
  modelId,
}: {
  markdown: string;
  modelId?: string | null;
}) {
  const { overviewMarkdown, fullMarkdown, canExpand } = React.useMemo(
    () => splitStockAnalysisMarkdown(markdown),
    [markdown],
  );

  const [expanded, setExpanded] = React.useState(false);

  React.useEffect(() => {
    setExpanded(false);
  }, [markdown]);

  const showFull = expanded || !canExpand;
  const activeMarkdown = showFull ? fullMarkdown : overviewMarkdown;
  const showModelInMarkdown = Boolean(modelId) && (showFull || !canExpand);

  return (
    <div className="space-y-1.5">
      <WidgetSummaryMarkdown markdown={activeMarkdown} modelId={showModelInMarkdown ? modelId : null} />
      {canExpand && !showFull && modelId ? (
        <p className="text-[10px] text-muted-foreground">
          Model: <span className="font-mono text-foreground/75">{modelId}</span>
        </p>
      ) : null}
      {canExpand ? (
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className={cn(
            'h-7 gap-1 px-1.5 text-[11px] font-medium text-primary/90',
            'hover:bg-primary/10 hover:text-primary',
          )}
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? (
            <>
              Show less
              <ChevronUp className="size-3.5 shrink-0 opacity-80" strokeWidth={2} aria-hidden />
            </>
          ) : (
            <>
              Show more
              <ChevronDown className="size-3.5 shrink-0 opacity-80" strokeWidth={2} aria-hidden />
            </>
          )}
        </Button>
      ) : null}
    </div>
  );
}
