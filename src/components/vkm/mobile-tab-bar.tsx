import { Link, useRouterState } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  LayoutDashboard,
  Calendar,
  Bell,
  UserCircle,
  Menu,
  Target,
  Activity,
  Upload,
  Sparkles,
  BarChart3,
  Users,
  Cog,
  type LucideIcon,
} from "lucide-react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { NAV_BY_ROLE, ROLE_BASE, navGroupsForTier } from "@/components/vkm/nav-config";
import type { AppRole } from "@/hooks/use-auth";
import { useAccessTier } from "@/hooks/use-access-tier";
import { MessagesSquare, Briefcase, LifeBuoy } from "lucide-react";
import type { AccessTier } from "@/lib/vkm/access";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/haptics";
import { useBackDismiss } from "@/hooks/use-back-dismiss";

type Tab = { label: string; to: string; icon: LucideIcon };

// #27 — fixed tabs; everything else lives in the "More" bottom sheet.
function tabsFor(role: AppRole, tier: AccessTier): Tab[] {
  const base = ROLE_BASE[role];
  if (role === "participant") {
    // Restricted tiers get tabs only for pages they can open.
    if (tier === "community") {
      return [{ label: "Community", to: `${base}/community`, icon: MessagesSquare }];
    }
    if (tier === "alumni") {
      return [
        { label: "Community", to: `${base}/community`, icon: MessagesSquare },
        { label: "Business", to: `${base}/business`, icon: Briefcase },
        { label: "Support", to: `${base}/support`, icon: LifeBuoy },
      ];
    }
    return [
      { label: "Home", to: base, icon: LayoutDashboard },
      { label: "Habits", to: `${base}/habits`, icon: Activity },
      { label: "Focus", to: `${base}/focus`, icon: Target },
    ];
  }
  if (role === "coach") {
    return [
      { label: "Home", to: base, icon: LayoutDashboard },
      { label: "Calendar", to: `${base}/calendar`, icon: Calendar },
      { label: "Inbox", to: `${base}/notifications`, icon: Bell },
      { label: "Profile", to: `${base}/profile`, icon: UserCircle },
    ];
  }
  if (role === "mentor") {
    return [
      { label: "Home", to: base, icon: LayoutDashboard },
      { label: "Insights", to: `${base}/insights`, icon: Sparkles },
      { label: "Analytics", to: `${base}/analytics`, icon: BarChart3 },
      { label: "Profile", to: `${base}/profile`, icon: UserCircle },
    ];
  }
  return [
    { label: "Home", to: base, icon: LayoutDashboard },
    { label: "Users", to: `${base}/users`, icon: Users },
    { label: "Analytics", to: `${base}/analytics`, icon: BarChart3 },
    { label: "Settings", to: `${base}/settings`, icon: Cog },
  ];
}

// #31 — the prominent raised center action (participants submit proof most often).
// Only full-access participants submit proofs.
function centerFor(role: AppRole, tier: AccessTier): Tab | null {
  if (role === "participant" && tier === "full")
    return { label: "Submit", to: "/participant/proof", icon: Upload };
  return null;
}

export function MobileTabBar({ role }: { role: AppRole }) {
  const { tier } = useAccessTier();
  const tabs = tabsFor(role, tier);
  const center = centerFor(role, tier);
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <nav
      aria-label="Primary"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 md:hidden"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0px)" }}
    >
      <div className="pointer-events-auto mx-3 mb-2 grid grid-cols-5 gap-1 rounded-2xl border border-border/70 glass px-2 py-2 shadow-vkm-float">
        {center ? (
          <>
            <TabLink tab={tabs[0]} />
            <TabLink tab={tabs[1]} />
            <CenterAction tab={center} />
            <TabLink tab={tabs[2]} />
            <MoreButton onClick={() => setMoreOpen(true)} />
          </>
        ) : (
          <>
            {tabs.map((t) => (
              <TabLink key={t.to} tab={t} />
            ))}
            <MoreButton onClick={() => setMoreOpen(true)} />
          </>
        )}
      </div>

      <MoreSheet role={role} tier={tier} open={moreOpen} onOpenChange={setMoreOpen} />
    </nav>
  );
}

