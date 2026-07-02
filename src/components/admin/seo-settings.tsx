import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Globe,
  Loader2,
  Save,
  RotateCcw,
  Upload,
  Search,
  Share2,
  LineChart,
  Check,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/vkm/page-header";
import { SectionCard } from "@/components/vkm/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { uploadToStorage } from "@/lib/storage-upload";
import { useSeoSettings, SEO_DEFAULTS, type SeoSettings } from "@/components/admin/seo-data";

const GA_RE = /^G-[A-Z0-9]{6,}$/i;

export function SeoSettingsPage() {
  const { user } = useAuth();
  const { settings, loading, saving, save } = useSeoSettings();
  const [form, setForm] = useState<SeoSettings>(SEO_DEFAULTS);
  const [uploading, setUploading] = useState(false);
  const [dirty, setDirty] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setForm(settings);
    setDirty(false);
  }, [settings]);

  const set = <K extends keyof SeoSettings>(k: K, v: SeoSettings[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setDirty(true);
  };

  async function onImage(file: File | null) {
    if (!file || !user) return;
    setUploading(true);
    try {
      const safe = file.name.replace(/[^\w.-]+/g, "_");
      const url = await uploadToStorage(
        "chat-attachments",
        `seo/${Date.now()}-${safe}`,
        file,
        file.type || "image/png",
      );
      set("og_image_url", url);
      toast.success("Share image uploaded");
    } catch (e) {
      toast.error("Upload failed", { description: (e as Error).message });
    } finally {
      setUploading(false);
    }
  }

  async function onSave() {
    const gid = form.ga_measurement_id.trim();
    if (form.ga_enabled && gid && !GA_RE.test(gid)) {
      toast.error("Invalid Measurement ID", {
        description: "GA4 IDs look like G-XXXXXXXXXX.",
      });
      return;
    }
    try {
      await save({ ...form, ga_measurement_id: gid });
      setDirty(false);
      toast.success("SEO settings saved", {
        description: "Applied on next page load for all visitors.",
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

  const gaOk = !form.ga_measurement_id.trim() || GA_RE.test(form.ga_measurement_id.trim());
  const host = safeHost(form.canonical_url);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-5"
    >
      <PageHeader
        eyebrow="Admin · VK"
        title="SEO & Analytics"
        description="Control how the platform appears in search & social, and connect Google Analytics."
        icon={Globe}
        actions={
          <>
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => {
                setForm(SEO_DEFAULTS);
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
          <SectionCard
            title="Search appearance"
            subtitle="How the site shows up on Google & other search engines"
          >
            <div className="space-y-4">
              <Field
                label="Site title"
                hint={`Browser tab & search result heading · ${form.site_title.length}/60 ideal`}
              >
                <Input
                  value={form.site_title}
                  onChange={(e) => set("site_title", e.target.value)}
                  maxLength={70}
                />
              </Field>
              <Field
                label="Meta description"
                hint={`Search result snippet · ${form.meta_description.length}/160 ideal`}
              >
                <Textarea
                  value={form.meta_description}
                  onChange={(e) => set("meta_description", e.target.value)}
                  rows={3}
                  maxLength={200}
                />
              </Field>
              <Field label="Keywords" hint="Comma-separated (minor SEO signal)">
                <Input value={form.keywords} onChange={(e) => set("keywords", e.target.value)} />
              </Field>
              <Field label="Canonical URL" hint="The site's primary address">
                <Input
                  value={form.canonical_url}
                  onChange={(e) => set("canonical_url", e.target.value)}
                  placeholder="https://vkmentorship.com"
                />
              </Field>
              <ToggleRow
                label="Allow search engines to index"
                hint={
                  form.robots_index
                    ? "Search engines can list the site."
                    : "Site is hidden from search (noindex)."
                }
                checked={form.robots_index}
                onChange={(v) => set("robots_index", v)}
              />
            </div>
          </SectionCard>

          <SectionCard
            title="Social sharing"
            subtitle="The card shown when a link is pasted into WhatsApp, X, LinkedIn…"
          >
            <div className="space-y-4">
              <Field label="Share title (Open Graph)">
                <Input value={form.og_title} onChange={(e) => set("og_title", e.target.value)} />
              </Field>
              <Field label="Share description">
                <Textarea
                  value={form.og_description}
                  onChange={(e) => set("og_description", e.target.value)}
                  rows={2}
                />
              </Field>
              <Field label="Share image" hint="1200×630 recommended (PNG/JPG)">
                <div className="flex items-center gap-4">
                  <div className="h-16 w-28 shrink-0 overflow-hidden rounded-lg border border-border bg-secondary/40">
                    <img
                      src={form.og_image_url}
                      alt="Share preview"
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = "/icon-512.png";
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        void onImage(e.target.files?.[0] ?? null);
                        e.target.value = "";
                      }}
                    />
                    <Button
                      variant="outline"
                      className="rounded-xl"
                      onClick={() => fileRef.current?.click()}
                      disabled={uploading}
                    >
                      {uploading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                      Upload image
                    </Button>
                  </div>
                </div>
              </Field>
              <Field label="X / Twitter handle" hint="Optional, e.g. vkmentorship">
                <Input
                  value={form.twitter_handle}
                  onChange={(e) => set("twitter_handle", e.target.value.replace(/^@/, ""))}
                  placeholder="vkmentorship"
                />
              </Field>
            </div>
          </SectionCard>

          <SectionCard
            title="Google Analytics"
            subtitle="Track traffic & behaviour with GA4"
          >
            <div className="space-y-4">
              <ToggleRow
                label="Enable Google Analytics"
                hint="Loads gtag.js for every visitor when a valid ID is set."
                checked={form.ga_enabled}
                onChange={(v) => set("ga_enabled", v)}
              />
              <Field
                label="Measurement ID"
                hint="From GA4 → Admin → Data Streams → your web stream"
              >
                <Input
                  value={form.ga_measurement_id}
                  onChange={(e) => set("ga_measurement_id", e.target.value.trim())}
                  placeholder="G-XXXXXXXXXX"
                  className={`font-mono ${!gaOk ? "border-red-400 focus-visible:ring-red-300" : ""}`}
                />
              </Field>
              {!gaOk && (
                <p className="text-xs text-red-500">GA4 IDs look like G-XXXXXXXXXX.</p>
              )}
              <a
                href="https://analytics.google.com/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-navy hover:underline"
              >
                Open Google Analytics <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </SectionCard>

          <p className="rounded-xl border border-border bg-secondary/40 px-4 py-3 text-xs text-muted-foreground">
            Changes take effect on the <span className="font-medium text-foreground">next page load</span>{" "}
            for every visitor. Analytics only loads when it's enabled and a valid Measurement ID is set.
          </p>
        </div>

        {/* Live preview */}
        <div className="space-y-5 lg:sticky lg:top-4 lg:self-start">
          <SectionCard title="Search preview">
            <div className="rounded-xl border border-border bg-white p-3">
              <div className="flex items-center gap-1.5 text-xs text-[#4d5156]">
                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-gradient-navy text-[8px] font-bold text-white">
                  V
                </span>
                <span className="truncate">{host}</span>
              </div>
              <p className="mt-1 truncate text-[15px] font-medium leading-snug text-[#1a0dab]">
                {form.site_title || "Site title"}
              </p>
              <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-[#4d5156]">
                {form.meta_description || "Meta description preview…"}
              </p>
            </div>
            <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Search className="h-3 w-3" /> How Google may show this page
            </p>
          </SectionCard>

          <SectionCard title="Social card preview">
            <div className="overflow-hidden rounded-xl border border-border">
              <div className="aspect-[1200/630] w-full bg-secondary/40">
                <img
                  src={form.og_image_url}
                  alt="Share preview"
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = "/icon-512.png";
                  }}
                />
              </div>
              <div className="bg-[#f2f3f5] px-3 py-2">
                <p className="text-[10px] uppercase tracking-wide text-[#65676b]">{host}</p>
                <p className="truncate text-[13px] font-semibold text-[#050505]">
                  {form.og_title || "Share title"}
                </p>
                <p className="line-clamp-2 text-[11px] text-[#65676b]">
                  {form.og_description || "Share description…"}
                </p>
              </div>
            </div>
            <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Share2 className="h-3 w-3" /> WhatsApp / X / LinkedIn preview
            </p>
          </SectionCard>

          <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/40 px-4 py-3">
            <span className="flex items-center gap-2 text-xs font-medium text-foreground">
              <LineChart className="h-4 w-4 text-gold" /> Analytics
            </span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                form.ga_enabled && GA_RE.test(form.ga_measurement_id.trim())
                  ? "bg-[oklch(0.93_0.06_160)] text-[oklch(0.35_0.12_160)]"
                  : "bg-secondary text-muted-foreground"
              }`}
            >
              {form.ga_enabled && GA_RE.test(form.ga_measurement_id.trim()) ? "Active" : "Off"}
            </span>
          </div>

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
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-secondary/30 px-3.5 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function safeHost(url: string): string {
  try {
    return new URL(url).host || url;
  } catch {
    return url.replace(/^https?:\/\//, "") || "vkmentorship.com";
  }
}
