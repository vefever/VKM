import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Mic, Loader2, Play, Square, Volume2, Sparkles, Eye, EyeOff } from "lucide-react";
import { SectionCard } from "@/components/vkm/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { aiVoiceReply } from "@/lib/vkm/voice-test.functions";
import { ttsSynthesize, type TtsProvider } from "@/lib/vkm/tts.functions";

type Engine = "browser" | TtsProvider;

const ENGINES: { id: Engine; label: string; natural: boolean }[] = [
  { id: "browser", label: "Browser (free, robotic)", natural: false },
  { id: "azure", label: "Microsoft Azure — Telugu (natural)", natural: true },
  { id: "google", label: "Google Cloud — Telugu (natural / HD)", natural: true },
  { id: "openai", label: "Abhibots / OpenAI speech", natural: true },
];

// Sensible Telugu defaults + hints per provider.
const PRESET: Record<TtsProvider, { voice: string; hint: string; voices: string }> = {
  azure: {
    voice: "te-IN-ShrutiNeural",
    hint: "Azure Speech key + region (e.g. centralindia). Get it in Azure → Speech service → Keys.",
    voices: "te-IN-ShrutiNeural (female), te-IN-MohanNeural (male)",
  },
  google: {
    voice: "te-IN-Standard-A",
    hint: "Google Cloud API key with the Text-to-Speech API enabled.",
    voices: "te-IN-Standard-A/B, te-IN-Wavenet-A/B, or an HD voice like te-IN-Chirp3-HD-Achernar",
  },
  openai: {
    voice: "alloy",
    hint: "Uses your AI gateway's /audio/speech (leave key blank to reuse the configured AI key). Note: the Abhibots gateway is chat-only right now, so this may 404 until it exposes speech.",
    voices: "alloy, verse, aria… (provider-specific — Telugu quality varies)",
  },
};

