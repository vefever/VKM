import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Link2, Upload, Trash2, Plus, Video, Pencil, Check, X } from "lucide-react";
import { SectionCard } from "@/components/vkm/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { uploadToStorage } from "@/lib/storage-upload";
import { resolveVideoSource } from "@/lib/video-source";
import { VideoPlayer } from "@/components/vkm/video-player";
import { weekByNumber } from "@/lib/vkm/program";

type Row = { id: string; week_no: number | null; title: string | null; video_url: string; provider: string | null; note: string | null; created_at: string };

const WEEK_OPTIONS = Array.from({ length: 16 }, (_, i) => i + 1);
function weekLabel(n: number) {
  const t = weekByNumber(n)?.topic;
  return `Week ${n}${t ? ` · ${t}` : ""}`;
}

// Per-member 1-on-1 session videos, managed in-line on the participant detail
// (staff: coach / mentor / admin). Adds per-week or general videos that the
// member then sees on their own "My Sessions" page — and edits/removes them.
export function MemberSessionsManager({ userId, memberName }: { userId: string; memberName?: string }) {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("member_session_videos")
      .select("id, week_no, title, video_url, provider, note, created_at")
      .eq("user_id", userId)
      .order("week_no", { ascending: true, nullsFirst: true })
      .order("created_at", { ascending: true });
    setRows((data ?? []) as Row[]);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const [week, setWeek] = useState<string>("");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [mode, setMode] = useState<"link" | "upload">("link");
  const [link, setLink] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function add() {
    if (!user) return;
    setBusy(true);
    try {
      let video_url = "";
      let provider = "link";
      if (mode === "upload") {
        if (!file) { toast.error("Choose a video file to upload."); return; }
        const key = `session-videos/${userId}/${Date.now()}-${file.name.replace(/[^\w.-]+/g, "_")}`;
        video_url = await uploadToStorage("assets", key, file, file.type, { skipCompress: true });
        provider = "file";
      } else {
        const u = link.trim();
        if (!u) { toast.error("Paste a video link (Google Drive, YouTube, Vimeo, or a direct URL)."); return; }
        video_url = u;
        provider = resolveVideoSource(u).kind;
      }
      const { error } = await supabase.from("member_session_videos").insert({
        user_id: userId,
        week_no: week ? Number(week) : null,
        title: title.trim() || null,
        video_url,
        provider,
        note: note.trim() || null,
        created_by: user.id,
      });
      if (error) throw error;
      toast.success("Session video added", { description: week ? `Week ${week}` : "General" });
      setTitle(""); setNote(""); setLink(""); setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      await load();
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
    setEditingId((cur) => (cur === id ? null : cur));
    await load();
  }

  // Save an edit to an existing video (week / title / note / link). Mistakenly
  // published one? Fix it here — the change reflects to the member immediately.
  const saveEdit = useCallback(
    async (id: string, patch: { week: string; title: string; note: string; url: string }) => {
      const url = patch.url.trim();
      if (!url) { toast.error("A video link or URL is required."); return false; }
      const { error } = await supabase
        .from("member_session_videos")
        .update({
          week_no: patch.week ? Number(patch.week) : null,
          title: patch.title.trim() || null,
          note: patch.note.trim() || null,
          video_url: url,
          provider: resolveVideoSource(url).kind,
        })
        .eq("id", id);
      if (error) { toast.error("Couldn't save", { description: error.message }); return false; }
      toast.success("Session video updated");
      setEditingId(null);
      await load();
      return true;
    },
    [load],
  );

  const grouped = useMemo(() => {
    const m = new Map<string, Row[]>();
    for (const r of rows) {
      const key = r.week_no == null ? "General" : `Week ${r.week_no}`;
      (m.get(key) ?? m.set(key, []).get(key)!).push(r);
    }
    return [...m.entries()];
  }, [rows]);

  return (
    <div className="space-y-4">
      <SectionCard
        title={<span className="flex items-center gap-2 text-sm font-semibold"><Video className="h-4 w-4 text-navy" /> Add 1-on-1 session video</span>}
        subtitle={memberName ? `Private to ${memberName} — they'll see it on My Sessions` : "Private to this member"}
      >
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Week</Label>
              <select value={week} onChange={(e) => setWeek(e.target.value)} className="h-10 w-full rounded-lg border border-input bg-background px-2 text-sm">
                <option value="">General (no specific week)</option>
                {WEEK_OPTIONS.map((n) => (
                  <option key={n} value={n}>{weekLabel(n)}</option>
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
              {file && <p className="text-[11px] text-muted-foreground">{file.name} · {(file.size / 1_048_576).toFixed(1)} MB</p>}
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

      <SectionCard title="Session videos" subtitle={`${rows.length} total`} bodyClassName="p-0">
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No session videos yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {grouped.map(([label, list]) => (
              <div key={label} className="px-4 py-3">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {list.map((r) =>
                    editingId === r.id ? (
                      <EditVideo key={r.id} row={r} onSave={(p) => saveEdit(r.id, p)} onCancel={() => setEditingId(null)} />
                    ) : (
                      <div key={r.id} className="space-y-1.5 rounded-xl border border-border bg-card p-2">
                        <div className="overflow-hidden rounded-lg border border-border">
                          <VideoPlayer url={r.video_url} title={r.title ?? label} />
                        </div>
                        <div className="flex items-center gap-1 px-1">
                          <p className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">{r.title || "(untitled)"}</p>
                          <button type="button" onClick={() => setEditingId(r.id)} className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-navy" aria-label="Edit">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button type="button" onClick={() => remove(r.id)} className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-destructive" aria-label="Remove">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        {r.note && <p className="px-1 text-[11px] text-muted-foreground line-clamp-2">{r.note}</p>}
                      </div>
                    ),
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

// Inline editor for a published video — fix a mistake in its week, title, note,
// or the link/URL itself (provider is re-detected from the URL on save).
function EditVideo({
  row,
  onSave,
  onCancel,
}: {
  row: Row;
  onSave: (p: { week: string; title: string; note: string; url: string }) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [week, setWeek] = useState(row.week_no == null ? "" : String(row.week_no));
  const [title, setTitle] = useState(row.title ?? "");
  const [note, setNote] = useState(row.note ?? "");
  const [url, setUrl] = useState(row.video_url);
  const [saving, setSaving] = useState(false);
  const isFile = resolveVideoSource(url).kind === "file";

  async function save() {
    setSaving(true);
    const ok = await onSave({ week, title, note, url });
    if (!ok) setSaving(false);
  }

  return (
    <div className="space-y-2 rounded-xl border border-navy/30 bg-navy/[0.03] p-2.5 sm:col-span-2">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-navy">
        <Pencil className="h-3.5 w-3.5" /> Edit session video
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-[11px]">Week</Label>
          <select value={week} onChange={(e) => setWeek(e.target.value)} className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm">
            <option value="">General (no specific week)</option>
            {WEEK_OPTIONS.map((n) => (
              <option key={n} value={n}>{weekLabel(n)}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-[11px]">Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="h-9 rounded-lg" />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-[11px]">Video link / URL</Label>
        <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Google Drive / YouTube / Vimeo / direct .mp4 link" className="h-9 rounded-lg" />
        {isFile ? (
          <p className="text-[11px] text-muted-foreground">This is an uploaded file — replace it by pasting a new link here.</p>
        ) : (
          <p className="text-[11px] text-muted-foreground">Paste any Google Drive / YouTube / Vimeo / direct link.</p>
        )}
      </div>
      <div className="space-y-1">
        <Label className="text-[11px]">Note (optional)</Label>
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything the member should know…" className="h-9 rounded-lg" />
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={save} disabled={saving} className="h-8 rounded-lg bg-gradient-navy text-primary-foreground hover:opacity-90">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel} disabled={saving} className="h-8 rounded-lg">
          <X className="h-4 w-4" /> Cancel
        </Button>
      </div>
    </div>
  );
}
