import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { X, Loader2, AlertTriangle, Video, ExternalLink } from "lucide-react";
import { getZoomSignature } from "@/components/meetings/meetings-data";

type Status = "connecting" | "joined" | "error";

/**
 * In-app Zoom meeting using the Meeting SDK (Component View) — runs inside the
 * app, no redirect. The signature is minted server-side by the `zoom` edge fn.
 * The SDK is dynamically imported so it never touches the server bundle.
 *
 * Mobile/PWA: the Component View canvas is sized to the live viewport (not a
 * fixed desktop size), the overlay respects safe-area insets, and an
 * "Open in Zoom app" fallback is always available for devices where the web
 * Meeting SDK can't run a full call.
 */
export function ZoomMeetingModal({
  meetingId,
  topic,
  userName,
  joinUrl,
  onClose,
}: {
  meetingId: string;
  topic: string;
  userName: string;
  joinUrl?: string | null;
  onClose: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const clientRef = useRef<{ leave: () => void } | null>(null);
  const destroyRef = useRef<(() => void) | null>(null);
  const [status, setStatus] = useState<Status>("connecting");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const info = await getZoomSignature(meetingId);
        if (cancelled || !rootRef.current) return;
        const { default: ZoomMtgEmbedded } = await import("@zoom/meetingsdk/embedded");
        const client = ZoomMtgEmbedded.createClient();
        clientRef.current = client as unknown as { leave: () => void };
        destroyRef.current = () => ZoomMtgEmbedded.destroyClient();

        // Fit the meeting canvas to the actual screen (minus the header bar).
        const vw = Math.max(320, Math.floor(window.innerWidth));
        const vh = Math.max(400, Math.floor(window.innerHeight));
        const size = { width: vw, height: Math.max(320, vh - 56) };

        await client.init({
          zoomAppRoot: rootRef.current,
          language: "en-US",
          patchJsMedia: true,
          customize: {
            video: {
              isResizable: true,
              viewSizes: { default: size, ribbon: size },
            },
          },
        });
        await client.join({
          signature: info.signature,
          sdkKey: info.sdkKey,
          meetingNumber: info.meetingNumber,
          password: info.password,
          userName,
        });
        if (!cancelled) setStatus("joined");
      } catch (e) {
        if (!cancelled) {
          setError((e as Error).message || "Could not start the meeting");
          setStatus("error");
        }
      }
    })();

    return () => {
      cancelled = true;
      try {
        clientRef.current?.leave();
        destroyRef.current?.();
      } catch {
        /* already torn down */
      }
    };
  }, [meetingId, userName]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ height: "100dvh" }}
      className="fixed inset-0 z-[70] flex flex-col overflow-hidden bg-black/95 pt-safe"
    >
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center justify-between gap-2 px-3 sm:px-4">
        <p className="flex min-w-0 items-center gap-2 text-sm font-medium text-white">
          <Video className="h-4 w-4 shrink-0" /> <span className="truncate">{topic}</span>
        </p>
        <div className="flex shrink-0 items-center gap-2">
          {joinUrl && (
            <a
              href={joinUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Open in Zoom</span>
            </a>
          )}
          <button
            onClick={onClose}
            className="app-press inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
            aria-label="Leave meeting"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Meeting canvas */}
      <div className="relative min-h-0 flex-1">
        <div ref={rootRef} className="flex h-full w-full items-center justify-center" />

        {status === "connecting" && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/80">
            <Loader2 className="h-7 w-7 animate-spin" />
            <p className="text-sm">Connecting to your Zoom meeting…</p>
          </div>
        )}

        {status === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center text-white/90">
            <AlertTriangle className="h-8 w-8 text-amber-400" />
            <p className="max-w-md text-sm">{error}</p>
            <p className="max-w-xs text-xs text-white/60">
              Some mobile browsers can’t run the in-app call. You can join in the Zoom app instead.
            </p>
            <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
              {joinUrl && (
                <a
                  href={joinUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#2D8CFF] px-4 py-2 text-sm font-medium text-white hover:bg-[#2D8CFF]/90"
                >
                  <ExternalLink className="h-4 w-4" /> Open in Zoom app
                </a>
              )}
              <button
                onClick={onClose}
                className="rounded-full bg-white/10 px-4 py-2 text-sm hover:bg-white/20"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
