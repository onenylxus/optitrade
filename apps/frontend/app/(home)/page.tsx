'use client';

import { useState } from 'react';
import { ChatPanel } from '@/components/home/chat-panel';
import { EditWidgetDrawer } from '@/components/home/edit-widget-drawer';
import { HomeHeader } from '@/components/home/home-header';
import { WidgetCanvas } from '@/components/home/widget-canvas';
import { cn } from '@/lib/utils';

export default function HomePage() {
  const [isEditMode, setIsEditMode] = useState(false);

  return (
    <div className="bg-background text-foreground relative flex h-screen w-full flex-col overflow-hidden">
      <HomeHeader isEditMode={isEditMode} onEditModeChange={setIsEditMode} />
      <main className="relative flex-1 overflow-hidden">
        <div
          className={cn(
            'h-full min-h-0 transition-[padding-left,padding-right] duration-300 ease-out',
            isEditMode ? 'lg:pl-[360px] lg:pr-0' : 'lg:pr-[360px] lg:pl-0',
          )}
        >
          <WidgetCanvas isEditMode={isEditMode} />
        </div>

        <div
          className={cn(
            'pointer-events-none absolute inset-y-0 left-0 hidden w-[360px] transition-all duration-300 ease-out lg:block',
            isEditMode ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0',
          )}
          aria-hidden={!isEditMode}
        >
          <EditWidgetDrawer open={isEditMode} mode="inline" className="h-full" />
        </div>

        <div
          className={cn(
            'absolute inset-y-0 right-0 hidden w-[360px] transition-all duration-300 ease-out lg:block',
            isEditMode ? 'pointer-events-none translate-x-full opacity-0' : 'pointer-events-auto translate-x-0 opacity-100',
          )}
          aria-hidden={isEditMode}
        >
          <ChatPanel />
        </div>

        <EditWidgetDrawer open={isEditMode} className="lg:hidden" />
      </main>
    </div>
  );
}
