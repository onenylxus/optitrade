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
  summary?: string;
  children: ReactNode;
}

export function BaseWidget({ title, summary, children, className, ...props }: BaseWidgetProps) {
  const { isEditMode, onDelete } = useWidgetContext();

  return (
    <Card className={cn('h-full min-h-0 w-full gap-1 px-4', className)} {...props}>
      <CardHeader className="px-0">
        <CardTitle>{title}</CardTitle>
        {summary ? (
          <div className="mt-1 rounded-md bg-primary/10 px-2.5 py-1.5 text-xs leading-relaxed text-primary/90">
            {summary}
          </div>
        ) : null}
      </CardHeader>

      <Separator />

      <CardContent className="flex-1 min-h-0 overflow-y-auto px-0 py-1">{children}</CardContent>

      <Separator />

      <CardFooter className="mt-1 flex items-center justify-between gap-2 border-0 bg-transparent px-0 py-1.5">
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
    </Card>
  );
}
