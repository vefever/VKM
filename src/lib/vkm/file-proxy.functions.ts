import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Server-side fetch of a storage file. Used by the participant Files tab's
// "Download all (.zip)" so zipping never depends on the BROWSER's own
// cross-origin fetch() succeeding against R2/Supabase Storage — a plain
// client-side fetch() can silently fail there (a CDN edge cache can serve a
// response cached before a CORS policy existed, without the header, even
// though a fresh server-to-server fetch of the same URL succeeds every time —
// confirmed live: curl/Node showed 200 + proper CORS on every file, yet the
// browser still reported several as unfetchable). Fetching server-side sides
// steps browser CORS entirely, since there is no origin restriction between
// two servers.
function isAllowedHost(host: string): boolean {
  const projectHost = (process.env.SUPABASE_URL || "")
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
  if (host === "assets.vkmentorship.com") return true;
  if (projectHost && host === projectHost) return true;
  if (host.endsWith(".supabase.co")) return true;
  if (host.endsWith(".r2.cloudflarestorage.com")) return true;
  return false;
}

export const proxyFetchFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { url: string }) => input)
  .handler(async ({ data }) => {
    let parsed: URL;
    try {
      parsed = new URL(data.url);
    } catch {
      throw new Error("Invalid file URL");
    }
    if (parsed.protocol !== "https:" || !isAllowedHost(parsed.hostname)) {
      throw new Error("File host is not allowed");
    }

    const res = await fetch(parsed.toString());
    if (!res.ok) {
      throw new Error(`Could not fetch file (${res.status})`);
    }
    const buf = await res.arrayBuffer();
    return new Response(buf, {
      headers: {
        "content-type": res.headers.get("content-type") || "application/octet-stream",
      },
    });
  });
