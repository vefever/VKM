import { Link, useRouterState, useNavigate, useRouter } from "@tanstack/react-router";
import { type ReactNode, useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppShell } from "@/hooks/use-app-shell";
import { PullToRefresh } from "@/components/vkm/pull-to-refresh";
import { OfflineBanner } from "@/components/vkm/offline-banner";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { LogOut, Search, ChevronsUpDown, ChevronDown, Command as CmdIcon, UserCircle } from "lucide-react";
import { useAuth, type AppRole } from "@/hooks/use-auth";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { NAV_BY_ROLE, PROFILE_PATH, ROLE_BASE, ROLE_LABEL } from "@/components/vkm/nav-config";
import { VKMLogo } from "@/components/vkm/logo";
import { cn } from "@/lib/utils";
import { CommandMenu } from "@/components/vkm/command-menu";
import { MobileTabBar } from "@/components/vkm/mobile-tab-bar";

function VKMSidebar({ role }: { role: AppRole }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const groups = NAV_BY_ROLE[role];
  // #5 — remember which sidebar sections the user collapsed (per device).
  const [closedGroups, setClosedGroups] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") return {};
    try {
      return JSON.parse(localStorage.getItem("vkm.sidebar.closedGroups.v1") || "{}");
    } catch {
      return {};
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("vkm.sidebar.closedGroups.v1", JSON.stringify(closedGroups));
    } catch {
      /* ignore */
    }
  }, [closedGroups]);

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        {collapsed ? <VKMLogo showWordmark={false} /> : <VKMLogo />}
      </SidebarHeader>
      <SidebarContent className="px-2 py-3">
        {groups.map((g) => {
          const groupClosed = !collapsed && closedGroups[g.label];
          return (
            <SidebarGroup key={g.label} className="mb-1">
              {!collapsed && (
                <button
                  type="button"
                  onClick={() => setClosedGroups((p) => ({ ...p, [g.label]: !p[g.label] }))}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-1 transition-colors hover:bg-sidebar-accent/40"
                >
                  <SidebarGroupLabel className="px-0 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground md:text-[11px]">
                    {g.label}
                  </SidebarGroupLabel>
                  <ChevronDown
                    className={cn(
                      "h-3.5 w-3.5 text-muted-foreground transition-transform",
                      groupClosed && "-rotate-90",
                    )}
                  />
                </button>
              )}
              {!groupClosed && (
                <SidebarGroupContent>
                  <SidebarMenu>
                    {g.items.map((item) => {
                      const active = pathname === item.to;
                      return (
                        <SidebarMenuItem key={item.to}>
                          <SidebarMenuButton
                            asChild
                            isActive={active}
                            tooltip={item.label}
                            className={cn(
                              "group/nav relative rounded-xl transition-all duration-300",
                              active &&
                                "bg-gradient-navy !text-primary-foreground shadow-vkm hover:bg-gradient-navy hover:!text-primary-foreground data-[active=true]:!text-primary-foreground [&_svg]:!text-primary-foreground",
                            )}
                          >
                            <Link
                              to={item.to}
                              aria-current={active ? "page" : undefined}
                              className={cn(
                                "relative flex items-center gap-3",
                                active && "!text-primary-foreground",
                              )}
                            >
                              {active && (
                                <span
                                  aria-hidden
                                  className="absolute -left-2 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-gradient-gold shadow-gold-glow"
                                />
                              )}
                              <item.icon
                                className={cn(
                                  "h-5 w-5 shrink-0 transition-transform duration-300 md:h-4 md:w-4",
                                  "group-hover/nav:scale-110 group-hover/nav:rotate-[-4deg]",
                                )}
                              />
                              <span className="truncate text-[15px] md:text-sm">{item.label}</span>
                              {active && (
                                <span
                                  aria-hidden
                                  className="pointer-events-none absolute inset-y-0 -right-2 w-12 overflow-hidden rounded-r-xl"
                                >
                                  <span className="absolute inset-y-0 -left-6 w-6 -skew-x-12 bg-white/15 animate-shimmer" />
                                </span>
                              )}
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              )}
            </SidebarGroup>
          );
        })}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border px-3 py-3">
        {!collapsed && (
          <div className="rounded-xl bg-gradient-navy p-3 text-primary-foreground shadow-vkm">
            <p className="text-xs font-semibold">VKM Pro</p>
            <p className="mt-0.5 text-[11px] text-primary-foreground/70">
              Premium coaching OS · v1.0
            </p>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}

function RoleSwitcher() {
  const { roles, primaryRole } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // Detect current portal from path
  const current: AppRole = pathname.startsWith("/admin")
    ? "super_admin"
    : pathname.startsWith("/mentor")
      ? "mentor"
      : pathname.startsWith("/coach")
        ? "coach"
        : "participant";

  if (roles.length <= 1) {
    return (
      <span className="hidden rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-vkm md:inline-flex">
        {ROLE_LABEL[primaryRole ?? "participant"]} portal
      </span>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="hidden rounded-full md:inline-flex">
          {ROLE_LABEL[current]} portal
          <ChevronsUpDown className="ml-1.5 h-3.5 w-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>Switch portal</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={current}
          onValueChange={(v) => navigate({ to: ROLE_BASE[v as AppRole] })}
        >
          {roles.map((r) => (
            <DropdownMenuRadioItem key={r} value={r}>
              {ROLE_LABEL[r]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TopBar({ onOpenCommand, role }: { onOpenCommand: () => void; role: AppRole }) {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const name = profile?.full_name ?? user?.email ?? "Guest";
  const initials = (name || "?")
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header
      className="sticky top-0 z-30 flex items-center gap-2 border-b border-border glass px-3 sm:px-6 pt-safe"
      style={{ minHeight: "calc(4rem + env(safe-area-inset-top))" }}
    >
      {/* Mobile: brand only (the sidebar toggle is redundant — "More" tab opens it) */}
      <div className="md:hidden">
        <VKMLogo />
      </div>
      {/* Desktop: sidebar toggle */}
      <SidebarTrigger className="hidden h-11 w-11 rounded-xl md:flex" />
      <button
        onClick={onOpenCommand}
        className="group ml-1 hidden h-9 flex-1 max-w-md items-center gap-2 rounded-full border border-border bg-card px-4 text-left text-sm text-muted-foreground shadow-vkm transition-all hover:-translate-y-px hover:border-gold/40 hover:shadow-vkm-float md:flex"
      >
        <Search className="h-4 w-4 transition-transform group-hover:scale-110" />
        <span>Search VKM…</span>
        <span className="ml-auto inline-flex items-center gap-1 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium">
          <CmdIcon className="h-3 w-3" /> K
        </span>
      </button>
      <div className="ml-auto flex items-center gap-2">
        <RoleSwitcher />
        <NotificationBell role={role} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex min-h-11 items-center gap-2 rounded-full border border-border bg-card p-1.5 pr-3 shadow-vkm transition-all hover:-translate-y-px hover:border-gold/40 hover:shadow-vkm-float">
              <Avatar className="h-8 w-8 ring-2 ring-gold/30 transition-transform hover:scale-105">
                <AvatarImage src={profile?.avatar_url ?? undefined} />
                <AvatarFallback className="bg-gradient-navy text-[11px] font-semibold text-primary-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="hidden text-sm font-medium text-foreground sm:inline">{name}</span>
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <p className="text-sm font-semibold">{name}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate({ to: PROFILE_PATH[role] })}>
              <UserCircle className="mr-2 h-4 w-4" /> Profile photo & settings
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={async () => {
                await signOut();
                navigate({ to: "/auth" });
              }}
            >
              <LogOut className="mr-2 h-4 w-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

// #3 — slide route content while the header + bottom nav stay mounted (#2).
// Desktop pointer users get no wrapper (identical to today).
function RouteTransition({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { appShell, reducedMotion } = useAppShell();
  if (!appShell || reducedMotion) return <>{children}</>;
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial={{ opacity: 0, x: 14 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -14 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

export function AppShell({ role, children }: { role: AppRole; children: ReactNode }) {
  const [cmdOpen, setCmdOpen] = useState(false);
  const router = useRouter();
  // #16 — re-run route loaders + signal data hooks to refetch.
  const refresh = useCallback(async () => {
    window.dispatchEvent(new Event("vkm:refresh"));
    await router.invalidate();
    await new Promise((r) => setTimeout(r, 400));
  }, [router]);

  return (
    <SidebarProvider>
      <OfflineBanner />
      <div data-app-root className="flex min-h-screen-mobile w-full bg-background">
        <VKMSidebar role={role} />
        <div className="flex min-h-screen-mobile min-w-0 flex-1 flex-col">
          <TopBar onOpenCommand={() => setCmdOpen(true)} role={role} />
          <main className="flex-1 overflow-x-hidden px-4 py-6 sm:px-8 sm:py-8 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-8">
            <div className="min-w-0 w-full">
              <PullToRefresh onRefresh={refresh}>
                <RouteTransition>{children}</RouteTransition>
              </PullToRefresh>
            </div>
          </main>
        </div>
        <MobileTabBar role={role} />
      </div>
      <CommandMenu role={role} open={cmdOpen} onOpenChange={setCmdOpen} />
    </SidebarProvider>
  );
}
