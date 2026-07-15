'use client';

import { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { HomeHeader } from '@/components/home/home-header';
import { FloatingChat } from '@/components/home/floating-chat';
import { EditWidgetDrawer } from '@/components/home/edit-widget-drawer';
import { WidgetCanvas } from '@/components/home/widget-canvas';
import { PortfolioProvider } from '@/contexts/portfolio-context';
import { ChatContextStoreProvider } from '@/contexts/chat-context-store';
import { LayoutProvider } from '@/contexts/layout-context';
import { loadBackendAuthProfile } from '@/lib/api/auth';
import type { AuthenticatedUserResponse } from '@/lib/api/types';
import { getFirebaseAuth } from '@/lib/firebase/client';
import { isFirebaseConfigReady } from '@/lib/firebase/config';
import type { WidgetType } from '@/app/(home)/fixtures';

export default function HomePage() {
  const [isEditMode, setIsEditMode] = useState(false);
  const [isDraggingWidget, setIsDraggingWidget] = useState(false);
  const [draggedSidebarWidgetType, setDraggedSidebarWidgetType] = useState<WidgetType | null>(null);
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
    location.reload();
  }

  return (
    <PortfolioProvider>
      <ChatContextStoreProvider>
        <LayoutProvider userId={firebaseUser?.uid ?? null}>
          <div className="bg-background text-foreground relative flex h-screen w-full flex-col overflow-hidden">
            <HomeHeader
              isEditMode={isEditMode}
              onEditModeChange={setIsEditMode}
              firebaseUser={firebaseUser}
              backendProfile={backendProfile}
              onSignOut={handleSignOut}
            />
            <main className="relative flex-1 overflow-hidden">
              <WidgetCanvas
                isEditMode={isEditMode}
                externalDraggedWidgetType={draggedSidebarWidgetType}
              />

              <EditWidgetDrawer
                open={isEditMode}
                isDraggingWidget={isDraggingWidget}
                onWidgetDragStart={(widgetType) => {
                  setDraggedSidebarWidgetType(widgetType);
                  setIsDraggingWidget(true);
                }}
                onWidgetDragEnd={() => {
                  setDraggedSidebarWidgetType(null);
                  setIsDraggingWidget(false);
                }}
              />
            </main>

            {!isEditMode && <FloatingChat />}
          </div>
        </LayoutProvider>
      </ChatContextStoreProvider>
    </PortfolioProvider>
  );
}
