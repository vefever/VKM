import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Mail,
  MessageSquareMore,
  Phone,
  FileText,
  KeyRound,
  Save,
  Send,
  Loader2,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Globe,
  Lock,
  ScrollText,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/vkm/page-header";
import { SectionCard } from "@/components/vkm/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  useMessagingSetting,
  useTemplates,
  invokeMessaging,
  type ChannelId,
  type MessageTemplate,
} from "@/components/admin/messaging-data";
import { EmailLogPanel } from "@/components/admin/email-log-panel";

type Field = { k: string; label: string; secret?: boolean; placeholder?: string };
type Chan = "email" | "sms" | "whatsapp";

const PROVIDERS: Record<Chan, Record<string, Field[]>> = {
  email: {
    resend: [
      { k: "apiKey", label: "API key", secret: true, placeholder: "re_…" },
      { k: "fromEmail", label: "From email", placeholder: "coach@yourdomain.com" },
      { k: "fromName", label: "From name", placeholder: "VK Mentorship" },
    ],
    mailersend: [
      { k: "apiKey", label: "API token", secret: true, placeholder: "mlsn.…" },
      { k: "fromEmail", label: "From email", placeholder: "coach@yourdomain.com" },
      { k: "fromName", label: "From name", placeholder: "VK Mentorship" },
    ],
    ses: [
      { k: "accessKeyId", label: "AWS access key ID" },
      { k: "secretAccessKey", label: "AWS secret access key", secret: true },
      { k: "region", label: "Region", placeholder: "us-east-1" },
      { k: "fromEmail", label: "From email (verified in SES)" },
      { k: "fromName", label: "From name", placeholder: "VK Mentorship" },
    ],
    zeptomail: [
      { k: "apiKey", label: "Send Mail token", secret: true, placeholder: "Zoho-enczapikey …" },
      { k: "region", label: "Data center", placeholder: "in (India) or com (global)" },
      { k: "fromEmail", label: "From email (verified domain)", placeholder: "noreply@yourdomain.com" },
      { k: "fromName", label: "From name", placeholder: "VK Mentorship" },
    ],
  },
  sms: {
    twilio: [
      { k: "accountSid", label: "Account SID", placeholder: "AC…" },
      { k: "authToken", label: "Auth token", secret: true },
      { k: "fromNumber", label: "From number (+E.164)", placeholder: "+1…" },
    ],
    msg91: [
      { k: "apiKey", label: "Auth key", secret: true },
      { k: "templateId", label: "Flow / template ID" },
    ],
  },
  whatsapp: {
    twilio: [
      { k: "accountSid", label: "Account SID", placeholder: "AC…" },
      { k: "authToken", label: "Auth token", secret: true },
      { k: "fromNumber", label: "From number (+E.164)", placeholder: "+1…" },
    ],
    meta: [
      { k: "accessToken", label: "Access token", secret: true },
      { k: "phoneNumberId", label: "Phone number ID" },
    ],
    aisensy: [
      { k: "apiKey", label: "API key", secret: true, placeholder: "AiSensy API key" },
      { k: "campaignName", label: "Default campaign name", placeholder: "e.g. vkm_daily_reminder" },
      { k: "templateParams", label: "Template variable VALUES for test (| separated)", placeholder: "e.g. Riya | 3 — NOT the template name" },
      { k: "senderName", label: "Contact name (optional)", placeholder: "VK Mentorship" },
    ],
  },
};

const PROVIDER_LABEL: Record<string, string> = {
  resend: "Resend",
  mailersend: "MailerSend",
  ses: "Amazon SES",
  zeptomail: "Zoho ZeptoMail",
  twilio: "Twilio",
  msg91: "MSG91",
  meta: "Meta Cloud API",
  aisensy: "AiSensy",
};

type TabId = "email" | "sms" | "whatsapp" | "templates" | "login" | "log";
const TABS: { id: TabId; label: string; icon: typeof Mail }[] = [
  { id: "email", label: "Email", icon: Mail },
  { id: "sms", label: "SMS", icon: Phone },
  { id: "whatsapp", label: "WhatsApp", icon: MessageSquareMore },
  { id: "templates", label: "Templates", icon: FileText },
  { id: "login", label: "Login (OTP)", icon: KeyRound },
  { id: "log", label: "Email log", icon: ScrollText },
];

