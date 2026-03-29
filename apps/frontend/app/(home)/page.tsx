import { ChatPanel } from '@/components/home/chat-panel';
import { HomeHeader } from '@/components/home/home-header';
import { WidgetCanvas } from '@/components/home/widget-canvas';

export default function HomePage() {
  return (
    <div className="bg-background text-foreground flex h-screen w-full flex-col overflow-hidden">
      <HomeHeader />

      <main className="grid flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[1fr_360px]">
        <WidgetCanvas />
        <ChatPanel />
      </main>
    </div>
  );
}
