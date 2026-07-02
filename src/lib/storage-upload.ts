import { supabase } from "@/integrations/supabase/client";
import { compressForUpload } from "@/lib/media-compress";

// Unified upload: the `storage` edge function decides the backend (Supabase
// Storage or Cloudflare R2) from the admin's setting. For R2 it returns a
// presigned PUT URL; otherwise we fall back to Supabase Storage. Either way the
// caller gets back a public URL to store, and bucket/path naming stays identical
// so switching providers doesn't break existing references.
//
// Before upload, every file passes through compressForUpload — images are
// downscaled + re-encoded (WebP) to a fraction of their size; videos/docs pass
// through. This shrinks what we store in R2/Supabase and speeds up uploads on
// phone connections, transparently for every caller.
export async function uploadToStorage(
  bucket: string,
  path: string,
  file: File | Blob,
  contentType?: string,
  opts?: { skipCompress?: boolean },
): Promise<string> {
  // Compress first so the presign is requested with the FINAL content-type
  // (R2 presigns are bound to the content-type header we'll send). Some callers
  // (e.g. a PWA app icon, which should stay a crisp PNG) opt out of compression.
  const compressed = opts?.skipCompress
    ? {
        blob: file,
        contentType: contentType || (file as File).type || "application/octet-stream",
        ext: null as string | null,
      }
    : await compressForUpload(file);
  const body = compressed.blob;
  const ct = compressed.contentType || contentType || (file as File).type || "application/octet-stream";
  // If the encoding changed (e.g. jpg → webp), align the stored key's extension
  // so the object's URL and content-type agree.
  const key = compressed.ext ? path.replace(/\.[^./]+$/, "") + "." + compressed.ext : path;

  let presign: { provider?: string; uploadUrl?: string; publicUrl?: string } | null = null;
  try {
    const { data } = await supabase.functions.invoke("storage", {
      body: { action: "presign", bucket, key, contentType: ct },
    });
    if (data && data.ok !== false) presign = data;
  } catch {
    // Edge function unavailable → fall back to Supabase Storage below.
  }

  if (presign?.provider === "r2" && presign.uploadUrl && presign.publicUrl) {
    const res = await fetch(presign.uploadUrl, {
      method: "PUT",
      headers: { "content-type": ct },
      body,
    });
    if (!res.ok) throw new Error(`R2 upload failed (${res.status})`);
    return presign.publicUrl;
  }

  // Supabase Storage (default).
  const { error } = await supabase.storage.from(bucket).upload(key, body, {
    upsert: true,
    contentType: ct,
  });
  if (error) throw error;
  return supabase.storage.from(bucket).getPublicUrl(key).data.publicUrl;
}
