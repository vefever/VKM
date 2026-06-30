// Marketing landing page — currently NOT routed (the platform opens straight to
// /auth). Kept here, unimported, so it's tree-shaken out of the bundle but easy
// to restore: re-wire it as the component of src/routes/index.tsx.
import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  ArrowRight, Sparkles, BookOpen, Users, Trophy, BrainCircuit, Bot, BarChart3, ShieldCheck, Zap,
} from "lucide-react";
import { VKMLogo } from "@/components/vkm/logo";
import { Button } from "@/components/ui/button";

const pillars = [
  { icon: BookOpen, title: "Living LMS", body: "Videos, PDFs, assignments, and weekly proof — designed to be opened daily, not buried in folders." },
  { icon: Bot, title: "AI Business Advisor", body: "Your personal AI knows your revenue, leads, KPIs and what to do next. Always on, always premium." },
  { icon: Trophy, title: "Recognition that compounds", body: "Leaderboards, milestones, badges, certificates — built so every win is visible and shareable." },
];

const stack = [
  { icon: Users, label: "4-role RBAC", sub: "Participant · Coach · Mentor · Super Admin" },
  { icon: BrainCircuit, label: "Business Brain", sub: "Personal context for every member" },
  { icon: BarChart3, label: "Premium analytics", sub: "Cohort, coach, and revenue insights" },
  { icon: ShieldCheck, label: "Enterprise-grade", sub: "Row-level security, audit logs" },
  { icon: Zap, label: "PWA ready", sub: "Installable. Fast. Native feel." },
  { icon: Sparkles, label: "Apple-quality UI", sub: "Outfit, navy, gold, cream" },
];

export function LandingPage() {
  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-background">
      {/* Ambient gradient blobs */}
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[700px]">
        <div className="absolute -top-40 left-1/2 h-96 w-[120%] -translate-x-1/2 rounded-full bg-gradient-gold opacity-20 blur-3xl" />
        <div className="absolute top-40 right-0 h-72 w-72 rounded-full bg-navy opacity-10 blur-3xl" />
      </div>

      {/* Nav */}
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
        <VKMLogo />
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" className="rounded-full hidden sm:inline-flex">
            <Link to="/auth">Sign in</Link>
          </Button>
          <Button asChild className="rounded-full bg-gradient-navy shadow-vkm">
            <Link to="/auth">
              Enter VKM <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-7xl px-6 pb-20 pt-12 text-center sm:pt-20">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-xs font-medium text-muted-foreground shadow-vkm">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-gradient-gold" />
            Official platform of Venu Kalyan Mentorship
          </span>
          <h1 className="mx-auto mt-6 max-w-4xl text-5xl font-semibold tracking-tight text-foreground sm:text-7xl">
            The operating system for{" "}
            <span className="text-gradient-gold">business transformation</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl">
            Coaching, LMS, AI advisor, community, recognition — one premium experience for participants, coaches, mentors,
            and operations. Designed like Apple, built like Linear.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="rounded-full bg-gradient-navy px-6 shadow-vkm-float">
              <Link to="/auth">
                Get started <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-full px-6">
              <Link to="/auth">Sign in</Link>
            </Button>
          </div>
        </motion.div>

        {/* Floating product mock */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
          className="relative mx-auto mt-16 max-w-5xl"
        >
          <div className="absolute -inset-6 -z-10 rounded-[3rem] bg-gradient-cream opacity-80 blur-2xl" />
          <div className="overflow-hidden rounded-[2rem] border border-border bg-card shadow-vkm-float">
            <div className="flex items-center gap-1.5 border-b border-border px-5 py-3">
              <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-[oklch(0.82_0.14_80)]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[oklch(0.71_0.14_160)]" />
              <span className="ml-3 text-xs text-muted-foreground">vkmentorship.app · Dashboard</span>
            </div>
            <div className="grid gap-4 p-6 md:grid-cols-4">
              <div className="md:col-span-1 rounded-2xl bg-gradient-navy p-5 text-primary-foreground">
                <p className="text-xs uppercase tracking-wider opacity-70">Week 6 of 16</p>
                <p className="mt-3 text-4xl font-semibold">38%</p>
                <p className="mt-1 text-xs opacity-70">Program progress</p>
              </div>
              {[
                { l: "Revenue", v: "₹4.2L", d: "+18%" },
                { l: "Leads", v: "146", d: "+24" },
                { l: "Habits", v: "92%", d: "streak 11d" },
              ].map((k) => (
                <div key={k.l} className="rounded-2xl border border-border bg-background p-5">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">{k.l}</p>
                  <p className="mt-3 text-3xl font-semibold tracking-tight">{k.v}</p>
                  <p className="mt-1 text-xs text-[oklch(0.55_0.14_160)]">{k.d}</p>
                </div>
              ))}
              <div className="md:col-span-4 rounded-2xl border border-border bg-background p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">Today's Focus</p>
                  <span className="text-xs text-muted-foreground">3 of 5 done</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {["Morning routine", "10 outreach calls", "Submit Week 6 proof", "AI strategy review", "Coach check-in"].map((t, i) => (
                    <span key={t} className={`rounded-full px-3 py-1 text-xs ${i < 3 ? "bg-gradient-gold text-navy" : "border border-border bg-card text-muted-foreground"}`}>
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Pillars */}
      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="grid gap-5 md:grid-cols-3">
          {pillars.map((p, i) => (
            <motion.div
              key={p.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="group rounded-3xl border border-border bg-card p-7 shadow-vkm transition-all hover:-translate-y-1 hover:shadow-vkm-float"
            >
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-navy text-primary-foreground shadow-vkm">
                <p.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-5 text-xl font-semibold tracking-tight">{p.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{p.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Stack */}
      <section className="mx-auto max-w-7xl px-6 py-12">
        <div className="rounded-3xl bg-gradient-navy p-10 text-primary-foreground shadow-vkm-float">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary-foreground/70">Built for scale</p>
          <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
            Enterprise-grade. Member-friendly.
          </h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {stack.map((s) => (
              <div key={s.label} className="flex items-start gap-3 rounded-2xl bg-white/5 p-4 backdrop-blur">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-gold text-navy">
                  <s.icon className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold">{s.label}</p>
                  <p className="mt-0.5 text-xs text-primary-foreground/70">{s.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-3xl px-6 py-24 text-center">
        <h2 className="text-3xl font-semibold tracking-tight sm:text-5xl">
          Step into your <span className="text-gradient-gold">next chapter</span>.
        </h2>
        <p className="mt-4 text-muted-foreground">
          Designed for the mentor, built for the member, loved by operations.
        </p>
        <Button asChild size="lg" className="mt-8 rounded-full bg-gradient-navy px-8 shadow-vkm-float">
          <Link to="/auth">
            Enter VKM <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </section>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} VK Mentorship · Crafted for transformation
      </footer>
    </div>
  );
}
