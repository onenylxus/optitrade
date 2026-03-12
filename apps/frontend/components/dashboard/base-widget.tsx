import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Sparkles } from 'lucide-react';
import * as React from 'react';

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
    <Card className={cn('w-full h-full', className)} {...props}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          {isAiWidget && <Sparkles className="text-primary" size={18} />}
        </div>
      </CardHeader>

      <CardContent className="flex-1">{children}</CardContent>
    </Card>
  );
}
