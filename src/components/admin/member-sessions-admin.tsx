import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Video, Loader2, Search, Link2, Upload, Trash2, Plus, User } from "lucide-react";
import { PageHeader } from "@/components/vkm/page-header";
import { SectionCard } from "@/components/vkm/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { uploadToStorage } from "@/lib/storage-upload";
import { resolveVideoSource } from "@/lib/video-source";
import { weekByNumber } from "@/lib/vkm/program";

type Person = { user_id: string; full_name: string | null; avatar_url: string | null; roles: string[] };
type Row = { id: string; week_no: number | null; title: string | null; video_url: string; provider: string | null; note: string | null; created_at: string };

export function MemberSessionsAdmin() {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<Person[]>([]);
  const [picked, setPicked] = useState<Person | null>(null);

  // Debounced member search (reuses the analytics people-search RPC).
  useEffect(() => {
    let alive = true;
    const t = setTimeout(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase.rpc as any)("admin_people_search", { _q: query, _limit: 15 });
      if (alive) setPeople((data ?? []) as Person[]);
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [query]);

  const [rows, setRows] = useState<Row[]>([]);
  const [loadingRows, setLoadingRows] = useState(false);

  const loadRows = useCallback(async (uid: string) => {
    setLoadingRows(true);
    const { data } = await supabase
      .from("member_session_videos")
      .select("id, week_no, title, video_url, provider, note, created_at")
      .eq("user_id", uid)
      .order("week_no", { ascending: true, nullsFirst: true })
      .order("created_at", { ascending: true });
    setRows((data ?? []) as Row[]);
    setLoadingRows(false);
  }, []);

  useEffect(() => {
    if (picked) void loadRows(picked.user_id);
    else setRows([]);
  }, [picked, loadRows]);

  // ── Add form ────────────────────────────────────────────────────────────────
  const [week, setWeek] = useState<string>(""); // "" = General
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [mode, setMode] = useState<"link" | "upload">("link");
  const [link, setLink] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function add() {
    if (!picked || !user) return;
    setBusy(true);
    try {
      let video_url = "";
      let provider = "link";
      if (mode === "upload") {
        if (!file) {
          toast.error("Choose a video file to upload.");
          return;
        }
        const key = `session-videos/${picked.user_id}/${Date.now()}-${file.name.replace(/[^\w.-]+/g, "_")}`;
        video_url = await uploadToStorage("assets", key, file, file.type, { skipCompress: true });
        provider = "file";
      } else {
        const u = link.trim();
        if (!u) {
          toast.error("Paste a video link (Google Drive, YouTube, Vimeo, or a direct URL).");
          return;
        }
        video_url = u;
        provider = resolveVideoSource(u).kind; // youtube | vimeo | drive | file
      }
      const { error } = await supabase.from("member_session_videos").insert({
        user_id: picked.user_id,
        week_no: week ? Number(week) : null,
        title: title.trim() || null,
        video_url,
        provider,
        note: note.trim() || null,
        created_by: user.id,
      });
      if (error) throw error;
      toast.success("Session video added", { description: `${picked.full_name ?? "Member"} · ${week ? `Week ${week}` : "General"}` });
      setTitle(""); setNote(""); setLink(""); setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      await loadRows(picked.user_id);
    } catch (e) {
      toast.error("Couldn't add", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Remove this session video?")) return;
    const { error } = await supabase.from("member_session_videos").delete().eq("id", id);
    if (error) return toast.error("Delete failed", { description: error.message });
    if (picked) await loadRows(picked.user_id);
  }

  const grouped = useMemo(() => {
    const m = new Map<string, Row[]>();
    for (const r of rows) {
      const key = r.week_no == null ? "General" : `Week ${r.week_no}`;
      (m.get(key) ?? m.set(key, []).get(key)!).push(r);
    }
    return [...m.entries()];
  }, [rows]);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-5">
      <PageHeader
        eyebrow="Admin"
        title="Member Sessions"
        description="Attach private 1-on-1 session videos to a specific member, by week. Paste a Google Drive / YouTube / Vimeo link or upload a file — only that member sees them."
        icon={Video}
      />

      {/* Member search */}
      <SectionCard title="Choose a member">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search a member by name…" className="h-11 rounded-xl pl-9" />
        </div>
        {picked ? (
          <div className="mt-3 flex items-center gap-3 rounded-xl border border-navy/30 bg-navy/[0.04] px-3 py-2">
            <img src={picked.avatar_url || "/icon-512.png"} alt="" className="h-8 w-8 rounded-full border border-border object-cover" />
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{picked.full_name ?? "Member"}</span>
            <Button variant="ghost" size="sm" className="rounded-lg" onClick={() => setPicked(null)}>Change</Button>
          </div>
        ) : (
          people.length > 0 && (
            <div className="mt-2 max-h-64 divide-y divide-border overflow-y-auto rounded-xl border border-border">
              {people.map((p) => (
                <button key={p.user_id} type="button" onClick={() => setPicked(p)} className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-secondary/50">
                  <img src={p.avatar_url || "/icon-512.png"} alt="" className="h-7 w-7 rounded-full border border-border object-cover" />
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground">{p.full_name ?? "—"}</span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">{p.roles.join(", ")}</span>
                </button>
              ))}
            </div>
          )
        )}
      </SectionCard>

      {picked && (
        <>
          {/* Add form */}
          <SectionCard title="Add a session video" subtitle={`For ${picked.full_name ?? "this member"}`}>
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">Week</Label>
                  <select value={week} onChange={(e) => setWeek(e.target.value)} className="h-10 w-full rounded-lg border border-input bg-background px-2 text-sm">
                    <option value="">General (no specific week)</option>
                    {Array.from({ length: 16 }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>Week {n}{weekByNumber(n)?.topic ? ` · ${weekByNumber(n)!.topic}` : ""}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Title</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Week 3 strategy call" className="h-10 rounded-lg" />
                </div>
              </div>

              <div className="flex gap-1.5">
                <button type="button" onClick={() => setMode("link")} className={cn("inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium", mode === "link" ? "bg-gradient-navy text-primary-foreground" : "bg-secondary/60 text-muted-foreground")}>
                  <Link2 className="h-3.5 w-3.5" /> Paste link
                </button>
                <button type="button" onClick={() => setMode("upload")} className={cn("inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium", mode === "upload" ? "bg-gradient-navy text-primary-foreground" : "bg-secondary/60 text-muted-foreground")}>
                  <Upload className="h-3.5 w-3.5" /> Upload file
                </button>
              </div>

              {mode === "link" ? (
                <div className="space-y-1">
                  <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Google Drive / YouTube / Vimeo / direct .mp4 link" className="h-10 rounded-lg" />
                  <p className="text-[11px] text-muted-foreground">Google Drive files must be shared “Anyone with the link · Viewer” to play.</p>
                </div>
              ) : (
                <div className="space-y-1">
                  <input ref={fileRef} type="file" accept="video/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-gradient-navy file:px-3 file:py-2 file:text-sm file:text-primary-foreground" />
                  {file && <p className="text-[11px] text-muted-foreground">{file.name} · {(file.size / 1_048_576).toFixed(1)} MB — uploads to your storage on Add.</p>}
                </div>
              )}

              <div className="space-y-1">
                <Label className="text-xs">Note (optional)</Label>
                <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything the member should know…" className="h-10 rounded-lg" />
              </div>

              <Button onClick={add} disabled={busy} className="rounded-xl bg-gradient-navy text-primary-foreground hover:opacity-90">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add session video
              </Button>
            </div>
          </SectionCard>

          {/* Existing list */}
          <SectionCard title="Session videos" subtitle={`${rows.length} for ${picked.full_name ?? "this member"}`} bodyClassName="p-0">
            {loadingRows ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : rows.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No session videos yet for this member.</p>
            ) : (
              <div className="divide-y divide-border">
                {grouped.map(([label, list]) => (
                  <div key={label} className="px-4 py-3">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
                    <div className="space-y-1.5">
                      {list.map((r) => (
                        <div key={r.id} className="flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2">
                          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-secondary text-navy"><User className="h-3.5 w-3.5" /></span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-foreground">{r.title || "(untitled)"}</p>
                            <p className="truncate text-[11px] text-muted-foreground">{r.provider ?? "link"} · {r.video_url}</p>
                          </div>
                          <button type="button" onClick={() => remove(r.id)} className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:text-destructive" aria-label="Remove">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </>
      )}
    </motion.div>
  );
}
