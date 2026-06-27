'use client';

import { PenLine, UserRound } from 'lucide-react';
import Link from 'next/link';
import type { User } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Typography } from '@/components/ui/typography';
import type { AuthenticatedUserResponse } from '@/lib/api/types';
import { LayoutSwitcher } from '@/components/home/layout-switcher';

interface HomeHeaderProps {
  isEditMode: boolean;
  onEditModeChange: (nextValue: boolean) => void;
  firebaseUser: User | null;
  backendProfile: AuthenticatedUserResponse | null;
  onSignOut: () => void;
}

export function HomeHeader({
  isEditMode,
  onEditModeChange,
  firebaseUser,
  backendProfile,
  onSignOut,
}: HomeHeaderProps) {
  const displayName =
    backendProfile?.display_name ??
    firebaseUser?.displayName ??
    backendProfile?.email ??
    firebaseUser?.email ??
    'Signed in';
  const avatarLabel = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((segment) => segment[0]?.toUpperCase())
    .join('');

  const isAuthenticated = firebaseUser != null;

  return (
    <header className="border-border/60 bg-card/70 relative z-20 flex h-16 items-center justify-between gap-4 border-b px-4 backdrop-blur sm:px-6">
      <div className="min-w-0 shrink-0">
        <Typography variant="h4" className="text-primary scroll-m-0 text-left text-xl">
          OptiTrade
        </Typography>
      </div>

      <div className="flex min-w-0 items-center justify-end gap-2">
        <Button
          type="button"
          variant={isEditMode ? 'default' : 'outline'}
          size="sm"
          onClick={() => onEditModeChange(!isEditMode)}
        >
          <PenLine className="size-4" />
          {isEditMode ? 'Editing' : 'Edit Layout'}
        </Button>

        {isAuthenticated && <LayoutSwitcher isEditMode={isEditMode} />}

        <Button asChild variant="outline" size="sm">
          {isAuthenticated ? (
            <button type="button" onClick={onSignOut}>
              <UserRound className="size-4" />
              Sign Out
            </button>
          ) : (
            <Link href="/auth">
              <UserRound className="size-4" />
              Sign In
            </Link>
          )}
        </Button>

        <Avatar size="default" aria-label={isAuthenticated ? displayName : 'Anonymous avatar'}>
          <AvatarFallback>
            {isAuthenticated ? (
              avatarLabel || <UserRound className="size-4" />
            ) : (
              <UserRound className="size-4" />
            )}
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
