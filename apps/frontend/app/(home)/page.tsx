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
      <EditWidgetDrawer open={isEditMode} />
      <main
        className={cn(
          'grid flex-1 grid-cols-1 overflow-hidden transition-[padding-left] duration-300 lg:grid-cols-[1fr_360px]',
          isEditMode && 'lg:pl-72',
        )}
      >
        <WidgetCanvas isEditMode={isEditMode} />
        <ChatPanel />
      </main>
    </div>
  );
}
