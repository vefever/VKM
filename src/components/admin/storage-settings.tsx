import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { HardDrive, Database, Cloud, Loader2, Save, CheckCircle2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/vkm/page-header";
import { SectionCard } from "@/components/vkm/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

type Provider = "supabase" | "r2";

async function invokeStorage(action: string, payload: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke("storage", { body: { action, ...payload } });
  if (error) throw error;
  if (data && data.ok === false) throw new Error(data.error || "Request failed");
  return data;
}

export function StorageSettings() {
  const [provider, setProvider] = useState<Provider>("supabase");
  const [enabled, setEnabled] = useState(false);
  const [accountId, setAccountId] = useState("");
  const [accessKeyId, setAccessKeyId] = useState("");
  const [secretAccessKey, setSecretAccessKey] = useState("");
  const [bucket, setBucket] = useState("");
  const [publicBaseUrl, setPublicBaseUrl] = useState("");
  const [hasSecret, setHasSecret] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    invokeStorage("get_config")
      .then((d) => {
        setProvider(d.provider === "r2" ? "r2" : "supabase");
        setEnabled(!!d.enabled);
        setAccountId(d.accountId ?? "");
        setAccessKeyId(d.accessKeyId ?? "");
        setBucket(d.bucket ?? "");
        setPublicBaseUrl(d.publicBaseUrl ?? "");
        setHasSecret(!!d.hasSecret);
      })
      .catch((e) => toast.error("Could not load storage settings", { description: (e as Error).message }))
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    if (provider === "r2") {
      if (!accountId || !accessKeyId || !bucket || !publicBaseUrl || (!secretAccessKey && !hasSecret)) {
        toast.error("Fill all R2 fields", { description: "Account ID, Access Key, Secret, Bucket and Public URL are required." });
        return;
      }
    }
    setSaving(true);
    try {
      const r = await invokeStorage("set_config", {
        provider, accountId, accessKeyId, secretAccessKey, bucket, publicBaseUrl,
      });
      setEnabled(!!r.enabled);
      if (secretAccessKey) { setHasSecret(true); setSecretAccessKey(""); }
      toast.success("Storage settings saved", {
        description: provider === "r2"
          ? r.enabled ? "Uploads now go to Cloudflare R2." : "R2 saved but incomplete — falling back to Supabase."
          : "Uploads use Supabase Storage.",
      });
    } catch (e) { toast.error("Could not save", { description: (e as Error).message }); }
    finally { setSaving(false); }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-5">
      <PageHeader
        eyebrow="Admin"
        title="Storage"
        description="Choose where uploaded files and class videos are stored — Supabase Storage or Cloudflare R2 (cheaper egress for large video)."
        icon={HardDrive}
      />

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          <SectionCard title="Provider" subtitle="Applies to chat files, vision board, avatars and class videos">
            <div className="grid gap-3 sm:grid-cols-2">
              <ProviderCard
                active={provider === "supabase"}
                onClick={() => setProvider("supabase")}
                icon={Database}
                title="Supabase Storage"
                desc="Default. Simple, integrated, public buckets."
              />
              <ProviderCard
                active={provider === "r2"}
                onClick={() => setProvider("r2")}
                icon={Cloud}
                title="Cloudflare R2"
                desc="S3-compatible. Zero egress fees — ideal for video."
                badge={provider === "r2" && enabled ? "Active" : undefined}
              />
            </div>
          </SectionCard>

          {provider === "r2" && (
            <SectionCard title="Cloudflare R2 credentials" subtitle="From R2 → Manage R2 API Tokens (S3 Auth)">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Account ID" value={accountId} onChange={setAccountId} placeholder="e.g. a1b2c3d4..." />
                <Field label="Bucket name" value={bucket} onChange={setBucket} placeholder="vkm-media" />
                <Field label="Access Key ID" value={accessKeyId} onChange={setAccessKeyId} placeholder="R2 access key id" />
                <Field
                  label={hasSecret ? "Secret Access Key (set — leave blank to keep)" : "Secret Access Key"}
                  value={secretAccessKey}
                  onChange={setSecretAccessKey}
                  placeholder={hasSecret ? "••••••••" : "R2 secret access key"}
                  type="password"
                />
                <Field
                  className="sm:col-span-2"
                  label="Public base URL"
                  value={publicBaseUrl}
                  onChange={setPublicBaseUrl}
                  placeholder="https://media.yourdomain.com  (R2 public/custom domain)"
                />
              </div>
              <p className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
                <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                The secret key is stored server-side and used only by the storage edge function to sign uploads — it never reaches participants' browsers. Enable public access (or a custom domain) on the bucket so stored URLs load.
              </p>
            </SectionCard>
          )}

          <div className="flex items-center gap-3">
            <Button onClick={save} disabled={saving} className="rounded-xl bg-gradient-navy text-primary-foreground hover:opacity-90">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save settings
            </Button>
            {provider === "r2" && enabled && (
              <span className="inline-flex items-center gap-1.5 text-sm text-[oklch(0.5_0.12_160)]">
                <CheckCircle2 className="h-4 w-4" /> R2 active
              </span>
            )}
          </div>
        </>
      )}
    </motion.div>
  );
}

function ProviderCard({ active, onClick, icon: Icon, title, desc, badge }: {
  active: boolean; onClick: () => void; icon: typeof Database; title: string; desc: string; badge?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-start gap-3 rounded-2xl border p-4 text-left transition-all",
        active ? "border-navy bg-navy/[0.04] ring-2 ring-navy/30" : "border-border bg-card hover:border-navy/30",
      )}
    >
      <span className={cn("inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", active ? "bg-gradient-navy text-primary-foreground" : "bg-secondary text-foreground")}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-foreground">{title}</p>
          {badge && <span className="rounded-full bg-[oklch(0.93_0.06_160)] px-2 py-0.5 text-[10px] font-medium text-[oklch(0.35_0.12_160)]">{badge}</span>}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
      </div>
    </button>
  );
}

function Field({ label, value, onChange, placeholder, type, className }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} type={type} className="h-10 rounded-xl" />
    </div>
  );
}
