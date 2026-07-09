import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Mic, Loader2, Play, Square, Volume2, Sparkles } from "lucide-react";
import { SectionCard } from "@/components/vkm/section-card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { aiVoiceReply } from "@/lib/vkm/voice-test.functions";

// Admin AI voice test: type a message → the configured AI replies in natural
// spoken-style Telugu → the browser speaks it aloud (Web Speech synthesis). Lets
// an admin sanity-check the model's Telugu + hear it, before any real voice
// feature. Browser voices are free but robotic; truly natural Telugu needs a
// dedicated TTS provider (e.g. Sarvam AI) — flagged in the UI.
export function VoiceTestPanel() {
  const ask = useServerFn(aiVoiceReply);
  const [input, setInput] = useState("నా బిజినెస్ ఎలా పెంచుకోవాలి? సింపుల్‌గా చెప్పు.");
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceURI, setVoiceURI] = useState<string>("");
  const [rate, setRate] = useState(0.95);
  const [pitch, setPitch] = useState(1);

  const supported = typeof window !== "undefined" && "speechSynthesis" in window;

  // Load available system voices (getVoices() is async on Chrome).
  useEffect(() => {
    if (!supported) return;
    const load = () => {
      const list = window.speechSynthesis.getVoices();
      if (list.length) {
        setVoices(list);
        // Prefer a Telugu voice, then any Indian voice, else the first.
        setVoiceURI((cur) => {
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

  const teluguVoice = useMemo(() => voices.some((v) => /^te(-|_|$)/i.test(v.lang)), [voices]);
  const stopRef = useRef(false);

  async function generate() {
    if (!input.trim() || busy) return;
    setBusy(true);
    setReply("");
    try {
      const r = await ask({ data: { text: input.trim() } });
      if (!r.ok) {
        toast.error("AI reply failed", { description: r.error });
        return;
      }
      setReply(r.text);
      // Auto-play the spoken reply for a true "voice" test.
      setTimeout(() => speak(r.text), 150);
    } catch (e) {
      toast.error("AI reply failed", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  function speak(text: string) {
    if (!supported || !text.trim()) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    stopRef.current = false;
    const u = new SpeechSynthesisUtterance(text);
    const v = voices.find((x) => x.voiceURI === voiceURI);
    if (v) u.voice = v;
    u.lang = v?.lang || "te-IN";
    u.rate = rate;
    u.pitch = pitch;
    u.onstart = () => setSpeaking(true);
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    synth.speak(u);
  }

  function stop() {
    if (!supported) return;
    stopRef.current = true;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }

  return (
    <SectionCard
      title={
        <span className="flex items-center gap-2">
          <Mic className="h-4 w-4 text-navy" /> AI voice test (Telugu)
        </span>
      }
      subtitle="Type a message → the AI replies in spoken-style Telugu → your browser reads it aloud"
    >
      <div className="space-y-3">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={2}
          placeholder="Type in Telugu, Tenglish or English…"
          className="w-full resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={generate} disabled={busy || !input.trim()} className="rounded-xl bg-gradient-navy text-primary-foreground hover:opacity-90">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Ask AI &amp; speak
          </Button>
          {reply && (
            speaking ? (
              <Button variant="outline" onClick={stop} className="rounded-xl">
                <Square className="h-4 w-4" /> Stop
              </Button>
            ) : (
              <Button variant="outline" onClick={() => speak(reply)} disabled={!supported} className="rounded-xl">
                <Play className="h-4 w-4" /> Replay
              </Button>
            )
          )}
        </div>

        {reply && (
          <div className="rounded-xl border border-border bg-secondary/30 p-3">
            <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <Volume2 className="h-3.5 w-3.5" /> AI reply
            </p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{reply}</p>
          </div>
        )}

        {/* Voice controls */}
        {supported ? (
          <div className="grid gap-3 rounded-xl border border-border p-3 sm:grid-cols-3">
            <label className="space-y-1 text-xs sm:col-span-3">
              <span className="font-medium text-foreground">Voice</span>
              <select
                value={voiceURI}
                onChange={(e) => setVoiceURI(e.target.value)}
                className="h-10 w-full rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {voices.map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name} · {v.lang}
                  </option>
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
            <div className="flex items-end sm:justify-end">
              <Button variant="outline" size="sm" onClick={() => speak(reply || input)} disabled={!supported} className="rounded-lg">
                <Play className="h-3.5 w-3.5" /> Test voice
              </Button>
            </div>
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">
            This browser doesn't support speech synthesis — try Chrome, Edge or Safari.
          </p>
        )}

        <p
          className={cn(
            "rounded-xl border border-dashed p-3 text-[11px] leading-relaxed",
            teluguVoice ? "border-border text-muted-foreground" : "border-amber-400/50 bg-amber-50/40 text-amber-700 dark:bg-amber-950/10 dark:text-amber-400",
          )}
        >
          {teluguVoice
            ? "A Telugu (te-IN) system voice was found — pick it above. Note: browser voices sound robotic. For a natural, human-like Telugu voice, a dedicated TTS provider (e.g. Sarvam AI) is needed — say the word and I'll wire it in."
            : "No Telugu (te-IN) voice is installed on this device, so it falls back to another voice and may mispronounce Telugu. Install a Telugu voice in your OS, or use a dedicated TTS provider (e.g. Sarvam AI) for a natural human Telugu voice."}
        </p>
      </div>
    </SectionCard>
  );
}
