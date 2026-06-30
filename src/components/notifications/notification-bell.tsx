import { useState } from "react";
import { Bell, ArrowRight, CheckCheck } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { safeHref } from "@/lib/safe-url";
import type { AppRole } from "@/hooks/use-auth";
import {
  useNotifications,
  groupNotifications,
  notificationMeta,
  type AppNotification,
} from "@/components/notifications/use-notifications";

const SEE_MORE: Record<AppRole, string> = {
  participant: "/participant/notifications",
  coach: "/coach/notifications",
  mentor: "/mentor/notifications",
  super_admin: "/admin/notifications",
};

export function NotificationBell({ role }: { role: AppRole }) {
  const [open, setOpen] = useState(false);
  const { items, unread, markRead, markAllRead } = useNotifications(50);
  const latest = items.slice(0, 10);
  const groups = groupNotifications(latest);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative inline-flex h-11 w-11 items-center justify-center rounded-full text-foreground transition-colors hover:bg-secondary/60"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[9px] font-bold text-navy ring-2 ring-card">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw,360px)] p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-sm font-semibold text-foreground">Notifications</p>
          {unread > 0 && (
            <button
              onClick={() => markAllRead()}
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <CheckCheck className="h-3.5 w-3.5" /> Mark all read
            </button>
          )}
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {latest.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
              <Bell className="h-7 w-7 text-muted-foreground/50" />
              <p className="text-sm font-medium text-foreground">You're all caught up</p>
              <p className="text-xs text-muted-foreground">New updates will appear here.</p>
            </div>
          ) : (
            groups.map((g) => (
              <div key={g.label}>
                <p className="bg-muted/40 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {g.label}
                </p>
                {g.items.map((n) => (
                  <NotifRow key={n.id} n={n} onClick={() => markRead(n.id)} />
                ))}
              </div>
            ))
          )}
        </div>

        <a
          href={SEE_MORE[role]}
          className="flex items-center justify-center gap-1.5 border-t border-border px-4 py-2.5 text-sm font-medium text-[oklch(0.45_0.1_85)] hover:bg-secondary/50"
        >
          See more <ArrowRight className="h-3.5 w-3.5" />
        </a>
      </PopoverContent>
    </Popover>
  );
}

function NotifRow({ n, onClick }: { n: AppNotification; onClick: () => void }) {
  const { Icon, color } = notificationMeta(n.type);
  const inner = (
    <div
      className={cn(
        "flex items-start gap-3 px-4 py-3 transition-colors hover:bg-secondary/50",
        !n.read && "bg-gold/[0.06]",
      )}
    >
      <span
        className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white"
        style={{ background: color }}
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-snug text-foreground">{n.title}</p>
        {n.body && <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{n.body}</p>}
        <p className="mt-1 text-[10px] text-muted-foreground">
          {formatDistanceToNowStrict(new Date(n.created_at), { addSuffix: true })}
        </p>
      </div>
      {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-gold" />}
    </div>
  );
  return safeHref(n.link) ? (
    <a href={safeHref(n.link)} onClick={onClick} className="block" rel="noopener noreferrer">
      {inner}
    </a>
  ) : (
    <button onClick={onClick} className="block w-full text-left">
      {inner}
    </button>
  );
}
