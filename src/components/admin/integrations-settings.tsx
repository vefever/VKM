import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Video, Save, Loader2, Eye, EyeOff, Plug, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/vkm/page-header";
import { SectionCard } from "@/components/vkm/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useMessagingSetting } from "@/components/admin/messaging-data";

type Field = { k: string; label: string; secret?: boolean; placeholder?: string; hint?: string };

// Two Zoom apps power the feature:
//  • Server-to-Server OAuth — used by the edge function to CREATE meetings.
//  • Meeting SDK — used to EMBED/JOIN the call in-app (no redirect).
const S2S: Field[] = [
  { k: "accountId", label: "Account ID", placeholder: "From your S2S OAuth app" },
  { k: "clientId", label: "Client ID" },
  { k: "clientSecret", label: "Client Secret", secret: true },
];
const SDK: Field[] = [
  { k: "sdkKey", label: "SDK Key", hint: "From a Meeting SDK app" },
  { k: "sdkSecret", label: "SDK Secret", secret: true },
];

export function IntegrationsSettings() {
  const { setting, loading, save } = useMessagingSetting("zoom");
  const [enabled, setEnabled] = useState(false);
  const [config, setConfig] = useState<Record<string, string>>({});
  const [reveal, setReveal] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (loading) return;
    setEnabled(setting.enabled);
    setConfig(
      Object.fromEntries(
        Object.entries(setting.config).map(([k, v]) => [k, typeof v === "string" ? v : ""]),
      ),
    );
  }, [loading, setting]);

  async function onSave() {
    setSaving(true);
    try {
      await save({ provider: "zoom", enabled, config });
      toast.success("Zoom settings saved");
    } catch (e) {
      toast.error("Could not save", { description: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  function fieldGroup(fields: Field[]) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((f) => (
          <label key={f.k} className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {f.label}
            </span>
            <div className="relative">
              <Input
                type={f.secret && !reveal[f.k] ? "password" : "text"}
                value={config[f.k] ?? ""}
                onChange={(e) => setConfig((c) => ({ ...c, [f.k]: e.target.value }))}
                placeholder={f.placeholder}
                autoComplete="off"
                className="rounded-lg pr-9"
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
            {f.hint && (
              <span className="mt-1 block text-[11px] text-muted-foreground">{f.hint}</span>
            )}
          </label>
        ))}
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
        eyebrow="Admin"
        title="Integrations"
        description="Connect Zoom so coaches & mentors can schedule instant 1:1 calls that participants join inside the app — no redirects."
        icon={Plug}
      />

      <SectionCard
        title={
          <span className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#2D8CFF] text-white">
              <Video className="h-4 w-4" />
            </span>
            Zoom
          </span>
        }
        subtitle="Server-to-Server OAuth (create meetings) + Meeting SDK (join in-app)."
        action={
          <button
            type="button"
            onClick={() => setEnabled((v) => !v)}
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold",
              enabled
                ? "bg-[oklch(0.93_0.06_160)] text-[oklch(0.35_0.12_160)]"
                : "bg-muted text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                enabled ? "bg-[#10b981]" : "bg-muted-foreground/50",
              )}
            />
            {enabled ? "Enabled" : "Disabled"}
          </button>
        }
      >
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-5">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground">
                Server-to-Server OAuth app
              </p>
              {fieldGroup(S2S)}
            </div>
            <div className="border-t border-border pt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground">
                Meeting SDK app
              </p>
              {fieldGroup(SDK)}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
              <a
                href="https://marketplace.zoom.us/develop/create"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Create your Zoom apps
              </a>
              <Button
                onClick={onSave}
                disabled={saving}
                className="rounded-lg bg-gradient-navy text-primary-foreground hover:opacity-90"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}{" "}
                Save Zoom settings
              </Button>
            </div>

            <p className="rounded-lg bg-secondary/40 px-3 py-2 text-[11px] text-muted-foreground">
              Scopes needed: S2S OAuth → <code>meeting:write:admin</code>. Add your app domain to
              the Meeting SDK app's allow-list so the in-app player can load.
            </p>
          </div>
        )}
      </SectionCard>
    </motion.div>
  );
}
