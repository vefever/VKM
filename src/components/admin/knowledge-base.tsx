import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { BrainCircuit, Loader2, Upload, Trash2, Search, FileText, Database } from "lucide-react";
import { PageHeader } from "@/components/vkm/page-header";
import { SectionCard } from "@/components/vkm/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ingestKnowledge,
  listKnowledge,
  deleteKnowledgeSource,
  testKnowledgeSearch,
} from "@/lib/vkm/knowledge.functions";

type Source = Awaited<ReturnType<typeof listKnowledge>>[number];
type Hit = Awaited<ReturnType<typeof testKnowledgeSearch>>[number];

export function KnowledgeBase() {
  const ingest = useServerFn(ingestKnowledge);
  const list = useServerFn(listKnowledge);
  const del = useServerFn(deleteKnowledgeSource);
  const search = useServerFn(testKnowledgeSearch);

  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState("");
  const [program, setProgram] = useState("");
  const [topic, setTopic] = useState("");
  const [language, setLanguage] = useState("english");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [searching, setSearching] = useState(false);

  const refresh = useCallback(() => {
    setLoading(true);
    list({})
      .then((s) => setSources(s))
      .catch((e) => toast.error("Couldn't load sources", { description: (e as Error).message }))
      .finally(() => setLoading(false));
  }, [list]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const totalChunks = sources.reduce((n, s) => n + s.chunks, 0);

  async function doIngest() {
    if (!title.trim() || text.trim().length < 30) {
      toast.error("Add a title and paste at least a paragraph.");
      return;
    }
    setBusy(true);
    try {
      const r = await ingest({ data: { title: title.trim(), program: program.trim(), topic: topic.trim(), language, text } });
      toast.success("Added to Venu's brain", { description: `${r.chunks} chunk(s) embedded from "${title.trim()}"` });
      setTitle(""); setProgram(""); setTopic(""); setText("");
      refresh();
    } catch (e) {
      toast.error("Ingest failed", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function doDelete(t: string) {
    if (!confirm(`Delete all chunks of "${t}"?`)) return;
    try {
      await del({ data: { title: t } });
      toast.success("Deleted");
      refresh();
    } catch (e) {
      toast.error("Delete failed", { description: (e as Error).message });
    }
  }

  async function doSearch() {
    if (!q.trim()) return;
    setSearching(true);
    setHits(null);
    try {
      setHits(await search({ data: { query: q.trim() } }));
    } catch (e) {
      toast.error("Search failed", { description: (e as Error).message });
    } finally {
      setSearching(false);
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-5">
      <PageHeader
        eyebrow="Admin · Digital Venu Kalyan"
        title="VK Knowledge Base"
        description="Feed Venu's real teaching into the AI advisor's brain. Content is chunked, embedded and retrieved to ground answers (RAG, phase 1)."
        icon={BrainCircuit}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card px-4 py-3">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"><Database className="h-3.5 w-3.5" /> Sources</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{sources.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card px-4 py-3">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"><FileText className="h-3.5 w-3.5" /> Chunks embedded</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{totalChunks}</p>
        </div>
        <div className="rounded-xl border border-border bg-secondary/30 px-4 py-3">
          <p className="text-[11px] text-muted-foreground">Embeddings: Supabase gte-small (free). Best for English/Tenglish; a multilingual model is a later upgrade.</p>
        </div>
      </div>

      {/* Ingest */}
      <SectionCard title={<span className="flex items-center gap-2"><Upload className="h-4 w-4 text-navy" /> Add teaching</span>} subtitle="Paste a framework, a Q&A, a transcript or notes. Keep one topic per paste for best retrieval.">
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Source title *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. BOSS — Objection Handling" className="h-10 rounded-lg" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Program</Label>
              <Input value={program} onChange={(e) => setProgram(e.target.value)} placeholder="BOSS / UBM / VKM" className="h-10 rounded-lg" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Topic</Label>
              <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Pricing, Sales…" className="h-10 rounded-lg" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Language</Label>
              <select value={language} onChange={(e) => setLanguage(e.target.value)} className="h-10 w-full rounded-lg border border-input bg-background px-2 text-sm">
                <option value="english">English</option>
                <option value="tinglish">Tenglish</option>
                <option value="telugu">Telugu</option>
              </select>
            </div>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            placeholder="Paste Venu's teaching here — a full framework, a real member Q&A, or session notes…"
            className="w-full resize-y rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <Button onClick={doIngest} disabled={busy} className="rounded-xl bg-gradient-navy text-primary-foreground hover:opacity-90">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Chunk, embed &amp; add
          </Button>
        </div>
      </SectionCard>

      {/* Test retrieval */}
      <SectionCard title={<span className="flex items-center gap-2"><Search className="h-4 w-4 text-navy" /> Test retrieval</span>} subtitle="Ask a question the way a member would — see which chunks the advisor would pull.">
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && doSearch()} placeholder="e.g. price objection ela handle cheyali?" className="h-10 rounded-lg" />
            <Button onClick={doSearch} disabled={searching || !q.trim()} variant="outline" className="rounded-lg">
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Search
            </Button>
          </div>
          {hits && (
            hits.length === 0 ? (
              <p className="py-3 text-sm text-muted-foreground">No chunks matched — add relevant teaching above.</p>
            ) : (
              <div className="space-y-2">
                {hits.map((h, i) => (
                  <div key={i} className="rounded-xl border border-border bg-secondary/20 p-3">
                    <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
                      <span className="font-semibold text-foreground">{h.source_title || "—"}{h.topic ? ` · ${h.topic}` : ""}</span>
                      <span className={h.similarity >= 68 ? "font-semibold text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}>{h.similarity}% match</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{h.preview}…</p>
                  </div>
                ))}
                <p className="text-[11px] text-muted-foreground">The advisor grounds its answer in matches ≥ 68%. Below that it falls back to general principle (honestly flagged).</p>
              </div>
            )
          )}
        </div>
      </SectionCard>

      {/* Sources list */}
      <SectionCard title="Ingested sources" subtitle={`${sources.length} source(s) · ${totalChunks} chunks`} bodyClassName="p-0">
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : sources.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No teaching added yet — paste some above to start Venu's brain.</p>
        ) : (
          <div className="divide-y divide-border">
            {sources.map((s) => (
              <div key={s.title} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{s.title}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {[s.program, s.topic, s.language].filter(Boolean).join(" · ") || "—"} · {s.chunks} chunk(s)
                  </p>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive" onClick={() => doDelete(s.title)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </motion.div>
  );
}
