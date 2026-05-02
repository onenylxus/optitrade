import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Plus } from 'lucide-react';
import { Trash2 } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { Button } from '../ui/button';
import { Separator } from '../ui/separator';
import { useWidgetContext } from '@/contexts/widget-context';

interface BaseWidgetProps extends ComponentProps<typeof Card> {
  title: string;
  /** Plain text, markdown-backed JSX, or any small summary block for the header. */
  summary?: ReactNode;
  children: ReactNode;
}

export function BaseWidget({ title, summary, children, className, ...props }: BaseWidgetProps) {
  const { isEditMode, onDelete } = useWidgetContext();

  return (
    <Card
      className={cn(
        'flex h-full min-h-0 w-full flex-col overflow-hidden gap-0 px-4 py-1',
        className,
      )}
      {...props}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
        <CardHeader className="shrink-0 space-y-0 px-0 pt-0 pb-0">
          <CardTitle>{title}</CardTitle>
          {summary ? (
            <div className="mt-1 rounded-md bg-primary/10 px-2.5 py-1.5 text-primary/90">
              {summary}
            </div>
          ) : null}
        </CardHeader>

        <Separator className="shrink-0" />

        <CardContent className="min-h-0 shrink-0 overflow-visible px-0 py-1">{children}</CardContent>

        <Separator className="shrink-0" />

        <CardFooter className="flex shrink-0 items-center justify-between gap-2 border-0 bg-transparent px-0 py-1.5">
          <Button
            type="button"
            variant="default"
            size="sm"
            className="shadow-sm shadow-primary/20 ring-1 ring-primary/25"
          >
            <Plus className="size-3.5" />
            Add to Context
          </Button>
          {isEditMode && onDelete ? (
            <Button
              type="button"
              size="sm"
              aria-label="Remove widget"
              onClick={onDelete}
              className="ml-auto bg-destructive hover:bg-destructive/90 ring-1 ring-destructive/30"
            >
              <Trash2 className="size-3.5" />
              Delete
            </Button>
          ) : null}
        </CardFooter>
      </div>
    </Card>
  );
}
