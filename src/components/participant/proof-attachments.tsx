import { useRef, useState, type DragEvent } from "react";
import {
  FileText,
  Download,
  Loader2,
  Camera,
  Paperclip,
  Image as ImageIcon,
  type LucideIcon,
} from "lucide-react";
import type { Attachment } from "@/components/chat/chat-data";
import { useAppShell } from "@/hooks/use-app-shell";
import { cn } from "@/lib/utils";

// Renders uploaded proof files with inline preview (image/video) + download.
export function ProofAttachments({ files }: { files: Attachment[] }) {
  if (!files || files.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {files.map((a, i) => (
        <Tile key={i} a={a} />
      ))}
    </div>
  );
}

function Tile({ a }: { a: Attachment }) {
  if (a.kind === "image") {
    return (
      <a
        href={a.url}
        target="_blank"
        rel="noreferrer"
        className="group relative block overflow-hidden rounded-xl border border-border"
        title={a.name}
      >
        <img src={a.url} alt={a.name} className="h-28 w-full object-cover" />
        <span className="absolute bottom-1 right-1 inline-flex h-6 w-6 items-center justify-center rounded-md bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100">
          <Download className="h-3.5 w-3.5" />
        </span>
      </a>
    );
  }
  if (a.kind === "video") {
    return (
      <div className="overflow-hidden rounded-xl border border-border">
        <video src={a.url} controls className="h-28 w-full bg-black object-contain" />
      </div>
    );
  }
  return (
    <a
      href={a.url}
      target="_blank"
      rel="noreferrer"
      download
      className="flex h-28 flex-col items-center justify-center gap-1.5 rounded-xl border border-border bg-secondary/40 p-2 text-center transition-colors hover:bg-secondary/70"
      title={a.name}
    >
      <FileText className="h-7 w-7 text-muted-foreground" />
      <span className="line-clamp-2 text-[11px] text-foreground">{a.name}</span>
      <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
        <Download className="h-3 w-3" /> Download
      </span>
    </a>
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
  const isImage = file.type.startsWith("image/");
  const isVideo = file.type.startsWith("video/");
  return (
    <div className="group relative overflow-hidden rounded-xl border border-border">
      {isImage ? (
        <img src={url} alt={file.name} className="h-28 w-full object-cover" />
      ) : isVideo ? (
        <video src={url} className="h-28 w-full bg-black object-contain" />
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

  const ALL = "image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv";
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
        accept="image/*,video/*"
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
        <span className="text-[11px] text-muted-foreground">jpg, png, mp4, pdf, docx…</span>
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
