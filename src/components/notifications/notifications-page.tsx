import { motion } from "framer-motion";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { PageHeader } from "@/components/vkm/page-header";
import { EmptyState } from "@/components/vkm/empty-state";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { safeHref } from "@/lib/safe-url";
import {
  useNotifications,
  groupNotifications,
  notificationMeta,
  type AppNotification,
} from "@/components/notifications/use-notifications";

export function NotificationsPage() {
  const { items, unread, loading, markRead, markAllRead } = useNotifications(200);
  const groups = groupNotifications(items);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-5"
    >
      <PageHeader
        eyebrow="Inbox"
        title="Notifications"
        description="Everything that's happened across your VKM journey."
        icon={Bell}
        actions={
          unread > 0 ? (
            <Button variant="outline" className="rounded-full" onClick={() => markAllRead()}>
              <CheckCheck className="h-4 w-4" /> Mark all read
            </Button>
          ) : undefined
        }
      />

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Bell}
          eyebrow="Inbox zero"
          title="You're all caught up"
          description="New mentions, approvals, milestone unlocks, and weekly recaps will land here."
          hint="Updates arrive in real time"
        />
      ) : (
        <div className="mx-auto max-w-2xl space-y-5">
          {groups.map((g) => (
            <div key={g.label}>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {g.label}
              </p>
              <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-vkm">
                {g.items.map((n) => (
                  <Row key={n.id} n={n} onClick={() => markRead(n.id)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

function Row({ n, onClick }: { n: AppNotification; onClick: () => void }) {
  const { Icon, color } = notificationMeta(n.type);
  const inner = (
    <div
      className={cn(
        "flex items-start gap-3 border-b border-border px-4 py-3.5 transition-colors last:border-0 hover:bg-secondary/50",
        !n.read && "bg-gold/[0.06]",
      )}
    >
      <span
        className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white"
        style={{ background: color }}
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-snug text-foreground">{n.title}</p>
        {n.body && <p className="mt-0.5 text-sm leading-snug text-muted-foreground">{n.body}</p>}
        <p className="mt-1 text-[11px] text-muted-foreground">
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
