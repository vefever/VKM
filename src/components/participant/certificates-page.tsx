import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Award,
  Lock,
  Sparkles,
  Download,
  CheckCircle2,
  ArrowRight,
  GraduationCap,
  Loader2,
} from "lucide-react";
import { PageHeader } from "@/components/vkm/page-header";
import { SectionCard } from "@/components/vkm/section-card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { VKM_PROGRAM } from "@/lib/vkm/program";
import { useMyProofs } from "@/components/coach/coach-data";
import { useEnrollment } from "@/components/participant/enrollment-data";
import { useMyCertificates } from "@/components/participant/certificate-data";
import { CertificateView } from "@/components/vkm/certificate-view";
import { format } from "date-fns";

const INCLUDES = [
  "Official Certificate of Transformation",
  "Your Before → After business metrics",
  "16-week program completion seal",
  "Signed by VK Mentorship leadership",
];

export function CertificatesPage() {
  const { user } = useAuth();
  const { weeks } = useMyProofs();
  // useEnrollment returns flat fields (no `enrollment` object).
  const { totalWeeks: enrolledWeeks, status: enrollmentStatus, loading: enrollmentLoading } = useEnrollment();
  const { rows: certificates, loading: certsLoading } = useMyCertificates();
  const [name, setName] = useState("");

  useEffect(() => {
    if (!user) return;
    let active = true;
    void supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (active) setName(data?.full_name?.trim() || user.email?.split("@")[0] || "Participant");
      });
    return () => {
      active = false;
    };
  }, [user]);

  const weeksApproved = weeks.filter((w) => w.proof_status === "approved").length;
  const totalWeeks = enrolledWeeks ?? VKM_PROGRAM.durationWeeks;
  const progressPct = Math.min(100, Math.round((weeksApproved / totalWeeks) * 100));
  const weeksLeft = Math.max(0, VKM_PROGRAM.graduationWeek - weeksApproved);

  // An issued certificate IS the unlock: staff upload it on completion, and the
  // member can then preview and download the real document. Until then they see
  // the locked teaser with their progress.
  const issued = certificates[0] ?? null;
  const unlocked = Boolean(issued);
  const completed =
    enrollmentStatus === "completed" || weeksApproved >= VKM_PROGRAM.graduationWeek;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-5"
    >
      <PageHeader
        eyebrow="Recognition"
        title="Your Certificate"
        description="The Certificate of Transformation — awarded when you complete all 16 weeks."
        icon={Award}
      />

      {certsLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : issued ? (
        /* Issued — the real document your team uploaded: preview + download. */
        <SectionCard
          title={issued.title || "Certificate of Transformation"}
          subtitle={`Issued ${format(new Date(issued.issued_at), "d MMMM yyyy")}`}
          accent
        >
          <CertificateView fileUrl={issued.file_url} fileType={issued.file_type} title={issued.title} />
          {issued.note && <p className="mt-3 text-sm text-muted-foreground">{issued.note}</p>}

          {certificates.length > 1 && (
            <div className="mt-6 space-y-4 border-t border-border pt-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Earlier certificates
              </p>
              {certificates.slice(1).map((c) => (
                <div key={c.id} className="space-y-2">
                  <p className="text-sm font-medium text-foreground">
                    {c.title || "Certificate"}{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      · {format(new Date(c.issued_at), "d MMM yyyy")}
                    </span>
                  </p>
                  <CertificateView fileUrl={c.file_url} fileType={c.file_type} title={c.title} compact />
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      ) : (
      /* Not issued yet — glass-locked teaser with real progress. */
      <div className="relative overflow-hidden rounded-3xl border border-gold/25 shadow-vkm-float">
        <span
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gradient-gold opacity-25 blur-3xl"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-20 -left-16 h-48 w-48 rounded-full bg-gradient-navy opacity-15 blur-3xl"
        />

        <div className="relative p-4 sm:p-6">
          <CertificatePreview name={name} blurred />

          {(
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.15 }}
              className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-2xl bg-white/25 p-6 backdrop-blur-[18px] dark:bg-navy/20"
            >
              <span
                aria-hidden
                className="pointer-events-none absolute inset-3 rounded-2xl border border-white/40 ring-1 ring-gold/20"
              />

              <motion.span
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                className="relative mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-navy text-primary-foreground shadow-vkm-float ring-2 ring-gold/40"
              >
                <Lock className="h-7 w-7" />
                <span className="absolute -right-1 -top-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-gradient-gold text-navy shadow-gold-glow">
                  <Sparkles className="h-3.5 w-3.5" />
                </span>
              </motion.span>

              <p className="text-center text-lg font-semibold tracking-tight text-foreground">
                {completed ? "Your certificate is being prepared" : "Unlocks after course completion"}
              </p>
              <p className="mt-1 max-w-xs text-center text-sm text-muted-foreground">
                {completed
                  ? "You've finished the program — your coach is issuing your official certificate. It appears here the moment it's ready."
                  : `Finish all ${VKM_PROGRAM.durationWeeks} weeks and graduate to claim your official certificate.`}
              </p>

              {enrollmentLoading ? (
                <Loader2 className="mt-4 h-5 w-5 animate-spin text-muted-foreground" />
              ) : (
                <div className="mt-5 w-full max-w-xs space-y-2">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="text-muted-foreground">Program progress</span>
                    <span className="text-foreground">
                      {weeksApproved} / {totalWeeks} weeks
                    </span>
                  </div>
                  <Progress value={progressPct} className="h-2" />
                  <p className="text-center text-[11px] text-muted-foreground">
                    {weeksLeft > 0
                      ? `${weeksLeft} more week${weeksLeft !== 1 ? "s" : ""} to graduation`
                      : "Almost there — awaiting final graduation approval"}
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </div>
      </div>
      )}

      {unlocked ? (
        <SectionCard
          title="Congratulations — you earned it"
          subtitle="Use the buttons above to download or open your certificate"
          accent
        >
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" className="rounded-xl" asChild>
              <Link to="/participant/graduation">
                View Before → After <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </SectionCard>
      ) : (
        <SectionCard
          title="What you'll receive"
          subtitle="A premium certificate that captures your transformation journey"
        >
          <ul className="space-y-2.5">
            {INCLUDES.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                {item}
              </li>
            ))}
          </ul>
          <div className="mt-5 flex flex-wrap gap-3 border-t border-border pt-4">
            <Button className="rounded-xl bg-gradient-navy shadow-vkm" asChild>
              <Link to="/participant/progress">
                <GraduationCap className="h-4 w-4" /> Continue your program
              </Link>
            </Button>
            <Button variant="outline" className="rounded-xl" asChild>
              <Link to="/participant/milestones">
                View milestones <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </SectionCard>
      )}
    </motion.div>
  );
}

function CertificatePreview({ name, blurred }: { name: string; blurred: boolean }) {
  return (
    <div
      className={cn(
        "relative mx-auto aspect-[1.414/1] w-full max-w-2xl overflow-hidden rounded-2xl border-2 border-gold/50 bg-gradient-to-br from-[oklch(0.98_0.01_95)] via-white to-[oklch(0.96_0.02_85)] p-6 shadow-vkm sm:p-10",
        blurred && "select-none",
      )}
    >
      {/* Ornate corners */}
      <span className="pointer-events-none absolute left-3 top-3 h-8 w-8 border-l-2 border-t-2 border-gold/60 sm:left-5 sm:top-5 sm:h-10 sm:w-10" />
      <span className="pointer-events-none absolute right-3 top-3 h-8 w-8 border-r-2 border-t-2 border-gold/60 sm:right-5 sm:top-5 sm:h-10 sm:w-10" />
      <span className="pointer-events-none absolute bottom-3 left-3 h-8 w-8 border-b-2 border-l-2 border-gold/60 sm:bottom-5 sm:left-5 sm:h-10 sm:w-10" />
      <span className="pointer-events-none absolute bottom-3 right-3 h-8 w-8 border-b-2 border-r-2 border-gold/60 sm:bottom-5 sm:right-5 sm:h-10 sm:w-10" />

      <div className="flex h-full flex-col items-center justify-between text-center">
        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-navy/70 sm:text-xs">
            VK Mentorship
          </p>
          <div className="mx-auto h-px w-16 bg-gradient-gold sm:w-24" />
        </div>

        <div className="space-y-3 px-2">
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground sm:text-xs">
            Certificate of
          </p>
          <h2 className="text-xl font-bold tracking-tight text-navy sm:text-3xl">Transformation</h2>
          <p className="text-xs text-muted-foreground sm:text-sm">This certifies that</p>
          <p
            className={cn(
              "font-serif text-2xl font-semibold italic text-navy sm:text-4xl",
              blurred && "blur-[6px]",
            )}
          >
            {name}
          </p>
          <p className="mx-auto max-w-md text-xs leading-relaxed text-muted-foreground sm:text-sm">
            has successfully completed the {VKM_PROGRAM.durationWeeks}-week VK Mentorship program
            with measurable business growth
          </p>
        </div>

        <div className="w-full space-y-4">
          <div
            className={cn(
              "mx-auto grid max-w-sm grid-cols-3 gap-2 rounded-xl border border-gold/20 bg-gold/[0.06] px-3 py-2.5 sm:gap-4 sm:px-4",
              blurred && "blur-[5px]",
            )}
          >
            {/* Placeholders only — this is the locked teaser, never real data.
                The issued certificate your team uploads replaces it entirely. */}
            <MetricTeaser label="Revenue" value="—" />
            <MetricTeaser label="Leads" value="—" />
            <MetricTeaser label="Systems" value="—" />
          </div>

          <div className="flex items-end justify-between px-2 sm:px-4">
            <div className="text-left">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Date</p>
              <p className={cn("text-xs font-medium text-navy sm:text-sm", blurred && "blur-sm")}>
                Week {VKM_PROGRAM.graduationWeek} · Graduation
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Authorised by
              </p>
              <p className={cn("text-xs font-semibold text-navy sm:text-sm", blurred && "blur-sm")}>
                Venu Kalyan
              </p>
              <p className="text-[10px] text-muted-foreground">VK Mentorship</p>
            </div>
          </div>

          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-gradient-navy text-[10px] font-bold text-primary-foreground shadow-vkm sm:h-12 sm:w-12 sm:text-xs">
            VKM
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricTeaser({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm font-bold text-navy sm:text-base">{value}</p>
    </div>
  );
}
