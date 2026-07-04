import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import {
  Users,
  Search,
  MessageCircle,
  UserCog,
  MapPin,
  Briefcase,
  GraduationCap,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { PageHeader } from "@/components/vkm/page-header";
import { SectionCard } from "@/components/vkm/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { MemberAvatar } from "@/components/community/member-avatar";
import { DmDialog } from "@/components/community/dm-dialog";
import { EditMemberProfileDialog } from "@/components/community/edit-member-profile";
import {
  useMemberDirectory,
  useDmThreads,
  type Member,
  type MemberStatus,
} from "@/components/community/community-data";

type StatusFilter = "all" | MemberStatus;

export function CommunityPage() {
  const { user } = useAuth();
  const { members, loading } = useMemberDirectory();
  const threads = useDmThreads();

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [industry, setIndustry] = useState("all");
  const [dm, setDm] = useState<Member | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const industries = useMemo(
    () => Array.from(new Set(members.map((m) => m.industry).filter(Boolean))) as string[],
    [members],
  );

  const inDirectory = !!user && members.some((m) => m.id === user.id);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return members
      .filter((m) => status === "all" || m.status === status)
      .filter((m) => industry === "all" || m.industry === industry)
      .filter(
        (m) =>
          !needle ||
          `${m.name} ${m.businessName ?? ""} ${m.industry ?? ""} ${m.headline ?? ""} ${m.skills.join(" ")}`
            .toLowerCase()
            .includes(needle),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [members, status, industry, q]);

  const suggested = useMemo(
    () => members.filter((m) => m.id !== user?.id).slice(0, 4),
    [members, user],
  );

  const stats = [
    { label: "Members", value: members.length },
    { label: "Alumni", value: members.filter((m) => m.status === "alumni").length },
    { label: "Active", value: members.filter((m) => m.status === "active").length },
    { label: "Your chats", value: threads.length },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-5"
    >
      <PageHeader
        eyebrow="Community"
        title="VKM Member Network"
        description="Connect with the VKM community — current members and alumni. Find people, view profiles, start a 1:1 chat."
        icon={Users}
        actions={
          <Button
            size="sm"
            className="h-10 rounded-full bg-gradient-navy text-primary-foreground hover:opacity-90"
            onClick={() => setEditOpen(true)}
          >
            <UserCog className="h-4 w-4" /> Edit my profile
          </Button>
        }
      />

      {/* network stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-border bg-card p-3 shadow-vkm">
            <p className="text-2xl font-bold tabular-nums text-foreground">{s.value}</p>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {!inDirectory && !loading && (
        <SectionCard className="border-gold/40 bg-gold/[0.05]">
          <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-gold text-navy">
                <Sparkles className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  You're not in the directory yet
                </p>
                <p className="text-xs text-muted-foreground">
                  Set up your network profile so other members can find and connect with you.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              className="h-10 rounded-lg bg-gradient-navy text-primary-foreground hover:opacity-90"
              onClick={() => setEditOpen(true)}
            >
              Set up profile
            </Button>
          </div>
        </SectionCard>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* directory */}
        <div className="space-y-3">
          {/* search + filters */}
          <div className="space-y-2.5 rounded-2xl border border-border bg-card p-3 shadow-vkm">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search members, business, industry, skills…"
                className="h-10 rounded-xl pl-9"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-full border border-border bg-secondary/40 p-0.5">
                {(["all", "active", "alumni"] as StatusFilter[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    className={cn(
                      "inline-flex min-h-9 items-center rounded-full px-3.5 text-xs font-medium capitalize transition-colors",
                      status === s
                        ? "bg-gradient-navy text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
              {industries.length > 0 && (
                <select
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  className="h-9 rounded-full border border-border bg-card px-3 text-xs text-foreground"
                >
                  <option value="all">All industries</option>
                  {industries.map((i) => (
                    <option key={i} value={i}>
                      {i}
                    </option>
                  ))}
                </select>
              )}
              <span className="ml-auto text-xs text-muted-foreground">
                {filtered.length} {filtered.length === 1 ? "member" : "members"}
              </span>
            </div>
          </div>

          {/* grid */}
          {loading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Loading members…</p>
          ) : filtered.length === 0 ? (
            <SectionCard>
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
                  <Users className="h-5 w-5" />
                </span>
                <p className="text-sm font-medium text-foreground">No members to show yet</p>
                <p className="max-w-xs text-xs text-muted-foreground">
                  Members appear here once they opt into a public profile. Be the first — set yours
                  up.
                </p>
              </div>
            </SectionCard>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {filtered.map((m) => (
                <MemberCard key={m.id} m={m} onMessage={() => setDm(m)} isMe={m.id === user?.id} />
              ))}
            </div>
          )}
        </div>

        {/* right rail */}
        <div className="space-y-5">
          <SectionCard title="My conversations" subtitle="Your 1:1 chats">
            {threads.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">
                No conversations yet — message a member to start.
              </p>
            ) : (
              <div className="space-y-1.5">
                {threads.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() =>
                      setDm({
                        id: t.otherId,
                        name: t.otherName,
                        avatar: t.otherAvatar,
                        allowMessages: true,
                      } as Member)
                    }
                    className="flex w-full items-center gap-2.5 rounded-xl p-2 text-left transition-colors hover:bg-secondary/60"
                  >
                    <MemberAvatar name={t.otherName} src={t.otherAvatar} size={36} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {t.otherName}
                      </span>
                    </span>
                    <MessageCircle className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}
          </SectionCard>

          {suggested.length > 0 && (
            <SectionCard title="Suggested connections" subtitle="People to meet in the network">
              <div className="space-y-1.5">
                {suggested.map((m) => (
                  <div key={m.id} className="flex items-center gap-2.5 rounded-xl p-2">
                    <MemberAvatar name={m.name} src={m.avatar} size={36} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {m.name}
                      </span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {m.industry ?? m.businessName ?? "VKM member"}
                      </span>
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-10 shrink-0 rounded-lg px-3 text-xs"
                      onClick={() => setDm(m)}
                    >
                      Message
                    </Button>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}
        </div>
      </div>

      <DmDialog open={!!dm} onOpenChange={(o) => !o && setDm(null)} member={dm} />
      <EditMemberProfileDialog open={editOpen} onOpenChange={setEditOpen} />
    </motion.div>
  );
}

function MemberCard({ m, onMessage, isMe }: { m: Member; onMessage: () => void; isMe: boolean }) {
  return (
    <div className="flex flex-col rounded-2xl border border-border bg-card p-3 shadow-vkm">
      <div className="flex items-start gap-3">
        <MemberAvatar name={m.name} src={m.avatar} size={48} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-sm font-semibold text-foreground">{m.name}</p>
            <StatusBadge status={m.status} />
          </div>
          {m.headline && (
            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{m.headline}</p>
          )}
        </div>
      </div>

      <div className="mt-2.5 space-y-1 text-[11px] text-muted-foreground">
        {(m.businessName || m.industry) && (
          <p className="flex items-center gap-1.5">
            <Briefcase className="h-3 w-3 shrink-0" />
            <span className="truncate">
              {[m.businessName, m.industry].filter(Boolean).join(" · ")}
            </span>
          </p>
        )}
        {(m.location || m.batchLabel) && (
          <p className="flex items-center gap-1.5">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">
              {[m.location, m.batchLabel].filter(Boolean).join(" · ")}
            </span>
          </p>
        )}
      </div>

      {m.skills.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {m.skills.slice(0, 3).map((s) => (
            <span
              key={s}
              className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground"
            >
              {s}
            </span>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        <Button size="sm" variant="outline" className="h-10 flex-1 rounded-lg text-xs" asChild>
          <Link to="/participant/member/$memberId" params={{ memberId: m.id }}>
            View profile <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
        {!isMe && m.allowMessages && (
          <Button
            size="sm"
            className="h-10 flex-1 rounded-lg bg-gradient-navy text-xs text-primary-foreground hover:opacity-90"
            onClick={onMessage}
          >
            <MessageCircle className="h-3.5 w-3.5" /> Message
          </Button>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: MemberStatus }) {
  const alumni = status === "alumni";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase",
        alumni
          ? "bg-gold/20 text-[oklch(0.5_0.11_80)]"
          : "bg-[oklch(0.93_0.06_160)] text-[oklch(0.35_0.12_160)]",
      )}
    >
      {alumni && <GraduationCap className="h-3 w-3" />}
      {status}
    </span>
  );
}
