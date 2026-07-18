import { Play, Clock, CheckCircle2, Film } from "lucide-react";
import { thumbnailFor, type VideoKind } from "@/lib/video-source";
import { cn } from "@/lib/utils";

// A YouTube-style 16:9 thumbnail shown before a video plays. Priority for the
// image: admin's custom thumbnail → YouTube-derived → a branded gradient
// placeholder. Fully responsive (scales with its container on desktop/mobile).
export function VideoThumb({
  url,
  thumbnail,
  title,
  durationLabel,
  watched,
  onPlay,
  className,
}: {
  url: string;
  provider?: VideoKind;
  thumbnail?: string | null;
  title?: string;
  durationLabel?: string;
  watched?: boolean;
  onPlay: () => void;
  className?: string;
}) {
  const poster = thumbnailFor(url, thumbnail);
  return (
    <button
      type="button"
      onClick={onPlay}
      aria-label={title ? `Play ${title}` : "Play video"}
      className={cn(
        "app-press group relative block aspect-video w-full overflow-hidden rounded-xl bg-gradient-navy text-left text-primary-foreground shadow-vkm",
        className,
      )}
    >
      {poster ? (
        <img
          src={poster}
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      ) : (
        // Branded placeholder for sources with no derivable thumbnail (Vimeo /
        // uploaded .mp4 without a custom thumbnail).
        <span aria-hidden className="absolute inset-0 flex items-center justify-center">
          <Film className="h-10 w-10 text-white/25" />
        </span>
      )}

      {/* Legibility scrim */}
      <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-navy/90 via-navy/25 to-navy/5" />

      {/* Center play button */}
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-white/20 ring-1 ring-white/40 backdrop-blur transition-transform duration-200 group-hover:scale-110 sm:h-16 sm:w-16">
          <Play className="ml-0.5 h-6 w-6 fill-current sm:h-7 sm:w-7" />
        </span>
      </span>

      {watched && (
        <span className="absolute left-2 top-2 inline-flex items-center gap-0.5 rounded-full bg-[#10b981] px-2 py-0.5 text-[10px] font-semibold text-white">
          <CheckCircle2 className="h-3 w-3" /> Watched
        </span>
      )}

      {/* Title + duration */}
      {(title || durationLabel) && (
        <span className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 p-3">
          {title && <span className="truncate text-sm font-semibold drop-shadow">{title}</span>}
          {durationLabel && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded bg-black/45 px-1.5 py-0.5 text-[11px]">
              <Clock className="h-3 w-3" /> {durationLabel}
            </span>
          )}
        </span>
      )}
    </button>
  );
}