export function VoiceTestPanel({ model }: { model?: string }) {
  const ask = useServerFn(aiVoiceReply);
  const tts = useServerFn(ttsSynthesize);

  const [input, setInput] = useState("నా బిజినెస్ ఎలా పెంచుకోవాలి? సింపుల్‌గా చెప్పు.");
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const [engine, setEngine] = useState<Engine>("browser");
  const [apiKey, setApiKey] = useState("");
  const [region, setRegion] = useState("centralindia");
  const [voice, setVoice] = useState("");
  const [reveal, setReveal] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Browser voices (only used for the "browser" engine).
  const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [browserVoiceURI, setBrowserVoiceURI] = useState("");
  const [rate, setRate] = useState(0.95);
  const [pitch, setPitch] = useState(1);
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;

  useEffect(() => {
    if (!supported) return;
    const load = () => {
      const list = window.speechSynthesis.getVoices();
      if (list.length) {
        setBrowserVoices(list);
        setBrowserVoiceURI((cur) => {
          if (cur && list.some((v) => v.voiceURI === cur)) return cur;
          const te = list.find((v) => /^te(-|_|$)/i.test(v.lang));
          const hi = list.find((v) => /^hi(-|_|$)/i.test(v.lang));
          const inEn = list.find((v) => /en-IN/i.test(v.lang));
          return (te || hi || inEn || list[0]).voiceURI;
        });
      }
    };
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, [supported]);

  const teluguVoice = useMemo(() => browserVoices.some((v) => /^te(-|_|$)/i.test(v.lang)), [browserVoices]);
  const isServer = engine !== "browser";
  const effectiveVoice = voice || (isServer ? PRESET[engine as TtsProvider].voice : "");

  function stop() {
    if (supported) window.speechSynthesis.cancel();
    audioRef.current?.pause();
    setSpeaking(false);
  }

  function browserSpeak(text: string) {
    if (!supported || !text.trim()) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const v = browserVoices.find((x) => x.voiceURI === browserVoiceURI);
    if (v) u.voice = v;
    u.lang = v?.lang || "te-IN";
    u.rate = rate;
    u.pitch = pitch;
    u.onstart = () => setSpeaking(true);
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    synth.speak(u);
  }

  async function serverSpeak(text: string) {
    setSpeaking(true);
    try {
      const r = await tts({
        data: {
          text,
          provider: engine as TtsProvider,
          apiKey: apiKey.trim() || undefined,
          region: region.trim() || undefined,
          voice: effectiveVoice || undefined,
        },
      });
      if (!r.ok || !r.audioBase64) {
        setSpeaking(false);
        toast.error("Voice failed", { description: r.error });
        return;
      }
      const el = audioRef.current;
      if (el) {
        el.src = `data:${r.mime};base64,${r.audioBase64}`;
        el.onended = () => setSpeaking(false);
        el.onerror = () => setSpeaking(false);
        await el.play();
      }
    } catch (e) {
      setSpeaking(false);
      toast.error("Voice failed", { description: (e as Error).message });
    }
  }

  function speak(text: string) {
    if (!text.trim()) return;
    stop();
    if (isServer) void serverSpeak(text);
    else browserSpeak(text);
  }

  async function generate() {
    if (!input.trim() || busy) return;
    setBusy(true);
    setReply("");
    try {
      const r = await ask({ data: { text: input.trim(), model: model || undefined } });
      if (!r.ok) {
        toast.error("AI reply failed", { description: r.error });
        return;
      }
      setReply(r.text);
      setTimeout(() => speak(r.text), 150);
    } catch (e) {
      toast.error("AI reply failed", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <SectionCard
      title={
        <span className="flex items-center gap-2">
          <Mic className="h-4 w-4 text-navy" /> AI voice test (Telugu)
        </span>
      }
      subtitle="Type a message → the AI replies in spoken-style Telugu → it's read aloud with your chosen voice engine"
    >
      <div className="space-y-3">
        <p className="text-[11px] text-muted-foreground">
          Brain model: <span className="font-mono font-medium text-foreground">{model || "saved default"}</span>
          <span className="text-muted-foreground"> (from the model picker above — pick abhibots-model there to test it)</span>
        </p>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={2}
          placeholder="Type in Telugu, Tenglish or English…"
          className="w-full resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />

        {/* Voice engine */}
        <div className="space-y-2 rounded-xl border border-border p-3">
          <Label className="text-xs">Voice engine</Label>
          <select
            value={engine}
            onChange={(e) => {
              setEngine(e.target.value as Engine);
              setVoice("");
            }}
            className="h-10 w-full rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {ENGINES.map((e) => (
              <option key={e.id} value={e.id}>{e.label}</option>
            ))}
          </select>

          {isServer && (
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs">API key {engine === "openai" && <span className="text-muted-foreground">(blank = reuse AI key)</span>}</Label>
                <div className="relative">
                  <Input
                    type={reveal ? "text" : "password"}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={`${engine} API key`}
                    className="h-10 rounded-lg pr-9"
                    autoComplete="off"
                  />
                  <button type="button" onClick={() => setReveal((r) => !r)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              {engine === "azure" && (
                <div className="space-y-1">
                  <Label className="text-xs">Region</Label>
                  <Input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="centralindia" className="h-10 rounded-lg" />
                </div>
              )}
              <div className="space-y-1">
                <Label className="text-xs">Voice name</Label>
                <Input value={effectiveVoice} onChange={(e) => setVoice(e.target.value)} placeholder={PRESET[engine as TtsProvider].voice} className="h-10 rounded-lg" />
              </div>
              <p className="text-[11px] text-muted-foreground sm:col-span-2">
                {PRESET[engine as TtsProvider].hint} Telugu voices: <span className="font-mono">{PRESET[engine as TtsProvider].voices}</span>
              </p>
            </div>
          )}

          {!isServer && supported && (
            <div className="grid gap-2 sm:grid-cols-3">
              <label className="space-y-1 text-xs sm:col-span-3">
                <span className="font-medium text-foreground">System voice</span>
                <select value={browserVoiceURI} onChange={(e) => setBrowserVoiceURI(e.target.value)} className="h-10 w-full rounded-lg border border-input bg-background px-2 text-sm">
                  {browserVoices.map((v) => (
                    <option key={v.voiceURI} value={v.voiceURI}>{v.name} · {v.lang}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-xs">
                <span className="font-medium text-foreground">Rate · {rate.toFixed(2)}</span>
                <input type="range" min={0.5} max={1.5} step={0.05} value={rate} onChange={(e) => setRate(Number(e.target.value))} className="w-full" />
              </label>
              <label className="space-y-1 text-xs">
                <span className="font-medium text-foreground">Pitch · {pitch.toFixed(2)}</span>
                <input type="range" min={0.5} max={1.5} step={0.05} value={pitch} onChange={(e) => setPitch(Number(e.target.value))} className="w-full" />
              </label>
              {!teluguVoice && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 sm:col-span-3">
                  No Telugu (te-IN) system voice here — it'll fall back and mispronounce Telugu. Pick Azure or Google above for a natural Telugu voice.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={generate} disabled={busy || !input.trim()} className="rounded-xl bg-gradient-navy text-primary-foreground hover:opacity-90">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Ask AI &amp; speak
          </Button>
          {reply && (speaking ? (
            <Button variant="outline" onClick={stop} className="rounded-xl"><Square className="h-4 w-4" /> Stop</Button>
          ) : (
            <Button variant="outline" onClick={() => speak(reply)} className="rounded-xl"><Play className="h-4 w-4" /> Replay</Button>
          ))}
          <Button variant="ghost" size="sm" onClick={() => speak(input)} className="rounded-lg text-muted-foreground">
            <Volume2 className="h-3.5 w-3.5" /> Speak my text
          </Button>
        </div>

        {reply && (
          <div className="rounded-xl border border-border bg-secondary/30 p-3">
            <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <Volume2 className="h-3.5 w-3.5" /> AI reply
            </p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{reply}</p>
          </div>
        )}

        <audio ref={audioRef} className="hidden" />

        <p className={cn("rounded-xl border border-dashed border-border p-3 text-[11px] leading-relaxed text-muted-foreground")}>
          The AI reply uses your existing chat gateway. Voice is separate: <span className="font-medium text-foreground">Browser</span> is free but robotic;
          <span className="font-medium text-foreground"> Azure</span> and <span className="font-medium text-foreground">Google</span> give natural human Telugu (paste their key above).
          Keys are used server-side only and never shipped to the browser.
        </p>
      </div>
    </SectionCard>
  );
}
