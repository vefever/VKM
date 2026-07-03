import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { MessageCircle, Search, Loader2, GraduationCap, X } from "lucide-react";
import { format } from "date-fns";
import { PageHeader } from "@/components/vkm/page-header";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { ConversationView } from "@/components/chat/chat-thread";
import { useThread } from "@/components/chat/chat-data";
import { useInbox, type InboxItem } from "@/components/chat/messages-data";
import { useDmThread } from "@/components/community/community-data";
import { AvatarBadge } from "@/components/vkm/avatar-badge";

function shortTime(ms: number): string {
  if (!ms) return "";
  const diff = Date.now() - ms;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "now";
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const d = Math.floor(hr / 24);
  if (d < 7) return `${d}d`;
  return format(new Date(ms), "MMM d");
}

export function ChatPage() {
  const { items, loading } = useInbox();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const reduceMotion = useReducedMotion();

  // Auto-open the coaching thread on desktop only; mobile starts on the list.
  useEffect(() => {
    if (selectedKey || !items.length) return;
    if (typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches) {
      setSelectedKey(items[0].key);
    }
  }, [items, selectedKey]);

  const selected = items.find((i) => i.key === selectedKey) ?? null;
  const filtered = items.filter(
    (i) => !q.trim() || `${i.name} ${i.preview}`.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-4"
    >
      <PageHeader
        eyebrow="Participant"
        title="Messages"
        description="Chat with your coaching team and the VKM community — all in one inbox."
        icon={MessageCircle}
      />

      <div
        className="grid gap-4 lg:grid-cols-[320px_1fr]"
        style={{ height: "calc(100dvh - 12rem - var(--kb, 0px))" }}
      >
        {/* Conversation list */}
        <div
          className={cn(
            "glass flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border shadow-vkm-float",
            selected && "hidden lg:flex",
          )}
        >
          <div className="border-b border-border p-2.5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search conversations…"
                className="h-10 w-full rounded-xl border border-input bg-background pl-9 pr-8 text-sm outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring"
              />
              {q && (
                <button
                  type="button"
                  onClick={() => setQ("")}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
            {loading ? (
              <p className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </p>
            ) : filtered.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">No conversations.</p>
            ) : (
              filtered.map((item, i) => (
                <InboxRow
                  key={item.key}
                  item={item}
                  index={i}
                  active={item.key === selectedKey}
                  reduceMotion={!!reduceMotion}
                  onClick={() => setSelectedKey(item.key)}
                />
              ))
            )}
          </div>
        </div>

        {/* Active thread */}
        <div className={cn("min-h-0", !selected && "hidden lg:block")}>
          <AnimatePresence mode="wait">
            {selected ? (
              <motion.div
                key={selected.key}
                initial={reduceMotion ? false : { opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                className="h-full"
              >
                {selected.kind === "coach" ? (
                  <CoachConversation convId={selected.convId} onBack={() => setSelectedKey(null)} />
                ) : (
                  <MemberConversation
                    otherId={selected.otherId as string}
                    name={selected.name}
                    avatar={selected.avatar}
                    onBack={() => setSelectedKey(null)}
                  />
                )}
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={reduceMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex h-full min-h-[420px] items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 text-sm text-muted-foreground"
              >
                Select a conversation to start chatting.
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

function InboxRow({
  item,
  index,
  active,
  reduceMotion,
  onClick,
}: {
  item: InboxItem;
  index: number;
  active: boolean;
  reduceMotion: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.04, 0.3) }}
      className={cn(
        "app-press flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition-colors",
        active ? "bg-secondary" : "hover:bg-secondary/50",
      )}
    >
      <span className="relative shrink-0">
        {item.kind === "coach" ? (
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-gradient-navy text-primary-foreground">
            <GraduationCap className="h-5 w-5" />
          </span>
        ) : (
          <AvatarBadge name={item.name} src={item.avatar} size="lg" className="h-11 w-11 text-sm" />
        )}
        {item.unread && (
          <motion.span
            initial={reduceMotion ? false : { scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 16 }}
            className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-card bg-gold"
          />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className={cn("truncate text-sm text-foreground", item.unread ? "font-bold" : "font-semibold")}>
            {item.name}
          </span>
          <span className={cn("shrink-0 text-[10px]", item.unread ? "font-semibold text-gold" : "text-muted-foreground")}>
            {shortTime(item.lastAt)}
          </span>
        </div>
        <p className={cn("truncate text-xs", item.unread ? "font-medium text-foreground" : "text-muted-foreground")}>
          {item.preview}
        </p>
      </div>
    </motion.button>
  );
}

function CoachConversation({ convId, onBack }: { convId: string | null; onBack: () => void }) {
  const { messages, names, loading, send, meId, typingOther, otherOnline, otherLastReadAt, sendTyping } =
    useThread(convId);
  return (
    <ConversationView
      loading={loading}
      messages={messages}
      names={names}
      meId={meId}
      send={send}
      header={{ name: "Coaching Team", subtitle: "Your coaches & mentors" }}
      callRoom={convId ? `vkm-${convId}` : null}
      typingOther={typingOther}
      otherOnline={otherOnline}
      otherLastReadAt={otherLastReadAt}
      sendTyping={sendTyping}
      onBack={onBack}
    />
  );
}

function MemberConversation({
  otherId,
  name,
  avatar,
  onBack,
}: {
  otherId: string;
  name: string;
  avatar: string | null;
  onBack: () => void;
}) {
  const { user } = useAuth();
  const { messages, send, loading, typingOther, otherOnline, otherLastReadAt, sendTyping } =
    useDmThread(otherId);
  const umsgs = messages.map((m) => ({
    id: m.id,
    sender_id: m.senderId,
    body: m.body,
    attachments: m.attachments,
    created_at: m.createdAt,
  }));
  return (
    <ConversationView
      loading={loading}
      messages={umsgs}
      names={{ [otherId]: name }}
      meId={user?.id ?? null}
      send={send}
      header={{ name, subtitle: "VKM member", avatar }}
      typingOther={typingOther}
      otherOnline={otherOnline}
      otherLastReadAt={otherLastReadAt}
      sendTyping={sendTyping}
      onBack={onBack}
    />
  );
}
