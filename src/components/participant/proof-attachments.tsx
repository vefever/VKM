import { useEffect, useRef, useState, type DragEvent } from "react";
import { createPortal } from "react-dom";
import {
  FileText,
  Download,
  Loader2,
  Camera,
  Paperclip,
  Image as ImageIcon,
  X,
  ChevronLeft,
  ChevronRight,
  Play,
  Eye,
  type LucideIcon,
} from "lucide-react";
import type { Attachment } from "@/components/chat/chat-data";
import { useAppShell } from "@/hooks/use-app-shell";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useDisplaySrc, isHeicUrl, isHeicSource } from "@/lib/heic";

const isPdf = (a: Attachment) => /\.pdf(\?|$)/i.test(a.name || "") || /\.pdf(\?|$)/i.test(a.url);
// A stored .heic that predates upload-time conversion may be tagged kind "file"
// (its MIME was empty at upload) — still treat it as an image so it previews.
const isImageAttachment = (a: Attachment) => a.kind === "image" || isHeicUrl(a.url);

// <img> that transparently decodes stored HEIC to a viewable JPEG.
function SmartImage({ url, alt, className }: { url: string; alt: string; className?: string }) {
  const { src, converting, failed } = useDisplaySrc(url);
  if (converting) {
    return (
      <div className={cn("flex flex-col items-center justify-center gap-1.5 bg-secondary/40", className)}>
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="text-[10px] text-muted-foreground">Loading photo…</span>
      </div>
    );
  }
  if (failed) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-1.5 bg-secondary/40 px-2 text-center",
          className,
        )}
      >
        <ImageIcon className="h-6 w-6 text-muted-foreground" />
        <span className="text-[11px] font-medium text-foreground">iPhone photo</span>
        <span className="text-[10px] text-muted-foreground">Use Download to view</span>
      </div>
    );
  }
  return <img src={src} alt={alt} className={className} />;
}

// Force a real download even for cross-origin files (R2 / Supabase public URLs):
// fetch the blob (CORS GET is allowed for the app origins) and save with the
// original filename. Falls back to opening the URL if the fetch is blocked.
async function downloadAttachment(a: Attachment) {
  try {
    const res = await fetch(a.url);
    if (!res.ok) throw new Error(String(res.status));
    const blob = await res.blob();
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = a.name || "download";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  } catch {
    window.open(a.url, "_blank", "noopener");
  }
}

// Renders uploaded proof files as tiles. Clicking a tile opens an in-page
// lightbox popup (image / video / PDF preview) with a Download button on top —
// no more jumping to a new browser tab. Used across coach / mentor / admin /
// participant views.
export function ProofAttachments({ files }: { files: Attachment[] }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  if (!files || files.length === 0) return null;
  return (
    <>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {files.map((a, i) => (
          <Tile key={i} a={a} onOpen={() => setOpenIdx(i)} />
        ))}
      </div>
      {openIdx !== null && (
        <Lightbox files={files} index={openIdx} onIndex={setOpenIdx} onClose={() => setOpenIdx(null)} />
      )}
    </>
  );
}

function Tile({ a, onOpen }: { a: Attachment; onOpen: () => void }) {
  if (isImageAttachment(a)) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="group relative block w-full overflow-hidden rounded-xl border border-border"
        title={a.name}
      >
        <SmartImage url={a.url} alt={a.name} className="h-28 w-full object-cover" />
        <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/25">
          <Eye className="h-6 w-6 text-white opacity-0 transition-opacity group-hover:opacity-100" />
        </span>
      </button>
    );
  }
  if (a.kind === "video") {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="group relative block w-full overflow-hidden rounded-xl border border-border"
        title={a.name}
      >
        <video src={a.url} preload="metadata" muted className="h-28 w-full bg-black object-contain" />
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white transition-transform group-hover:scale-110">
            <Play className="h-4 w-4 fill-current" />
          </span>
        </span>
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex h-28 w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-border bg-secondary/40 p-2 text-center transition-colors hover:bg-secondary/70"
      title={a.name}
    >
      <FileText className="h-7 w-7 text-muted-foreground" />
      <span className="line-clamp-2 text-[11px] text-foreground">{a.name}</span>
      <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
        <Eye className="h-3 w-3" /> View
      </span>
    </button>
  );
}

