// Client-side media compression, run before every upload (see storage-upload.ts).
//
// Images are the big win: phone photos are typically 3–8 MB and compress to a
// few hundred KB with no visible quality loss. We do it with a plain <canvas>
// re-encode (no dependency, no wasm) — downscale the longest edge to a cap and
// re-encode to WebP (JPEG fallback for older Safari). Animated GIFs and SVGs are
// left untouched (canvas would flatten/rasterise them), and anything already
// small is skipped.
//
// HEIC/HEIF photos (from iPhones) are decoded to JPEG first (browsers other
// than Safari can't render HEIC), then compressed like any image — so stored
// files are viewable everywhere.
//
// Videos and other files (PDF, docx, …) can't be safely transcoded in the
// browser without a heavy ffmpeg.wasm bundle that risks OOM on phones, so they
// pass through unchanged.
//
// EVERYTHING degrades to the original file on any error — an upload must never
// fail because compression failed.

import { isHeicSource, heicToJpeg } from "@/lib/heic";

export type Compressed = {
  blob: Blob | File;
  contentType: string;
  // New extension when the encoding changed (e.g. jpg → webp), else null.
  ext: string | null;
};

const MAX_DIM = 1920; // cap the longest edge (plenty for proofs/photos on any screen)
const QUALITY = 0.82; // WebP/JPEG quality — visually lossless for photos
const IMAGE_MIN_BYTES = 80 * 1024; // don't bother re-encoding images already this small

function passthrough(file: File | Blob): Compressed {
  return { blob: file, contentType: (file as File).type || "application/octet-stream", ext: null };
}

// Decode a file to a bitmap, honouring EXIF orientation where supported so
// portrait phone photos don't come out sideways.
async function decode(file: File | Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      /* fall through to <img> */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("image decode failed"));
      el.src = url;
    });
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function dims(src: ImageBitmap | HTMLImageElement): { w: number; h: number } {
  const w = (src as ImageBitmap).width || (src as HTMLImageElement).naturalWidth;
  const h = (src as ImageBitmap).height || (src as HTMLImageElement).naturalHeight;
  return { w, h };
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), type, quality));
}

async function compressImage(file: File | Blob): Promise<Compressed> {
  const type = (file as File).type || "";
  // Leave vector + animated formats alone; skip tiny images.
  if (type === "image/svg+xml" || type === "image/gif") return passthrough(file);
  if (file.size < IMAGE_MIN_BYTES) return passthrough(file);

  const src = await decode(file);
  const { w, h } = dims(src);
  if (!w || !h) return passthrough(file);

  const scale = Math.min(1, MAX_DIM / Math.max(w, h));
  const tw = Math.max(1, Math.round(w * scale));
  const th = Math.max(1, Math.round(h * scale));

  const canvas = document.createElement("canvas");
  canvas.width = tw;
  canvas.height = th;
  const ctx = canvas.getContext("2d");
  if (!ctx) return passthrough(file);
  ctx.drawImage(src as CanvasImageSource, 0, 0, tw, th);
  if ("close" in src && typeof src.close === "function") src.close(); // free the bitmap

  // Prefer WebP; fall back to JPEG when the browser (older Safari) can't encode
  // WebP via toBlob (it silently returns a PNG or null).
  let out = await canvasToBlob(canvas, "image/webp", QUALITY);
  let ct = "image/webp";
  let ext: string | null = "webp";
  if (!out || out.type !== "image/webp") {
    out = await canvasToBlob(canvas, "image/jpeg", QUALITY);
    ct = "image/jpeg";
    ext = "jpg";
  }

  // Only keep the re-encode if it actually saved space; otherwise ship original.
  if (!out || out.size >= file.size) return passthrough(file);
  return { blob: out, contentType: ct, ext };
}

/**
 * Compress a file for upload where it's safe and beneficial. Images are
 * downscaled + re-encoded; everything else passes through untouched. Never
 * throws — falls back to the original file on any failure.
 */
export async function compressForUpload(file: File | Blob): Promise<Compressed> {
  const type = (file as File).type || "";
  const name = (file as File).name || "";
  try {
    // iPhone HEIC/HEIF → decode to JPEG first (type is often empty, so match on
    // the filename too), then run the normal image compression on the result.
    if (isHeicSource(type, name)) {
      const jpeg = await heicToJpeg(file);
      const out = await compressImage(jpeg);
      // If the canvas step declined to re-encode, still ship the JPEG we decoded
      // (never the original .heic, which most browsers can't display).
      return out.ext ? out : { blob: jpeg, contentType: "image/jpeg", ext: "jpg" };
    }
    if (type.startsWith("image/")) return await compressImage(file);
    return passthrough(file);
  } catch {
    return passthrough(file);
  }
}
