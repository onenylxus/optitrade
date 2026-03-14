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
}

export function BaseWidget({
  title,
  description,
  children,
  isAiWidget = false,
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
          {isAiWidget && <Sparkles className="text-primary self-start" size={18} />}
        </div>
      </CardHeader>

      <Separator />

      <CardContent className="flex-1 px-0">{children}</CardContent>
    </Card>
  );
}
