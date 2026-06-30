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
} from "lucide-react";
import type { AppRole } from "@/hooks/use-auth";

export type NavItem = { label: string; to: string; icon: LucideIcon };
export type NavGroup = { label: string; items: NavItem[] };

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
      { label: "Today's Focus", to: "/participant/focus", icon: Target },
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
      { label: "Profile", to: "/participant/profile", icon: UserCircle },
      { label: "Support", to: "/participant/support", icon: LifeBuoy },
      { label: "Settings", to: "/participant/settings", icon: Settings },
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
      { label: "Create Program", to: "/mentor/programs/new", icon: FilePlus },
      { label: "Manage Programs", to: "/mentor/programs", icon: BookCopy },
      { label: "Clone Programs", to: "/mentor/programs/clone", icon: GitBranch },
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
      { label: "Assignments", to: "/mentor/assignments", icon: ClipboardEdit },
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
      { label: "Graduation Approval", to: "/mentor/graduation", icon: GraduationCap },
      { label: "Certificates", to: "/mentor/certificates", icon: Award },
      { label: "Success Stories", to: "/mentor/stories", icon: BadgeCheck },
    ],
  },
  {
    label: "Reports",
    items: [{ label: "Reports", to: "/mentor/reports", icon: FileBarChart }],
  },
  {
    label: "Account",
    items: [
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
      { label: "Programs", to: "/admin/programs", icon: BookCopy },
      { label: "Program Builder", to: "/admin/program-builder", icon: ListChecks },
      { label: "Batches", to: "/admin/batches", icon: Layers3 },
      { label: "LMS", to: "/admin/lms", icon: BookOpen },
      { label: "Storage", to: "/admin/storage", icon: HardDrive },
      { label: "Files", to: "/admin/files", icon: FolderTree },
    ],
  },
  {
    label: "Commerce",
    items: [
      { label: "Payments", to: "/admin/payments", icon: Wallet },
      { label: "Invoices", to: "/admin/invoices", icon: Receipt },
    ],
  },
  {
    label: "Messaging",
    items: [
      { label: "Chat", to: "/admin/chat", icon: MessageCircle },
      { label: "Email", to: "/admin/email", icon: Mailbox },
      { label: "WhatsApp", to: "/admin/whatsapp", icon: MessageSquareMore },
      { label: "SMS", to: "/admin/sms", icon: Phone },
      { label: "Push Notifications", to: "/admin/push", icon: BellRing },
    ],
  },
  {
    label: "Platform",
    items: [
      { label: "Participants", to: "/admin/participants", icon: Users },
      { label: "Coach Performance", to: "/admin/coach-performance", icon: TrendingUp },
      { label: "AI Configurations", to: "/admin/ai", icon: Bot },
      { label: "API Keys", to: "/admin/api-keys", icon: KeyRound },
      { label: "Database", to: "/admin/database", icon: Database },
      { label: "Integrations", to: "/admin/integrations", icon: Plug },
      { label: "CRM", to: "/admin/crm", icon: Users },
      { label: "Backup", to: "/admin/backup", icon: ArrowDownToLine },
      { label: "Feature Flags", to: "/admin/feature-flags", icon: FlaskConical },
      { label: "Branding", to: "/admin/branding", icon: Sparkles },
      { label: "Exports", to: "/admin/exports", icon: FileSpreadsheet },
      { label: "Support", to: "/admin/support", icon: LifeBuoy },
      { label: "Profile", to: "/admin/profile", icon: UserCircle },
      { label: "Settings", to: "/admin/settings", icon: Cog },
    ],
  },
  {
    label: "VK Operations",
    items: [
      { label: "Admissions", to: "/admin/vk-ops/admissions", icon: ClipboardSignature },
      { label: "Payment Verification", to: "/admin/vk-ops/payments", icon: BadgeIndianRupee },
      { label: "Batch Allocation", to: "/admin/vk-ops/allocation", icon: Layers3 },
      { label: "Coach Assignment", to: "/admin/vk-ops/coach-assign", icon: UsersRound },
      { label: "Onboarding", to: "/admin/vk-ops/onboarding", icon: ConciergeBell },
      { label: "Welcome Kit", to: "/admin/vk-ops/welcome-kit", icon: Package },
      { label: "WhatsApp Groups", to: "/admin/vk-ops/whatsapp-groups", icon: MessageSquareMore },
      { label: "Participant Support", to: "/admin/vk-ops/support", icon: LifeBuoy },
      { label: "Certificate Printing", to: "/admin/vk-ops/printing", icon: Printer },
      { label: "Gift Dispatch", to: "/admin/vk-ops/gifts", icon: Gift },
      { label: "Event Management", to: "/admin/vk-ops/events", icon: PartyPopper },
      { label: "Graduation Planning", to: "/admin/vk-ops/graduation", icon: GraduationCap },
      { label: "Alumni Management", to: "/admin/vk-ops/alumni", icon: HeartHandshake },
      { label: "Feedback / NPS", to: "/admin/vk-ops/feedback", icon: ClipboardCheck },
      { label: "Success Stories", to: "/admin/vk-ops/stories", icon: BadgeCheck },
      { label: "Campaign Management", to: "/admin/vk-ops/campaigns", icon: Send },
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
