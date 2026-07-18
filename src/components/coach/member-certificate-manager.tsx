import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Upload, Trash2, Award, Check, X, Pencil } from "lucide-react";
import { format } from "date-fns";
import { SectionCard } from "@/components/vkm/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { uploadToStorage } from "@/lib/storage-upload";
import { CertificateView } from "@/components/vkm/certificate-view";

type Row = {
  id: string;
  title: string | null;
  file_url: string;
  file_type: string | null;
  note: string | null;
  issued_at: string;
  is_active: boolean;
};

const ACCEPT = "application/pdf,image/png,image/jpeg,image/webp";

/**
 * Staff-side certificate issuing for ONE member, shown on the participant
 * detail. Uploading a certificate is what unlocks it for the member — they see
 * it, preview it and download it on their Certificates page immediately.
 */
export function MemberCertificateManager({ userId, memberName }: { userId: string; memberName?: string }) {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("member_certificates")
      .select("id, title, file_url, file_type, note, issued_at, is_active")
      .eq("user_id", userId)
      .order("issued_at", { ascending: false });
    setRows((data ?? []) as Row[]);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function issue() {
    if (!user) return;
    if (!file) {
      toast.error("Choose the certificate file (PDF or image) to upload.");
      return;
    }
    setBusy(true);
    try {
      const key = `certificates/${userId}/${Date.now()}-${file.name.replace(/[^\w.-]+/g, "_")}`;
      const file_url = await uploadToStorage("assets", key, file, file.type || "application/pdf", { skipCompress: true });
      const { error } = await supabase.from("member_certificates").insert({
        user_id: userId,
        title: title.trim() || "Certificate of Transformation",
        file_url,
        file_type: file.type || null,
        note: note.trim() || null,
        created_by: user.id,
      });
      if (error) throw error;
      toast.success("Certificate issued", { description: memberName ? `${memberName} can now view and download it.` : undefined });
      setTitle("");
      setNote("");
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      await load();
    } catch (e) {
      toast.error("Couldn't issue certificate", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Remove this certificate? The member will lose access to it.")) return;
    const { error } = await supabase.from("member_certificates").delete().eq("id", id);
    if (error) return toast.error("Delete failed", { description: error.message });
    setEditingId((c) => (c === id ? null : c));
    await load();
  }

  async function saveEdit(id: string, patch: { title: string; note: string }) {
    const { error } = await supabase
      .from("member_certificates")
      .update({ title: patch.title.trim() || "Certificate of Transformation", note: patch.note.trim() || null })
      .eq("id", id);
    if (error) {
      toast.error("Couldn't save", { description: error.message });
      return false;
    }
    toast.success("Certificate updated");
    setEditingId(null);
    await load();
    return true;
  }

  return (
    <div className="space-y-4">
      <SectionCard
        title={
          <span className="flex items-center gap-2 text-sm font-semibold">
            <Award className="h-4 w-4 text-gold" /> Issue a certificate
          </span>
        }
        subtitle={
          memberName
            ? `Upload ${memberName}'s finished certificate — issuing it unlocks it on their Certificates page`
            : "Uploading unlocks the certificate for this member"
        }
      >
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Certificate file (PDF or image)</Label>
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPT}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-gradient-navy file:px-3 file:py-2 file:text-sm file:text-primary-foreground"
            />
            {file && (
              <p className="text-[11px] text-muted-foreground">
                {file.name} · {(file.size / 1_048_576).toFixed(2)} MB
              </p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Certificate of Transformation" className="h-10 rounded-lg" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Note (optional)</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything the member should know…" className="h-10 rounded-lg" />
            </div>
          </div>

          <Button onClick={issue} disabled={busy || !file} className="rounded-xl bg-gradient-navy text-primary-foreground hover:opacity-90">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Issue certificate
          </Button>
        </div>
      </SectionCard>

      <SectionCard title="Issued certificates" subtitle={rows.length === 0 ? "None yet" : `${rows.length} issued`}>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No certificate issued yet — this member sees the locked “unlocks after course completion” state.
          </p>
        ) : (
          <div className="space-y-5">
            {rows.map((r) => (
              <div key={r.id} className="space-y-2 rounded-2xl border border-border p-3">
                {editingId === r.id ? (
                  <EditCert row={r} onSave={(p) => saveEdit(r.id, p)} onCancel={() => setEditingId(null)} />
                ) : (
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">{r.title || "Certificate"}</p>
                      <p className="text-[11px] text-muted-foreground">
                        Issued {format(new Date(r.issued_at), "d MMM yyyy")}
                        {r.note ? ` · ${r.note}` : ""}
                      </p>
                    </div>
                    <button type="button" onClick={() => setEditingId(r.id)} className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-navy" aria-label="Edit">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => remove(r.id)} className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-destructive" aria-label="Remove">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
                <CertificateView fileUrl={r.file_url} fileType={r.file_type} title={r.title} compact />
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function EditCert({
  row,
  onSave,
  onCancel,
}: {
  row: Row;
  onSave: (p: { title: string; note: string }) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(row.title ?? "");
  const [note, setNote] = useState(row.note ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const ok = await onSave({ title, note });
    if (!ok) setSaving(false);
  }

  return (
    <div className="space-y-2 rounded-xl border border-navy/30 bg-navy/[0.03] p-2.5">
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-[11px]">Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-9 rounded-lg" />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px]">Note</Label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} className="h-9 rounded-lg" />
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={save} disabled={saving} className="h-8 rounded-lg bg-gradient-navy text-primary-foreground">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel} disabled={saving} className="h-8 rounded-lg">
          <X className="h-4 w-4" /> Cancel
        </Button>
      </div>
    </div>
  );
}
