import { useEffect, useRef, useState } from "react";
import { useLocation } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X, Send, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { askPlatformAssistantStream, type ChatMsg } from "@/lib/vkm/platform-assistant.functions";
import { cn } from "@/lib/utils";

// Foundation · Systems · Sell · Review — the page's phase colour language.
const PHASE_STRIP = ["#3b82f6", "#8b5cf6", "#e0a93b", "#22c55e"];

const GREETING =
  "Hi! 👋 I'm your platform assistant. Ask me anything about how VK Mentorship works — habits, proof submission, points, batches, community, support, or where to find a feature.";

/**
 * Floating "AI Assistant" launcher + popup, mounted globally for every signed-
 * in role. Answers instantly using the same AI provider configured in
 * Admin → AI Configurations — purely about HOW TO USE the platform (nav,
 * features, workflows), not business/coaching advice (that's the separate AI
 * Business Advisor). Ephemeral: the conversation lives only in this session
 * (lifted to this component so it survives closing/reopening the bubble, but
 * resets on a full page reload — this is quick wayfinding help, not a record).
 */
export function ChatWidget() {
  const { user } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);

  if (!user) return null;
  const path = location.pathname;
  if (path.startsWith("/auth")) return null;

  return (
    <div className="fixed bottom-5 right-5 z-40 hidden md:block">
      <AnimatePresence>
        {open && (
          <ChatPanel messages={messages} setMessages={setMessages} onClose={() => setOpen(false)} />
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        onClick={() => setOpen((o) => !o)}
        whileTap={{ scale: 0.92 }}
        aria-label={open ? "Close AI Assistant" : "Open AI Assistant"}
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
              <Sparkles className="h-6 w-6" />
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

function ChatPanel({
  messages,
  setMessages,
  onClose,
}: {
  messages: ChatMsg[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMsg[]>>;
  onClose: () => void;
}) {
  const askStream = useServerFn(askPlatformAssistantStream);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, loading]);

  function setLastAssistant(content: string) {
    setMessages((m) => {
      const copy = m.slice();
      copy[copy.length - 1] = { role: "assistant", content };
      return copy;
    });
  }

  async function onSend() {
    const content = text.trim();
    if (!content || loading) return;
    const next: ChatMsg[] = [...messages, { role: "user", content }];
    setMessages(next);
    setText("");
    setLoading(true);

    try {
      const res = await askStream({ data: { messages: next } });

      if (res instanceof Response && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let acc = "";
        let started = false;
        // Defense-in-depth idle watchdog (mirrors the Business Advisor's) — a
        // hung upstream should never leave the "…" indicator stuck forever.
        const IDLE_MS = 35_000;
        for (;;) {
          const raced = await Promise.race([
            reader.read(),
            new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), IDLE_MS)),
          ]);
          if (raced === "timeout") {
            void reader.cancel().catch(() => {});
            if (!started) {
              setMessages((m) => [
                ...m,
                { role: "assistant", content: "That's taking too long — please try again." },
              ]);
            } else {
              setLastAssistant(acc + "\n\n_(cut off — please try again.)_");
            }
            break;
          }
          const { done, value } = raced;
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          if (!chunk) continue;
          acc += chunk;
          if (!started) {
            started = true;
            setLoading(false);
            setMessages((m) => [...m, { role: "assistant", content: acc }]);
          } else {
            setLastAssistant(acc);
          }
        }
        if (!started) {
          setMessages((m) => [
            ...m,
            { role: "assistant", content: "I couldn't generate a reply just now — please try again." },
          ]);
        }
        return;
      }

      const fallbackText = res instanceof Response ? await res.text() : "";
      setMessages((m) => [
        ...m,
        { role: "assistant", content: fallbackText || "I couldn't generate a reply just now — please try again." },
      ]);
    } catch (err) {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: `Something went wrong: ${(err as Error).message}` },
      ]);
    } finally {
      setLoading(false);
    }
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
          <Sparkles className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight">AI Assistant</p>
          <p className="flex items-center gap-1 text-[11px] text-white/70">
            <span className="h-1.5 w-1.5 rounded-full bg-[#22c55e]" /> Instant answers · how the platform works
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
        {messages.length === 0 && (
          <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-card px-3 py-2 text-sm text-foreground shadow-vkm">
            {GREETING}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm",
                m.role === "user"
                  ? "rounded-br-sm bg-gradient-navy text-primary-foreground"
                  : "rounded-tl-sm bg-card text-foreground shadow-vkm",
              )}
            >
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-tl-sm bg-card px-3 py-2 shadow-vkm">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          </div>
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
          placeholder="Ask how something works…"
          className="h-10 flex-1 rounded-xl border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <button
          type="button"
          onClick={onSend}
          disabled={loading || !text.trim()}
          aria-label="Send"
          className="app-press inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-gold text-navy disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
    </motion.div>
  );
}
