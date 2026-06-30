import { useEffect, useRef, useState } from "react";
import { useLocation } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useMyConversation, useThread } from "@/components/chat/chat-data";
import { cn } from "@/lib/utils";

// Foundation · Systems · Sell · Review — the page's phase colour language.
const PHASE_STRIP = ["#3b82f6", "#8b5cf6", "#e0a93b", "#22c55e"];

/**
 * Floating "Coaching Team" chat launcher + popup, mounted globally. Wired to the
 * participant's real Coaching Support conversation (same thread as /chat), so
 * messages sent here reach the coach. Participants only; hidden on the auth
 * screen and the full chat page. Desktop/tablet only (mobile has the tab bar).
 */
export function ChatWidget() {
  const { hasRole } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  if (!hasRole("participant")) return null;
  const path = location.pathname;
  if (path.startsWith("/auth") || path === "/participant/chat") return null;

  return (
    <div className="fixed bottom-5 right-5 z-40 hidden md:block">
      <AnimatePresence>{open && <ChatPanel onClose={() => setOpen(false)} />}</AnimatePresence>

      <motion.button
        type="button"
        onClick={() => setOpen((o) => !o)}
        whileTap={{ scale: 0.92 }}
        aria-label={open ? "Close chat" : "Open coaching chat"}
        className="relative inline-flex h-14 w-14 items-center justify-center rounded-full bg-gradient-navy text-primary-foreground shadow-vkm-float ring-1 ring-white/10"
      >
        <AnimatePresence mode="wait" initial={false}>
          {open ? (
            <motion.span
              key="x"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <X className="h-6 w-6" />
            </motion.span>
          ) : (
            <motion.span
              key="chat"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <MessageCircle className="h-6 w-6" />
            </motion.span>
          )}
        </AnimatePresence>
        {!open && (
          <span className="absolute right-1 top-1 h-3 w-3 rounded-full border-2 border-navy bg-gold" />
        )}
      </motion.button>
    </div>
  );
}

function ChatPanel({ onClose }: { onClose: () => void }) {
  const { convId } = useMyConversation();
  const { messages, loading, send, meId } = useThread(convId);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, loading]);

  async function onSend() {
    if (!text.trim() || busy) return;
    setBusy(true);
    const body = text;
    setText("");
    await send(body, []);
    setBusy(false);
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: 14 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, y: 14 }}
      transition={{ type: "spring", stiffness: 340, damping: 26 }}
      style={{ transformOrigin: "bottom right" }}
      className="mb-3 flex h-[28rem] w-[20rem] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-vkm-float"
    >
      {/* phase colour strip */}
      <div className="flex h-1 shrink-0">
        {PHASE_STRIP.map((c) => (
          <div key={c} className="flex-1" style={{ background: c }} />
        ))}
      </div>

      {/* header */}
      <div className="flex items-center gap-2.5 bg-gradient-navy px-3 py-2.5 text-primary-foreground">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/20">
          <MessageCircle className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight">Coaching Team</p>
          <p className="flex items-center gap-1 text-[11px] text-white/70">
            <span className="h-1.5 w-1.5 rounded-full bg-[#22c55e]" /> Online · usually replies fast
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="app-press inline-flex h-7 w-7 items-center justify-center rounded-full text-white/80 hover:bg-white/10"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* messages */}
      <div className="flex-1 space-y-2 overflow-y-auto bg-secondary/20 p-3">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {messages.length === 0 && (
              <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-card px-3 py-2 text-sm text-foreground shadow-vkm">
                Hi! 👋 Your coaching team is here — ask anything about your week, your proof, or
                your business.
              </div>
            )}
            {messages.map((m) => {
              const mine = m.sender_id === meId;
              return (
                <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
                      mine
                        ? "rounded-br-sm bg-gradient-navy text-primary-foreground"
                        : "rounded-tl-sm bg-card text-foreground shadow-vkm",
                    )}
                  >
                    {m.body}
                  </div>
                </div>
              );
            })}
          </>
        )}
        <div ref={endRef} />
      </div>

      {/* input */}
      <div className="flex items-center gap-2 border-t border-border p-2.5">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void onSend();
            }
          }}
          placeholder="Message your coach…"
          className="h-10 flex-1 rounded-xl border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <button
          type="button"
          onClick={onSend}
          disabled={busy || !text.trim()}
          aria-label="Send"
          className="app-press inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-gold text-navy disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
    </motion.div>
  );
}
