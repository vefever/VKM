import { useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Download, X } from "lucide-react";
import type { VisionImage } from "@/components/participant/vision-data";
import { downloadUrl } from "@/lib/download-file";

/**
 * Full-size viewer for vision board images.
 *
 * The grid crops every image to a square thumbnail (object-cover), so the only
 * way to actually see what was generated or uploaded is to open it here, where
 * it's object-contain and uncropped.
 *
 * Rendered in a portal on document.body: the board sits inside cards with their
 * own stacking and `overflow-hidden`, which would otherwise clip a fixed overlay.
 */
export function VisionImageLightbox({
  images,
  index,
  onClose,
  onIndexChange,
}: {
  images: VisionImage[];
  /** Index to show, or null when closed. */
  index: number | null;
  onClose: () => void;
  onIndexChange: (i: number) => void;
}) {
  const open = index !== null && index >= 0 && index < images.length;

  const step = useCallback(
    (delta: number) => {
      if (index === null || images.length < 2) return;
      onIndexChange((index + delta + images.length) % images.length);
    },
    [index, images.length, onIndexChange],
  );

  // Esc to close, arrows to move — expected of any full-screen image viewer.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, step]);

  // Don't let the page scroll behind the overlay.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (typeof document === "undefined") return null;

  const current = open ? images[index] : null;

  return createPortal(
    <AnimatePresence>
      {current && (
        <motion.div
          key="vision-lightbox"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          role="dialog"
          aria-modal="true"
          aria-label="Vision board image"
          onClick={onClose}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Close image"
            className="absolute right-3 top-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>

          {images.length > 1 && (
            <>
              <button
                type="button"
                aria-label="Previous image"
                onClick={(e) => {
                  e.stopPropagation();
                  step(-1);
                }}
                className="absolute left-2 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 sm:left-4"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                type="button"
                aria-label="Next image"
                onClick={(e) => {
                  e.stopPropagation();
                  step(1);
                }}
                className="absolute right-2 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 sm:right-4"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}

          {/* Stop propagation so clicking the image itself doesn't close it. */}
          <motion.img
            key={current.url}
            initial={{ scale: 0.97, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.2 }}
            src={current.url}
            alt={current.caption ?? "Vision board image"}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[82vh] max-w-[92vw] rounded-2xl object-contain shadow-2xl"
          />

          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute bottom-4 flex items-center gap-3 rounded-full bg-white/10 px-4 py-2 text-xs text-white/90 backdrop-blur"
          >
            {images.length > 1 && (
              <span className="tabular-nums">
                {(index ?? 0) + 1} / {images.length}
              </span>
            )}
            {current.caption && <span className="max-w-[50vw] truncate">{current.caption}</span>}
            <button
              type="button"
              onClick={() => void downloadUrl(current.url)}
              className="inline-flex items-center gap-1 font-medium transition-colors hover:text-white"
            >
              <Download className="h-3.5 w-3.5" /> Download
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
