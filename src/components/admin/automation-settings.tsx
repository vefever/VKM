import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Workflow,
  Loader2,
  Save,
  RotateCcw,
  Mail,
  MessageCircle,
  Send,
  Play,
  Clock,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/vkm/page-header";
import { SectionCard } from "@/components/vkm/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  useAutomationSettings,
  AUTOMATION_DEFAULTS,
  fetchLastRun,
  fetchCronStatus,
  setReminderSchedule,
  timeLabel,
  runReminders,
  testReminder,
  type AutomationConfig,
  type LastRun,
  type CronStatus,
} from "@/components/admin/automation-data";

export function AutomationSettingsPage() {
  const { config, loading, saving, save } = useAutomationSettings();
  const [form, setForm] = useState<AutomationConfig>(AUTOMATION_DEFAULTS);
  const [dirty, setDirty] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [testPhone, setTestPhone] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<LastRun[]>([]);
  const [cron, setCron] = useState<CronStatus | null>(null);

  useEffect(() => {
    setForm(config);
    setDirty(false);
  }, [config]);

  useEffect(() => {
    void fetchLastRun().then(setLastRun);
    void fetchCronStatus().then(setCron);
  }, []);

  const set = <K extends keyof AutomationConfig>(k: K, v: AutomationConfig[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setDirty(true);
  };

  async function onSave() {
    try {
      await save(form);
      // Always reschedule the cron job to match the chosen time so the DB
      // schedule and the saved config never drift.
      const st = await setReminderSchedule(form.send_hour_ist, form.send_minute_ist);
      setCron(st);
      setDirty(false);
      toast.success("Automation settings saved", {
        description: `Reminders run daily at ${timeLabel(form.send_hour_ist, form.send_minute_ist)} IST`,
      });
    } catch (e) {
      toast.error("Couldn't save", { description: (e as Error).message });
    }
  }

  async function onTest(channel: "email" | "whatsapp") {
    const to = channel === "email" ? testEmail.trim() : testPhone.trim();
    if (!to) {
      toast.error(channel === "email" ? "Enter a test email address." : "Enter a test phone number.");
      return;
    }
    setBusy(`test-${channel}`);
    try {
      await testReminder(channel, to);
      toast.success(`Test ${channel} sent`, { description: `Delivered to ${to}` });
    } catch (e) {
      toast.error(`Test ${channel} failed`, { description: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function onRunNow() {
    setBusy("run");
    try {
      const res = (await runReminders()) as {
        target?: string;
        targets?: number;
        email?: { sent: number; failed: number };
        whatsapp?: { sent: number; failed: number };
      };
      toast.success("Reminders sent", {
        description: `${res.targets ?? 0} participant(s) behind · email ${res.email?.sent ?? 0} sent, WhatsApp ${res.whatsapp?.sent ?? 0} sent`,
      });
      void fetchLastRun().then(setLastRun);
    } catch (e) {
      toast.error("Run failed", { description: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-5"
    >
      <PageHeader
        eyebrow="Admin · VK"
        title="Workflow & Automation"
        description="Automated nudges that keep participants on track — sent on the platform's email & WhatsApp settings."
        icon={Workflow}
        actions={
          <>
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => {
                setForm(AUTOMATION_DEFAULTS);
                setDirty(true);
              }}
            >
              <RotateCcw className="h-4 w-4" /> Reset
            </Button>
            <Button className="rounded-full bg-gradient-navy" onClick={onSave} disabled={saving || !dirty}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save changes
            </Button>
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          {/* Daily reminders master card */}
          <SectionCard
            title="Daily task reminders"
            subtitle="Nudge every active participant who hasn't finished their 6 daily habits"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-secondary/40 px-3.5 py-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                    <Clock className="h-4 w-4 text-gold" /> Send time (IST)
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Runs daily at {timeLabel(form.send_hour_ist, form.send_minute_ist)} IST. Only participants behind
                    that day are contacted — never staff or alumni.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={`${String(form.send_hour_ist).padStart(2, "0")}:${String(form.send_minute_ist).padStart(2, "0")}`}
                    onChange={(e) => {
                      const [h, m] = e.target.value.split(":").map((x) => parseInt(x, 10));
                      if (Number.isFinite(h) && Number.isFinite(m)) {
                        set("send_hour_ist", h);
                        set("send_minute_ist", m);
                      }
                    }}
                    className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm font-medium text-foreground"
                  />
                  {cron && (
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                        cron.scheduled && cron.active
                          ? "bg-[oklch(0.93_0.06_160)] text-[oklch(0.35_0.12_160)]"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {cron.scheduled && cron.active ? "Active" : "Inactive"}
                    </span>
                  )}
                </div>
              </div>
              <ToggleRow
                label="Enable daily reminders"
                hint="Master switch for the scheduled job."
                checked={form.daily_reminders_enabled}
                onChange={(v) => set("daily_reminders_enabled", v)}
              />
              <div className="grid grid-cols-2 gap-3">
                <ToggleRow
                  compact
                  label="Email"
                  icon={<Mail className="h-4 w-4" />}
                  checked={form.email_enabled}
                  onChange={(v) => set("email_enabled", v)}
                />
                <ToggleRow
                  compact
                  label="WhatsApp"
                  icon={<MessageCircle className="h-4 w-4" />}
                  checked={form.whatsapp_enabled}
                  onChange={(v) => set("whatsapp_enabled", v)}
                />
              </div>
            </div>
          </SectionCard>

          {/* Email content */}
          <SectionCard title="Email content" subtitle="Variables: {name} · {done} · {remaining}">
            <div className="space-y-4">
              <Field label="Subject">
                <Input value={form.email_subject} onChange={(e) => set("email_subject", e.target.value)} />
              </Field>
              <Field label="Heading">
                <Input value={form.email_heading} onChange={(e) => set("email_heading", e.target.value)} />
              </Field>
              <Field label="Intro message">
                <Textarea value={form.email_intro} onChange={(e) => set("email_intro", e.target.value)} rows={3} />
              </Field>
              <div className="rounded-xl border border-border bg-secondary/30 p-3">
                <Label className="mb-1.5 block text-xs">Send a test email</Label>
                <div className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                  />
                  <Button
                    variant="outline"
                    className="shrink-0 rounded-xl"
                    onClick={() => onTest("email")}
                    disabled={busy === "test-email"}
                  >
                    {busy === "test-email" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Test
                  </Button>
                </div>
              </div>
            </div>
          </SectionCard>

          {/* WhatsApp content */}
          <SectionCard title="WhatsApp content" subtitle="Variables: {name} · {done} · {remaining}">
            <div className="space-y-4">
              <Field label="Message">
                <Textarea
                  value={form.whatsapp_message}
                  onChange={(e) => set("whatsapp_message", e.target.value)}
                  rows={3}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Approved template name" hint="Meta Cloud API only — optional">
                  <Input
                    value={form.whatsapp_template_name}
                    onChange={(e) => set("whatsapp_template_name", e.target.value)}
                    placeholder="daily_reminder"
                  />
                </Field>
                <Field label="Template language" hint="e.g. en, en_US, hi">
                  <Input
                    value={form.whatsapp_template_lang}
                    onChange={(e) => set("whatsapp_template_lang", e.target.value)}
                    placeholder="en"
                  />
                </Field>
              </div>
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-700">
                WhatsApp only delivers unsolicited messages through a <b>pre-approved template</b> (outside the 24-hour
                window). Set the template name above once it's approved in your provider; the plain message is used for
                in-window replies and Twilio. Configure the provider under <b>Admin → WhatsApp</b>.
              </p>
              <div className="rounded-xl border border-border bg-secondary/30 p-3">
                <Label className="mb-1.5 block text-xs">Send a test WhatsApp</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="+91 90000 00000"
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                  />
                  <Button
                    variant="outline"
                    className="shrink-0 rounded-xl"
                    onClick={() => onTest("whatsapp")}
                    disabled={busy === "test-whatsapp"}
                  >
                    {busy === "test-whatsapp" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    Test
                  </Button>
                </div>
              </div>
            </div>
          </SectionCard>
        </div>

        {/* Right rail: run now + last run */}
        <div className="space-y-5 lg:sticky lg:top-4 lg:self-start">
          <SectionCard title="Run now" subtitle="Send today's reminders immediately">
            <Button
              className="w-full rounded-xl bg-gradient-navy"
              onClick={onRunNow}
              disabled={busy === "run"}
            >
              {busy === "run" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Run reminders now
            </Button>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Runs the same job the 8 PM schedule uses. Already-notified participants are skipped, so it's safe to
              re-run.
            </p>
          </SectionCard>

          <SectionCard title="Last run">
            {lastRun.length === 0 ? (
              <p className="text-xs text-muted-foreground">No reminders sent yet.</p>
            ) : (
              <div className="space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {lastRun[0].target_date}
                </p>
                {lastRun.map((r) => (
                  <div
                    key={`${r.channel}:${r.status}`}
                    className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 px-3 py-2 text-xs"
                  >
                    <span className="flex items-center gap-1.5 capitalize text-foreground">
                      {r.channel === "email" ? (
                        <Mail className="h-3.5 w-3.5" />
                      ) : (
                        <MessageCircle className="h-3.5 w-3.5" />
                      )}
                      {r.channel} · {r.status}
                    </span>
                    <span className="font-semibold text-foreground">{r.count}</span>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {dirty && (
            <p className="flex items-center gap-1.5 text-xs text-amber-600">
              <Check className="h-3.5 w-3.5" /> Unsaved changes
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  icon,
  checked,
  onChange,
  compact,
}: {
  label: string;
  hint?: string;
  icon?: React.ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
  compact?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-xl border border-border bg-secondary/30 ${
        compact ? "px-3 py-2.5" : "px-3.5 py-3"
      }`}
    >
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          {icon}
          {label}
        </p>
        {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
