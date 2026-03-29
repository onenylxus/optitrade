import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Sparkles, Trash2 } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { Button } from '../ui/button';
import { Separator } from '../ui/separator';

interface BaseWidgetProps extends ComponentProps<typeof Card> {
  title: string;
  description?: string;
  children?: ReactNode;
  isAiWidget?: boolean;
  showRemoveButton?: boolean;
  onRemove?: () => void;
}

export function BaseWidget({
  title,
  description,
  children,
  isAiWidget = false,
  showRemoveButton = false,
  onRemove,
  className,
  ...props
}: BaseWidgetProps) {
  return (
    <Card className={cn('w-full h-full gap-1 px-4', className)} {...props}>
      <CardHeader className="px-0">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>

          <div className="flex items-center gap-2 self-start">
            {isAiWidget && <Sparkles className="text-primary" size={18} />}
            {showRemoveButton && onRemove ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label="Remove widget"
                onClick={onRemove}
              >
                <Trash2 className="size-4.5" />
              </Button>
            ) : null}
          </div>
        </div>
      </CardHeader>

      <Separator />

      <CardContent className="flex-1 px-0">{children}</CardContent>
    </Card>
  );
}
