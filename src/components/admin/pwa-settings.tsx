import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Smartphone, Loader2, Upload, RotateCcw, Save, Check } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/vkm/page-header";
import { SectionCard } from "@/components/vkm/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { uploadToStorage } from "@/lib/storage-upload";
import { usePwaSettings, PWA_DEFAULTS, type PwaSettings } from "@/components/admin/pwa-data";

export function PwaSettingsPage() {
  const { user } = useAuth();
  const { settings, loading, saving, save } = usePwaSettings();
  const [form, setForm] = useState<PwaSettings>(PWA_DEFAULTS);
  const [uploading, setUploading] = useState(false);
  const [dirty, setDirty] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setForm(settings);
    setDirty(false);
  }, [settings]);

  const set = <K extends keyof PwaSettings>(k: K, v: PwaSettings[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setDirty(true);
  };

  async function onIcon(file: File | null) {
    if (!file || !user) return;
    setUploading(true);
    try {
      const safe = file.name.replace(/[^\w.-]+/g, "_");
      const url = await uploadToStorage(
        "chat-attachments",
        `pwa/${Date.now()}-${safe}`,
        file,
        file.type || "image/png",
        { skipCompress: true }, // keep the icon crisp
      );
      set("icon_url", url);
      toast.success("Icon uploaded");
    } catch (e) {
      toast.error("Icon upload failed", { description: (e as Error).message });
    } finally {
      setUploading(false);
    }
  }

  async function onSave() {
    try {
      await save(form);
      setDirty(false);
      toast.success("PWA settings saved", {
        description: "New installs pick this up; reinstall to refresh an existing app.",
      });
    } catch (e) {
      toast.error("Couldn't save", { description: (e as Error).message });
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
        title="Installable App (PWA)"
        description="Control how the app appears when installed — name, icon, and splash colors."
        icon={Smartphone}
        actions={
          <>
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => {
                setForm(PWA_DEFAULTS);
                setDirty(true);
              }}
            >
              <RotateCcw className="h-4 w-4" /> Reset to default
            </Button>
            <Button
              className="rounded-full bg-gradient-navy"
              onClick={onSave}
              disabled={saving || !dirty}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{" "}
              Save changes
            </Button>
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        {/* Form */}
        <div className="space-y-5">
          <SectionCard title="App identity" subtitle="Names shown on the home screen & install prompts">
            <div className="space-y-4">
              <Field label="App name" hint="Full name (Android install, splash)">
                <Input value={form.app_name} onChange={(e) => set("app_name", e.target.value)} maxLength={45} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Short name" hint="Home-screen label (keep it short)">
                  <Input value={form.short_name} onChange={(e) => set("short_name", e.target.value)} maxLength={12} />
                </Field>
                <Field label="iOS title" hint="Under the icon on iPhone">
                  <Input value={form.apple_title} onChange={(e) => set("apple_title", e.target.value)} maxLength={15} />
                </Field>
              </div>
              <Field label="Description" hint="Shown in some app stores / install sheets">
                <Textarea
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                  rows={3}
                />
              </Field>
            </div>
          </SectionCard>

          <SectionCard title="Icon" subtitle="Square PNG, 512×512 recommended">
            <div className="flex items-center gap-4">
              <IconPreview src={form.icon_url} className="h-20 w-20 rounded-2xl" />
              <div className="space-y-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={(e) => {
                    void onIcon(e.target.files?.[0] ?? null);
                    e.target.value = "";
                  }}
                />
                <Button
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  Upload icon
                </Button>
                <p className="text-[11px] text-muted-foreground">
                  Keep a bit of padding so a maskable (circular) crop looks right.
                </p>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Colors" subtitle="Theme (status bar) & splash background">
            <div className="grid grid-cols-2 gap-4">
              <ColorField label="Theme color" value={form.theme_color} onChange={(v) => set("theme_color", v)} />
              <ColorField
                label="Background (splash)"
                value={form.background_color}
                onChange={(v) => set("background_color", v)}
              />
            </div>
          </SectionCard>

          <p className="rounded-xl border border-border bg-secondary/40 px-4 py-3 text-xs text-muted-foreground">
            Changes apply to <span className="font-medium text-foreground">new installs</span> right away.
            An already-installed app refreshes its name/icon when the device re-reads the manifest, or
            after a reinstall. The address-bar/status-bar color and iOS icon update on next load.
          </p>
        </div>

        {/* Live preview */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <SectionCard title="Live preview">
            <div className="space-y-5">
              {/* Home-screen tile */}
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Home screen
                </p>
                <div className="flex items-end gap-6 rounded-2xl bg-gradient-to-b from-secondary/60 to-secondary/20 p-5">
                  {[form.short_name, form.apple_title].map((label, i) => (
                    <div key={i} className="flex w-16 flex-col items-center gap-1.5">
                      <IconPreview src={form.icon_url} className="h-14 w-14 rounded-[14px] shadow-vkm" />
                      <span className="max-w-full truncate text-[11px] font-medium text-foreground">
                        {label || "App"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Splash */}
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Splash screen
                </p>
                <div
                  className="flex aspect-[9/16] max-h-72 flex-col items-center justify-center gap-3 rounded-2xl border border-border"
                  style={{ background: form.background_color }}
                >
                  <IconPreview src={form.icon_url} className="h-16 w-16 rounded-2xl shadow-vkm-float" />
                  <span
                    className="text-sm font-semibold"
                    style={{ color: readableOn(form.background_color) }}
                  >
                    {form.app_name}
                  </span>
                  <span className="h-1 w-10 rounded-full" style={{ background: form.theme_color }} />
                </div>
              </div>

              {dirty && (
                <p className="flex items-center gap-1.5 text-xs text-amber-600">
                  <Check className="h-3.5 w-3.5" /> Unsaved changes
                </p>
              )}
            </div>
          </SectionCard>
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

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#0B2545"}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-border bg-transparent p-0.5"
          aria-label={label}
        />
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="font-mono text-sm" />
      </div>
    </div>
  );
}

function IconPreview({ src, className }: { src: string; className?: string }) {
  return (
    <img
      src={src}
      alt="App icon"
      className={`shrink-0 border border-border object-cover ${className ?? ""}`}
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).src = "/icon-512.png";
      }}
    />
  );
}

// Pick black/white text for legibility on a hex background.
function readableOn(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return "#ffffff";
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255,
    g = (n >> 8) & 255,
    b = n & 255;
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? "#0B2545" : "#ffffff";
}
