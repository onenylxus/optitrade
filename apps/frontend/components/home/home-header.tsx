import { Search, UserRound } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Typography } from '@/components/ui/typography';

export function HomeHeader() {
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

      <div className="flex flex-1 justify-end md:flex-none">
        <Avatar size="default" aria-label="Anonymous avatar">
          <AvatarFallback>
            <UserRound className="size-4" />
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
