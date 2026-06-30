import { resolveVideoSource, withAutoplay, type VideoKind } from "@/lib/video-source";
import { cn } from "@/lib/utils";

// One renderer for every source type. Direct/uploaded files use <video> (so we
// can fire onEnded → "watched"); YouTube/Vimeo render as responsive iframes.
export function VideoPlayer({
  url,
  provider,
  autoPlay = false,
  onEnded,
  poster,
  title = "Video",
  className,
}: {
  url: string;
  provider?: VideoKind;
  autoPlay?: boolean;
  onEnded?: () => void;
  poster?: string;
  title?: string;
  className?: string;
}) {
  const base = resolveVideoSource(url, provider);
  const src = autoPlay ? withAutoplay(base) : base;

  if (src.kind === "file") {
    return (
      <video
        src={src.fileUrl}
        controls
        autoPlay={autoPlay}
        onEnded={onEnded}
        poster={poster}
        preload="metadata"
        playsInline
        // Only one inline video plays at a time — pause any others on play.
        onPlay={(e) => {
          document.querySelectorAll("video").forEach((v) => {
            if (v !== e.currentTarget) v.pause();
          });
        }}
        className={cn("aspect-video w-full rounded-xl bg-black", className)}
      >
        <track kind="captions" />
      </video>
    );
  }

  return (
    <iframe
      src={src.embedUrl}
      title={title}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowFullScreen
      className={cn("aspect-video w-full rounded-xl border-0 bg-black", className)}
    />
  );
}
