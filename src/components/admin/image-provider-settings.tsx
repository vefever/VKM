import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Eye, EyeOff, ImageIcon, Loader2, Save } from "lucide-react";
import { SectionCard } from "@/components/vkm/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImageTestPanel } from "@/components/admin/image-test-panel";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type ImageProvider = "openai" | "gemini";

// OpenAI uses /images/generations; Gemini uses its native
// /models/{model}:generateContent. Google's OpenAI-compatible images endpoint
// only serves the older 2.5 model, so the native one is what reaches Nano
// Banana 2 — see src/lib/vkm/image-provider.ts.
const PRESETS: Record<
  ImageProvider,
  { baseUrl: string; model: string; label: string; hint: string; keyHint: string }
> = {
  openai: {
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-image-1-mini",
    label: "OpenAI",
    hint: "api.openai.com",
    keyHint: "sk-… from platform.openai.com. Image models need org verification.",
  },
  gemini: {
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    model: "gemini-3.1-flash-lite-image",
    label: "Google AI Studio (Gemini)",
    hint: "generativelanguage.googleapis.com · Nano Banana",
    keyHint: "Gemini API key from aistudio.google.com/apikey.",
  },
};

const CUSTOM_MODEL = "__custom__";

// Every id here was confirmed to generate against a live key. Cheapest first —
// the first entry of each list is the default.
const MODELS: Record<ImageProvider, { id: string; label: string; caps: string }[]> = {
  openai: [
    { id: "gpt-image-1-mini", label: "GPT Image 1 Mini", caps: "Cheapest - default" },
    { id: "gpt-image-1", label: "GPT Image 1", caps: "Higher quality, slower" },
    { id: "gpt-image-1.5", label: "GPT Image 1.5", caps: "Improved detail" },
    { id: "gpt-image-2", label: "GPT Image 2", caps: "Latest, up to 4K, priciest" },
    { id: "dall-e-3", label: "DALL-E 3", caps: "Legacy" },
  ],
  gemini: [
    {
      id: "gemini-3.1-flash-lite-image",
      label: "Nano Banana Lite",
      caps: "Cheapest + fastest (~6s) - default",
    },
    { id: "gemini-3.1-flash-image", label: "Nano Banana 2 Flash", caps: "Balanced (~12s)" },
    { id: "gemini-3-pro-image", label: "Nano Banana 2 Pro", caps: "Best quality (~20s)" },
    { id: "gemini-2.5-flash-image", label: "Nano Banana 1", caps: "Previous generation" },
  ],
};

/**
 * Image-generation provider, stored separately from the chat advisor's config
 * (messaging_settings id='ai_image' vs 'ai'). They must be independent: the
 * advisor commonly runs on Anthropic, which generates no images at all.
 */
