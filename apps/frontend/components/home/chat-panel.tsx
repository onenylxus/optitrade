import { Plus, Send } from 'lucide-react';
import { chatMessages } from '@/app/(home)/fixtures';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';

export function ChatPanel() {
  return (
    <aside className="min-h-0 p-3 sm:p-4">
      <Card className="flex h-full min-h-0 flex-col">
        <CardHeader>
          <CardTitle>Chat</CardTitle>
        </CardHeader>

        <CardContent className="flex min-h-0 flex-1 flex-col gap-3 px-4">
          <ScrollArea className="bg-muted/20 h-full min-h-0 rounded-lg">
            <div className="space-y-3 pr-2">
              {chatMessages.map((message) => {
                const isUser = message.role === 'user';

                return (
                  <div
                    key={message.id}
                    className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[90%] rounded-2xl px-3 py-2 text-sm leading-5 ${
                        isUser
                          ? 'bg-primary text-primary-foreground rounded-br-sm'
                          : 'bg-card text-card-foreground border border-border rounded-bl-sm'
                      }`}
                    >
                      {message.text}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>

          <div className="bg-muted/20 border-input focus-within:border-ring focus-within:ring-ring/50 flex flex-col rounded-3xl border transition-colors focus-within:ring-2">
            <Textarea
              placeholder="Ask anything..."
              rows={3}
              className="max-h-20 min-h-12 resize-none overflow-y-auto border-0 bg-transparent px-4 pt-4 pb-2 shadow-none focus-visible:border-0 focus-visible:ring-0"
            />

            <div className="flex items-center justify-between px-3">
              <Button
                size="icon"
                variant="ghost"
                aria-label="Add attachment"
                className="text-foreground size-7 border-0 bg-transparent p-0 shadow-none hover:bg-transparent"
              >
                <Plus className="size-4" />
              </Button>

              <Button
                size="icon"
                variant="ghost"
                aria-label="Send message"
                className="text-foreground size-7 rounded-full border-0 bg-transparent p-0 shadow-none hover:bg-transparent"
              >
                <Send className="size-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </aside>
  );
}