export function MessagingSettings({ defaultTab = "email" }: { defaultTab?: TabId }) {
  const [tab, setTab] = useState<TabId>(defaultTab);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-5"
    >
      <PageHeader
        eyebrow="Admin"
        title="Messaging"
        description="Configure email, SMS & WhatsApp providers, manage templates, and turn on email-OTP login. API keys are stored securely and never shipped to the browser."
        icon={Mail}
      />

      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "app-press inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium transition-colors",
                tab === t.id
                  ? "bg-gradient-navy text-primary-foreground shadow-vkm"
                  : "bg-secondary/60 text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {(tab === "email" || tab === "sms" || tab === "whatsapp") && <ChannelTab channel={tab} />}
      {tab === "templates" && <TemplatesTab />}
      {tab === "login" && <LoginTab />}
      {tab === "log" && <EmailLogPanel />}
    </motion.div>
  );
}

function ChannelTab({ channel }: { channel: Chan }) {
  const { setting, loading, save } = useMessagingSetting(channel);
  const [provider, setProvider] = useState<string>("");
  const [enabled, setEnabled] = useState(false);
  const [config, setConfig] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [reveal, setReveal] = useState<Record<string, boolean>>({});
  const [testTo, setTestTo] = useState("");
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (loading) return;
    setProvider(setting.provider ?? Object.keys(PROVIDERS[channel])[0]);
    setEnabled(setting.enabled);
    setConfig(
      Object.fromEntries(
        Object.entries(setting.config).map(([k, v]) => [k, typeof v === "string" ? v : ""]),
      ),
    );
  }, [loading, setting, channel]);

  const fields = PROVIDERS[channel][provider] ?? [];

  async function onSave() {
    setSaving(true);
    try {
      // Saving a configured provider turns it on — that's the intent of "Save".
      // Use the toggle to disable it later.
      await save({ provider, enabled: true, config });
      setEnabled(true);
      toast.success("Saved & enabled");
    } catch (e) {
      toast.error("Could not save", { description: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  async function toggleEnabled() {
    const next = !enabled;
    setEnabled(next);
    try {
      await save({ provider, enabled: next, config });
    } catch (e) {
      setEnabled(!next);
      toast.error("Could not update", { description: (e as Error).message });
    }
  }

  async function onTest() {
    if (!testTo.trim()) return toast.error("Enter a destination to test");
    setTesting(true);
    try {
      await invokeMessaging("test", { channel, to: testTo.trim() });
      toast.success("Test sent", { description: `Check ${testTo}` });
    } catch (e) {
      toast.error("Test failed", { description: (e as Error).message });
    } finally {
      setTesting(false);
    }
  }

  if (loading) return <Spinner />;

  return (
    <SectionCard
      title={`${channel === "email" ? "Email" : channel === "sms" ? "SMS" : "WhatsApp"} provider`}
      subtitle="Pick a provider, paste credentials, then Save — it turns on automatically. Use the toggle to switch it off."
      action={<EnabledToggle on={enabled} onClick={toggleEnabled} />}
    >
      <div className="space-y-4">
        <Field label="Provider">
          <div className="flex flex-wrap gap-1.5">
            {Object.keys(PROVIDERS[channel]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setProvider(p)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  provider === p
                    ? "border-transparent bg-gradient-navy text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:bg-secondary/60",
                )}
              >
                {PROVIDER_LABEL[p] ?? p}
              </button>
            ))}
          </div>
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          {fields.map((f) => (
            <Field key={f.k} label={f.label}>
              <div className="relative">
                <Input
                  type={f.secret && !reveal[f.k] ? "password" : "text"}
                  value={config[f.k] ?? ""}
                  onChange={(e) => setConfig((c) => ({ ...c, [f.k]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="rounded-lg pr-9"
                  autoComplete="off"
                />
                {f.secret && (
                  <button
                    type="button"
                    onClick={() => setReveal((r) => ({ ...r, [f.k]: !r[f.k] }))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                    aria-label="Toggle visibility"
                  >
                    {reveal[f.k] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                )}
              </div>
            </Field>
          ))}
        </div>

        {provider === "aisensy" && (
          <p className="rounded-lg border border-dashed border-border bg-secondary/30 px-3 py-2 text-xs text-muted-foreground">
            AiSensy only sends <span className="font-medium text-foreground">approved WhatsApp templates</span> (organised as
            "campaigns"). Paste the <span className="font-medium text-foreground">campaign name</span> above (e.g. <span className="font-mono">vkm_daily_reminder</span>) — you never enter the
            template name; AiSensy finds it from the campaign. In <span className="font-medium text-foreground">Template variable values</span> put the actual VALUES that fill your
            template's <span className="font-mono">{"{{1}}"}</span>, <span className="font-mono">{"{{2}}"}</span>… — e.g. a template like
            <span className="italic"> "Hi {"{{1}}"}, you have {"{{2}}"} tasks left"</span> takes <span className="font-mono">Riya | 3</span> (two values). Leave it blank for a template with no variables.
            Sending the wrong count is AiSensy's <span className="font-mono">"Template params does not match the campaign"</span> error.
            Daily-reminder automation fills its own two values (participant name, tasks left), so use a 2-variable template.
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
          <div className="flex items-center gap-2">
            <Input
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              placeholder={channel === "email" ? "you@email.com" : "+91…"}
              className="h-9 w-44 rounded-lg text-sm"
            />
            <Button
              size="sm"
              variant="outline"
              className="rounded-lg"
              disabled={testing}
              onClick={onTest}
            >
              {testing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}{" "}
              Send test
            </Button>
          </div>
          <Button
            className="rounded-lg bg-gradient-navy text-primary-foreground hover:opacity-90"
            disabled={saving}
            onClick={onSave}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{" "}
            Save provider
          </Button>
        </div>
      </div>
    </SectionCard>
  );
}

function TemplatesTab() {
  const [channel, setChannel] = useState<Chan>("email");
  const { templates, loading, create, update, remove } = useTemplates(channel);
  const [draft, setDraft] = useState({ key: "", name: "", subject: "", body: "" });
  const [saving, setSaving] = useState(false);

  async function add() {
    if (!draft.key.trim() || !draft.name.trim() || !draft.body.trim())
      return toast.error("Key, name and body are required");
    setSaving(true);
    try {
      await create({
        key: draft.key.trim(),
        name: draft.name.trim(),
        subject: channel === "email" ? draft.subject.trim() || undefined : undefined,
        body: draft.body,
      });
      setDraft({ key: "", name: "", subject: "", body: "" });
      toast.success("Template added");
    } catch (e) {
      toast.error("Could not add", { description: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5">
        {(["email", "sms", "whatsapp"] as Chan[]).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setChannel(c)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium capitalize transition-colors",
              channel === c
                ? "bg-gradient-navy text-primary-foreground"
                : "bg-secondary/60 text-muted-foreground hover:text-foreground",
            )}
          >
            {c}
          </button>
        ))}
      </div>

      <SectionCard
        title="New template"
        subtitle="Use {{variables}} like {{name}}, {{week}}, {{code}}"
      >
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Key (code reference)">
              <Input
                value={draft.key}
                onChange={(e) => setDraft((d) => ({ ...d, key: e.target.value }))}
                placeholder="weekly_reminder"
                className="rounded-lg"
              />
            </Field>
            <Field label="Name">
              <Input
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                placeholder="Weekly reminder"
                className="rounded-lg"
              />
            </Field>
          </div>
          {channel === "email" && (
            <Field label="Subject">
              <Input
                value={draft.subject}
                onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value }))}
                placeholder="Your Week {{week}} task is due"
                className="rounded-lg"
              />
            </Field>
          )}
          <Field label="Body">
            <Textarea
              value={draft.body}
              onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
              placeholder={
                channel === "email"
                  ? "<p>Hi {{name}}, your Week {{week}} task is due…</p>"
                  : "Hi {{name}}, your Week {{week}} task is due. Submit proof in the app."
              }
              className="min-h-[96px] rounded-lg font-mono text-xs"
            />
          </Field>
          <div className="flex justify-end">
            <Button
              className="rounded-lg bg-gradient-navy text-primary-foreground hover:opacity-90"
              disabled={saving}
              onClick={add}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}{" "}
              Add template
            </Button>
          </div>
        </div>
      </SectionCard>

      <SectionCard title={`${channel} templates`} subtitle={`${templates.length} saved`}>
        {loading ? (
          <Spinner />
        ) : templates.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No templates yet.</p>
        ) : (
          <div className="space-y-2.5">
            {templates.map((t) => (
              <TemplateRow key={t.id} t={t} onUpdate={update} onDelete={() => remove(t.id)} />
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function TemplateRow({
  t,
  onUpdate,
  onDelete,
}: {
  t: MessageTemplate;
  onUpdate: (id: string, patch: Partial<MessageTemplate>) => Promise<void>;
  onDelete: () => void;
}) {
  const [body, setBody] = useState(t.body);
  const [subject, setSubject] = useState(t.subject ?? "");
  const dirty = body !== t.body || subject !== (t.subject ?? "");
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{t.name}</p>
          <p className="text-[11px] text-muted-foreground">
            key: <code>{t.key}</code>
          </p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 rounded-lg text-destructive hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      {t.channel === "email" && (
        <Input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Subject"
          className="mt-2 h-9 rounded-lg text-sm"
        />
      )}
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        className="mt-2 min-h-[72px] rounded-lg font-mono text-xs"
      />
      {dirty && (
        <div className="mt-2 flex justify-end">
          <Button
            size="sm"
            className="rounded-lg bg-gradient-navy text-primary-foreground hover:opacity-90"
            onClick={() => onUpdate(t.id, { body, subject: subject || null })}
          >
            <Save className="h-4 w-4" /> Save
          </Button>
        </div>
      )}
    </div>
  );
}

function LoginTab() {
  const { setting, loading, save } = useMessagingSetting("general");
  const enabled = setting.config?.otp_login_enabled === true;
  const [saving, setSaving] = useState(false);

  async function toggle() {
    setSaving(true);
    try {
      await save({ config: { ...setting.config, otp_login_enabled: !enabled } });
      toast.success(!enabled ? "Email-OTP login enabled" : "Email-OTP login disabled");
    } catch (e) {
      toast.error("Could not save", { description: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Spinner />;

  return (
    <SectionCard
      title="Email-OTP login"
      subtitle="Let participants sign in with a one-time code emailed to them — optional, in addition to password & Google."
    >
      <div className="flex items-start justify-between gap-4 rounded-xl border border-border bg-secondary/30 p-4">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl",
              enabled ? "bg-[#10b981] text-white" : "bg-muted text-muted-foreground",
            )}
          >
            {enabled ? <Globe className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">
              {enabled ? "Enabled" : "Disabled"}
            </p>
            <p className="text-xs text-muted-foreground">
              When on, the sign-in screen shows a “Login with email code” option. The code is sent
              through your configured Email provider — set that up in the Email tab first.
            </p>
          </div>
        </div>
        <Button
          className={cn(
            "shrink-0 rounded-lg",
            enabled
              ? "bg-secondary text-foreground hover:bg-secondary/80"
              : "bg-gradient-navy text-primary-foreground hover:opacity-90",
          )}
          disabled={saving}
          onClick={toggle}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {enabled ? "Turn off" : "Turn on"}
        </Button>
      </div>
    </SectionCard>
  );
}

// ---- small shared bits ----------------------------------------------------
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function EnabledToggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold",
        on
          ? "bg-[oklch(0.93_0.06_160)] text-[oklch(0.35_0.12_160)]"
          : "bg-muted text-muted-foreground",
      )}
    >
      <span
        className={cn("h-2 w-2 rounded-full", on ? "bg-[#10b981]" : "bg-muted-foreground/50")}
      />
      {on ? "Enabled" : "Disabled"}
    </button>
  );
}

function Spinner() {
  return (
    <div className="flex justify-center py-10">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );
}
