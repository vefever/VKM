import { useCallback, useEffect, useRef, useState } from "react";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Loader2,
  Gauge,
  RotateCcw,
} from "lucide-react";
import { resolveVideoSource, withAutoplay, isHlsUrl, type VideoKind } from "@/lib/video-source";
import { cn } from "@/lib/utils";

type Props = {
  url: string;
  provider?: VideoKind;
  autoPlay?: boolean;
  onEnded?: () => void;
  poster?: string;
  title?: string;
  className?: string;
};

// One renderer for every source type. Direct/uploaded files (mp4/webm) and HLS
// (.m3u8) use our branded custom player below; YouTube/Vimeo render as an
// iframe (their players can't be re-skinned) inside a matching frame.
export function VideoPlayer({ url, provider, autoPlay = false, onEnded, poster, title = "Video", className }: Props) {
  const base = resolveVideoSource(url, provider);

  if (base.kind === "file") {
    return (
      <FilePlayer
        src={base.fileUrl}
        autoPlay={autoPlay}
        onEnded={onEnded}
        poster={poster}
        title={title}
        className={className}
      />
    );
  }

  const src = autoPlay ? withAutoplay(base) : base;
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

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

function fmt(s: number): string {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(sec).padStart(2, "0")}`;
}

// ── Branded player for direct files + HLS ────────────────────────────────────
function FilePlayer({
  src,
  autoPlay,
  onEnded,
  poster,
  title,
  className,
}: {
  src: string;
  autoPlay?: boolean;
  onEnded?: () => void;
  poster?: string;
  title: string;
  className?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [ended, setEnded] = useState(false);
  const [muted, setMuted] = useState(autoPlay ?? false);
  const [volume, setVolume] = useState(1);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [rate, setRate] = useState(1);
  const [speedOpen, setSpeedOpen] = useState(false);
  const [fs, setFs] = useState(false);
  const [showUi, setShowUi] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // HLS: native on Safari/iOS, else lazy-load hls.js and attach.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    setError(null);

    if (!isHlsUrl(src) || video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      return;
    }

    let destroyed = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let hls: any;
    void import("hls.js").then(({ default: Hls }) => {
      if (destroyed) return;
      if (!Hls.isSupported()) {
        video.src = src; // last-ditch: let the browser try
        return;
      }
      hls = new Hls({ enableWorker: true });
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.ERROR, (_e: unknown, data: { fatal: boolean; type: string }) => {
        if (!data?.fatal) return;
        if (data.type === "networkError") hls.startLoad();
        else if (data.type === "mediaError") hls.recoverMediaError();
        else {
          hls.destroy();
          setError("This stream couldn't be played.");
        }
      });
    });
    return () => {
      destroyed = true;
      if (hls) hls.destroy();
    };
  }, [src]);

  // Keep element volume/mute/rate in sync with state.
  useEffect(() => {
    const v = videoRef.current;
    if (v) {
      v.volume = volume;
      v.muted = muted;
    }
  }, [volume, muted]);
  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = rate;
  }, [rate]);

  // Fullscreen state sync.
  useEffect(() => {
    const onFs = () => setFs(document.fullscreenElement === wrapRef.current);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const armAutoHide = useCallback(() => {
    setShowUi(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      // Only hide while actively playing (and no menu open).
      if (videoRef.current && !videoRef.current.paused) setShowUi(false);
    }, 2600);
  }, []);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      setEnded(false);
      void v.play().catch(() => {});
    } else {
      v.pause();
    }
    armAutoHide();
  }, [armAutoHide]);

  const seekBy = useCallback((delta: number) => {
    const v = videoRef.current;
    if (!v || !Number.isFinite(v.duration)) return;
    v.currentTime = Math.min(v.duration, Math.max(0, v.currentTime + delta));
  }, []);

  const onScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = videoRef.current;
    if (!v || !Number.isFinite(v.duration)) return;
    const t = (Number(e.target.value) / 1000) * v.duration;
    v.currentTime = t;
    setCurrent(t);
  };

  const toggleFullscreen = useCallback(() => {
    const el = wrapRef.current;
    const v = videoRef.current;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else if (el?.requestFullscreen) {
      void el.requestFullscreen();
    } else if (v && "webkitEnterFullscreen" in v) {
      // iOS Safari: only the <video> element can go fullscreen.
      (v as unknown as { webkitEnterFullscreen: () => void }).webkitEnterFullscreen();
    }
  }, []);

  // Keyboard shortcuts (player focused).
  const onKey = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case " ":
      case "k":
        e.preventDefault();
        togglePlay();
        break;
      case "ArrowRight":
        e.preventDefault();
        seekBy(5);
        armAutoHide();
        break;
      case "ArrowLeft":
        e.preventDefault();
        seekBy(-5);
        armAutoHide();
        break;
      case "f":
        toggleFullscreen();
        break;
      case "m":
        setMuted((m) => !m);
        break;
    }
  };

  const progress = duration > 0 ? (current / duration) * 1000 : 0;
  const bufferedPct = duration > 0 ? Math.min(100, (buffered / duration) * 100) : 0;
  const playedPct = duration > 0 ? Math.min(100, (current / duration) * 100) : 0;

  return (
    <div
      ref={wrapRef}
      tabIndex={0}
      onKeyDown={onKey}
      onMouseMove={armAutoHide}
      onMouseLeave={() => playing && setShowUi(false)}
      onTouchStart={armAutoHide}
      className={cn(
        "group/vp relative aspect-video w-full select-none overflow-hidden rounded-xl bg-black outline-none",
        !showUi && playing && "cursor-none",
        className,
      )}
    >
      <video
        ref={videoRef}
        poster={poster}
        autoPlay={autoPlay}
        muted={autoPlay}
        preload="metadata"
        playsInline
        onClick={togglePlay}
        onDoubleClick={toggleFullscreen}
        onLoadedMetadata={(e) => {
          setDuration(e.currentTarget.duration || 0);
          setReady(true);
        }}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onProgress={(e) => {
          const v = e.currentTarget;
          if (v.buffered.length) setBuffered(v.buffered.end(v.buffered.length - 1));
        }}
        onPlay={() => {
          setPlaying(true);
          setEnded(false);
          armAutoHide();
          // Only one inline video plays at a time.
          document.querySelectorAll("video").forEach((el) => {
            if (el !== videoRef.current) el.pause();
          });
        }}
        onPause={() => {
          setPlaying(false);
          setShowUi(true);
        }}
        onWaiting={() => setWaiting(true)}
        onPlaying={() => setWaiting(false)}
        onCanPlay={() => setWaiting(false)}
        onEnded={() => {
          setPlaying(false);
          setEnded(true);
          setShowUi(true);
          onEnded?.();
        }}
        onError={() => setError("This video couldn't be loaded.")}
        className="h-full w-full bg-black"
      >
        <track kind="captions" />
      </video>

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/80 px-4 text-center">
          <p className="text-sm font-medium text-white">{error}</p>
          <a
            href={src}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-white/15 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/25"
          >
            Open in a new tab
          </a>
        </div>
      )}

      {/* Buffering spinner */}
      {waiting && !error && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-white/90 drop-shadow" />
        </div>
      )}

      {/* Big center play / replay button */}
      {!error && !waiting && (!playing || ended) && (
        <button
          type="button"
          onClick={togglePlay}
          aria-label={ended ? "Replay" : "Play"}
          className="absolute inset-0 flex items-center justify-center"
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-navy text-primary-foreground shadow-vkm-float ring-1 ring-white/20 transition-transform duration-200 hover:scale-110 sm:h-[72px] sm:w-[72px]">
            {ended ? (
              <RotateCcw className="h-7 w-7" />
            ) : (
              <Play className="ml-1 h-8 w-8 fill-current" />
            )}
          </span>
        </button>
      )}

      {/* Controls bar */}
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-3 pb-2 pt-8 transition-opacity duration-300",
          showUi || !playing ? "opacity-100" : "opacity-0",
        )}
        // Clicks in the bar shouldn't bubble to the video (which would pause it).
        onClick={(e) => e.stopPropagation()}
      >
        {/* Seek bar: buffered underlay + played fill + invisible range on top */}
        <div className="group/seek relative mb-1.5 h-4 w-full">
          <div className="absolute top-1/2 h-1 w-full -translate-y-1/2 overflow-hidden rounded-full bg-white/25">
            <div className="absolute inset-y-0 left-0 bg-white/35" style={{ width: `${bufferedPct}%` }} />
            <div className="absolute inset-y-0 left-0 bg-gold" style={{ width: `${playedPct}%` }} />
          </div>
          {/* Thumb */}
          <div
            className="pointer-events-none absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold opacity-0 shadow transition-opacity group-hover/seek:opacity-100"
            style={{ left: `${playedPct}%` }}
          />
          <input
            type="range"
            min={0}
            max={1000}
            value={progress}
            onChange={onScrub}
            aria-label="Seek"
            className="absolute inset-0 h-4 w-full cursor-pointer appearance-none bg-transparent opacity-0"
          />
        </div>

        {/* Buttons row */}
        <div className="flex items-center gap-1 text-white">
          <Ctrl label={playing ? "Pause" : "Play"} onClick={togglePlay}>
            {playing ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current" />}
          </Ctrl>

          {/* Volume (hover to reveal slider on desktop) */}
          <div className="group/vol flex items-center">
            <Ctrl label={muted || volume === 0 ? "Unmute" : "Mute"} onClick={() => setMuted((m) => !m)}>
              {muted || volume === 0 ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </Ctrl>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(e) => {
                const val = Number(e.target.value);
                setVolume(val);
                setMuted(val === 0);
              }}
              aria-label="Volume"
              className="h-1 w-0 cursor-pointer appearance-none rounded-full bg-white/40 opacity-0 transition-all duration-200 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white group-hover/vol:ml-1.5 group-hover/vol:w-16 group-hover/vol:opacity-100"
            />
          </div>

          <span className="ml-1 text-xs font-medium tabular-nums text-white/90">
            {fmt(current)} <span className="text-white/50">/ {ready ? fmt(duration) : "0:00"}</span>
          </span>

          <div className="ml-auto flex items-center gap-1">
            {/* Playback speed */}
            <div className="relative">
              <Ctrl label="Playback speed" onClick={() => setSpeedOpen((o) => !o)}>
                <span className="flex items-center gap-0.5">
                  <Gauge className="h-5 w-5" />
                  {rate !== 1 && <span className="text-[10px] font-bold">{rate}x</span>}
                </span>
              </Ctrl>
              {speedOpen && (
                <div className="absolute bottom-full right-0 mb-2 w-24 overflow-hidden rounded-xl border border-white/10 bg-black/90 py-1 backdrop-blur">
                  {SPEEDS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        setRate(s);
                        setSpeedOpen(false);
                      }}
                      className={cn(
                        "block w-full px-3 py-1.5 text-left text-xs font-medium hover:bg-white/10",
                        s === rate ? "text-gold" : "text-white/90",
                      )}
                    >
                      {s === 1 ? "Normal" : `${s}x`}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Ctrl label={fs ? "Exit fullscreen" : "Fullscreen"} onClick={toggleFullscreen}>
              {fs ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
            </Ctrl>
          </div>
        </div>
      </div>

      {/* Title chip (top) — fades with controls */}
      {title && title !== "Video" && (
        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/60 to-transparent px-4 pb-6 pt-3 transition-opacity duration-300",
            showUi || !playing ? "opacity-100" : "opacity-0",
          )}
        >
          <p className="truncate text-sm font-semibold text-white drop-shadow">{title}</p>
        </div>
      )}
    </div>
  );
}

function Ctrl({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="inline-flex h-9 min-w-9 items-center justify-center rounded-lg px-1.5 text-white/90 transition-colors hover:bg-white/15 hover:text-white"
    >
      {children}
    </button>
  );
}
