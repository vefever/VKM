import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Bot, Loader2, Save, Send, Eye, EyeOff, Zap, CheckCircle2, ShieldAlert } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { PageHeader } from "@/components/vkm/page-header";
import { SectionCard } from "@/components/vkm/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { testAiProvider } from "@/lib/vkm/advisor.functions";

type Provider = "openai" | "anthropic";

const PRESETS: Record<string, { provider: Provider; baseUrl: string; model: string; maxTokens: number; label: string; hint: string }> = {
  abhibots: { provider: "anthropic", baseUrl: "https://opus.abhibots.com/v1", model: "claude-haiku-4-5", maxTokens: 800, label: "Anthropic gateway", hint: "opus.abhibots.com · Messages API" },
  openai: { provider: "openai", baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini", maxTokens: 800, label: "OpenAI", hint: "api.openai.com · Chat Completions" },
  openrouter: { provider: "openai", baseUrl: "https://openrouter.ai/api/v1", model: "anthropic/claude-3.5-haiku", maxTokens: 800, label: "OpenRouter", hint: "openrouter.ai · many models" },
};

export function AiSettings() {
  const test = useServerFn(testAiProvider);
  const [provider, setProvider] = useState<Provider>("anthropic");
  const [baseUrl, setBaseUrl] = useState("https://opus.abhibots.com/v1");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("claude-haiku-4-5");
  const [maxTokens, setMaxTokens] = useState(800);
  const [enabled, setEnabled] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testReply, setTestReply] = useState<string | null>(null);

  useEffect(() => {
    void supabase
      .from("messaging_settings")
      .select("provider, enabled, config")
      .eq("id", "ai")
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          const c = (data.config ?? {}) as Record<string, string>;
          setProvider(data.provider === "anthropic" ? "anthropic" : "openai");
          setEnabled(!!data.enabled);
          if (c.baseUrl) setBaseUrl(c.baseUrl);
          if (c.apiKey) setApiKey(c.apiKey);
          if (c.model) setModel(c.model);
          if (c.maxTokens) setMaxTokens(Number(c.maxTokens) || 800);
        }
        setLoading(false);
      }, () => setLoading(false));
  }, []);

  function applyPreset(key: keyof typeof PRESETS) {
    const p = PRESETS[key];
    setProvider(p.provider);
    setBaseUrl(p.baseUrl);
    setModel(p.model);
    setMaxTokens(p.maxTokens);
  }

  async function save() {
    if (!apiKey.trim() || !baseUrl.trim() || !model.trim()) {
      toast.error("API key, base URL and model are required");
      return;
    }
    setSaving(true);
    try {
      const on = !!apiKey.trim();
      const { error } = await supabase.from("messaging_settings").upsert(
        {
          id: "ai",
          provider,
          enabled: on,
          config: { apiKey: apiKey.trim(), baseUrl: baseUrl.trim().replace(/\/$/, ""), model: model.trim(), maxTokens: String(maxTokens) },
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      );
      if (error) throw error;
      setEnabled(on);
      toast.success("AI Advisor saved & enabled", { description: `${provider === "anthropic" ? "Anthropic" : "OpenAI"} · ${model}` });
    } catch (e) { toast.error("Could not save", { description: (e as Error).message }); }
    finally { setSaving(false); }
  }

  async function sendTest() {
    if (!apiKey.trim() || !baseUrl.trim() || !model.trim()) {
      toast.error("Fill in the API key, base URL and model first");
      return;
    }
    setTesting(true); setTestReply(null);
    try {
      // Test the values on screen so you can verify before saving.
      const r = await test({
        data: {
          prompt: "Reply with one short sentence confirming the AI Advisor is connected.",
          provider, baseUrl: baseUrl.trim(), apiKey: apiKey.trim(), model: model.trim(), maxTokens,
        },
      });
      if (!r.ok) { toast.error("Test failed", { description: r.error }); return; }
      setTestReply(r.reply ?? "");
      toast.success("AI provider is working", { description: `${r.provider} · ${r.model}` });
    } catch (e) { toast.error("Test failed", { description: (e as Error).message }); }
    finally { setTesting(false); }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-5">
      <PageHeader
        eyebrow="Admin"
        title="AI Configurations"
        description="Power the participants' AI Business Advisor. Works with any OpenAI-compatible endpoint or the Anthropic Messages API. Use a low-token model to keep costs down."
        icon={Bot}
      />

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          <SectionCard title="Provider" subtitle="Pick the API shape your endpoint uses">
            <div className="grid gap-3 sm:grid-cols-2">
              <ProviderCard active={provider === "anthropic"} onClick={() => setProvider("anthropic")} title="Anthropic (Messages API)" desc="x-api-key + anthropic-version · /v1/messages. e.g. opus.abhibots.com." />
              <ProviderCard active={provider === "openai"} onClick={() => setProvider("openai")} title="OpenAI-compatible" desc="Bearer token · /chat/completions. OpenAI, OpenRouter, Groq…" />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Quick fill:</span>
              {(Object.keys(PRESETS) as (keyof typeof PRESETS)[]).map((k) => (
                <button key={k} type="button" onClick={() => applyPreset(k)} className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-foreground hover:bg-secondary/60" title={PRESETS[k].hint}>
                  {PRESETS[k].label}
                </button>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Credentials & model">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field className="sm:col-span-2" label="Base URL" value={baseUrl} onChange={setBaseUrl} placeholder="https://opus.abhibots.com/v1" />
              <div className="space-y-1.5 sm:col-span-2">
                <Label>API key</Label>
                <div className="relative">
                  <Input type={reveal ? "text" : "password"} value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="ak-… or sk-…" className="h-10 rounded-xl pr-9" autoComplete="off" />
                  <button type="button" onClick={() => setReveal((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" aria-label="Toggle visibility">
                    {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Field label="Model" value={model} onChange={setModel} placeholder="claude-haiku-4-5" />
              <div className="space-y-1.5">
                <Label>Max tokens per reply</Label>
                <Input type="number" inputMode="numeric" value={maxTokens} onChange={(e) => setMaxTokens(Number(e.target.value) || 0)} className="h-10 rounded-xl" />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-gold/30 bg-gold/[0.06] px-3 py-2">
              <Zap className="h-4 w-4 text-gold" />
              <span className="text-xs text-muted-foreground">Low-token preset — cheaper, faster replies.</span>
              <button type="button" onClick={() => { setModel(provider === "anthropic" ? "claude-haiku-4-5" : "gpt-4o-mini"); setMaxTokens(512); }} className="rounded-full bg-gradient-navy px-3 py-1 text-xs font-semibold text-primary-foreground">
                Use low-token model
              </button>
            </div>
            <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
              <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
              The key is stored server-side and used only by the advisor's server function — it never ships to participants' browsers.
            </p>
          </SectionCard>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={save} disabled={saving} className="rounded-xl bg-gradient-navy text-primary-foreground hover:opacity-90">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save & enable
            </Button>
            <Button variant="outline" onClick={sendTest} disabled={testing} className="rounded-xl">
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send test
            </Button>
            {enabled && (
              <span className="inline-flex items-center gap-1.5 text-sm text-[oklch(0.5_0.12_160)]"><CheckCircle2 className="h-4 w-4" /> Active</span>
            )}
          </div>

          {testReply && (
            <SectionCard title="Test reply">
              <p className="whitespace-pre-wrap text-sm text-foreground">{testReply}</p>
            </SectionCard>
          )}
        </>
      )}
    </motion.div>
  );
}

function ProviderCard({ active, onClick, title, desc }: { active: boolean; onClick: () => void; title: string; desc: string }) {
  return (
    <button type="button" onClick={onClick} className={cn("rounded-2xl border p-4 text-left transition-all", active ? "border-navy bg-navy/[0.04] ring-2 ring-navy/30" : "border-border bg-card hover:border-navy/30")}>
      <p className="font-semibold text-foreground">{title}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
    </button>
  );
}

function Field({ label, value, onChange, placeholder, className }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-10 rounded-xl" />
    </div>
  );
}
