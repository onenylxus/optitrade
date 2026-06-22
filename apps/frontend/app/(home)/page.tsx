'use client';

import { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { HomeHeader } from '@/components/home/home-header';
import { FloatingChat } from '@/components/home/floating-chat';
import { EditWidgetDrawer } from '@/components/home/edit-widget-drawer';
import { WidgetCanvas } from '@/components/home/widget-canvas';
import { PortfolioProvider } from '@/contexts/portfolio-context';
import { ChatContextStoreProvider } from '@/contexts/chat-context-store';
import { loadBackendAuthProfile } from '@/lib/api/auth';
import type { AuthenticatedUserResponse } from '@/lib/api/types';
import { getFirebaseAuth } from '@/lib/firebase/client';
import { isFirebaseConfigReady } from '@/lib/firebase/config';
import { cn } from '@/lib/utils';

export default function HomePage() {
  const [isEditMode, setIsEditMode] = useState(false);
  const [firebaseAuth] = useState<ReturnType<typeof getFirebaseAuth> | null>(() => {
    if (!isFirebaseConfigReady()) {
      return null;
    }

    try {
      return getFirebaseAuth();
    } catch {
      return null;
    }
  });
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [backendProfile, setBackendProfile] = useState<AuthenticatedUserResponse | null>(null);

  useEffect(() => {
    if (!firebaseAuth) {
      return;
    }

    const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
      setFirebaseUser(user);

      if (!user) {
        setBackendProfile(null);
        return;
      }

      try {
        const idToken = await user.getIdToken(true);
        const profile = await loadBackendAuthProfile(idToken);
        setBackendProfile(profile);
      } catch {
        setBackendProfile(null);
      }
    });

    return unsubscribe;
  }, [firebaseAuth]);

  async function handleSignOut() {
    if (!firebaseAuth) {
      return;
    }

    await signOut(firebaseAuth);
  }

  return (
    <PortfolioProvider>
      <ChatContextStoreProvider>
        <div className="bg-background text-foreground relative flex h-screen w-full flex-col overflow-hidden">
          <HomeHeader
            isEditMode={isEditMode}
            onEditModeChange={setIsEditMode}
            firebaseUser={firebaseUser}
            backendProfile={backendProfile}
            onSignOut={handleSignOut}
          />
          <main className="relative flex-1 overflow-hidden">
            <div
              className={cn(
                'h-full min-h-0 transition-[padding-left,padding-right] duration-300 ease-out',
                isEditMode ? 'lg:pl-90 lg:pr-0' : '',
              )}
            >
              <WidgetCanvas isEditMode={isEditMode} />
            </div>

            <div
              className={cn(
                'pointer-events-none absolute inset-y-0 left-0 hidden w-90 transition-all duration-300 ease-out lg:block',
                isEditMode ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0',
              )}
              aria-hidden={!isEditMode}
            >
              <EditWidgetDrawer open={isEditMode} mode="inline" className="h-full" />
            </div>

            <EditWidgetDrawer open={isEditMode} className="lg:hidden" />
          </main>

          {!isEditMode && <FloatingChat />}
        </div>
      </ChatContextStoreProvider>
    </PortfolioProvider>
  );
}
