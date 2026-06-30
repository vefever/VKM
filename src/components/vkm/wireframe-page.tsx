import { type ReactNode, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useRouterState } from "@tanstack/react-router";
import {
  Search,
  Filter,
  Plus,
  Download,
  Upload,
  MoreHorizontal,
  Check,
  X,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Bell,
  Pin,
  ListTodo,
  Trophy,
  BellRing,
  BarChart3,
  LayoutGrid,
  Rows3,
  Inbox,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { SectionCard } from "@/components/vkm/section-card";
import { KpiTile } from "@/components/vkm/kpi-tile";
import { EmptyState, type EmptyStateProps } from "@/components/vkm/empty-state";
import { cn } from "@/lib/utils";

// ---------- Empty-state presets per module ----------
type EmptyKind = "table" | "list" | "grid" | "feed" | "chart";
function presetFor(pathname: string, kind: EmptyKind): EmptyStateProps {
  if (/leaderboard/i.test(pathname)) {
    return {
      icon: Trophy,
      eyebrow: "Leaderboard is warming up",
      title: "No scores posted yet",
      description: "The board fills up as your cohort completes the first weekly check-in.",
      primaryAction: { label: "Invite teammates", icon: Plus },
      secondaryAction: { label: "View scoring rules" },
      hint: "Updates live every Monday at 9:00",
    };
  }
  if (/notification|inbox/i.test(pathname)) {
    return {
      icon: BellRing,
      eyebrow: "Inbox zero",
      title: "You're all caught up",
      description: "New mentions, milestone unlocks, and weekly recaps will land here.",
      primaryAction: { label: "Notification settings" },
      secondaryAction: { label: "View archive" },
      hint: "Quiet hours respected · 9pm – 7am",
    };
  }
  if (/task|focus|weekly/i.test(pathname)) {
    return {
      icon: ListTodo,
      eyebrow: "No tasks this week",
      title: "Your week is wide open",
      description: "Plan a focused week — add 3 outcomes you'll ship and we'll keep score for you.",
      primaryAction: { label: "Add first task", icon: Plus },
      secondaryAction: { label: "Use a template" },
      hint: "Tip · Press ⌘K and type 'task'",
    };
  }
  const fallback: Record<EmptyKind, EmptyStateProps> = {
    table: {
      icon: Rows3,
      title: "Nothing to show",
      description: "Records will appear here as they come in.",
      primaryAction: { label: "Add record", icon: Plus },
    },
    list: {
      icon: Inbox,
      title: "Empty list",
      description: "Items you create or receive will appear here.",
      primaryAction: { label: "Create new", icon: Plus },
    },
    grid: {
      icon: LayoutGrid,
      title: "No items yet",
      description: "Add your first item to populate the grid.",
      primaryAction: { label: "Add item", icon: Plus },
    },
    feed: {
      icon: Sparkles,
      title: "Quiet so far",
      description: "Activity will stream in here once things start moving.",
    },
    chart: {
      icon: BarChart3,
      title: "No data to chart",
      description: "Once events come in we'll graph trends right here.",
    },
  };
  return fallback[kind];
}

// ---------- Types ----------
export type Kpi = {
  label: string;
  value: string;
  delta?: string;
  trend?: "up" | "down" | "flat";
  accent?: "navy" | "gold" | "success" | "warning" | "danger";
  icon?: LucideIcon;
};
export type ActionBtn = {
  label: string;
  icon?: LucideIcon;
  variant?: "default" | "outline" | "secondary";
};
export type TableCol = { key: string; label: string; align?: "left" | "right" };
export type TableRowData = Record<string, string | number>;
export type FeedItem = { who: string; what: string; when: string; tag?: string };
export type ListItem = { title: string; meta?: string; badge?: string; progress?: number };
export type TabSpec =
  | { id: string; label: string; kind: "table"; columns: TableCol[]; rows: TableRowData[] }
  | { id: string; label: string; kind: "list"; items: ListItem[] }
  | { id: string; label: string; kind: "feed"; items: FeedItem[] }
  | { id: string; label: string; kind: "chart"; bars: { label: string; value: number }[] }
  | {
      id: string;
      label: string;
      kind: "form";
      fields: { label: string; type?: string; placeholder?: string }[];
    }
  | { id: string; label: string; kind: "grid"; items: ListItem[] };

export type PageConfig = {
  eyebrow: string;
  title: string;
  description: string;
  icon: LucideIcon;
  actions?: ActionBtn[];
  kpis?: Kpi[];
  tabs?: TabSpec[];
  side?: { title: string; feed: FeedItem[] };
};

// ---------- Helpers ----------
function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// ---------- Sub renderers ----------
function TableView({
  columns,
  rows,
  emptyState,
}: {
  columns: TableCol[];
  rows: TableRowData[];
  emptyState: EmptyStateProps;
}) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    if (!q.trim()) return rows;
    const needle = q.toLowerCase();
    return rows.filter((r) =>
      Object.values(r).some((v) => String(v).toLowerCase().includes(needle)),
    );
  }, [q, rows]);
  if (rows.length === 0) return <EmptyState {...emptyState} />;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search..."
            className="h-10 rounded-xl pl-9"
          />
        </div>
        <Button variant="outline" size="sm" className="rounded-xl">
          <Filter className="h-4 w-4" /> Filter
        </Button>
        <Button variant="outline" size="sm" className="rounded-xl">
          <Download className="h-4 w-4" /> Export
        </Button>
      </div>
      <div className="overflow-hidden rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              {columns.map((c) => (
                <TableHead
                  key={c.key}
                  className={cn(
                    "text-xs uppercase tracking-wider",
                    c.align === "right" && "text-right",
                  )}
                >
                  {c.label}
                </TableHead>
              ))}
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((r, i) => (
              <TableRow key={i} className="group">
                {columns.map((c) => {
                  const v = r[c.key];
                  const isStatus = c.key === "status";
                  return (
                    <TableCell
                      key={c.key}
                      className={cn(c.align === "right" && "text-right tabular-nums")}
                    >
                      {isStatus ? (
                        <StatusBadge value={String(v)} />
                      ) : c.key === "name" ? (
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7">
                            <AvatarFallback className="bg-gradient-navy text-[10px] text-primary-foreground">
                              {initials(String(v))}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{v}</span>
                        </div>
                      ) : (
                        v
                      )}
                    </TableCell>
                  );
                })}
                <TableCell className="text-right">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 rounded-lg opacity-0 group-hover:opacity-100"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={columns.length + 1}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  No results
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function StatusBadge({ value }: { value: string }) {
  const v = value.toLowerCase();
  const tone =
    v.includes("active") ||
    v.includes("approved") ||
    v.includes("paid") ||
    v.includes("completed") ||
    v.includes("on track") ||
    v.includes("delivered") ||
    v.includes("success")
      ? "bg-[oklch(0.93_0.06_160)] text-[oklch(0.35_0.12_160)]"
      : v.includes("pending") ||
          v.includes("review") ||
          v.includes("processing") ||
          v.includes("warning")
        ? "bg-[oklch(0.95_0.08_85)] text-[oklch(0.4_0.12_70)]"
        : v.includes("rejected") ||
            v.includes("failed") ||
            v.includes("risk") ||
            v.includes("overdue") ||
            v.includes("blocked")
          ? "bg-[oklch(0.93_0.06_25)] text-[oklch(0.4_0.16_25)]"
          : "bg-muted text-foreground/80";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        tone,
      )}
    >
      {value}
    </span>
  );
}

