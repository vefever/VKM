import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Loader2,
  Settings,
  RotateCcw,
  Check,
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

// Stable per-source key for the "resume where you left off" position cache.
function resumeKey(src: string): string {
  let h = 0;
  for (let i = 0; i < src.length; i++) h = (h * 31 + src.charCodeAt(i)) | 0;
  return `vkm.vp.pos.${h}`;
}

type Level = { index: number; height: number };
type FakeFs = "off" | "rotate" | "fill";

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
  const inlineRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveAt = useRef(0);
  // A stable host node the player renders into. We physically move THIS node
  // between the inline slot and <body> (appendChild preserves the live <video>,
  // so it keeps playing) — instead of switching the portal container, which
  // would remount and reload the video.
  const hostRef = useRef<HTMLDivElement | null>(null);
  if (typeof document !== "undefined" && !hostRef.current) {
    hostRef.current = document.createElement("div");
    hostRef.current.style.display = "contents";
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hlsRef = useRef<any>(null);

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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [levels, setLevels] = useState<Level[]>([]);
  const [level, setLevel] = useState(-1); // -1 = Auto
  const [fsReal, setFsReal] = useState(false);
  const [fake, setFake] = useState<FakeFs>("off");
  const [showUi, setShowUi] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const inFs = fsReal || fake !== "off";

  // Move the host node to <body> in immersive mode (escaping any transformed
  // ancestor that would otherwise trap position:fixed), back to the inline slot
  // otherwise. Runs after mount so the inline slot exists.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const target = fake !== "off" ? document.body : inlineRef.current;
    if (target && host.parentElement !== target) target.appendChild(host);
  }, [fake]);
  // Detach the host on unmount.
  useEffect(() => () => hostRef.current?.remove(), []);

  // Lock page scroll while the CSS-immersive layer covers the screen.
  useEffect(() => {
    if (fake === "off") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [fake]);

  // ── Source attach: HLS (native on Safari, else hls.js) or direct file ──────
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    setError(null);
    setLevels([]);
    setLevel(-1);

    if (!isHlsUrl(src) || video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      return;
    }

    let destroyed = false;
    void import("hls.js").then(({ default: Hls }) => {
      if (destroyed) return;
      if (!Hls.isSupported()) {
        video.src = src;
        return;
      }
      const hls = new Hls({ enableWorker: true, capLevelToPlayerSize: true });
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      hls.on(Hls.Events.MANIFEST_PARSED, (_e: unknown, data: { levels: any[] }) => {
        const ls: Level[] = (data.levels || [])
          .map((l, i) => ({ index: i, height: l.height || 0 }))
          .filter((l) => l.height > 0)
          .sort((a, b) => b.height - a.height);
        setLevels(ls);
      });
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
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [src]);

  // Apply a chosen HLS quality (or Auto).
  const pickLevel = useCallback((idx: number) => {
    setLevel(idx);
    if (hlsRef.current) hlsRef.current.currentLevel = idx; // -1 → auto
    setSettingsOpen(false);
  }, []);

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

  // Real (desktop) fullscreen state sync.
  useEffect(() => {
    const onFs = () => setFsReal(document.fullscreenElement === wrapRef.current);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  // Anti screen-recording deterrent (best-effort): pause when the tab/app is
  // hidden. NOTE: the web platform can't truly block screenshots or screen
  // recording — that's an OS capability only native apps can gate.
  useEffect(() => {
    const onVis = () => {
      if (document.hidden && videoRef.current) videoRef.current.pause();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  // ── Custom immersive fullscreen ────────────────────────────────────────────
  // Desktop uses the native Fullscreen API. Touch devices use a CSS "immersive"
  // mode instead — no native API means no browser "<domain> — to exit
  // fullscreen" banner, and on a portrait phone we CSS-rotate to landscape so
  // the video fills the screen (no OS orientation permission needed).
  // Rotate to landscape ONLY when the screen is portrait AND the video is a
  // landscape video — a portrait video would look sideways, so it just fills.
  const computeFake = useCallback((): FakeFs => {
    const v = videoRef.current;
    const videoLandscape = v && v.videoWidth > 0 ? v.videoWidth >= v.videoHeight : true;
    const screenPortrait = window.innerHeight > window.innerWidth;
    return screenPortrait && videoLandscape ? "rotate" : "fill";
  }, []);

  const enterFake = useCallback(() => {
    setFake(computeFake());
    try {
      history.pushState({ vpImm: true }, "");
    } catch {
      /* ignore */
    }
    // Best-effort real orientation lock where allowed (Android Chrome).
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      void (screen.orientation as any)?.lock?.("landscape");
    } catch {
      /* not permitted outside real FS — the CSS rotate covers it */
    }
  }, []);

  const exitFake = useCallback((fromPop: boolean) => {
    setFake("off");
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (screen.orientation as any)?.unlock?.();
    } catch {
      /* ignore */
    }
    if (!fromPop && typeof history !== "undefined" && history.state?.vpImm) {
      history.back(); // pop the state we pushed
    }
  }, []);

  // Hardware/browser back exits immersive instead of navigating away.
  useEffect(() => {
    if (fake === "off") return;
    const onPop = () => exitFake(true);
    const onResize = () => setFake((f) => (f === "off" ? f : computeFake()));
    window.addEventListener("popstate", onPop);
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, [fake, exitFake, computeFake]);

  const toggleFullscreen = useCallback(() => {
    if (fsReal) {
      void document.exitFullscreen();
      return;
    }
    if (fake !== "off") {
      exitFake(false);
      return;
    }
    const coarse = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
    if (coarse) {
      enterFake();
      return;
    }
    const el = wrapRef.current;
    if (el?.requestFullscreen) void el.requestFullscreen();
  }, [fsReal, fake, enterFake, exitFake]);

  const armAutoHide = useCallback(() => {
    setShowUi(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
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

  const fakeStyle: React.CSSProperties | undefined =
    fake === "rotate"
      ? {
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vh", // element is "landscape": width = screen height…
          height: "100vw", // …height = screen width
          transformOrigin: "0 0",
          // rotate about the top-left, then shift right by a screen-width so the
          // rotated box lands back over the portrait viewport.
          transform: "translateX(100vw) rotate(90deg)",
          zIndex: 2147483000,
          borderRadius: 0,
          background: "#000",
        }
      : fake === "fill"
        ? {
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            zIndex: 2147483000,
            borderRadius: 0,
            background: "#000",
          }
        : undefined;

  const content = (
    <div
      ref={wrapRef}
      tabIndex={0}
      onKeyDown={onKey}
      onMouseMove={armAutoHide}
      onMouseLeave={() => playing && setShowUi(false)}
      onTouchStart={armAutoHide}
      onContextMenu={(e) => e.preventDefault()} // no "save video as"
      style={fakeStyle}
      className={cn(
        "group/vp select-none overflow-hidden bg-black outline-none",
        fake === "off" ? "absolute inset-0 rounded-xl" : "",
        !showUi && playing && "cursor-none",
      )}
    >
      <video
        ref={videoRef}
        poster={poster}
        autoPlay={autoPlay}
        muted={autoPlay}
        preload="metadata"
        playsInline
        draggable={false}
        controlsList="nodownload noremoteplayback noplaybackrate"
        disablePictureInPicture
        onContextMenu={(e) => e.preventDefault()}
        onClick={togglePlay}
        onDoubleClick={toggleFullscreen}
        onLoadedMetadata={(e) => {
          const v = e.currentTarget;
          setDuration(v.duration || 0);
          setReady(true);
          // Resume where the user left off (skip if basically at start/end).
          try {
            const saved = Number(localStorage.getItem(resumeKey(src)) || 0);
            if (saved > 5 && Number.isFinite(v.duration) && saved < v.duration - 8) {
              v.currentTime = saved;
              setCurrent(saved);
            }
          } catch {
            /* ignore */
          }
        }}
        onTimeUpdate={(e) => {
          const v = e.currentTarget;
          setCurrent(v.currentTime);
          const now = Date.now();
          if (now - saveAt.current > 4000) {
            saveAt.current = now;
            try {
              localStorage.setItem(resumeKey(src), String(Math.floor(v.currentTime)));
            } catch {
              /* ignore */
            }
          }
        }}
        onProgress={(e) => {
          const v = e.currentTarget;
          if (v.buffered.length) setBuffered(v.buffered.end(v.buffered.length - 1));
        }}
        onPlay={() => {
          setPlaying(true);
          setEnded(false);
          armAutoHide();
          document.querySelectorAll("video").forEach((el) => {
            if (el !== videoRef.current) el.pause();
          });
        }}
        onPause={() => {
          setPlaying(false);
          setShowUi(true);
          const v = videoRef.current;
          if (v) {
            try {
              localStorage.setItem(resumeKey(src), String(Math.floor(v.currentTime)));
            } catch {
              /* ignore */
            }
          }
        }}
        onWaiting={() => setWaiting(true)}
        onPlaying={() => setWaiting(false)}
        onCanPlay={() => setWaiting(false)}
        onEnded={() => {
          setPlaying(false);
          setEnded(true);
          setShowUi(true);
          try {
            localStorage.removeItem(resumeKey(src));
          } catch {
            /* ignore */
          }
          onEnded?.();
        }}
        onError={() => setError("This video couldn't be loaded.")}
        className="h-full w-full bg-black object-contain"
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
            {ended ? <RotateCcw className="h-7 w-7" /> : <Play className="ml-1 h-8 w-8 fill-current" />}
          </span>
        </button>
      )}

      {/* Controls bar */}
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-3 pb-2 pt-8 transition-opacity duration-300",
          showUi || !playing ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Seek bar */}
        <div className="group/seek relative mb-1.5 h-4 w-full">
          <div className="absolute top-1/2 h-1 w-full -translate-y-1/2 overflow-hidden rounded-full bg-white/25">
            <div className="absolute inset-y-0 left-0 bg-white/35" style={{ width: `${bufferedPct}%` }} />
            <div className="absolute inset-y-0 left-0 bg-gold" style={{ width: `${playedPct}%` }} />
          </div>
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
            {/* Settings: quality (HLS) + speed */}
            <div className="relative">
              <Ctrl label="Settings" onClick={() => setSettingsOpen((o) => !o)}>
                <Settings className={cn("h-5 w-5 transition-transform", settingsOpen && "rotate-45")} />
              </Ctrl>
              {settingsOpen && (
                <div className="absolute bottom-full right-0 mb-2 w-44 overflow-hidden rounded-xl border border-white/10 bg-black/90 p-1 backdrop-blur">
                  {levels.length > 0 && (
                    <>
                      <p className="px-3 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-wide text-white/50">
                        Quality
                      </p>
                      <MenuItem active={level === -1} onClick={() => pickLevel(-1)}>
                        Auto
                      </MenuItem>
                      {levels.map((l) => (
                        <MenuItem key={l.index} active={level === l.index} onClick={() => pickLevel(l.index)}>
                          {l.height}p
                        </MenuItem>
                      ))}
                      <div className="my-1 h-px bg-white/10" />
                    </>
                  )}
                  <p className="px-3 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-wide text-white/50">
                    Speed
                  </p>
                  {SPEEDS.map((s) => (
                    <MenuItem
                      key={s}
                      active={s === rate}
                      onClick={() => {
                        setRate(s);
                        setSettingsOpen(false);
                      }}
                    >
                      {s === 1 ? "Normal" : `${s}x`}
                    </MenuItem>
                  ))}
                </div>
              )}
            </div>

            <Ctrl label={inFs ? "Exit fullscreen" : "Fullscreen"} onClick={toggleFullscreen}>
              {inFs ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
            </Ctrl>
          </div>
        </div>
      </div>

      {/* Title chip */}
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

  // Inline placeholder reserves the 16:9 slot; the player itself renders into
  // the stable host node (which lives here inline, or on <body> in fullscreen).
  return (
    <div
      ref={inlineRef}
      className={cn("relative aspect-video w-full", fake === "off" && "overflow-hidden rounded-xl", className)}
    >
      {hostRef.current ? createPortal(content, hostRef.current) : null}
    </div>
  );
}

function Ctrl({ children, label, onClick }: { children: React.ReactNode; label: string; onClick: () => void }) {
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

function MenuItem({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-left text-xs font-medium hover:bg-white/10",
        active ? "text-gold" : "text-white/90",
      )}
    >
      {children}
      {active && <Check className="h-3.5 w-3.5" />}
    </button>
  );
}
