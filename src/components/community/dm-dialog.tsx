import { useEffect, useRef, useState } from "react";
import { Send, Loader2, Lock } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { MemberAvatar } from "@/components/community/member-avatar";
import { useDmThread, type Member } from "@/components/community/community-data";

export function DmDialog({
  open,
  onOpenChange,
  member,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  member: Pick<Member, "id" | "name" | "avatar" | "allowMessages" | "mock"> | null;
}) {
  const { user } = useAuth();
  const { messages, send, loading } = useDmThread(
    open && member && !member.mock ? member.id : null,
  );
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function onSend() {
    if (!text.trim()) return;
    setBusy(true);
    const body = text;
    setText("");
    await send(body);
    setBusy(false);
  }

  const blocked = member && (!member.allowMessages || member.mock);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[80vh] max-w-lg flex-col p-0">
        <DialogHeader className="flex-row items-center gap-3 space-y-0 border-b border-border px-4 py-3">
          {member && <MemberAvatar name={member.name} src={member.avatar} size={36} />}
          <DialogTitle className="text-base">{member?.name ?? "Message"}</DialogTitle>
        </DialogHeader>

        {blocked ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
            <Lock className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">
              {member?.mock ? "Sample member" : "Messages are off"}
            </p>
            <p className="max-w-xs text-xs text-muted-foreground">
              {member?.mock
                ? "This is demo data — 1:1 chat works with real members in the directory."
                : "This member isn't accepting direct messages right now."}
            </p>
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : messages.length === 0 ? (
                <p className="py-8 text-center text-xs text-muted-foreground">
                  Say hello — start the conversation.
                </p>
              ) : (
                messages.map((m) => {
                  const mine = m.senderId === user?.id;
                  return (
                    <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                      <div
                        className={cn(
                          "max-w-[78%] rounded-2xl px-3 py-2 text-sm",
                          mine
                            ? "bg-gradient-navy text-primary-foreground"
                            : "bg-secondary text-foreground",
                        )}
                      >
                        {m.body}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={endRef} />
            </div>

            <div className="flex items-center gap-2 border-t border-border p-3">
              <Input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void onSend();
                  }
                }}
                placeholder="Write a message…"
                className="h-10 flex-1 rounded-xl"
              />
              <Button
                size="icon"
                className="h-10 w-10 shrink-0 rounded-xl bg-gradient-navy text-primary-foreground hover:opacity-90"
                disabled={busy || !text.trim()}
                onClick={onSend}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
