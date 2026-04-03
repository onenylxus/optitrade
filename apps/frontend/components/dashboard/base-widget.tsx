import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Sparkles } from 'lucide-react';
import * as React from 'react';
import { Separator } from '../ui/separator';

interface BaseWidgetProps extends React.ComponentProps<typeof Card> {
  title: string;
  description?: string;
  children?: React.ReactNode;
  isAiWidget?: boolean;
  /** Renders directly under the title (e.g. AI-generated insight). */
  titleSupplement?: React.ReactNode;
  /**
   * When `isAiWidget` is true and this is set, the sparkles control becomes a button
   * that invokes this handler (e.g. toggle insight). Otherwise the icon is decorative only.
   */
  onAiButtonClick?: () => void;
  /** `aria-expanded` for the AI control when it is a button. */
  aiButtonExpanded?: boolean;
}

export function BaseWidget({
  title,
  description,
  children,
  isAiWidget = false,
  titleSupplement,
  onAiButtonClick,
  aiButtonExpanded,
  className,
  ...props
}: BaseWidgetProps) {
  const aiControl =
    isAiWidget &&
    (onAiButtonClick ? (
      <button
        type="button"
        onClick={onAiButtonClick}
        aria-expanded={aiButtonExpanded ?? false}
        aria-label="Toggle AI-generated insight"
        className={cn(
          'text-primary shrink-0 self-start rounded-md p-1 outline-none',
          'hover:bg-muted/80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        )}
      >
        <Sparkles size={18} aria-hidden />
      </button>
    ) : (
      <Sparkles className="text-primary shrink-0 self-start" size={18} aria-hidden />
    ));

  return (
    <Card className={cn('w-full h-full gap-1 px-4', className)} {...props}>
      <CardHeader className="px-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <CardTitle>{title}</CardTitle>
            {titleSupplement}
            {description ? <CardDescription>{description}</CardDescription> : null}
          </div>
          {aiControl}
        </div>
      </CardHeader>

      <Separator />

      <CardContent className="flex-1 px-0">{children}</CardContent>
    </Card>
  );
}
