import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { X, Loader2, AlertTriangle, Video, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { safeHref } from "@/lib/safe-url";

/**
 * Join launcher — opens the Zoom meeting in the Zoom app / Zoom web client.
 *
 * We deliberately do NOT embed the Zoom Meeting SDK (Component View): it's built
 * for React 18 and crashes on React 19 ("ReactCurrentOwner"). Opening the join
 * URL works reliably on every device — desktop and mobile — with no SDK.
 *
 * Props are kept compatible with the previous in-app modal so call sites are
 * unchanged. `userName` is accepted but unused.
 */
export function ZoomMeetingModal({
  meetingId,
  topic,
  joinUrl,
  onClose,
}: {
  meetingId: string;
  topic: string;
  userName?: string;
  joinUrl?: string | null;
  onClose: () => void;
}) {
  const [url, setUrl] = useState<string | null>(safeHref(joinUrl ?? undefined) ?? null);
  const [loading, setLoading] = useState(!joinUrl);
  const [error, setError] = useState("");
  const opened = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let target = safeHref(joinUrl ?? undefined) ?? null;
      // Some flows (e.g. just-created meetings) don't carry the link — look it up.
      if (!target && meetingId) {
        const { data } = await supabase
          .from("meetings")
          .select("join_url")
          .eq("id", meetingId)
          .maybeSingle();
        target = safeHref(data?.join_url ?? undefined) ?? null;
      }
      if (cancelled) return;
      if (!target) {
        setError("This meeting doesn't have a Zoom link yet. Ask your coach to (re)create it.");
        setLoading(false);
        return;
      }
      setUrl(target);
      setLoading(false);
      // Best-effort auto-open in a new tab (may be blocked by the browser — the
      // button below is the reliable, gesture-driven fallback).
      if (!opened.current) {
        opened.current = true;
        try {
          window.open(target, "_blank", "noopener,noreferrer");
        } catch {
          /* popup blocked — user taps the button */
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [meetingId, joinUrl]);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 380, damping: 38 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-t-3xl bg-card p-6 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] text-center shadow-vkm-float sm:rounded-3xl"
      >
        <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#2D8CFF]/15 text-[#2D8CFF]">
          <Video className="h-7 w-7" />
        </div>
        <h3 className="text-lg font-semibold text-foreground">Join “{topic}”</h3>

        {loading ? (
          <p className="mt-2 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Preparing your meeting…
          </p>
        ) : error ? (
          <p className="mx-auto mt-2 flex max-w-xs items-center justify-center gap-1.5 text-sm text-muted-foreground">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" /> {error}
          </p>
        ) : (
          <p className="mx-auto mt-2 max-w-xs text-sm text-muted-foreground">
            Your meeting is opening in Zoom. If it didn't open automatically, tap below.
          </p>
        )}

        <div className="mt-5 flex flex-col gap-2">
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setTimeout(onClose, 400)}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#2D8CFF] text-sm font-semibold text-white hover:bg-[#2D8CFF]/90"
            >
              <ExternalLink className="h-4 w-4" /> Open meeting in Zoom
            </a>
          )}
          <button
            onClick={onClose}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-secondary text-sm font-medium text-foreground hover:bg-secondary/70"
          >
            <X className="h-4 w-4" /> Close
          </button>
        </div>
      </motion.div>
    </div>
  );
}
