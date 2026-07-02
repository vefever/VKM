import { useEffect, useRef, useState } from "react";
import { format, isToday } from "date-fns";
import { Paperclip, Send, Loader2, X, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { uploadAttachment, type Attachment } from "@/components/chat/chat-data";
import { ProofAttachments } from "@/components/participant/proof-attachments";
import { useTicketThread } from "@/components/support/support-data";

type Staged = { id: string; file: File; url: string };

function stamp(iso: string) {
  const d = new Date(iso);
  return isToday(d) ? format(d, "h:mm a") : format(d, "MMM d, h:mm a");
}

// The message conversation + composer for one ticket. Used by both the
// participant view and the staff inbox. `readOnly` hides the composer (e.g. a
// closed ticket for the participant).
export function TicketThread({ ticketId, readOnly }: { ticketId: string; readOnly?: boolean }) {
  const { user } = useAuth();
  const { messages, loading, send } = useTicketThread(ticketId);
  const [text, setText] = useState("");
  const [staged, setStaged] = useState<Staged[]>([]);
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  // Revoke still-staged blob URLs on unmount (abandoned attachments).
  const stagedRef = useRef<Staged[]>([]);
  stagedRef.current = staged;
  useEffect(() => () => stagedRef.current.forEach((s) => URL.revokeObjectURL(s.url)), []);

  function onFiles(list: FileList | null) {
    if (!list) return;
    setStaged((s) => [
      ...s,
      ...Array.from(list).map((f) => ({
        id: `${f.name}-${f.size}-${f.lastModified}`,
        file: f,
        url: URL.createObjectURL(f),
      })),
    ]);
  }
  function removeStaged(id: string) {
    setStaged((s) => {
      const t = s.find((x) => x.id === id);
      if (t) URL.revokeObjectURL(t.url);
      return s.filter((x) => x.id !== id);
    });
  }

  async function submit() {
    if ((!text.trim() && staged.length === 0) || busy || !user) return;
    setBusy(true);
    try {
      const atts: Attachment[] = staged.length
        ? await Promise.all(staged.map((s) => uploadAttachment(user.id, s.file)))
        : [];
      await send(text, atts);
      staged.forEach((s) => URL.revokeObjectURL(s.url));
      setStaged([]);
      setText("");
    } catch (e) {
      toast.error("Couldn't send your message", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4 sm:px-4">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground">
            <MessageSquare className="h-8 w-8 opacity-40" />
            <p className="text-sm">No messages yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((m) => {
              const mine = m.sender_id === user?.id;
              return (
                <div key={m.id} className={cn("flex flex-col", mine ? "items-end" : "items-start")}>
                  {!mine && (
                    <span className="mb-0.5 px-1 text-[11px] font-medium text-muted-foreground">
                      {m.senderName}
                    </span>
                  )}
                  <div
                    className={cn(
                      "max-w-[85%] px-3.5 py-2.5 text-sm leading-relaxed",
                      mine
                        ? "rounded-2xl rounded-tr-md bg-gradient-navy text-primary-foreground shadow-vkm"
                        : "rounded-2xl rounded-tl-md border border-border bg-card text-foreground shadow-sm",
                    )}
                  >
                    {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
                    {m.attachments.length > 0 && (
                      <div className={cn(m.body && "mt-2")}>
                        <ProofAttachments files={m.attachments} />
                      </div>
                    )}
                  </div>
                  <span className="mt-0.5 px-1 text-[10px] text-muted-foreground">
                    {stamp(m.created_at)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Composer */}
      {!readOnly && (
        <div className="border-t border-border bg-card/70 p-2.5 backdrop-blur sm:p-3">
          {staged.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {staged.map((s) => (
                <span
                  key={s.id}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary/50 py-1 pl-2 pr-1 text-xs"
                >
                  <span className="max-w-[140px] truncate">{s.file.name}</span>
                  <button
                    type="button"
                    onClick={() => removeStaged(s.id)}
                    className="inline-flex h-4 w-4 items-center justify-center rounded text-muted-foreground hover:bg-secondary"
                    aria-label="Remove"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2 rounded-2xl border border-border bg-background p-1.5 focus-within:border-gold/50">
            <input
              ref={fileRef}
              type="file"
              multiple
              accept="image/*,.heic,.heif,video/*,.pdf,.doc,.docx,.txt"
              className="hidden"
              onChange={(e) => {
                onFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              aria-label="Attach files"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <Paperclip className="h-4 w-4" />
            </button>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void submit();
                }
              }}
              rows={1}
              placeholder="Write a reply…"
              className="max-h-32 flex-1 resize-none bg-transparent px-1.5 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
            <Button
              onClick={submit}
              disabled={busy || (!text.trim() && staged.length === 0)}
              size="icon"
              aria-label="Send"
              className="h-9 w-9 shrink-0 rounded-xl bg-gradient-navy text-primary-foreground active:scale-95 disabled:opacity-40"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
