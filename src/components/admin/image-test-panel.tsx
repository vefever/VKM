import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ImageIcon, Loader2, Sparkles, Download, ExternalLink } from "lucide-react";
import { SectionCard } from "@/components/vkm/section-card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { generateTestImage } from "@/lib/vkm/image-test.functions";

const SIZES = ["512x512", "768x768", "1024x1024", "1024x1792", "1792x1024"];

// Admin image-generation test: type a prompt → the AI gateway returns an image.
export function ImageTestPanel({ model }: { model?: string }) {
  const gen = useServerFn(generateTestImage);
  const [prompt, setPrompt] = useState("A calm sunrise over hills, warm golden light, cinematic");
  const [size, setSize] = useState("1024x1024");
  const [busy, setBusy] = useState(false);
  const [img, setImg] = useState<string>("");
  const [balance, setBalance] = useState<number | null>(null);

  async function run() {
    if (!prompt.trim() || busy) return;
    setBusy(true);
    setImg("");
    try {
      const r = await gen({ data: { prompt: prompt.trim(), model: model || undefined, size } });
      if (!r.ok) {
        toast.error("Image failed", { description: r.error });
        return;
      }
      setImg(r.url || (r.b64 ? `data:image/png;base64,${r.b64}` : ""));
      setBalance(r.balance ?? null);
    } catch (e) {
      toast.error("Image failed", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <SectionCard
      title={
        <span className="flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-navy" /> AI image test
        </span>
      }
      subtitle="Type a prompt → the AI generates an image (uses the model picked above)"
    >
      <div className="space-y-3">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={2}
          placeholder="Describe the image you want…"
          className="w-full resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />

        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Size</Label>
            <select value={size} onChange={(e) => setSize(e.target.value)} className="h-10 rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {SIZES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <Button onClick={run} disabled={busy || !prompt.trim()} className="rounded-xl bg-gradient-navy text-primary-foreground hover:opacity-90">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Generate image
          </Button>
          {balance != null && (
            <span className="text-[11px] text-muted-foreground">Credits left: <span className="font-medium text-foreground">{balance}</span></span>
          )}
        </div>

        {busy && (
          <div className="flex aspect-video w-full max-w-md items-center justify-center rounded-2xl border border-dashed border-border bg-secondary/30">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {img && !busy && (
          <div className="space-y-2">
            <img src={img} alt="Generated" className="w-full max-w-md rounded-2xl border border-border shadow-vkm" />
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="rounded-lg" asChild>
                <a href={img} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" /> Open</a>
              </Button>
              <Button variant="outline" size="sm" className="rounded-lg" asChild>
                <a href={img} download="vkm-ai-image.jpg"><Download className="h-3.5 w-3.5" /> Download</a>
              </Button>
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  );
}
