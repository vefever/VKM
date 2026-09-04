import { useMemo, useState } from "react";
import { Search, SquarePen, Loader2, MessageCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { AvatarBadge } from "@/components/vkm/avatar-badge";
import { useMemberDirectory, type Member } from "@/components/community/community-data";
import { cn } from "@/lib/utils";

/**
 * "New message" picker — the compose step Messenger has and this inbox didn't.
 *
 * Before this, the Messages page could only show conversations that already
 * existed: to reach someone new you had to leave, find them in the Community
 * directory, and open a DM from there. Starting a conversation is the one thing
 * a chat inbox has to make easy.
 *
 * Only members who allow messages are listed — the directory already carries
 * that flag, and offering someone you can't actually message is a dead end.
 */
export function NewChatDialog({
  open,
  onOpenChange,
  onPick,
  excludeIds,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Called with the chosen member; the caller opens/creates the thread. */
  onPick: (member: Member) => void;
  /** Members already in the inbox — shown under "Recent" rather than hidden,
   *  since picking an existing chat from here is a reasonable thing to do. */
  excludeIds?: Set<string>;
}) {
  const { members, loading } = useMemberDirectory();
  const [q, setQ] = useState("");

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = members.filter((m) => m.allowMessages !== false);
    if (!term) return list;
    // Match on name, business or industry — an owner is often easier to recall
    // by their company than their name.
    return list.filter((m) =>
      `${m.name} ${m.businessName ?? ""} ${m.industry ?? ""} ${m.headline ?? ""}`
        .toLowerCase()
        .includes(term),
    );
  }, [members, q]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-0 overflow-hidden rounded-3xl p-0">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            <SquarePen className="h-4 w-4 text-gold" /> New message
          </DialogTitle>
          <DialogDescription className="text-xs">
            Search the community by name, business or industry.
          </DialogDescription>
        </DialogHeader>

        <div className="border-b border-border px-4 py-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search people…"
              className="h-10 rounded-xl pl-9"
            />
          </div>
        </div>

        <div className="vkm-scroll max-h-[52vh] overflow-y-auto p-2">
          {loading ? (
            <p className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading people…
            </p>
          ) : results.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {q.trim() ? `No one matches “${q.trim()}”.` : "No one to message yet."}
            </p>
          ) : (
            results.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  onPick(m);
                  onOpenChange(false);
                  setQ("");
                }}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors",
                  "hover:bg-secondary/70 focus-visible:bg-secondary/70 focus-visible:outline-none",
                )}
              >
                <AvatarBadge name={m.name} src={m.avatar} className="h-10 w-10" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-foreground">
                    {m.name}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {m.businessName || m.headline || m.industry || "VKM member"}
                  </span>
                </span>
                {excludeIds?.has(m.id) && (
                  <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    <MessageCircle className="mr-1 inline h-3 w-3" />
                    Existing
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
