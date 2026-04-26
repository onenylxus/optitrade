'use client';

import { useState } from 'react';
import type { WidgetType } from '@/app/(home)/fixtures';
import { ChatPanel } from '@/components/home/chat-panel';
import { EditWidgetDrawer } from '@/components/home/edit-widget-drawer';
import { HomeHeader } from '@/components/home/home-header';
import { WidgetCanvas } from '@/components/home/widget-canvas';
import { cn } from '@/lib/utils';

export default function HomePage() {
  const [isEditMode, setIsEditMode] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [draggedSidebarWidgetType, setDraggedSidebarWidgetType] = useState<WidgetType | null>(null);

  return (
    <div className="bg-background text-foreground relative flex h-screen w-full flex-col overflow-hidden">
      <HomeHeader
        isEditMode={isEditMode}
        onEditModeChange={setIsEditMode}
        isChatOpen={isChatOpen}
        onChatOpenChange={setIsChatOpen}
      />
      <main className="relative flex-1 overflow-hidden">
        <div
          className={cn(
            'h-full min-h-0 transition-[padding-left,padding-right] duration-300 ease-out',
            isEditMode ? 'lg:pl-[360px] lg:pr-0' : isChatOpen ? 'lg:pr-[360px] lg:pl-0' : '',
          )}
        >
          <WidgetCanvas
            isEditMode={isEditMode}
            externalDraggedWidgetType={draggedSidebarWidgetType}
          />
        </div>

        <div
          className={cn(
            'pointer-events-none absolute inset-y-0 left-0 hidden w-[360px] transition-all duration-300 ease-out lg:block',
            isEditMode ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0',
          )}
          aria-hidden={!isEditMode}
        >
          <EditWidgetDrawer
            open={isEditMode}
            mode="inline"
            className="h-full"
            onWidgetDragStart={setDraggedSidebarWidgetType}
            onWidgetDragEnd={() => setDraggedSidebarWidgetType(null)}
          />
        </div>

        <div
          className={cn(
            'absolute inset-y-0 right-0 hidden w-[360px] transition-all duration-300 ease-out lg:block',
            isEditMode || !isChatOpen
              ? 'pointer-events-none translate-x-full opacity-0'
              : 'pointer-events-auto translate-x-0 opacity-100',
          )}
          aria-hidden={isEditMode || !isChatOpen}
        >
          <ChatPanel />
        </div>

        <EditWidgetDrawer
          open={isEditMode}
          className="lg:hidden"
          onWidgetDragStart={setDraggedSidebarWidgetType}
          onWidgetDragEnd={() => setDraggedSidebarWidgetType(null)}
        />
      </main>
    </div>
  );
}
