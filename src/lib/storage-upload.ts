import { supabase } from "@/integrations/supabase/client";

// Unified upload: the `storage` edge function decides the backend (Supabase
// Storage or Cloudflare R2) from the admin's setting. For R2 it returns a
// presigned PUT URL; otherwise we fall back to Supabase Storage. Either way the
// caller gets back a public URL to store, and bucket/path naming stays identical
// so switching providers doesn't break existing references.
export async function uploadToStorage(
  bucket: string,
  path: string,
  file: File | Blob,
  contentType?: string,
): Promise<string> {
  const ct = contentType || (file as File).type || "application/octet-stream";

  let presign: { provider?: string; uploadUrl?: string; publicUrl?: string } | null = null;
  try {
    const { data } = await supabase.functions.invoke("storage", {
      body: { action: "presign", bucket, key: path, contentType: ct },
    });
    if (data && data.ok !== false) presign = data;
  } catch {
    // Edge function unavailable → fall back to Supabase Storage below.
  }

  if (presign?.provider === "r2" && presign.uploadUrl && presign.publicUrl) {
    const res = await fetch(presign.uploadUrl, {
      method: "PUT",
      headers: { "content-type": ct },
      body: file,
    });
    if (!res.ok) throw new Error(`R2 upload failed (${res.status})`);
    return presign.publicUrl;
  }

  // Supabase Storage (default).
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    upsert: true,
    contentType: ct,
  });
  if (error) throw error;
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}
