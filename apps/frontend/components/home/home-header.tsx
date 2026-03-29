'use client';

import { PenLine, Search, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Typography } from '@/components/ui/typography';

interface HomeHeaderProps {
  isEditMode: boolean;
  onEditModeChange: (nextValue: boolean) => void;
}

export function HomeHeader({ isEditMode, onEditModeChange }: HomeHeaderProps) {
  return (
    <header className="border-border/60 bg-card/70 flex h-16 items-center gap-4 border-b px-4 backdrop-blur sm:px-6">
      <div className="min-w-0 flex-1 md:flex-none">
        <Typography variant="h4" className="text-primary scroll-m-0 text-left text-xl">
          OptiTrade
        </Typography>
      </div>

      <div className="relative mx-auto w-full max-w-xl flex-1">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          className="bg-background/70 pl-9"
          placeholder="Search symbols, widgets, or notes..."
        />
      </div>

      <div className="flex flex-1 items-center justify-end gap-2 md:flex-none">
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