function TabLink({ tab }: { tab: Tab }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const reducedMotion = useReducedMotion();
  const active = pathname === tab.to;
  return (
    <Link
      to={tab.to}
      onClick={() => {
        haptic("light");
        // Tapping the tab you're already on scrolls back to the top, the way
        // every native tab bar behaves. Without it the tap does nothing at all.
        if (active) window.scrollTo({ top: 0, behavior: "smooth" });
      }}
      aria-current={active ? "page" : undefined}
      className={cn(
        "app-press relative flex h-14 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold",
        active ? "text-primary-foreground" : "text-muted-foreground",
      )}
    >
      {active && (
        <motion.span
          layoutId="tab-indicator"
          aria-hidden
          className="absolute inset-0 rounded-xl bg-gradient-navy shadow-vkm"
          transition={{ type: "spring", stiffness: 420, damping: 34 }}
        />
      )}
      {/* Springy pop when a tab becomes active — the low damping gives the
          icon a small native-style overshoot. */}
      <motion.span
        className="relative z-10"
        animate={reducedMotion ? undefined : { scale: active ? 1.12 : 1, y: active ? -1 : 0 }}
        transition={{ type: "spring", stiffness: 420, damping: 16 }}
      >
        <tab.icon className="h-5 w-5" />
      </motion.span>
      <span className="relative z-10 leading-none">{tab.label}</span>
    </Link>
  );
}

// Two different things are called "submitting proof": the daily habit proofs and
// the weekly task proof. The button used to jump straight to the weekly form,
// which is the less frequent of the two, so daily submitters landed on the wrong
// screen. It now asks which.
const SUBMIT_OPTIONS = [
  {
    to: "/participant/habits",
    icon: Activity,
    label: "Daily proof",
    hint: "Today's habits — walking, water, meditation…",
  },
  {
    to: "/participant/proof",
    icon: Upload,
    label: "Weekly proof",
    hint: "This week's task proof for your coach",
  },
] as const;

function CenterAction({ tab }: { tab: Tab }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const closeForNavigation = useBackDismiss(open, close);

  return (
    <div className="flex flex-col items-center justify-end">
      <button
        type="button"
        onClick={() => {
          haptic("medium");
          setOpen(true);
        }}
        aria-label={tab.label}
        className="app-press -mt-7 inline-flex h-14 w-14 items-center justify-center rounded-full bg-gradient-gold text-navy shadow-gold-glow ring-4 ring-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy"
      >
        <tab.icon className="h-6 w-6" />
      </button>
      <span className="mt-0.5 text-[10px] font-semibold text-muted-foreground">{tab.label}</span>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent>
          <DrawerHeader className="pb-2">
            <DrawerTitle>What are you submitting?</DrawerTitle>
          </DrawerHeader>
          <div className="space-y-2 px-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
            {SUBMIT_OPTIONS.map((o) => (
              <Link
                key={o.to}
                to={o.to}
                onClick={() => {
                  haptic("light");
                  // Order matters: mark the close as a navigation *before* it
                  // happens, or unwinding the sheet's history entry can pop the
                  // route we're about to push. Tapping the page you're already
                  // on pushes nothing, so there it stays a plain close.
                  if (pathname !== o.to) closeForNavigation();
                  setOpen(false);
                }}
                className="app-press flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 text-left transition-colors hover:bg-secondary/50"
              >
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-navy text-primary-foreground">
                  <o.icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-foreground">{o.label}</span>
                  <span className="block truncate text-xs text-muted-foreground">{o.hint}</span>
                </span>
              </Link>
            ))}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

function MoreButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={() => {
        haptic("light");
        onClick();
      }}
      className="app-press flex h-14 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
      aria-label="Open menu"
    >
      <Menu className="h-5 w-5" />
      <span className="leading-none">More</span>
    </button>
  );
}

// #27 / #28 — overflow navigation as a slide-up bottom sheet (drag handle + snap via vaul).
function MoreSheet({
  role,
  tier,
  open,
  onOpenChange,
}: {
  role: AppRole;
  tier: AccessTier;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const groups =
    role === "participant" ? navGroupsForTier(NAV_BY_ROLE[role], tier) : NAV_BY_ROLE[role];

  // Back used to navigate the page underneath and leave this sheet sitting on
  // top of the new screen. It now dismisses the sheet, as on Android/iOS.
  const close = useCallback(() => onOpenChange(false), [onOpenChange]);
  const closeForNavigation = useBackDismiss(open, close);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[82vh]">
        <DrawerHeader className="pb-2">
          <DrawerTitle>All sections</DrawerTitle>
        </DrawerHeader>
        <div
          className="min-h-0 flex-1 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]"
          data-selectable
        >
          {groups.map((g) => (
            <div key={g.label} className="mb-4">
              <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {g.label}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {g.items.map((item) => {
                  const active = pathname === item.to;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => {
                        haptic("light");
                        if (!active) closeForNavigation();
                        onOpenChange(false);
                      }}
                      className={cn(
                        "app-press flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors",
                        active
                          ? "border-transparent bg-gradient-navy text-primary-foreground shadow-vkm"
                          : "border-border bg-card text-foreground hover:bg-secondary/50",
                      )}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
