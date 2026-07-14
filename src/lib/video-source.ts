// Resolve any video reference an admin might paste or upload into a concrete
// playable source: YouTube / Vimeo embeds, or a direct file URL (.mp4, .webm,
// HLS, or a Supabase Storage URL from an admin upload).
export type VideoKind = "youtube" | "vimeo" | "drive" | "file";

export type ResolvedVideo =
  | { kind: "youtube" | "vimeo" | "drive"; embedUrl: string }
  | { kind: "file"; fileUrl: string };

const YT = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/)|youtu\.be\/)([\w-]{11})/;
const VIMEO = /vimeo\.com\/(?:video\/)?(\d+)/;
// Google Drive share links: /file/d/<ID>/…  or  ?id=<ID>  (docs.google.com too).
const DRIVE = /(?:drive|docs)\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=\w+&)?id=)([\w-]{20,})/;

/**
 * @param url      Raw URL/reference (watch link, embed link, .mp4, storage URL…)
 * @param provider Optional explicit hint set by the admin; overrides detection
 *                 except that an unparseable embed falls back to a file source.
 */
export function resolveVideoSource(url: string, provider?: VideoKind): ResolvedVideo {
  const u = (url ?? "").trim();

  if (provider !== "file") {
    const yt = u.match(YT);
    if ((provider === "youtube" || yt) && yt) {
      return { kind: "youtube", embedUrl: `https://www.youtube.com/embed/${yt[1]}` };
    }
    const vi = u.match(VIMEO);
    if ((provider === "vimeo" || vi) && vi) {
      return { kind: "vimeo", embedUrl: `https://player.vimeo.com/video/${vi[1]}` };
    }
    // Google Drive → the /preview player streams (with seek) in an iframe. The
    // file must be shared "Anyone with the link · Viewer" to embed.
    const dr = u.match(DRIVE);
    if ((provider === "drive" || dr) && dr) {
      return { kind: "drive", embedUrl: `https://drive.google.com/file/d/${dr[1]}/preview` };
    }
  }

  return { kind: "file", fileUrl: u };
}

/** Append an autoplay flag appropriate to the source kind. */
export function withAutoplay(src: ResolvedVideo): ResolvedVideo {
  if (src.kind === "file") return src;
  const sep = src.embedUrl.includes("?") ? "&" : "?";
  return { ...src, embedUrl: `${src.embedUrl}${sep}autoplay=1` };
}

/** YouTube-derived thumbnail (hqdefault, always exists), else null. */
export function posterFor(url: string): string | null {
  const yt = (url ?? "").match(YT);
  return yt ? `https://img.youtube.com/vi/${yt[1]}/hqdefault.jpg` : null;
}

/**
 * The thumbnail to show before a video plays, in priority order:
 *   1. an admin-uploaded custom thumbnail (works for any source, incl. .mp4/Vimeo)
 *   2. the YouTube-derived thumbnail (no upload needed)
 *   3. null → the caller shows a branded placeholder
 * Vimeo/direct files have no static thumbnail URL, so they rely on a custom one.
 */
export function thumbnailFor(url: string, custom?: string | null): string | null {
  const c = (custom ?? "").trim();
  if (c) return c;
  return posterFor(url);
}

/** True for HLS streams (.m3u8) — need hls.js on browsers without native HLS. */
export function isHlsUrl(url: string): boolean {
  return /\.m3u8(\?|#|$)/i.test((url ?? "").trim());
}
