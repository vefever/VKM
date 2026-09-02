import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  Briefcase,
  Check,
  Copy,
  History,
  MessageSquarePlus,
  RefreshCw,
  Send,
  Sparkles,
  Square,
  Sunrise,
  Target,
  Trash2,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { usePageTitle } from "@/components/vkm/page-title-context";
import { VenuAvatar, VENU_NAME, VENU_TITLE } from "@/components/vkm/venu-avatar";
import { Markdown } from "@/components/vkm/advisor-markdown";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  askAdvisor,
  askAdvisorStream,
  advisorStatus,
  type ChatMsg,
} from "@/lib/vkm/advisor.functions";
import {
  groupThreads,
  loadActiveId,
  loadThreads,
  newThread,
  saveActiveId,
  saveThreads,
  titleFor,
  type Thread,
} from "@/lib/vkm/advisor-threads";

export const Route = createFileRoute("/_authenticated/participant/advisor")({
  head: () => ({ meta: [{ title: "AI Advisor · VKM" }] }),
  component: AdvisorPage,
});

const SUGGESTIONS: { icon: LucideIcon; label: string; prompt: string }[] = [
  {
    icon: Target,
    label: "Sales closing rate",
    prompt: "How do I improve my closing rate without offering discounts?",
  },
  {
    icon: TrendingUp,
    label: "More leads",
    prompt: "My enquiries are low. How do I get more right leads?",
  },
  {
    icon: Users,
    label: "Team accountability",
    prompt: "Give me a simple weekly review rhythm to keep my team accountable.",
  },
  {
    icon: Sunrise,
    label: "Plan my day",
    prompt: "Plan my top 3 highest-leverage actions for today.",
  },
  {
    icon: Sparkles,
    label: "Tenglish / Telugu",
    prompt: "Naa business revenue ela penchali? Simple ga cheppu.",
  },
];

/** Stable identity for "this thread has no messages" so effects don't re-run. */
const EMPTY_MSGS: ChatMsg[] = [];

/** The stream is dead if no chunk lands for this long (see comment in send()). */
const CLIENT_IDLE_MS = 35_000;

