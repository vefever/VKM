import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import {
  Bot,
  Sparkles,
  Send,
  Plus,
  User,
  BrainCircuit,
  AlertTriangle,
  Settings2,
  Sunrise,
  Target,
  TrendingUp,
  Users,
  ArrowRight,
  Copy,
  Check,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/vkm/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { askAdvisor, advisorStatus, type ChatMsg } from "@/lib/vkm/advisor.functions";

export const Route = createFileRoute("/_authenticated/participant/advisor")({
  head: () => ({ meta: [{ title: "AI Advisor · VKM" }] }),
  component: AdvisorPage,
});

const SUGGESTIONS: { icon: LucideIcon; label: string; prompt: string }[] = [
  {
    icon: Sunrise,
    label: "Plan my day",
    prompt: "Plan my top 3 highest-leverage actions for today.",
  },
  {
    icon: Target,
    label: "Pressure-test CRM",
    prompt: "Pressure-test my Week 7 CRM lead stages and a 3-day follow-up cadence.",
  },
  {
    icon: TrendingUp,
    label: "Lift closing rate",
    prompt: "How do I lift my closing rate this month without discounting?",
  },
  {
    icon: Users,
    label: "Team accountability",
    prompt: "Give me a simple weekly review rhythm to keep my team accountable.",
  },
];

function AdvisorPage() {
  const { user, profile } = useAuth();
  const ask = useServerFn(askAdvisor);
  const getStatus = useServerFn(advisorStatus);

  const storageKey = `vkm.advisor.thread.${user?.id ?? "anon"}`;
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [activated, setActivated] = useState<boolean | null>(null);
  const [businessName, setBusinessName] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Hydrate thread from localStorage (per user) + check activation.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setMessages(JSON.parse(raw) as ChatMsg[]);
      else setMessages([]);
    } catch {
      setMessages([]);
    }
    getStatus()
      .then((s) => {
        setActivated(s.activated);
        setBusinessName(s.businessName);
      })
      .catch(() => setActivated(null));
  }, [storageKey, getStatus]);

  // Persist thread.
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(messages));
    } catch {
      /* ignore */
    }
  }, [storageKey, messages]);

  // Auto-scroll to newest.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  function autoresize() {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    const next: ChatMsg[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setLoading(true);
    if (taRef.current) taRef.current.style.height = "auto";
    try {
      const res = await ask({ data: { messages: next } });
      setActivated(res.activated);
      setMessages((m) => [...m, { role: "assistant", content: res.content }]);
    } catch (err) {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: `Something went wrong: ${(err as Error).message}` },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function newChat() {
    setMessages([]);
    setInput("");
  }

  const firstName = profile?.full_name?.split(" ")[0] ?? "there";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-4"
    >
      <PageHeader
        eyebrow="Personal AI · trained on your business"
        title="AI Business Advisor"
        description={
          businessName
            ? `Private advisor for ${businessName} — 24/7, in VK's methodology.`
            : "Your private business advisor — 24/7, in Venu Kalyan's methodology."
        }
        icon={BrainCircuit}
        actions={
          <>
            <Button variant="outline" className="rounded-full" asChild>
              <Link to="/participant/brain">
                <Settings2 className="h-4 w-4" /> Business Brain
              </Link>
            </Button>
            <Button
              variant="outline"
              className="rounded-full"
              onClick={newChat}
              disabled={!messages.length}
            >
              <Plus className="h-4 w-4" /> New chat
            </Button>
          </>
        }
      />

      {activated === false && (
        <div className="flex items-start gap-3 rounded-2xl border border-[oklch(0.85_0.1_85)] bg-[oklch(0.97_0.04_85)] px-4 py-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[oklch(0.55_0.14_70)]" />
          <div className="text-sm">
            <p className="font-semibold text-foreground">Advisor not activated yet</p>
            <p className="text-muted-foreground">
              An admin needs to configure an AI provider in{" "}
              <span className="font-medium">Admin → AI Configurations</span>. You can still explore the chat
              — replies will be limited until it's switched on.
            </p>
          </div>
        </div>
      )}

      {/* Chat surface */}
      <div className="flex h-[calc(100dvh-15rem)] min-h-[440px] flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-vkm md:h-[calc(100dvh-13rem)]">
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-3xl px-4 py-6 md:px-6">
            {messages.length === 0 ? (
              <EmptyState firstName={firstName} onPick={send} />
            ) : (
              <div className="space-y-6">
                {messages.map((m, i) => (
                  <MessageRow key={i} role={m.role} content={m.content} />
                ))}
                {loading && <TypingRow />}
              </div>
            )}
          </div>
        </div>

        {/* Composer */}
        <div className="border-t border-border bg-card/80 px-3 py-3 backdrop-blur md:px-6">
          <div className="mx-auto w-full max-w-3xl">
            <div className="flex items-end gap-2 rounded-2xl border border-border bg-background p-2 shadow-vkm focus-within:border-gold/50 focus-within:shadow-vkm-float">
              <textarea
                ref={taRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  autoresize();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                rows={1}
                placeholder="Ask your advisor anything about your business…"
                className="max-h-40 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
              <Button
                onClick={() => send()}
                disabled={!input.trim() || loading}
                size="icon"
                className="h-9 w-9 shrink-0 rounded-xl bg-gradient-navy text-primary-foreground hover:opacity-90 disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="mt-1.5 px-1 text-center text-[11px] text-muted-foreground">
              <span className="font-medium">Enter</span> to send ·{" "}
              <span className="font-medium">Shift+Enter</span> for a new line · Advice supports your
              coach, not replaces them.
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------
function EmptyState({ firstName, onPick }: { firstName: string; onPick: (p: string) => void }) {
  return (
    <div className="flex flex-col items-center py-6 text-center md:py-10">
      <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-gold text-navy shadow-vkm-float">
        <Bot className="h-7 w-7" />
      </span>
      <h2 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
        Hi {firstName}, how can I help your business today?
      </h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        I'm trained on your Business Brain and VK's 16-week method. Ask me to plan your day, fix a
        system, or sharpen your sales.
      </p>
      <div className="mt-6 grid w-full max-w-2xl grid-cols-1 gap-2.5 sm:grid-cols-2">
        {SUGGESTIONS.map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={s.label}
              type="button"
              onClick={() => onPick(s.prompt)}
              className="group flex items-start gap-3 rounded-2xl border border-border bg-card p-3.5 text-left transition-all hover:-translate-y-0.5 hover:border-gold/40 hover:shadow-vkm"
            >
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-navy transition-colors group-hover:bg-gradient-gold">
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-foreground">{s.label}</span>
                <span className="block truncate text-xs text-muted-foreground">{s.prompt}</span>
              </span>
              <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
          );
        })}
      </div>
      <Badge variant="outline" className="mt-6 rounded-full">
        <Sparkles className="h-3 w-3 text-gold" /> Context-aware · uses your Business Brain
      </Badge>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Message row
