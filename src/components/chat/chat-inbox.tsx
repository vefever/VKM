import { useState } from "react";
import { motion } from "framer-motion";
import { formatDistanceToNowStrict } from "date-fns";
import { MessagesSquare, Loader2, ChevronLeft, Inbox } from "lucide-react";
import { PageHeader } from "@/components/vkm/page-header";
import { AvatarBadge } from "@/components/vkm/avatar-badge";
import { cn } from "@/lib/utils";
import { ChatThread } from "@/components/chat/chat-thread";
import { useChatInbox, type InboxItem } from "@/components/chat/chat-data";

export function ChatInbox({ eyebrow = "Coach" }: { eyebrow?: string }) {
  const { items, loading } = useChatInbox();
  const [sel, setSel] = useState<InboxItem | null>(null);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-4"
    >
      <PageHeader
        eyebrow={eyebrow}
        title="Chat"
        description="Participant conversations — reply, share files and start a video call. Updates live."
        icon={MessagesSquare}
      />

      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        {/* Conversation list */}
        <div
          className={cn(
            "rounded-2xl border border-border bg-card shadow-vkm",
            sel && "hidden lg:block",
          )}
        >
          {loading ? (
            <p className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </p>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <Inbox className="h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm font-medium text-foreground">No conversations yet</p>
              <p className="text-xs text-muted-foreground">
                They appear when a participant messages.
              </p>
            </div>
          ) : (
            <ul className="max-h-[calc(100dvh-15rem)] divide-y divide-border overflow-y-auto">
              {items.map((it) => (
                <li key={it.id}>
                  <button
                    onClick={() => setSel(it)}
                    className={cn(
                      "flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-secondary/50",
                      sel?.id === it.id && "bg-secondary/60",
                    )}
                  >
                    <AvatarBadge name={it.name} src={it.avatar} size="lg" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{it.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{it.preview}</p>
                    </div>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {formatDistanceToNowStrict(new Date(it.lastAt))}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Thread */}
        <div className={cn(!sel && "hidden lg:block")}>
          {sel ? (
            <div className="space-y-2">
              <button
                onClick={() => setSel(null)}
                className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground lg:hidden"
              >
                <ChevronLeft className="h-4 w-4" /> Conversations
              </button>
              <ChatThread convId={sel.id} title={sel.name} />
            </div>
          ) : (
            <div className="flex h-[calc(100dvh-13rem)] min-h-[420px] flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-card text-center shadow-vkm">
              <MessagesSquare className="h-9 w-9 text-muted-foreground/40" />
              <p className="text-sm font-medium text-foreground">Select a conversation</p>
              <p className="text-xs text-muted-foreground">Pick a participant to start chatting.</p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