function AdvisorPage() {
  const { user, profile } = useAuth();
  const ask = useServerFn(askAdvisor);
  const askStream = useServerFn(askAdvisorStream);
  const getStatus = useServerFn(advisorStatus);
  const { setTitle, setCollapsed } = usePageTitle();

  const userId = user?.id ?? "anon";

  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false); // waiting for the first token
  const [streaming, setStreaming] = useState(false); // tokens are landing
  const [activated, setActivated] = useState<boolean | null>(null);
  const [businessName, setBusinessName] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [showJump, setShowJump] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const stoppedRef = useRef(false);
  /**
   * "Keep the newest text in view."  Deliberately a ref, not state: it is
   * driven by *user intent* (a wheel tick or a downward drag), never by the
   * scroll position itself. Deriving it from position is the classic bug —
   * each appended token grows the page, the reader briefly measures as
   * "not at bottom", auto-follow switches itself off and the transcript
   * stutters mid-answer.
   */
  const followRef = useRef(true);
  const touchYRef = useRef(0);
  /** Guards against a double Enter racing two generations (state is async). */
  const busyRef = useRef(false);
  /** Bumped on every send/stop so a superseded stream can't touch the UI. */
  const genRef = useRef(0);

  const active = useMemo(() => threads.find((t) => t.id === activeId) ?? null, [threads, activeId]);
  const messages = useMemo(() => active?.messages ?? EMPTY_MSGS, [active]);
  const busy = thinking || streaming;

  // This page is the whole screen and has no scrolling page header of its own,
  // so the mobile top bar carries the title from the moment it opens.
  useEffect(() => {
    setTitle("AI Advisor");
    setCollapsed(true);
    return () => {
      setTitle(null);
      setCollapsed(false);
    };
  }, [setTitle, setCollapsed]);

  // Hydrate history (per user) + check activation.
  useEffect(() => {
    const loaded = loadThreads(userId);
    const savedId = loadActiveId(userId);
    if (loaded.length) {
      setThreads(loaded);
      setActiveId(loaded.some((t) => t.id === savedId) ? savedId : loaded[0].id);
    } else {
      const t = newThread();
      setThreads([t]);
      setActiveId(t.id);
    }
    getStatus()
      .then((s) => {
        setActivated(s.activated);
        setBusinessName(s.businessName);
      })
      .catch(() => setActivated(null));
  }, [userId, getStatus]);

  // Persist history — debounced so a fast token stream isn't stringifying the
  // whole archive on every frame.
  useEffect(() => {
    if (!threads.length) return;
    const id = setTimeout(() => saveThreads(userId, threads), 400);
    return () => clearTimeout(id);
  }, [userId, threads]);

  useEffect(() => {
    if (activeId) saveActiveId(userId, activeId);
  }, [userId, activeId]);

  // Leaving the page mid-answer: retire the generation and drop the socket so
  // nothing keeps streaming into a screen that is gone.
  useEffect(
    () => () => {
      genRef.current += 1;
      void readerRef.current?.cancel().catch(() => {});
      readerRef.current = null;
    },
    [],
  );

  const pin = useCallback((behavior: ScrollBehavior = "auto") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  const syncScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    const near = dist < 64;
    // Scrolling back down to the end re-arms following — same as ChatGPT.
    if (near) followRef.current = true;
    setShowJump(!near && el.scrollHeight > el.clientHeight + 8);
  }, []);

  // Follow the newest text while streaming. Layout effect + instant scroll:
  // a smooth scroll restarted on every token never finishes, which is what
  // makes a token stream feel like it is dragging the page around.
  useLayoutEffect(() => {
    if (followRef.current) pin("auto");
    // Not following: the answer is still growing below the fold, so keep the
    // "jump to latest" pill honest.
    else syncScrollState();
  }, [messages, thinking, pin, syncScrollState]);

  // Opening a thread (or the page) lands at the newest message, with no
  // visible travel from the top.
  useLayoutEffect(() => {
    followRef.current = true;
    setShowJump(false);
    pin("auto");
  }, [activeId, pin]);

  // One rAF per burst — a scroll handler that setStates on every event fights
  // the very stream it is trying to track.
  const scrollTickRef = useRef(false);
  const onScroll = useCallback(() => {
    if (scrollTickRef.current) return;
    scrollTickRef.current = true;
    requestAnimationFrame(() => {
      scrollTickRef.current = false;
      syncScrollState();
    });
  }, [syncScrollState]);

  /** Any upward gesture means "let me read" — stop chasing the newest token. */
  function releaseFollow() {
    followRef.current = false;
  }

  function scrollToBottom() {
    followRef.current = true;
    pin("smooth");
    setShowJump(false);
  }

  function autoresize() {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 208)}px`;
    // A growing composer eats into the transcript — stay pinned to the end.
    if (followRef.current) pin("auto");
  }

  // --- thread mutations ----------------------------------------------------

  /** Patch one thread by id — streaming callbacks target the thread that was
   *  active when the request started, even if the user opens another one. */
  const patch = useCallback((tid: string, updater: (m: ChatMsg[]) => ChatMsg[]) => {
    setThreads((prev) =>
      prev.map((t) => {
        if (t.id !== tid) return t;
        const msgs = updater(t.messages);
        return {
          ...t,
          messages: msgs,
          title: t.messages.length === 0 ? titleFor(msgs) : t.title,
          updatedAt: Date.now(),
        };
      }),
    );
  }, []);

  function startNewChat() {
    if (busy) stop();
    const empty = threads.find((t) => t.messages.length === 0);
    if (empty) {
      setActiveId(empty.id);
    } else {
      const t = newThread();
      setThreads((prev) => [t, ...prev]);
      setActiveId(t.id);
    }
    setInput("");
    setHistoryOpen(false);
    followRef.current = true;
    if (taRef.current) taRef.current.style.height = "auto";
    requestAnimationFrame(() => taRef.current?.focus());
  }

  function openThread(id: string) {
    if (busy) stop();
    setActiveId(id);
    setHistoryOpen(false);
    followRef.current = true;
  }

  function deleteThread(id: string) {
    setThreads((prev) => {
      const next = prev.filter((t) => t.id !== id);
      if (id === activeId) {
        if (next.length) setActiveId(next[0].id);
        else {
          const t = newThread();
          setActiveId(t.id);
          return [t];
        }
      }
      return next;
    });
  }

  // --- sending -------------------------------------------------------------

  function stop() {
    stoppedRef.current = true;
    // Retire the in-flight generation: anything it emits from here on is
    // ignored, including a response that is still on its way to us.
    genRef.current += 1;
    busyRef.current = false;
    void readerRef.current?.cancel().catch(() => {});
    readerRef.current = null;
    setThinking(false);
    setStreaming(false);
  }

  async function send(text?: string, opts?: { replaceLast?: boolean }) {
    const content = (text ?? input).trim();
    const tid = activeId;
    // busyRef, not the `busy` state: two fast Enters would both read a stale
    // `false` and fire two generations into the same thread.
    if (!tid || busyRef.current) return;

    // A regenerate re-sends the transcript up to (and including) the last user
    // turn; a normal send appends the new question.
    let next: ChatMsg[];
    if (opts?.replaceLast) {
      const cut = [...messages];
      while (cut.length && cut[cut.length - 1].role === "assistant") cut.pop();
      if (!cut.length) return;
      next = cut;
    } else {
      if (!content) return;
      next = [...messages, { role: "user", content }];
      setInput("");
      if (taRef.current) taRef.current.style.height = "auto";
    }

    stoppedRef.current = false;
    busyRef.current = true;
    const gen = ++genRef.current;
    /** False once this generation has been stopped or superseded. */
    const live = () => genRef.current === gen && !stoppedRef.current;

    patch(tid, () => next);
    setThinking(true);
    followRef.current = true;
    setShowJump(false);

    try {
      const res = await askStream({ data: { messages: next } });

      // Stop pressed while the request was still in flight — drop the response
      // on the floor instead of letting it stream in behind the user's back.
      if (!live()) {
        if (res instanceof Response) void res.body?.cancel().catch(() => {});
        return;
      }

      // Streaming path: append tokens to a growing assistant bubble as they land.
      if (res instanceof Response && res.body) {
        const reader = res.body.getReader();
        readerRef.current = reader;
        const decoder = new TextDecoder();
        let acc = "";
        let started = false;
        // Defense-in-depth: the server already times out a hung upstream (see
        // ai-provider.ts), but if the Worker itself were ever killed mid-stream
        // its try/finally would never run and this read would hang forever with
        // nothing to catch it. A per-chunk idle watchdog guarantees the typing
        // indicator always clears even in that case.
        for (;;) {
          // The watchdog timer is cleared after every chunk — left uncleared,
          // a long answer parks one 35s timer per token.
          let idle: ReturnType<typeof setTimeout> | undefined;
          const raced = await Promise.race([
            reader.read(),
            new Promise<"timeout">((resolve) => {
              idle = setTimeout(() => resolve("timeout"), CLIENT_IDLE_MS);
            }),
          ]).finally(() => {
            if (idle) clearTimeout(idle);
          });
          if (!live()) break;
          if (raced === "timeout") {
            void reader.cancel().catch(() => {});
            if (!started) {
              patch(tid, (m) => [
                ...m,
                {
                  role: "assistant",
                  content: "The advisor is taking too long to respond — please try again.",
                },
              ]);
            } else {
              patch(tid, (m) =>
                replaceLastAssistant(m, `${acc}\n\n_(cut off — please try again.)_`),
              );
            }
            break;
          }
          const { done, value } = raced;
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          if (!chunk) continue;
          acc += chunk;
          if (!started) {
            // First token arrived — swap the thinking indicator for the reply.
            started = true;
            setThinking(false);
            setStreaming(true);
            patch(tid, (m) => [...m, { role: "assistant", content: acc }]);
          } else {
            patch(tid, (m) => replaceLastAssistant(m, acc));
          }
        }
        if (!started && live()) {
          // Stream closed without any text — show a gentle fallback.
          patch(tid, (m) => [
            ...m,
            {
              role: "assistant",
              content: "I couldn't generate a reply just now — please try again.",
            },
          ]);
        }
        return;
      }

      // Fallback: non-streaming Response (gateway buffered) or unexpected shape.
      const fallbackText =
        res instanceof Response ? await res.text() : ((res as { content?: string })?.content ?? "");
      if (!live()) return;
      patch(tid, (m) => [
        ...m,
        {
          role: "assistant",
          content: fallbackText || "I couldn't generate a reply just now — please try again.",
        },
      ]);
    } catch (err) {
      if (!live()) return;
      // Last-resort fallback to the blocking endpoint so a stream hiccup never
      // leaves the user with nothing.
      try {
        const res = await ask({ data: { messages: next } });
        if (!live()) return;
        setActivated(res.activated);
        patch(tid, (m) => [...m, { role: "assistant", content: res.content }]);
      } catch {
        if (!live()) return;
        patch(tid, (m) => [
          ...m,
          { role: "assistant", content: `Something went wrong: ${(err as Error).message}` },
        ]);
      }
    } finally {
      // Only the generation that is still current may clear the indicators —
      // otherwise a slow, superseded request switches off the live one.
      if (genRef.current === gen) {
        readerRef.current = null;
        busyRef.current = false;
        setThinking(false);
        setStreaming(false);
      }
    }
  }

  const firstName = profile?.full_name?.split(" ")[0] ?? "there";
  const lastIsAssistant = messages.length > 0 && messages[messages.length - 1].role === "assistant";

  return (
    <div
      // The shell's pull-to-refresh listens on the document and fires whenever
      // window.scrollY is 0 — which is always true here, since the page itself
      // never scrolls. Without this opt-out every downward swipe in the
      // transcript drags the whole app down.
      data-no-pull-refresh
      className={cn(
        // Full-bleed: cancel AppShell's page padding so the chat owns the
        // viewport the way ChatGPT / Claude / Gemini do.
        "-mx-4 -mt-3 -mb-[calc(var(--vkm-nav-h)+1rem)] flex flex-col overflow-hidden bg-background",
        "h-[calc(100dvh-4rem-env(safe-area-inset-top)-var(--vkm-nav-h)-var(--kb,0px))]",
        "sm:-mx-8 sm:-mt-8 md:-mb-8",
      )}
    >
      <ChatHeader
        activated={activated}
        businessName={businessName}
        canStartNew={messages.length > 0}
        onNewChat={startNewChat}
        onOpenHistory={() => setHistoryOpen(true)}
      />

      {activated === false && (
        <div className="flex items-start gap-2.5 border-b border-[oklch(0.85_0.1_85)] bg-[oklch(0.97_0.04_85)] px-4 py-2.5 sm:px-6">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[oklch(0.55_0.14_70)]" />
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            <span className="font-semibold text-foreground">Advisor not activated yet.</span> An
            admin needs to configure an AI provider in{" "}
            <span className="font-medium">Admin → AI Configurations</span>. You can still explore
            the chat — replies will be limited until it's switched on.
          </p>
        </div>
      )}

      {/* Transcript */}
      <div
        ref={scrollRef}
        onScroll={onScroll}
        // A wheel tick up, or a finger dragging the transcript down, means the
        // reader wants to stay put — that is what releases auto-follow.
        onWheel={(e) => {
          if (e.deltaY < 0) releaseFollow();
        }}
        onTouchStart={(e) => {
          touchYRef.current = e.touches[0].clientY;
        }}
        onTouchMove={(e) => {
          const y = e.touches[0].clientY;
          if (y > touchYRef.current + 4) releaseFollow();
          touchYRef.current = y;
        }}
        onKeyDown={(e) => {
          if (["ArrowUp", "PageUp", "Home"].includes(e.key)) releaseFollow();
        }}
        // min-h-0 is load-bearing: a flex child defaults to min-height:auto, so
        // without it this pane grows to fit the transcript instead of
        // scrolling, and the composer gets pushed off the screen.
        className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain"
      >
        <div className="mx-auto w-full max-w-3xl px-4 pb-8 pt-6 sm:px-6">
          {messages.length === 0 ? (
            <EmptyState firstName={firstName} businessName={businessName} onPick={(p) => send(p)} />
          ) : (
            <div className="space-y-7">
              {messages.map((m, i) =>
                m.role === "user" ? (
                  <UserRow key={i} content={m.content} />
                ) : (
                  <AssistantRow
                    key={i}
                    content={m.content}
                    streaming={streaming && i === messages.length - 1}
                    onRegenerate={
                      !busy && i === messages.length - 1
                        ? () => send(undefined, { replaceLast: true })
                        : undefined
                    }
                  />
                ),
              )}
              {thinking && <ThinkingRow onStop={stop} />}
              {/* A question left hanging — the user pressed Stop before any
                  text arrived, or the reply failed. Never leave it silent. */}
              {!busy && !lastIsAssistant && (
                <StoppedRow onRetry={() => send(undefined, { replaceLast: true })} />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Composer */}
      <div className="relative shrink-0 bg-background px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-1 sm:px-6">
        {/* Fade so the transcript dissolves into the composer instead of
            colliding with a hard border. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-8 h-8 bg-gradient-to-t from-background to-transparent"
        />

        <AnimatePresence>
          {showJump && messages.length > 0 && (
            <motion.button
              type="button"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              onClick={scrollToBottom}
              className="absolute -top-5 left-1/2 z-10 inline-flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-vkm-float transition-transform hover:-translate-y-px active:scale-95"
              aria-label="Scroll to latest"
            >
              <ArrowDown className="h-4 w-4" />
            </motion.button>
          )}
        </AnimatePresence>

        <div className="mx-auto w-full max-w-3xl">
          {/* Follow-up chips — the quick nudges ChatGPT shows once a thread is
              underway, so the owner never faces a blank prompt. */}
          {messages.length > 0 && lastIsAssistant && !busy && (
            <div className="mb-2 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {FOLLOW_UPS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => send(f)}
                  className="shrink-0 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm transition-all hover:border-gold/50 hover:text-foreground active:scale-95"
                >
                  {f}
                </button>
              ))}
            </div>
          )}

          <div className="rounded-[1.75rem] border border-border bg-card p-2 shadow-vkm transition-all focus-within:border-gold/60 focus-within:shadow-vkm-float">
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
              placeholder={`Message ${VENU_NAME} — English, తెలుగు or Tenglish…`}
              className="max-h-52 w-full resize-none bg-transparent px-3 pb-1 pt-2 text-[15px] leading-6 text-foreground outline-none placeholder:text-muted-foreground"
            />
            <div className="flex items-center justify-between gap-2 pl-3 pr-1">
              <span className="inline-flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
                <Sparkles className="h-3 w-3 shrink-0 text-gold" />
                <span className="truncate">
                  {businessName ? `Knows ${businessName}` : "Uses your live business data"}
                </span>
              </span>
              {busy ? (
                <Button
                  onClick={stop}
                  size="icon"
                  variant="outline"
                  aria-label="Stop generating"
                  className="h-10 w-10 shrink-0 rounded-full"
                >
                  <Square className="h-3.5 w-3.5 fill-current" />
                </Button>
              ) : (
                <Button
                  onClick={() => send()}
                  disabled={!input.trim()}
                  size="icon"
                  aria-label="Send"
                  className="h-10 w-10 shrink-0 rounded-full bg-gradient-navy text-primary-foreground shadow-vkm transition-transform hover:opacity-90 active:scale-95 disabled:opacity-30 disabled:shadow-none"
                >
                  <Send className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          <p className="mt-2 hidden px-1 text-center text-[11px] text-muted-foreground sm:block">
            <span className="font-medium">Enter</span> to send ·{" "}
            <span className="font-medium">Shift + Enter</span> for a new line · Venu's AI avatar
            guides you alongside your coach, never replaces them.
          </p>
        </div>
      </div>

      <HistorySheet
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        threads={threads}
        activeId={activeId}
        onOpenThread={openThread}
        onDelete={deleteThread}
        onNewChat={startNewChat}
      />
    </div>
  );
}

const FOLLOW_UPS = [
  "Give me a 7-day action plan",
  "Explain in Telugu",
  "What should I do first?",
  "Show me an example script",
];

function replaceLastAssistant(m: ChatMsg[], content: string): ChatMsg[] {
  const copy = m.slice();
  copy[copy.length - 1] = { role: "assistant", content };
  return copy;
}

// ---------------------------------------------------------------------------
// Header — thin, sticky, always says WHO you're talking to. This is the line
// that keeps the surface reading as "a conversation with Venu" rather than
// "an AI chat widget".
// ---------------------------------------------------------------------------
function ChatHeader({
  activated,
  businessName,
  canStartNew,
  onNewChat,
  onOpenHistory,
}: {
  activated: boolean | null;
  businessName: string | null;
  canStartNew: boolean;
  onNewChat: () => void;
  onOpenHistory: () => void;
}) {
  const online = activated !== false;
  return (
    <header className="flex shrink-0 items-center gap-2 border-b border-border bg-card/70 px-3 py-2 backdrop-blur sm:px-6 sm:py-2.5">
      <Button
        variant="ghost"
        size="icon"
        onClick={onOpenHistory}
        aria-label="Chat history"
        className="h-9 w-9 shrink-0 rounded-xl text-muted-foreground"
      >
        <History className="h-[18px] w-[18px]" />
      </Button>

      <div className="relative shrink-0">
        <VenuAvatar className="h-9 w-9" ring />
        <span
          aria-hidden
          className={cn(
            "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-card",
            online ? "bg-[oklch(0.65_0.17_150)]" : "bg-muted-foreground/50",
          )}
        />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold leading-tight text-foreground">
          {VENU_NAME}
          <span className="sr-only">{online ? " — online" : " — offline"}</span>
        </p>
        <p className="truncate text-[11px] leading-tight text-muted-foreground">
          {VENU_TITLE} · AI Avatar
          {businessName ? ` · ${businessName}` : ""}
        </p>
      </div>

      <Button
        variant="ghost"
        size="sm"
        className="shrink-0 rounded-full text-muted-foreground"
        asChild
      >
        <Link to="/participant/business" aria-label="My Business">
          <Briefcase className="h-4 w-4" />
          <span className="hidden sm:inline">My Business</span>
        </Link>
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="shrink-0 rounded-full"
        onClick={onNewChat}
        disabled={!canStartNew}
        aria-label="New chat"
      >
        <MessageSquarePlus className="h-4 w-4" />
        <span className="hidden sm:inline">New chat</span>
      </Button>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Empty state — the "what can I help with?" moment.
// ---------------------------------------------------------------------------
function EmptyState({
  firstName,
  businessName,
  onPick,
}: {
  firstName: string;
  businessName: string | null;
  onPick: (p: string) => void;
}) {
  return (
    <div className="flex flex-col items-center py-6 text-center md:py-12">
      <motion.span
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 18 }}
        className="relative inline-flex items-center justify-center"
      >
        <span
          aria-hidden
          className="absolute -inset-1.5 rounded-full bg-gradient-gold opacity-30 blur-lg"
        />
        <VenuAvatar className="relative h-16 w-16" ring />
      </motion.span>

      <h2 className="mt-5 text-2xl font-bold tracking-tight text-foreground sm:text-[28px]">
        Namaskaram {firstName} 🙏
      </h2>
      <p className="mt-2 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
        Nenu {VENU_NAME}.{" "}
        {businessName ? (
          <span className="font-medium text-foreground">{businessName}</span>
        ) : (
          "Mee business"
        )}{" "}
        gurinchi — leads, sales, team, marketing, ye topic ayinaa — adagandi. I know your profile,
        revenue and where you are in VK's 16-week method.
      </p>

      <div className="mt-7 grid w-full max-w-2xl grid-cols-1 gap-2.5 sm:grid-cols-2">
        {SUGGESTIONS.map((s, i) => {
          const Icon = s.icon;
          return (
            <motion.button
              key={s.label}
              type="button"
              onClick={() => onPick(s.prompt)}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * i + 0.08 }}
              className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 text-left transition-all hover:-translate-y-0.5 hover:border-gold/50 hover:shadow-vkm active:scale-[0.98]"
            >
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-navy transition-colors group-hover:bg-gradient-gold group-hover:text-navy">
                <Icon className="h-[18px] w-[18px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-foreground">{s.label}</span>
                <span className="block truncate text-xs text-muted-foreground">{s.prompt}</span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-all group-hover:translate-x-0.5 group-hover:text-gold" />
            </motion.button>
          );
        })}
      </div>

      <p className="mt-6 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Sparkles className="h-3 w-3 text-gold" /> Private to you · uses your live business data
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Message rows
// ---------------------------------------------------------------------------
function UserRow({ content }: { content: string }) {
  return (
    <motion.div
      // Fade only, no travel: a y-offset on a message that is being
      // auto-followed leaves the transcript a few pixels short of the end.
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18 }}
      className="flex justify-end"
    >
      <div className="max-w-[85%] whitespace-pre-wrap rounded-3xl rounded-br-lg bg-gradient-navy px-4 py-2.5 text-[15px] leading-7 text-primary-foreground shadow-vkm">
        {content}
      </div>
    </motion.div>
  );
}

function AssistantRow({
  content,
  streaming,
  onRegenerate,
}: {
  content: string;
  streaming: boolean;
  onRegenerate?: () => void;
}) {
  return (
    <motion.div
      // Fade only, no travel: a y-offset on a message that is being
      // auto-followed leaves the transcript a few pixels short of the end.
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18 }}
      className="group flex gap-3"
    >
      <VenuAvatar className="mt-0.5 h-8 w-8 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1">
        {/* No bubble on Venu's side — long answers read better as a document,
            which is exactly what ChatGPT / Claude / Gemini all settled on. */}
        <Markdown text={content} />
        {streaming && (
          <span
            aria-hidden
            className="ml-0.5 inline-block h-4 w-[3px] animate-pulse rounded-full bg-navy/70 align-middle"
          />
        )}
        {!streaming && (
          <div className="mt-2 flex items-center gap-1 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100">
            <CopyButton text={content} />
            {onRegenerate && (
              <ActionButton onClick={onRegenerate} icon={RefreshCw} label="Regenerate" />
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function StoppedRow({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex gap-3">
      <VenuAvatar className="mt-0.5 h-8 w-8 shrink-0 rounded-full opacity-60" />
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <span className="text-[13px] text-muted-foreground">No reply yet.</span>
        <ActionButton onClick={onRetry} icon={RefreshCw} label="Ask again" />
      </div>
    </div>
  );
}

function ThinkingRow({ onStop }: { onStop: () => void }) {
  return (
    <div className="flex gap-3">
      <VenuAvatar className="mt-0.5 h-8 w-8 shrink-0 rounded-full" />
      <div className="flex flex-wrap items-center gap-2 pt-1.5">
        <span className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-2 w-2 animate-bounce rounded-full bg-navy/40"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </span>
        <span className="bg-gradient-to-r from-muted-foreground via-foreground to-muted-foreground bg-[length:200%_100%] bg-clip-text text-[13px] font-medium text-transparent [animation:vkm-text-shimmer_2s_linear_infinite]">
          Venu is thinking…
        </span>
        {/* Reachable even before the first token — the composer's Stop button
            can be off-screen on a phone with the keyboard up. */}
        <ActionButton onClick={onStop} icon={Square} label="Stop" />
      </div>
    </div>
  );
}

function ActionButton({
  onClick,
  icon: Icon,
  label,
}: {
  onClick: () => void;
  icon: LucideIcon;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Clear any pending reset timer if the button unmounts mid-countdown.
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );
  return (
    <button
      type="button"
      title="Copy"
      onClick={() => {
        navigator.clipboard?.writeText(text).then(() => {
          setCopied(true);
          if (timerRef.current) clearTimeout(timerRef.current);
          timerRef.current = setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-[oklch(0.55_0.14_160)]" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

// ---------------------------------------------------------------------------
// History drawer — past conversations, grouped by day.
// ---------------------------------------------------------------------------
function HistorySheet({
  open,
  onOpenChange,
  threads,
  activeId,
  onOpenThread,
  onDelete,
  onNewChat,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  threads: Thread[];
  activeId: string | null;
  onOpenThread: (id: string) => void;
  onDelete: (id: string) => void;
  onNewChat: () => void;
}) {
  const groups = groupThreads(threads.filter((t) => t.messages.length > 0));
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="flex w-[19rem] flex-col gap-0 p-0 sm:w-[21rem]">
        <SheetHeader className="border-b border-border px-4 py-3.5">
          <SheetTitle className="text-base">Your chats</SheetTitle>
        </SheetHeader>

        <div className="px-3 py-3">
          <Button
            onClick={onNewChat}
            className="w-full justify-start rounded-xl bg-gradient-navy text-primary-foreground shadow-vkm hover:opacity-90"
          >
            <MessageSquarePlus className="h-4 w-4" /> New chat
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-6">
          {groups.length === 0 ? (
            <p className="px-3 py-6 text-center text-[13px] text-muted-foreground">
              No past chats yet. Ask Venu anything to start one.
            </p>
          ) : (
            groups.map((g) => (
              <div key={g.label} className="mb-3">
                <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {g.label}
                </p>
                {g.items.map((t) => (
                  <div
                    key={t.id}
                    className={cn(
                      "group flex items-center gap-1 rounded-xl transition-colors",
                      t.id === activeId ? "bg-secondary" : "hover:bg-secondary/60",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => onOpenThread(t.id)}
                      className="min-w-0 flex-1 px-3 py-2 text-left"
                    >
                      <span className="block truncate text-[13px] font-medium text-foreground">
                        {t.title}
                      </span>
                      <span className="block text-[11px] text-muted-foreground">
                        {t.messages.length} messages · {timeAgo(t.updatedAt)}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(t.id)}
                      aria-label={`Delete ${t.title}`}
                      className="mr-1.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>

        <p className="border-t border-border px-4 py-2.5 text-[11px] text-muted-foreground">
          Chats are stored privately on this device.
        </p>
      </SheetContent>
    </Sheet>
  );
}

function timeAgo(ts: number): string {
  const s = Math.max(1, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return d < 7 ? `${d}d ago` : new Date(ts).toLocaleDateString();
}
