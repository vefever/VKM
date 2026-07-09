import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Target,
  Calendar,
  ClipboardCheck,
  Activity,
  Users,
  TrendingUp,
  BarChart3,
  Bot,
  MessagesSquare,
  Megaphone,
  BookOpen,
  UploadCloud,
  Trophy,
  Award,
  Gem,
  Star,
  MessageCircle,
  Sparkles,
  ImagePlus,
  GraduationCap,
  Gift,
  UserCircle,
  LifeBuoy,
  Settings,
  ListChecks,
  ShieldCheck,
  ShieldX,
  Coins,
  Footprints,
  StickyNote,
  AlertTriangle,
  FileBarChart,
  GitBranch,
  CalendarClock,
  Layers,
  Layers3,
  UsersRound,
  BookCopy,
  ClipboardEdit,
  BadgeCheck,
  Library,
  Cog,
  Building2,
  KeyRound,
  ListTree,
  Database,
  FolderTree,
  FilePieChart,
  Plug,
  BookmarkCheck,
  Globe,
  Workflow,
  FlaskConical,
  ScrollText,
  Mailbox,
  Phone,
  MessageSquareMore,
  BellRing,
  Receipt,
  Wallet,
  FileSpreadsheet,
  ArrowDownToLine,
  HardDrive,
  FilePlus,
  BadgeIndianRupee,
  Briefcase,
  PartyPopper,
  HeartHandshake,
  MessagesSquare as Mss,
  Megaphone as Mp,
  Printer,
  Package,
  ConciergeBell,
  ClipboardSignature,
  Send,
  Smartphone,
} from "lucide-react";
import type { AppRole } from "@/hooks/use-auth";
import { isPathAllowed, type AccessTier } from "@/lib/vkm/access";

export type NavItem = { label: string; to: string; icon: LucideIcon };
export type NavGroup = { label: string; items: NavItem[] };

/** Keep only the nav groups/items a participant's access tier may open. */
export function navGroupsForTier(groups: NavGroup[], tier: AccessTier): NavGroup[] {
  if (tier === "full") return groups;
  return groups
    .map((g) => ({ ...g, items: g.items.filter((i) => isPathAllowed(tier, i.to)) }))
    .filter((g) => g.items.length > 0);
}

export const PROFILE_PATH: Record<AppRole, string> = {
  participant: "/participant/profile",
  coach: "/coach/profile",
  mentor: "/mentor/profile",
  super_admin: "/admin/profile",
};

export const ROLE_BASE: Record<AppRole, string> = {
  participant: "/participant",
  coach: "/coach",
  mentor: "/mentor",
  super_admin: "/admin",
};

export const ROLE_LABEL: Record<AppRole, string> = {
  participant: "Participant",
  coach: "Coach",
  mentor: "Mentor",
  super_admin: "Super Admin",
};

export const PARTICIPANT_NAV: NavGroup[] = [
  {
    label: "Today",
    items: [
      { label: "Dashboard", to: "/participant", icon: LayoutDashboard },
      { label: "Calendar", to: "/participant/calendar", icon: Calendar },
    ],
  },
  {
    label: "Growth",
    items: [
      { label: "Program Progress", to: "/participant/progress", icon: TrendingUp },
      { label: "Daily Habits", to: "/participant/habits", icon: Activity },
      { label: "Submit Proof", to: "/participant/proof", icon: UploadCloud },
    ],
  },
  {
    label: "Business",
    items: [
      { label: "My Business", to: "/participant/business", icon: Briefcase },
      { label: "AI Business Advisor", to: "/participant/advisor", icon: Bot },
      { label: "Vision Board", to: "/participant/vision", icon: ImagePlus },
    ],
  },
  {
    label: "Community",
    items: [
      { label: "Coach Chat", to: "/participant/chat", icon: MessageCircle },
      { label: "Community", to: "/participant/community", icon: MessagesSquare },
    ],
  },
  {
    label: "Recognition",
    items: [
      { label: "Leaderboard", to: "/participant/leaderboard", icon: Trophy },
      { label: "Milestones & Rewards", to: "/participant/milestones", icon: Star },
      { label: "Certificates", to: "/participant/certificates", icon: Award },
    ],
  },
  {
    label: "Account",
    items: [
      { label: "Profile & settings", to: "/participant/profile", icon: UserCircle },
      { label: "Support", to: "/participant/support", icon: LifeBuoy },
    ],
  },
];

export const COACH_NAV: NavGroup[] = [
  {
    label: "Today",
    items: [
      { label: "Dashboard", to: "/coach", icon: LayoutDashboard },
      { label: "Proof Reviews", to: "/coach/approve", icon: ShieldCheck },
      { label: "Chat", to: "/coach/chat", icon: MessageCircle },
      { label: "Coach Calendar", to: "/coach/calendar", icon: Calendar },
    ],
  },
  {
    label: "Participants",
    items: [
      { label: "Cohort Overview", to: "/coach/cohort", icon: LayoutDashboard },
      { label: "My Participants", to: "/coach/participants", icon: Users },
      { label: "Habits & Activity", to: "/coach/health", icon: Activity },
    ],
  },
  {
    label: "Performance",
    items: [{ label: "Coach Performance", to: "/coach/leaderboard", icon: Trophy }],
  },
  {
    label: "Account",
    items: [{ label: "Profile", to: "/coach/profile", icon: UserCircle }],
  },
];

