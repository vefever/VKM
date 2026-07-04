import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Download, X, Share, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VKMLogo } from "@/components/vkm/logo";
import { supabase } from "@/integrations/supabase/client";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "vkm.pwa.install.dismissed.v1";

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // @ts-expect-error iOS Safari
    window.navigator.standalone === true
  );
}

function isIos() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function PwaManager() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [iosHint, setIosHint] = useState(false);
  const [updateReady, setUpdateReady] = useState<ServiceWorker | null>(null);

  // ---- Keep users signed in across app/tab suspensions ----
  // Phones (and backgrounded desktop tabs) freeze JS timers, so Supabase's token
  // auto-refresh ticker stalls while the app is hidden. If the access token
  // lapses in the meantime, the user returns to a logged-out state. Every time
  // the app comes back to the foreground, restart the refresh loop and recover
  // the session (getSession refreshes it if it has expired). Runs in both the
  // installed PWA and the browser as a belt-and-suspenders safety net.
  useEffect(() => {
    if (typeof window === "undefined") return;
    let timer: ReturnType<typeof setInterval> | null = null;

    // getSession() returns the current session and silently refreshes the token
    // when it's near/after expiry — so calling it on resume + on a slow tick
    // keeps the session alive without over-rotating the refresh token.
    const keepAlive = () => {
      if (navigator.onLine === false) return;
      void supabase.auth.getSession();
    };

    const resume = () => {
      if (document.visibilityState === "visible") {
        supabase.auth.startAutoRefresh();
        keepAlive();
        if (!timer) timer = setInterval(keepAlive, 4 * 60 * 1000); // stay fresh while open
      } else {
        supabase.auth.stopAutoRefresh();
        if (timer) {
          clearInterval(timer);
          timer = null;
        }
      }
    };

    resume(); // run once for the current foreground state
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("focus", resume);
    window.addEventListener("pageshow", resume); // bfcache / iOS resume
    window.addEventListener("online", keepAlive); // recover the moment we reconnect
    return () => {
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("focus", resume);
      window.removeEventListener("pageshow", resume);
      window.removeEventListener("online", keepAlive);
      if (timer) clearInterval(timer);
    };
  }, []);

  // ---- Service worker registration + update detection ----
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (!import.meta.env.PROD) return; // avoid clobbering Vite HMR in dev

    let reg: ServiceWorkerRegistration | undefined;
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        reg = registration;
        // A new build was already downloaded on a previous session and is
        // waiting. This is app launch (a cold, safe point — not mid-session), so
        // apply it now: users are never more than one launch behind, without the
        // deploy-time force-reload that caused logouts. The boot session-refresh
        // (use-auth) recovers if the ensuing reload interrupts a token refresh.
        if (registration.waiting && navigator.serviceWorker.controller) {
          registration.waiting.postMessage("SKIP_WAITING");
        }
        // Nudge the browser to check for a newer worker on every launch.
        void registration.update().catch(() => {});
        registration.addEventListener("updatefound", () => {
          const sw = registration.installing;
          if (!sw) return;
          sw.addEventListener("statechange", () => {
            if (sw.state === "installed" && navigator.serviceWorker.controller) {
              setUpdateReady(sw); // found during THIS session → offer an Update toast
            }
          });
        });
      })
      .catch(() => {
        /* ignore */
      });

    // Reload once the new SW takes control.
    let refreshing = false;
    const onControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      void reg;
    };
  }, []);

  // ---- Install prompt wiring ----
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone()) return;
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setShowBanner(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    const onInstalled = () => {
      setShowBanner(false);
      setIosHint(false);
      setDeferred(null);
    };
    window.addEventListener("appinstalled", onInstalled);

    // iOS never fires beforeinstallprompt — show a gentle Add-to-Home hint.
    if (isIos() && !isStandalone()) {
      const t = setTimeout(() => setIosHint(true), 2500);
      return () => {
        clearTimeout(t);
        window.removeEventListener("beforeinstallprompt", onPrompt);
        window.removeEventListener("appinstalled", onInstalled);
      };
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  function dismiss() {
    setShowBanner(false);
    setIosHint(false);
    toast.dismiss(INSTALL_TOAST_ID);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setShowBanner(false);
    setDeferred(null);
    toast.dismiss(INSTALL_TOAST_ID);
  }

  const showInstall = showBanner && !!deferred;

  // The install prompt renders as a PERSISTENT SONNER TOAST rather than its own
  // fixed-position banner — sonner then owns the stacking, so the prompt and a
  // regular toast can never overlap each other or the bottom nav (the toaster's
  // offset already derives from --vkm-nav-h).
  useEffect(() => {
    if (!(showInstall || iosHint)) {
      toast.dismiss(INSTALL_TOAST_ID);
      return;
    }
    toast.custom(
      () => (
        <InstallToastCard
          canInstall={showInstall}
          onInstall={() => void install()}
          onDismiss={dismiss}
        />
      ),
      { id: INSTALL_TOAST_ID, duration: Infinity },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showInstall, iosHint, deferred]);

  return (
    <>
      {/* Update available banner — z-45: above the nav, BELOW modal overlays so
          it can never cover an open sheet/dialog. */}
      <AnimatePresence>
        {updateReady && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="fixed inset-x-0 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[45] mx-auto flex w-[min(92%,420px)] items-center gap-3 rounded-2xl border border-border glass px-4 py-3 shadow-vkm-float"
          >
            <RefreshCw className="h-4 w-4 shrink-0 text-gold" />
            <p className="flex-1 text-sm font-medium text-foreground">
              A new version of VKM is ready.
            </p>
            <Button
              size="sm"
              className="rounded-full bg-gradient-navy text-primary-foreground"
              onClick={() => updateReady.postMessage("SKIP_WAITING")}
            >
              Update
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

const INSTALL_TOAST_ID = "vkm-install-prompt";

// Content only — the sonner toast card (border/background/padding from
// .vkm-toaster CSS) supplies the chrome.
function InstallToastCard({
  canInstall,
  onInstall,
  onDismiss,
}: {
  canInstall: boolean;
  onInstall: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="relative w-full">
      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        className="absolute -right-1 -top-1 rounded-full p-1.5 text-muted-foreground hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-center gap-3 pr-7">
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-navy shadow-vkm">
          <VKMLogo showWordmark={false} />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-foreground">Install VK Mentorship</p>
          <p className="text-xs text-muted-foreground">
            Get the full-screen app — faster, offline-ready, on your home screen.
          </p>
        </div>
      </div>

      {canInstall ? (
        <Button
          onClick={onInstall}
          className="mt-3 w-full rounded-xl bg-gradient-navy text-primary-foreground hover:opacity-90"
        >
          <Download className="h-4 w-4" /> Add to home screen
        </Button>
      ) : (
        <div className="mt-3 flex items-center justify-center gap-1.5 rounded-xl bg-secondary px-3 py-2.5 text-xs text-foreground">
          Tap <Share className="mx-0.5 inline h-4 w-4 text-navy" /> then
          <span className="mx-0.5 inline-flex items-center gap-1 font-medium">
            <Plus className="h-3.5 w-3.5" /> Add to Home Screen
          </span>
        </div>
      )}
    </div>
  );
}
