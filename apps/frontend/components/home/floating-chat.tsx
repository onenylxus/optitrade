'use client';

import Image from 'next/image';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ChatPanel } from '@/components/home/chat-panel';

export function FloatingChat() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <div
        className={cn(
          'fixed bottom-6 right-6 z-50 flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl transition-all duration-300 ease-out',
          'h-[85vh] max-h-[1000px] w-[min(94vw,720px)] lg:w-[min(70vw,860px)] xl:w-[min(60vw,1000px)] 2xl:w-[min(55vw,1200px)]',
          isOpen
            ? 'pointer-events-auto translate-y-0 scale-100 opacity-100'
            : 'pointer-events-none translate-y-4 scale-95 opacity-0',
        )}
        aria-hidden={!isOpen}
      >
        <div className="flex min-h-0 flex-1 flex-col p-2">
          <ChatPanel onClose={() => setIsOpen(false)} />
        </div>
      </div>

      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={isOpen ? 'Hide chat' : 'Open chat'}
        className={cn(
          'fixed bottom-6 right-6 z-50 flex size-16 items-center justify-center rounded-full',
          'bg-primary shadow-lg shadow-primary/40 ring-1 ring-primary/30 transition-all duration-300',
          'hover:scale-105 hover:shadow-xl hover:shadow-primary/50 active:scale-95',
          isOpen ? 'pointer-events-none scale-0 opacity-0' : 'scale-100 opacity-100',
        )}
      >
        <Image
          src="/robot-pixel.svg"
          alt="Chat assistant"
          width={40}
          height={40}
          className="size-10 [image-rendering:pixelated]"
          priority
        />
      </button>
    </>
  );
}