// Full-screen popup preview with a Download button on top + prev/next.
function Lightbox({
  files,
  index,
  onIndex,
  onClose,
}: {
  files: Attachment[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const a = files[index];
  const many = files.length > 1;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft" && files.length > 1)
        onIndex((index - 1 + files.length) % files.length);
      else if (e.key === "ArrowRight" && files.length > 1) onIndex((index + 1) % files.length);
    };
    document.addEventListener("keydown", onKey);
    // Lock body scroll while the popup is open.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [index, files.length, onClose, onIndex]);

  if (typeof document === "undefined") return null;

  // Render at the document root (a portal) so ancestor transforms — framer-motion
  // cards, dialogs — can't trap `position: fixed` and shrink/offset the popup.
  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-black/90 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      {/* Top bar — filename + Download + close */}
      <div
        className="flex items-center gap-2 border-b border-white/10 px-3 py-2.5 sm:px-4"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="min-w-0 flex-1 truncate text-sm font-medium text-white">{a.name}</p>
        {many && (
          <span className="shrink-0 text-xs tabular-nums text-white/60">
            {index + 1} / {files.length}
          </span>
        )}
        <Button
          size="sm"
          onClick={() => downloadAttachment(a)}
          className="rounded-lg bg-white text-black hover:bg-white/90"
        >
          <Download className="h-4 w-4" /> Download
        </Button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-white/80 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Body — preview */}
      <div
        className="relative flex flex-1 items-center justify-center overflow-auto p-3 sm:p-6"
        onClick={onClose}
      >
        {many && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onIndex((index - 1 + files.length) % files.length);
            }}
            aria-label="Previous"
            className="absolute left-2 top-1/2 z-10 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}

        <div className="max-h-full max-w-full" onClick={(e) => e.stopPropagation()}>
          {isImageAttachment(a) ? (
            <SmartImage
              url={a.url}
              alt={a.name}
              className="max-h-[82vh] max-w-full rounded-lg object-contain"
            />
          ) : a.kind === "video" ? (
            <video
              src={a.url}
              controls
              autoPlay
              className="max-h-[82vh] max-w-[92vw] rounded-lg bg-black"
            />
          ) : isPdf(a) ? (
            <iframe
              src={a.url}
              title={a.name}
              className="h-[82vh] w-[92vw] rounded-lg border-0 bg-white sm:w-[72vw]"
            />
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-2xl bg-white/5 p-8 text-center">
              <FileText className="h-12 w-12 text-white/70" />
              <p className="max-w-xs break-words text-sm text-white">{a.name}</p>
              <p className="text-xs text-white/60">Preview isn't available for this file type.</p>
              <Button
                onClick={() => downloadAttachment(a)}
                className="rounded-lg bg-white text-black hover:bg-white/90"
              >
                <Download className="h-4 w-4" /> Download to view
              </Button>
            </div>
          )}
        </div>

        {many && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onIndex((index + 1) % files.length);
            }}
            aria-label="Next"
            className="absolute right-2 top-1/2 z-10 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}

// Local (pre-upload) preview tile for staged files chosen from the device.
// #33 — shows an upload spinner ring overlay while submitting.
export function LocalPreviewTile({
  file,
  url,
  onRemove,
  uploading,
}: {
  file: File;
  url: string;
  onRemove: () => void;
  uploading?: boolean;
}) {
  const isHeic = isHeicSource(file.type, file.name);
  const isImage = file.type.startsWith("image/") && !isHeic;
  const isVideo = file.type.startsWith("video/");
  return (
    <div className="group relative overflow-hidden rounded-xl border border-border">
      {isImage ? (
        <img src={url} alt={file.name} className="h-28 w-full object-cover" />
      ) : isVideo ? (
        <video src={url} className="h-28 w-full bg-black object-contain" />
      ) : isHeic ? (
        // Browsers can't render a HEIC preview; it converts to JPEG on upload.
        <div className="flex h-28 flex-col items-center justify-center gap-1.5 bg-secondary/40 p-2 text-center">
          <ImageIcon className="h-7 w-7 text-muted-foreground" />
          <span className="text-[11px] font-medium text-foreground">iPhone photo</span>
          <span className="text-[10px] text-muted-foreground">Ready to upload</span>
        </div>
      ) : (
        <div className="flex h-28 flex-col items-center justify-center gap-1.5 bg-secondary/40 p-2 text-center">
          <FileText className="h-7 w-7 text-muted-foreground" />
          <span className="line-clamp-2 text-[11px] text-foreground">{file.name}</span>
        </div>
      )}
      {uploading ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black/45">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/15">
            <Loader2 className="h-5 w-5 animate-spin text-white" />
          </span>
        </div>
      ) : (
        <button
          type="button"
          onClick={onRemove}
          className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-md bg-black/60 text-white"
          aria-label="Remove"
        >
          ×
        </button>
      )}
    </div>
  );
}

// #32 — file picker. On touch: Camera / Photos / Files buttons (camera uses
// `capture`). On desktop: the drag-and-drop zone.
export function FilePickerZone({ onFiles }: { onFiles: (files: FileList | null) => void }) {
  const { appShell } = useAppShell();
  const camRef = useRef<HTMLInputElement>(null);
  const libRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const ALL =
    "image/*,.heic,.heif,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv";
  const inputs = (
    <>
      <input
        ref={camRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          onFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={libRef}
        type="file"
        accept="image/*,.heic,.heif,video/*"
        multiple
        className="hidden"
        onChange={(e) => {
          onFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={fileRef}
        type="file"
        accept={ALL}
        multiple
        className="hidden"
        onChange={(e) => {
          onFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </>
  );

  if (appShell) {
    return (
      <div>
        {inputs}
        <div className="grid grid-cols-3 gap-2">
          <PickerButton icon={Camera} label="Camera" onClick={() => camRef.current?.click()} />
          <PickerButton icon={ImageIcon} label="Photos" onClick={() => libRef.current?.click()} />
          <PickerButton icon={Paperclip} label="Files" onClick={() => fileRef.current?.click()} />
        </div>
      </div>
    );
  }

  return (
    <>
      {inputs}
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          onFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-3 py-6 text-sm transition-colors",
          dragging
            ? "border-gold bg-gold/10 text-foreground"
            : "border-border bg-secondary/30 text-muted-foreground hover:border-gold/40 hover:text-foreground",
        )}
      >
        <Paperclip className="h-5 w-5" />
        <span className="font-medium">
          {dragging ? "Drop files to attach" : "Drag & drop files here, or click to browse"}
        </span>
        <span className="text-[11px] text-muted-foreground">jpg, png, heic, mp4, pdf, docx…</span>
      </button>
    </>
  );
}

function PickerButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="app-press flex flex-col items-center gap-1.5 rounded-xl border border-border bg-card px-2 py-3.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary/50"
    >
      <Icon className="h-5 w-5 text-muted-foreground" />
      {label}
    </button>
  );
}
