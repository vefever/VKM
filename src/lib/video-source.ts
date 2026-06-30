// Resolve any video reference an admin might paste or upload into a concrete
// playable source: YouTube / Vimeo embeds, or a direct file URL (.mp4, .webm,
// HLS, or a Supabase Storage URL from an admin upload).
export type VideoKind = "youtube" | "vimeo" | "file";

export type ResolvedVideo =
  | { kind: "youtube" | "vimeo"; embedUrl: string }
  | { kind: "file"; fileUrl: string };

const YT = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/)|youtu\.be\/)([\w-]{11})/;
const VIMEO = /vimeo\.com\/(?:video\/)?(\d+)/;

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
  }

  return { kind: "file", fileUrl: u };
}

/** Append an autoplay flag appropriate to the source kind. */
export function withAutoplay(src: ResolvedVideo): ResolvedVideo {
  if (src.kind === "file") return src;
  const sep = src.embedUrl.includes("?") ? "&" : "?";
  return { ...src, embedUrl: `${src.embedUrl}${sep}autoplay=1` };
}

/** A poster/thumbnail URL when we can derive one (YouTube), else null. */
export function posterFor(url: string): string | null {
  const yt = (url ?? "").match(YT);
  return yt ? `https://img.youtube.com/vi/${yt[1]}/hqdefault.jpg` : null;
}