function ListView({ items, emptyState }: { items: ListItem[]; emptyState: EmptyStateProps }) {
  if (items.length === 0) return <EmptyState {...emptyState} />;
  return (
    <ul className="divide-y divide-border rounded-xl border border-border bg-card">
      {items.map((it, i) => (
        <li
          key={i}
          className="flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-muted/40"
        >
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-gradient-gold text-navy">
              {initials(it.title)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{it.title}</p>
            {it.meta && <p className="truncate text-xs text-muted-foreground">{it.meta}</p>}
            {typeof it.progress === "number" && (
              <Progress value={it.progress} className="mt-2 h-1.5" />
            )}
          </div>
          {it.badge && (
            <Badge variant="outline" className="rounded-full">
              {it.badge}
            </Badge>
          )}
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </li>
      ))}
    </ul>
  );
}

function GridView({ items, emptyState }: { items: ListItem[]; emptyState: EmptyStateProps }) {
  if (items.length === 0) return <EmptyState {...emptyState} />;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((it, i) => (
        <div
          key={i}
          className="group rounded-2xl border border-border bg-card p-5 shadow-vkm transition-all hover:-translate-y-0.5 hover:shadow-vkm-float"
        >
          <div className="flex items-center justify-between">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-gradient-navy text-primary-foreground">
                {initials(it.title)}
              </AvatarFallback>
            </Avatar>
            {it.badge && (
              <Badge variant="secondary" className="rounded-full">
                {it.badge}
              </Badge>
            )}
          </div>
          <h4 className="mt-4 text-sm font-semibold text-foreground">{it.title}</h4>
          {it.meta && <p className="mt-1 text-xs text-muted-foreground">{it.meta}</p>}
          {typeof it.progress === "number" && (
            <>
              <Progress value={it.progress} className="mt-4 h-1.5" />
              <p className="mt-1.5 text-[11px] text-muted-foreground">{it.progress}% complete</p>
            </>
          )}
          <Button variant="outline" size="sm" className="mt-4 w-full rounded-lg">
            Open <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
    </div>
  );
}

function FeedView({ items, emptyState }: { items: FeedItem[]; emptyState?: EmptyStateProps }) {
  if (items.length === 0 && emptyState) return <EmptyState {...emptyState} />;
  return (
    <ul className="relative space-y-4 border-l border-dashed border-border pl-6">
      {items.map((it, i) => (
        <li key={i} className="relative">
          <span className="absolute -left-[27px] top-1.5 inline-flex h-3 w-3 rounded-full bg-gradient-gold ring-4 ring-card" />
          <p className="text-sm text-foreground">
            <span className="font-semibold">{it.who}</span>{" "}
            <span className="text-muted-foreground">{it.what}</span>
          </p>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" /> {it.when}
            {it.tag && (
              <Badge variant="outline" className="ml-1 rounded-full text-[10px]">
                {it.tag}
              </Badge>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function ChartView({
  bars,
  emptyState,
}: {
  bars: { label: string; value: number }[];
  emptyState: EmptyStateProps;
}) {
  if (bars.length === 0) return <EmptyState {...emptyState} />;
  const max = Math.max(...bars.map((b) => b.value), 1);
  const total = bars.reduce((a, b) => a + b.value, 0) || 1;
  return (
    <TooltipProvider delayDuration={100}>
      <motion.div
        initial="hidden"
        animate="show"
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
        }}
        className="space-y-3"
      >
        {bars.map((b, i) => {
          const pct = (b.value / max) * 100;
          const share = ((b.value / total) * 100).toFixed(1);
          return (
            <motion.div
              key={i}
              variants={{
                hidden: { opacity: 0, x: -8 },
                show: { opacity: 1, x: 0 },
              }}
              className="group/bar"
            >
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-muted-foreground transition-colors group-hover/bar:text-foreground">
                  {b.label}
                </span>
                <span className="font-medium tabular-nums">{b.value}</span>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="relative h-2.5 cursor-pointer overflow-hidden rounded-full bg-muted ring-1 ring-transparent transition-all hover:ring-gold/40">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.9, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
                      className="relative h-full rounded-full bg-gradient-navy"
                    >
                      <span
                        aria-hidden
                        className="absolute inset-y-0 -right-2 w-8 rounded-full bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-0 transition-opacity duration-300 group-hover/bar:opacity-100"
                      />
                    </motion.div>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  <div className="font-semibold">{b.label}</div>
                  <div className="text-muted-foreground">
                    {b.value} · {share}% of total
                  </div>
                </TooltipContent>
              </Tooltip>
            </motion.div>
          );
        })}
      </motion.div>
    </TooltipProvider>
  );
}

export function ChartSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i}>
          <div className="mb-1 flex items-center justify-between">
            <div className="h-3 w-24 animate-pulse rounded bg-muted" />
            <div className="h-3 w-8 animate-pulse rounded bg-muted" />
          </div>
          <div className="relative h-2.5 overflow-hidden rounded-full bg-muted">
            <span className="absolute inset-0 -translate-x-full animate-[vkm-shimmer_1.6s_infinite] bg-gradient-to-r from-transparent via-foreground/10 to-transparent" />
          </div>
        </div>
      ))}
    </div>
  );
}

function FormView({
  fields,
}: {
  fields: { label: string; type?: string; placeholder?: string }[];
}) {
  return (
    <form className="grid grid-cols-1 gap-5 md:grid-cols-2" onSubmit={(e) => e.preventDefault()}>
      {fields.map((f, i) => (
        <div key={i} className={cn("space-y-1.5", f.type === "textarea" && "md:col-span-2")}>
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {f.label}
          </label>
          {f.type === "textarea" ? (
            <textarea
              placeholder={f.placeholder}
              className="min-h-[100px] w-full rounded-xl border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          ) : (
            <Input
              type={f.type || "text"}
              placeholder={f.placeholder}
              className="h-11 rounded-xl"
            />
          )}
        </div>
      ))}
      <div className="md:col-span-2 flex justify-end gap-2 pt-2">
        <Button variant="outline" className="rounded-xl">
          Cancel
        </Button>
        <Button className="rounded-xl bg-gradient-navy text-primary-foreground hover:opacity-90">
          <Check className="h-4 w-4" /> Save changes
        </Button>
      </div>
    </form>
  );
}

// ---------- Main page ----------
export function WireframePage({ config }: { config: PageConfig }) {
  const { eyebrow, title, description, icon: Icon, actions, kpis, tabs, side } = config;
  const [activeTab, setActiveTab] = useState(tabs?.[0]?.id ?? "");
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="space-y-6 md:space-y-8">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-end md:justify-between md:gap-4"
      >
        <div className="flex min-w-0 items-start gap-3 md:gap-4">
          <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-navy text-primary-foreground shadow-vkm-float md:h-14 md:w-14">
            <Icon className="h-5 w-5 md:h-6 md:w-6" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold md:text-xs">
              {eyebrow}
            </p>
            <h1 className="mt-1 text-2xl font-semibold leading-tight tracking-tight text-foreground md:mt-1.5 md:text-3xl">
              {title}
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground md:mt-1.5 md:text-base">
              {description}
            </p>
          </div>
        </div>
        {actions && actions.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {actions.map((a, i) => {
              const Btn = a.icon;
              const variant = a.variant ?? (i === 0 ? "default" : "outline");
              return (
                <Button
                  key={i}
                  variant={variant}
                  className={cn(
                    "h-10 rounded-xl",
                    variant === "default" &&
                      "bg-gradient-navy text-primary-foreground hover:opacity-90",
                  )}
                >
                  {Btn && <Btn className="h-4 w-4" />}
                  <span className="hidden sm:inline">{a.label}</span>
                </Button>
              );
            })}
          </div>
        )}
      </motion.header>

      {/* KPI grid */}
      {kpis && kpis.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {kpis.map((k, i) => (
            <KpiTile key={i} index={i} {...k} />
          ))}
        </div>
      )}

      <div className={cn("grid gap-6", side ? "lg:grid-cols-[1fr_320px]" : "grid-cols-1")}>
        {/* Main panel */}
        <SectionCard
          title={tabs && tabs.length > 1 ? undefined : (tabs?.[0]?.label ?? "Overview")}
          subtitle={tabs && tabs.length > 1 ? undefined : "Live data and recent activity"}
          bodyClassName={tabs && tabs.length > 1 ? "p-0" : undefined}
        >
          {tabs && tabs.length > 1 ? (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <div className="border-b border-border px-5 pt-4">
                <TabsList className="bg-transparent p-0 h-auto gap-1">
                  {tabs.map((t) => (
                    <TabsTrigger
                      key={t.id}
                      value={t.id}
                      className="rounded-lg data-[state=active]:bg-gradient-navy data-[state=active]:text-primary-foreground data-[state=active]:shadow-vkm"
                    >
                      {t.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
              {tabs.map((t) => (
                <TabsContent key={t.id} value={t.id} className="p-5 m-0">
                  <TabContentRenderer tab={t} pathname={pathname} />
                </TabsContent>
              ))}
            </Tabs>
          ) : tabs && tabs.length === 1 ? (
            <TabContentRenderer tab={tabs[0]} pathname={pathname} />
          ) : (
            <EmptyHint />
          )}
        </SectionCard>

        {/* Side feed */}
        {side && (
          <SectionCard
            title={side.title}
            subtitle="Live updates"
            action={<Bell className="h-4 w-4 text-muted-foreground" />}
          >
            <FeedView items={side.feed} />
            <Separator className="my-5" />
            <div className="rounded-xl bg-gradient-to-br from-[oklch(0.97_0.02_85)] to-[oklch(0.95_0.04_75)] p-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-navy">
                <Sparkles className="h-3.5 w-3.5" /> AI Insight
              </div>
              <p className="mt-2 text-sm text-foreground/90">
                Engagement is trending <span className="font-semibold">+12%</span> WoW. Consider
                scheduling a follow-up to maintain momentum.
              </p>
            </div>
          </SectionCard>
        )}
      </div>
    </div>
  );
}

function TabContentRenderer({ tab, pathname }: { tab: TabSpec; pathname: string }) {
  switch (tab.kind) {
    case "table":
      return (
        <TableView
          columns={tab.columns}
          rows={tab.rows}
          emptyState={presetFor(pathname, "table")}
        />
      );
    case "list":
      return <ListView items={tab.items} emptyState={presetFor(pathname, "list")} />;
    case "grid":
      return <GridView items={tab.items} emptyState={presetFor(pathname, "grid")} />;
    case "feed":
      return <FeedView items={tab.items} emptyState={presetFor(pathname, "feed")} />;
    case "chart":
      return <ChartView bars={tab.bars} emptyState={presetFor(pathname, "chart")} />;
    case "form":
      return <FormView fields={tab.fields} />;
  }
}

function EmptyHint() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Pin className="h-8 w-8 text-muted-foreground" />
      <p className="mt-3 text-sm text-muted-foreground">No content configured for this tab.</p>
    </div>
  );
}

export const ICONS = { Plus, Download, Upload, ArrowUpRight, ArrowDownRight, CalendarIcon };