export function ImageProviderSettings() {
  const [provider, setProvider] = useState<ImageProvider>("openai");
  const [baseUrl, setBaseUrl] = useState(PRESETS.openai.baseUrl);
  // One key per provider, so switching between OpenAI and Gemini doesn't make
  // you re-paste the other one.
  const [keys, setKeys] = useState<Record<ImageProvider, string>>({ openai: "", gemini: "" });
  const [model, setModel] = useState(PRESETS.openai.model);
  const [customModel, setCustomModel] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void supabase
      .from("messaging_settings")
      .select("provider, enabled, config")
      .eq("id", "ai_image")
      .maybeSingle()
      .then(
        ({ data }) => {
          if (data) {
            const c = (data.config ?? {}) as {
              apiKey?: string;
              baseUrl?: string;
              model?: string;
              keys?: Partial<Record<ImageProvider, string>>;
            };
            const p: ImageProvider = data.provider === "gemini" ? "gemini" : "openai";
            setProvider(p);
            setEnabled(!!data.enabled);
            if (c.baseUrl) setBaseUrl(c.baseUrl);
            // `apiKey` is the pre-per-provider shape; treat it as this row's key.
            setKeys({
              openai: c.keys?.openai ?? (p === "openai" ? (c.apiKey ?? "") : ""),
              gemini: c.keys?.gemini ?? (p === "gemini" ? (c.apiKey ?? "") : ""),
            });
            if (c.model) {
              if (MODELS[p].some((m) => m.id === c.model)) setModel(c.model);
              else {
                setModel(CUSTOM_MODEL);
                setCustomModel(c.model);
              }
            }
          }
          setLoading(false);
        },
        () => setLoading(false),
      );
  }, []);

  function applyProvider(p: ImageProvider) {
    setProvider(p);
    setBaseUrl(PRESETS[p].baseUrl);
    setModel(PRESETS[p].model);
    setCustomModel("");
  }

  const effectiveModel = (model === CUSTOM_MODEL ? customModel : model).trim();
  const apiKey = keys[provider];

  async function save() {
    if (!apiKey.trim() || !baseUrl.trim() || !effectiveModel) {
      toast.error("API key, base URL and model are required");
      return;
    }
    setSaving(true);
    try {
      const on = !!apiKey.trim();
      const { error } = await supabase.from("messaging_settings").upsert(
        {
          id: "ai_image",
          provider,
          enabled: on,
          config: {
            // Both keys persist; the server picks the active provider's.
            keys: { openai: keys.openai.trim(), gemini: keys.gemini.trim() },
            baseUrl: baseUrl.trim().replace(/\/$/, ""),
            model: effectiveModel,
          },
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      );
      if (error) throw error;
      setEnabled(on);
      toast.success("Image provider saved & enabled", {
        description: `${PRESETS[provider].label} · ${effectiveModel}`,
      });
    } catch (e) {
      toast.error("Could not save", { description: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <SectionCard title="Image generation">
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      title={
        <span className="flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-navy" /> Image generation
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-semibold",
              enabled
                ? "bg-[oklch(0.93_0.06_150)] text-[oklch(0.4_0.12_150)]"
                : "bg-secondary text-muted-foreground",
            )}
          >
            {enabled ? "On" : "Off"}
          </span>
        </span>
      }
      subtitle="Powers AI images on the participants' Vision Board. Kept separate from the advisor above — the advisor often runs on Anthropic, which can't generate images."
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          {(Object.keys(PRESETS) as ImageProvider[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => applyProvider(p)}
              className={cn(
                "rounded-xl border p-3 text-left transition-all",
                provider === p
                  ? "border-gold bg-secondary/40 shadow-vkm"
                  : "border-border hover:border-gold/50",
              )}
            >
              <p className="text-sm font-semibold text-foreground">{PRESETS[p].label}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{PRESETS[p].hint}</p>
            </button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">Base URL</Label>
            <Input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              className="h-10 rounded-lg font-mono text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">API key</Label>
            <div className="relative">
              <Input
                type={reveal ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setKeys((k) => ({ ...k, [provider]: e.target.value }))}
                placeholder="Paste the provider key"
                className="h-10 rounded-lg pr-10 font-mono text-xs"
              />
              <button
                type="button"
                onClick={() => setReveal((r) => !r)}
                aria-label={reveal ? "Hide API key" : "Show API key"}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground">{PRESETS[provider].keyHint}</p>
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Model</Label>
          <div className="flex flex-wrap gap-2">
            {MODELS[provider].map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setModel(m.id)}
                title={m.caps}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  model === m.id
                    ? "border-gold bg-gradient-gold text-navy"
                    : "border-border text-muted-foreground hover:border-gold/50",
                )}
              >
                {m.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setModel(CUSTOM_MODEL)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                model === CUSTOM_MODEL
                  ? "border-gold bg-gradient-gold text-navy"
                  : "border-border text-muted-foreground hover:border-gold/50",
              )}
            >
              Custom
            </button>
          </div>
          {model === CUSTOM_MODEL && (
            <Input
              value={customModel}
              onChange={(e) => setCustomModel(e.target.value)}
              placeholder="exact model id"
              className="mt-2 h-10 rounded-lg font-mono text-xs"
            />
          )}
        </div>

        <Button onClick={() => void save()} disabled={saving} className="rounded-full">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save image provider
        </Button>

        <ImageTestPanel model={effectiveModel} />
      </div>
    </SectionCard>
  );
}