export const MENTOR_NAV: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { label: "Dashboard", to: "/mentor", icon: LayoutDashboard },
      { label: "AI Insights", to: "/mentor/insights", icon: Sparkles },
      { label: "Analytics", to: "/mentor/analytics", icon: BarChart3 },
    ],
  },
  {
    label: "Programs & Batches",
    items: [
      { label: "Manage Programs", to: "/mentor/programs", icon: BookCopy },
      { label: "Clone Programs", to: "/mentor/programs/clone", icon: GitBranch },
      { label: "Program Builder", to: "/mentor/program-builder", icon: ListChecks },
      { label: "Videos & Files", to: "/mentor/program-content", icon: FilePlus },
      { label: "Manage Batches", to: "/mentor/batches", icon: Layers3 },
      { label: "Schedule Live Classes", to: "/mentor/classes", icon: CalendarClock },
      { label: "Zoom Meetings", to: "/mentor/meetings", icon: Calendar },
    ],
  },
  {
    label: "People",
    items: [
      { label: "Cohort Overview", to: "/mentor/cohort", icon: LayoutDashboard },
      { label: "Coaches", to: "/mentor/coaches", icon: UsersRound },
      { label: "Participants", to: "/mentor/participants", icon: Users },
      { label: "Coach Performance", to: "/mentor/coach-performance", icon: TrendingUp },
      { label: "Participant Performance", to: "/mentor/participant-performance", icon: TrendingUp },
    ],
  },
  {
    label: "Content",
    items: [
      { label: "Upload Content", to: "/mentor/content", icon: UploadCloud },
      { label: "Announcements", to: "/mentor/announcements", icon: Megaphone },
      { label: "Chat", to: "/mentor/chat", icon: MessageCircle },
      { label: "Community", to: "/mentor/community", icon: MessagesSquare },
    ],
  },
  {
    label: "Recognition",
    items: [
      { label: "Leaderboards", to: "/mentor/leaderboards", icon: Trophy },
      { label: "Review Cohorts", to: "/mentor/cohorts", icon: ListTree },
      { label: "Graduation & Recognition", to: "/mentor/graduation", icon: GraduationCap },
    ],
  },
  {
    label: "Reports",
    items: [{ label: "Reports", to: "/mentor/reports", icon: FileBarChart }],
  },
  {
    label: "Account",
    items: [
      { label: "Support", to: "/mentor/support", icon: LifeBuoy },
      { label: "Profile", to: "/mentor/profile", icon: UserCircle },
      { label: "Settings", to: "/mentor/settings", icon: Settings },
    ],
  },
];

export const ADMIN_NAV: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { label: "System Overview", to: "/admin", icon: LayoutDashboard },
      { label: "Analytics", to: "/admin/analytics", icon: BarChart3 },
      { label: "Reports", to: "/admin/reports", icon: FileBarChart },
    ],
  },
  {
    label: "Users & Access",
    items: [
      { label: "User Management", to: "/admin/users", icon: Users },
      { label: "Security", to: "/admin/security", icon: ShieldCheck },
    ],
  },
  {
    label: "Academy",
    items: [
      { label: "Manage Programs", to: "/admin/programs-hub", icon: GitBranch },
      { label: "Videos & Files", to: "/admin/programs", icon: BookCopy },
      { label: "Program Builder", to: "/admin/program-builder", icon: ListChecks },
      { label: "Batches", to: "/admin/batches", icon: Layers3 },
      { label: "LMS", to: "/admin/lms", icon: BookOpen },
      { label: "Storage", to: "/admin/storage", icon: HardDrive },
      { label: "Files", to: "/admin/files", icon: FolderTree },
    ],
  },
  {
    label: "Messaging",
    items: [
      { label: "Chat", to: "/admin/chat", icon: MessageCircle },
      { label: "Email", to: "/admin/email", icon: Mailbox },
      { label: "WhatsApp", to: "/admin/whatsapp", icon: MessageSquareMore },
      { label: "SMS", to: "/admin/sms", icon: Phone },
    ],
  },
  {
    label: "Platform",
    items: [
      { label: "Participants", to: "/admin/participants", icon: Users },
      { label: "Coach Performance", to: "/admin/coach-performance", icon: TrendingUp },
      { label: "AI Configurations", to: "/admin/ai", icon: Bot },
      { label: "VK Knowledge Base", to: "/admin/knowledge", icon: BookOpen },
      { label: "Integrations", to: "/admin/integrations", icon: Plug },
      { label: "Workflow & Automation", to: "/admin/automation", icon: Workflow },
      { label: "Installable App", to: "/admin/pwa", icon: Smartphone },
      { label: "SEO & Analytics", to: "/admin/seo", icon: Globe },
      { label: "Support", to: "/admin/support", icon: LifeBuoy },
      { label: "Profile", to: "/admin/profile", icon: UserCircle },
      { label: "Settings", to: "/admin/settings", icon: Cog },
    ],
  },
  {
    label: "VK Operations",
    items: [
      { label: "Coach Assignment", to: "/admin/vk-ops/coach-assign", icon: UsersRound },
      { label: "Participant Support", to: "/admin/vk-ops/support", icon: LifeBuoy },
      { label: "Graduation & Recognition", to: "/admin/vk-ops/graduation", icon: GraduationCap },
      { label: "Alumni", to: "/admin/vk-ops/alumni", icon: HeartHandshake },
      { label: "Operational Reports", to: "/admin/vk-ops/reports", icon: FilePieChart },
    ],
  },
];

export const NAV_BY_ROLE: Record<AppRole, NavGroup[]> = {
  participant: PARTICIPANT_NAV,
  coach: COACH_NAV,
  mentor: MENTOR_NAV,
  super_admin: ADMIN_NAV,
};
