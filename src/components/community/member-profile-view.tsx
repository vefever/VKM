import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  MessageCircle,
  MapPin,
  Briefcase,
  GraduationCap,
  Users,
  Lock,
  Globe,
  Sparkles,
} from "lucide-react";
import { SectionCard } from "@/components/vkm/section-card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { MemberAvatar } from "@/components/community/member-avatar";
import { DmDialog } from "@/components/community/dm-dialog";
import { useMemberProfile, type Member } from "@/components/community/community-data";

export function MemberProfileView({ memberId }: { memberId: string }) {
  const { user } = useAuth();
  const { member, bio, loading } = useMemberProfile(memberId);
  const [dmOpen, setDmOpen] = useState(false);
  const isMe = user?.id === memberId;

  if (loading) {
    return <p className="py-16 text-center text-sm text-muted-foreground">Loading profile…</p>;
  }
  if (!member) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-muted-foreground">Member not found.</p>
        <Button variant="outline" size="sm" className="mt-3 rounded-lg" asChild>
          <Link to="/participant/community">Back to community</Link>
        </Button>
      </div>
    );
  }

  const canMessage = !isMe && member.allowMessages;
  const hasBusiness =
    member.businessName || member.industry || member.location || member.website || member.usp || member.logoUrl;
  const websiteHref = member.website
    ? /^https?:\/\//i.test(member.website)
      ? member.website
      : `https://${member.website}`
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-4"
    >
      <Link
        to="/participant/community"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Member Network
      </Link>

      {/* header */}
      <div className="overflow-hidden rounded-3xl bg-gradient-navy p-5 text-primary-foreground shadow-vkm-float">
        <div className="flex items-start gap-4">
          <MemberAvatar
            name={member.name}
            src={member.avatar}
            size={72}
            className="ring-2 ring-white/20"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold">{member.name}</h1>
              <StatusBadge status={member.status} />
            </div>
            {member.headline && <p className="mt-0.5 text-sm text-white/80">{member.headline}</p>}
            {(member.location || member.batchLabel) && (
              <p className="mt-1 flex items-center gap-1.5 text-xs text-white/60">
                <MapPin className="h-3 w-3" />
                {[member.location, member.batchLabel].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
        </div>
        {canMessage && (
          <Button
            className="mt-4 w-full rounded-xl bg-white text-navy hover:bg-white/90 sm:w-auto"
            onClick={() => setDmOpen(true)}
          >
            <MessageCircle className="h-4 w-4" /> Message {member.name.split(" ")[0]}
          </Button>
        )}
        {!isMe && !member.allowMessages && (
          <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs text-white/70">
            <Lock className="h-3.5 w-3.5" /> Not accepting messages
          </p>
        )}
      </div>

      {/* about */}
      {bio && (
        <SectionCard title="About">
          <p className="text-sm leading-relaxed text-muted-foreground">{bio}</p>
        </SectionCard>
      )}

      {/* business — auto-pulled from their My Business profile */}
      {hasBusiness && (
        <SectionCard title="Business" subtitle="From their business profile">
          {(member.logoUrl || member.businessName) && (
            <div className="mb-3 flex items-center gap-3">
              {member.logoUrl ? (
                <img
                  src={member.logoUrl}
                  alt={member.businessName ?? "Business logo"}
                  className="h-12 w-12 shrink-0 rounded-xl border border-border object-contain"
                />
              ) : (
                <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-navy text-primary-foreground">
                  <Briefcase className="h-5 w-5" />
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-foreground">
                  {member.businessName ?? "—"}
                </p>
                {member.industry && (
                  <p className="truncate text-xs text-muted-foreground">{member.industry}</p>
                )}
              </div>
            </div>
          )}
          <div className="grid gap-2 sm:grid-cols-3">
            {member.industry && <Detail icon={Users} label="Industry" value={member.industry} />}
            {member.location && <Detail icon={MapPin} label="Location" value={member.location} />}
            {websiteHref && (
              <a href={websiteHref} target="_blank" rel="noreferrer" className="block">
                <div className="rounded-xl border border-border bg-card p-3 transition-colors hover:border-gold/40">
                  <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                    <Globe className="h-3 w-3" /> Website
                  </p>
                  <p className="mt-1 truncate text-sm font-medium text-[#2D8CFF]">
                    {member.website}
                  </p>
                </div>
              </a>
            )}
          </div>
          {member.usp && (
            <div className="mt-2 flex items-start gap-2 rounded-xl bg-secondary/40 p-3">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
              <p className="text-sm text-foreground">{member.usp}</p>
            </div>
          )}
        </SectionCard>
      )}

      {/* journey */}
      <SectionCard title="VKM journey">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground">
            <GraduationCap className="h-3.5 w-3.5" />
            {member.batchLabel ?? "VKM member"}
          </span>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium capitalize",
              member.status === "alumni"
                ? "bg-gold/20 text-[oklch(0.5_0.11_80)]"
                : "bg-[oklch(0.93_0.06_160)] text-[oklch(0.35_0.12_160)]",
            )}
          >
            {member.status}
          </span>
        </div>
      </SectionCard>

      {/* skills */}
      {member.skills.length > 0 && (
        <SectionCard title="Skills & expertise">
          <div className="flex flex-wrap gap-1.5">
            {member.skills.map((s) => (
              <span
                key={s}
                className="rounded-full bg-secondary px-2.5 py-1 text-xs text-muted-foreground"
              >
                {s}
              </span>
            ))}
          </div>
        </SectionCard>
      )}

      <DmDialog open={dmOpen} onOpenChange={setDmOpen} member={member} />
    </motion.div>
  );
}

function Detail({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Briefcase;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </p>
      <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: Member["status"] }) {
  const alumni = status === "alumni";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
        alumni ? "bg-gold/25 text-gold" : "bg-white/15 text-white",
      )}
    >
      {alumni && <GraduationCap className="h-3 w-3" />}
      {status}
    </span>
  );
}
