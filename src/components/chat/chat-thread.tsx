import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { format, isSameDay } from "date-fns";
import {
  Send,
  Paperclip,
  Video,
  Loader2,
  X,
  FileText,
  Download,
  ChevronLeft,
  ChevronDown,
  Check,
  CheckCheck,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { AvatarBadge } from "@/components/vkm/avatar-badge";
import { EmojiPicker } from "@/components/chat/emoji-picker";
import { CallModal } from "@/components/chat/call-modal";
import { useThread, uploadAttachment, callUrl, type Attachment } from "@/components/chat/chat-data";

// Normalised message shape — both `messages` (coach) and `dm_messages` (member)
// map onto this so they share one renderer.
export type UMsg = {
  id: string;
  sender_id: string | null;
  body: string | null;
  attachments: Attachment[];
  created_at: string;
};

const GROUP_GAP_MS = 5 * 60_000; // messages within 5 min of the same sender group together

/**
 * Shared conversation UI (header + messages + composer). Data-agnostic: pass
 * messages/send from either the coach thread or a member DM thread. Also
 * shared with the staff inbox (coach/mentor/admin) via the `ChatThread`
 * wrapper below — keep changes here safe for both call sites.
 */
export function ConversationView({
  loading,
  messages,
  names,
  meId,
  send,
  header,
  callRoom,
  onBack,
  typingOther = false,
  otherOnline = false,
  otherLastReadAt = null,
  sendTyping,
}: {
  loading: boolean;
  messages: UMsg[];
  names: Record<string, string>;
  meId: string | null;
  send: (body: string, atts: Attachment[]) => Promise<void> | void;
  header: { name: string; subtitle: string; avatar?: string | null };
  callRoom?: string | null;
  onBack?: () => void;
  typingOther?: boolean;
  otherOnline?: boolean;
  otherLastReadAt?: Date | null;
  sendTyping?: () => void;
}) {
  const { user } = useAuth();
  const reduceMotion = useReducedMotion();
  const [text, setText] = useState("");
  const [pending, setPending] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [callOpen, setCallOpen] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [unseenBelow, setUnseenBelow] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(messages.length);

  // Auto-scroll to the latest message, but only when already near the bottom —
  // someone reading history shouldn't get yanked down by a new arrival.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const grew = messages.length > prevCountRef.current;
    prevCountRef.current = messages.length;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (!grew || nearBottom) {
      el.scrollTo({ top: el.scrollHeight, behavior: grew ? "smooth" : "auto" });
    } else if (grew) {
      setUnseenBelow((n) => n + 1);
    }
  }, [messages, loading]);

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollBtn(distanceFromBottom > 200);
    if (distanceFromBottom < 120) setUnseenBelow(0);
  }

  function scrollToBottom() {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    setUnseenBelow(0);
  }

  // Keep the composer above the on-screen keyboard via visualViewport.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => {
      const overlap = window.innerHeight - vv.height - vv.offsetTop;
      document.documentElement.style.setProperty("--kb", `${Math.max(0, overlap)}px`);
    };
    vv.addEventListener("resize", onResize);
    vv.addEventListener("scroll", onResize);
    onResize();
    return () => {
      vv.removeEventListener("resize", onResize);
      vv.removeEventListener("scroll", onResize);
      document.documentElement.style.removeProperty("--kb");
    };
  }, []);

  // Auto-grow the textarea from 1 line up to the existing max-h-28 cap.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 112)}px`;
  }, [text]);

  async function onFiles(files: FileList | null) {
    if (!files || !user) return;
    setUploading(true);
    try {
      for (const f of Array.from(files)) {
        const a = await uploadAttachment(user.id, f);
        setPending((p) => [...p, a]);
      }
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function onSend() {
    if (uploading) return;
    if (!text.trim() && pending.length === 0) return;
    await send(text, pending);
    setText("");
    setPending([]);
  }

  function startCall() {
    if (!callRoom) return;
    send(`📞 Started a video call — tap to join: ${callUrl(callRoom)}`, []);
    setCallOpen(true);
  }

  // Group consecutive same-sender messages within a short window, and mark day
  // boundaries for the date-separator pill.
  const rendered = useMemo(() => {
    return messages.map((m, i) => {
      const prev = messages[i - 1];
      const next = messages[i + 1];
      const sameAsPrev =
        prev && prev.sender_id === m.sender_id && +new Date(m.created_at) - +new Date(prev.created_at) < GROUP_GAP_MS;
      const sameAsNext =
        next && next.sender_id === m.sender_id && +new Date(next.created_at) - +new Date(m.created_at) < GROUP_GAP_MS;
      const newDay = !prev || !isSameDay(new Date(prev.created_at), new Date(m.created_at));
      return { m, isFirstInGroup: !sameAsPrev, isLastInGroup: !sameAsNext, newDay };
    });
  }, [messages]);

  const subtitle = typingOther ? null : otherOnline ? "online" : header.subtitle;

  return (
    <div className="flex h-full min-h-[420px] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-vkm">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              aria-label="Back to conversations"
              className="app-press -ml-1 inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary/60 lg:hidden"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
          <div className="relative shrink-0">
            <AvatarBadge name={header.name} src={header.avatar} size="md" />
            {otherOnline && !typingOther && (
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card bg-success" />
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{header.name}</p>
            {typingOther ? (
              <span className="flex items-center gap-1 text-[11px] text-success">
                <TypingDots reduceMotion={!!reduceMotion} /> typing…
              </span>
            ) : (
              <p className={cn("truncate text-[11px]", otherOnline ? "text-success" : "text-muted-foreground")}>
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {callRoom && (
          <button
            onClick={startCall}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-success px-3 py-1.5 text-sm font-medium text-white transition-transform hover:opacity-90 active:scale-95"
          >
            <Video className="h-4 w-4" /> Call
          </button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} onScroll={onScroll} className="relative flex-1 space-y-1 overflow-y-auto p-4">
        {loading ? (
          <p className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </p>
        ) : messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No messages yet — say hello 👋
          </p>
        ) : (
          rendered.map(({ m, isFirstInGroup, isLastInGroup, newDay }) => {
            const mine = m.sender_id === meId;
            const seen = mine && otherLastReadAt != null && otherLastReadAt >= new Date(m.created_at);
            return (
              <div key={m.id}>
                {newDay && (
                  <div className="my-3 flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="h-px flex-1 bg-border" />
                    <span className="rounded-full bg-secondary px-2.5 py-0.5">
                      {format(new Date(m.created_at), "MMM d")}
                    </span>
                    <span className="h-px flex-1 bg-border" />
                  </div>
                )}
                <motion.div
                  initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18 }}
                  className={cn("flex flex-col", mine ? "items-end" : "items-start", isFirstInGroup ? "mt-2.5" : "mt-0.5")}
                >
                  {!mine && m.sender_id && names[m.sender_id] && isFirstInGroup && (
                    <span className="mb-0.5 px-1 text-[11px] font-medium text-muted-foreground">
                      {names[m.sender_id]}
                    </span>
                  )}
                  <div
                    className={cn(
                      "max-w-[78%] px-3.5 py-2 text-sm",
                      mine
                        ? cn("bg-gradient-navy text-primary-foreground", isLastInGroup ? "rounded-2xl rounded-br-sm" : "rounded-2xl")
                        : cn(
                            "border border-border bg-secondary/60 text-foreground",
                            isLastInGroup ? "rounded-2xl rounded-bl-sm" : "rounded-2xl",
                          ),
                    )}
                  >
                    {m.attachments?.length > 0 && (
                      <div className="mb-1 space-y-1.5">
                        {m.attachments.map((a, i) => (
                          <AttachmentView key={i} a={a} mine={mine} />
                        ))}
                      </div>
                    )}
                    {m.body && <Linkified text={m.body} mine={mine} />}
                  </div>
                  {isLastInGroup && (
                    <span className="mt-0.5 flex items-center gap-1 px-1 text-[10px] text-muted-foreground">
                      {format(new Date(m.created_at), "h:mm a")}
                      {mine &&
                        (seen ? (
                          <CheckCheck className="h-3 w-3 text-success" />
                        ) : (
                          <Check className="h-3 w-3" />
                        ))}
                    </span>
                  )}
                </motion.div>
              </div>
            );
          })
        )}

        {/* Scroll-to-bottom */}
        <AnimatePresence>
          {showScrollBtn && (
            <motion.button
              type="button"
              onClick={scrollToBottom}
              initial={reduceMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              className="app-press sticky bottom-2 left-full inline-flex h-10 w-10 items-center justify-center rounded-full bg-gradient-navy text-primary-foreground shadow-vkm-float"
              aria-label="Scroll to latest"
            >
              <ChevronDown className="h-5 w-5" />
              {unseenBelow > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-bold text-navy">
                  {unseenBelow}
                </span>
              )}
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Pending attachments */}
      {(pending.length > 0 || uploading) && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border px-3 py-2">
          {pending.map((a, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-2 py-1 text-xs"
            >
              <FileText className="h-3.5 w-3.5" /> {a.name.slice(0, 18)}
              <button onClick={() => setPending((p) => p.filter((_, j) => j !== i))}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          {uploading && (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> uploading…
            </span>
          )}
        </div>
      )}

      {/* Composer */}
      <div className="flex items-end gap-1.5 border-t border-border p-2.5">
        <EmojiPicker onPick={(e) => setText((t) => t + e)} />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="app-press inline-flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
          aria-label="Attach"
        >
          <Paperclip className="h-5 w-5" />
        </button>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept="image/*,video/*,.pdf,.doc,.docx,.xlsx,.csv,.txt"
          className="hidden"
          onChange={(e) => onFiles(e.target.files)}
        />
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            sendTyping?.();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          rows={1}
          enterKeyHint="send"
          placeholder="Message… (links, emoji & files supported)"
          className="max-h-28 flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring"
        />
        <button
          onClick={onSend}
          disabled={uploading || (!text.trim() && pending.length === 0)}
          className="app-press inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-navy text-primary-foreground transition-transform hover:opacity-90 active:scale-90 disabled:opacity-40"
          aria-label="Send"
        >
          <Send className="h-5 w-5" />
        </button>
      </div>

      <AnimatePresence>
        {callOpen && callRoom && <CallModal room={callRoom} onClose={() => setCallOpen(false)} />}
      </AnimatePresence>
    </div>
  );
}

function TypingDots({ reduceMotion }: { reduceMotion: boolean }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-1 w-1 rounded-full bg-success"
          animate={reduceMotion ? undefined : { y: [0, -3, 0] }}
          transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </span>
  );
}

// Backward-compatible coach thread wrapper (used by the staff inbox).
export function ChatThread({ convId, title }: { convId: string | null; title: string }) {
  const { messages, names, loading, send, meId, typingOther, otherOnline, otherLastReadAt, sendTyping } =
    useThread(convId);
  return (
    <ConversationView
      loading={loading}
      messages={messages}
      names={names}
      meId={meId}
      send={send}
      header={{ name: title, subtitle: "Coaching support" }}
      callRoom={convId ? `vkm-${convId}` : null}
      typingOther={typingOther}
      otherOnline={otherOnline}
      otherLastReadAt={otherLastReadAt}
      sendTyping={sendTyping}
    />
  );
}

function AttachmentView({ a, mine }: { a: Attachment; mine: boolean }) {
  if (a.kind === "image") {
    return (
      <a href={a.url} target="_blank" rel="noreferrer">
        <img src={a.url} alt={a.name} loading="lazy" decoding="async" className="max-h-56 w-auto rounded-lg" />
      </a>
    );
  }
  if (a.kind === "video") {
    return <video src={a.url} controls className="max-h-56 w-full rounded-lg" />;
  }
  return (
    <a
      href={a.url}
      target="_blank"
      rel="noreferrer"
      download
      className={cn(
        "flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs",
        mine ? "bg-white/10" : "bg-card",
      )}
    >
      <FileText className="h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{a.name}</span>
      <Download className="h-3.5 w-3.5 shrink-0" />
    </a>
  );
}

const URL_RE = /(https?:\/\/[^\s]+)/g;
function Linkified({ text, mine }: { text: string; mine: boolean }): ReactNode {
  const parts = text.split(URL_RE);
  return (
    <span className="whitespace-pre-wrap break-words">
      {parts.map((p, i) =>
        URL_RE.test(p) ? (
          <a
            key={i}
            href={p}
            target="_blank"
            rel="noreferrer"
            className={cn("underline", mine ? "text-gold" : "text-navy")}
          >
            {p}
          </a>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </span>
  );
}
