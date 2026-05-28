'use client';

import { MessageSquare, PenLine, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Typography } from '@/components/ui/typography';

interface HomeHeaderProps {
  isEditMode: boolean;
  onEditModeChange: (nextValue: boolean) => void;
  isChatOpen: boolean;
  onChatOpenChange: (nextValue: boolean) => void;
}

export function HomeHeader({
  isEditMode,
  onEditModeChange,
  isChatOpen,
  onChatOpenChange,
}: HomeHeaderProps) {
  return (
    <header className="border-border/60 bg-card/70 flex h-16 items-center justify-between gap-4 border-b px-4 backdrop-blur sm:px-6">
      <div className="min-w-0 shrink-0">
        <Typography variant="h4" className="text-primary scroll-m-0 text-left text-xl">
          OptiTrade
        </Typography>
      </div>

      <div className="flex min-w-0 items-center justify-end gap-2">
        <Button
          type="button"
          variant={isChatOpen ? 'default' : 'outline'}
          size="sm"
          onClick={() => onChatOpenChange(!isChatOpen)}
          aria-label={isChatOpen ? 'Hide chat' : 'Show chat'}
        >
          <MessageSquare className="size-4" />
          {isChatOpen ? 'Hide Chat' : 'Chat'}
        </Button>

        <Button
          type="button"
          variant={isEditMode ? 'default' : 'outline'}
          size="sm"
          onClick={() => onEditModeChange(!isEditMode)}
        >
          <PenLine className="size-4" />
          {isEditMode ? 'Editing' : 'Edit Layout'}
        </Button>

        <Avatar size="default" aria-label="Anonymous avatar">
          <AvatarFallback>
            <UserRound className="size-4" />
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
