// HEIC/HEIF support. iPhones shoot photos in HEIC, which browsers (except
// Safari on Apple devices) can't decode — so an <img src="…heic"> is broken on
// Android/Chrome/Windows. We handle it two ways:
//   • on upload: convert HEIC → JPEG before storing (media-compress.ts), so new
//     files are universally viewable.
//   • on display: for files already stored as .heic, convert on the fly in the
//     browser (useDisplaySrc below) so they still show for everyone.
// The heic2any decoder (libheif wasm, ~1.4 MB) is lazy-loaded only when a HEIC
// is actually encountered, so it never weighs down normal image handling.

import { useEffect, useState } from "react";

/** True for a HEIC/HEIF file by MIME type or filename (type is often empty). */
export function isHeicSource(type: string, name: string): boolean {
  return /image\/hei[cf]/i.test(type) || /\.(heic|heif)(\?|#|$)/i.test(name);
}

/** True for a URL that points at a stored HEIC/HEIF image. */
export function isHeicUrl(url: string): boolean {
  return /\.(heic|heif)(\?|#|$)/i.test((url ?? "").trim());
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

/**
 * Decode a HEIC/HEIF blob to a JPEG blob (browser-side, lazy heic2any). heic2any
 * is a UMD bundle — handle both `.default` and module-as-function interop — and
 * bound it with a timeout so a pathological image can never hang the caller.
 */
export async function heicToJpeg(input: Blob, quality = 0.9): Promise<Blob> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mod: any = await import("heic2any");
  const convert = (mod?.default ?? mod) as (o: {
    blob: Blob;
    toType?: string;
    quality?: number;
  }) => Promise<Blob | Blob[]>;
  if (typeof convert !== "function") throw new Error("heic2any unavailable");
  const out = await withTimeout(convert({ blob: input, toType: "image/jpeg", quality }), 20_000, "HEIC decode");
  return Array.isArray(out) ? out[0] : (out as Blob);
}

/**
 * Returns a directly-displayable image src for a URL: the URL itself for normal
 * images, or a freshly-decoded object URL for stored HEIC files. `converting`
 * is true while a HEIC is being decoded so callers can show a spinner. Falls
 * back to the original URL if conversion fails.
 */
export function useDisplaySrc(url: string): { src: string; converting: boolean; failed: boolean } {
  const [state, setState] = useState<{ src: string; converting: boolean; failed: boolean }>(() => ({
    src: url,
    converting: isHeicUrl(url),
    failed: false,
  }));

  useEffect(() => {
    if (!isHeicUrl(url)) {
      setState({ src: url, converting: false, failed: false });
      return;
    }
    let objectUrl: string | null = null;
    let alive = true;
    setState({ src: url, converting: true, failed: false });
    (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(String(res.status));
        const jpeg = await heicToJpeg(await res.blob());
        objectUrl = URL.createObjectURL(jpeg);
        if (alive) setState({ src: objectUrl, converting: false, failed: false });
      } catch {
        if (alive) setState({ src: url, converting: false, failed: true });
      }
    })();
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);

  return state;
}
