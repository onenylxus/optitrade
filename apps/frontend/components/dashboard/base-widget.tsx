import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { MoreVertical, Plus, Trash2 } from 'lucide-react';
import { DropdownMenu } from 'radix-ui';
import type { ComponentProps, ReactNode } from 'react';
import { Button } from '../ui/button';
import { Separator } from '../ui/separator';
import { useWidgetContext } from '@/contexts/widget-context';
import { useChatContextStore } from '@/contexts/chat-context-store';

interface BaseWidgetProps extends ComponentProps<typeof Card> {
  title: string;
  summary?: string;
  children: ReactNode;
  contextData?: { label: string; text: string };
  contextButtonLabel?: string;
  contextButtonActiveLabel?: string;
  contextButtonActive?: boolean;
  onContextButtonClick?: () => void;
}
const menuItemClass =
  'flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none data-highlighted:bg-accent data-highlighted:text-accent-foreground';

  export function BaseWidget({
    title,
    summary,
    children,
    className,
    contextData,
    contextButtonLabel = 'Add to Context',
    contextButtonActiveLabel = 'Added to Context',
    contextButtonActive = false,
    onContextButtonClick,
    ...props
  }: BaseWidgetProps) {
    const { isEditMode, onDelete, widgetId } = useWidgetContext();
    const { contexts, addContext, removeContext } = useChatContextStore();
  
    const isActive = widgetId ? contexts.some((c) => c.widgetId === widgetId) : false;
  
    const handleContextButtonClick = () => {
      if (onContextButtonClick) {
        onContextButtonClick();
        return;
      }
      if (!contextData || !widgetId) return;
  
      if (isActive) {
        removeContext(widgetId);
      } else {
        addContext({ widgetId, label: contextData.label, text: contextData.text });
      }
    };
  const showDelete = Boolean(isEditMode && onDelete);

  return (
    <Card
      className={cn(
        'flex h-full min-h-0 w-full flex-col overflow-hidden gap-0 px-4 py-1',
        className,
      )}
      {...props}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
        <CardHeader className="relative shrink-0 space-y-0 px-0 pt-0 pb-0">
          <div className="flex gap-2 pr-10">
            <div className="min-w-0 flex-1">
              <CardTitle>{title}</CardTitle>
              {summary ? (
                <div className="mt-1 rounded-md bg-primary/10 px-2.5 py-1.5 text-primary/90">
                  {summary}
                </div>
              ) : null}
            </div>
          </div>
          <DropdownMenu.Root modal={false}>
            <DropdownMenu.Trigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="absolute top-0 right-0 shrink-0 cursor-pointer text-muted-foreground hover:text-foreground"
                aria-label="Widget actions"
              >
                <MoreVertical className="size-4" />
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                sideOffset={4}
                align="end"
                className={cn(
                  'z-50 min-w-[10rem] overflow-hidden rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-md',
                )}
              >
                <DropdownMenu.Item className={menuItemClass} onSelect={handleContextButtonClick}>
                  <Plus className="size-3.5" />
                  Add to Context
                </DropdownMenu.Item>
                {showDelete ? (
                  <>
                    <DropdownMenu.Separator className="-mx-1 my-1 h-px bg-border" />
                    <DropdownMenu.Item
                      className={cn(menuItemClass, 'text-destructive data-highlighted:bg-destructive/15')}
                      onSelect={() => onDelete?.()}
                    >
                      <Trash2 className="size-3.5" />
                      Delete
                    </DropdownMenu.Item>
                  </>
                ) : null}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </CardHeader>

        <Separator className="shrink-0" />

        <CardContent className="relative flex min-h-0 flex-1 flex-col overflow-visible px-0 py-1">{children}</CardContent>
      </div>
    </Card>
  );
}