// ---------------------------------------------------------------------------
function MessageRow({ role, content }: { role: ChatMsg["role"]; content: string }) {
  const isUser = role === "user";
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={cn("flex gap-3", isUser && "flex-row-reverse")}
    >
      <span
        className={cn(
          "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl shadow-vkm",
          isUser ? "bg-gradient-navy text-primary-foreground" : "bg-gradient-gold text-navy",
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </span>
      <div className={cn("min-w-0 max-w-[85%]", isUser && "flex flex-col items-end")}>
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
            isUser
              ? "bg-gradient-navy text-primary-foreground"
              : "border border-border bg-secondary/60 text-foreground",
          )}
        >
          {isUser ? (
            <span className="whitespace-pre-wrap">{content}</span>
          ) : (
            <FormattedText text={content} />
          )}
        </div>
        {!isUser && <CopyButton text={content} />}
      </div>
    </motion.div>
  );
}

function TypingRow() {
  return (
    <div className="flex gap-3">
      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-gold text-navy shadow-vkm">
        <Bot className="h-4 w-4" />
      </span>
      <div className="flex items-center gap-1.5 rounded-2xl border border-border bg-secondary/60 px-4 py-3.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Clear any pending reset timer if the button unmounts mid-countdown.
  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(text).then(() => {
          setCopied(true);
          if (timerRef.current) clearTimeout(timerRef.current);
          timerRef.current = setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="mt-1 inline-flex items-center gap-1 px-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
    >
      {copied ? (
        <Check className="h-3 w-3 text-[oklch(0.55_0.14_160)]" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Minimal rich-text rendering (paragraphs, bullet lists, **bold**)
// ---------------------------------------------------------------------------
function inline(s: string): ReactNode[] {
  return s.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? (
      <strong key={i} className="font-semibold">
        {p.slice(2, -2)}
      </strong>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
}

function FormattedText({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <>
      {blocks.map((b, i) => {
        const lines = b.split("\n").filter((l) => l.length > 0);
        const isList = lines.length > 0 && lines.every((l) => /^\s*[-*]\s+/.test(l));
        if (isList) {
          return (
            <ul key={i} className={cn("list-disc space-y-1 pl-5", i > 0 && "mt-2")}>
              {lines.map((l, j) => (
                <li key={j}>{inline(l.replace(/^\s*[-*]\s+/, ""))}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className={i > 0 ? "mt-2" : undefined}>
            {b.split("\n").map((l, j) => (
              <span key={j}>
                {j > 0 && <br />}
                {inline(l)}
              </span>
            ))}
          </p>
        );
      })}
    </>
  );
}
