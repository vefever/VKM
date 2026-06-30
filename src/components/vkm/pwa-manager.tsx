import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, X, Share, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VKMLogo } from "@/components/vkm/logo";

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
        registration.addEventListener("updatefound", () => {
          const sw = registration.installing;
          if (!sw) return;
          sw.addEventListener("statechange", () => {
            if (sw.state === "installed" && navigator.serviceWorker.controller) {
              setUpdateReady(sw); // a new version is waiting
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
  }

  const showInstall = showBanner && !!deferred;

  return (
    <>
      {/* Update available toast */}
      <AnimatePresence>
        {updateReady && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="fixed inset-x-0 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[60] mx-auto flex w-[min(92%,420px)] items-center gap-3 rounded-2xl border border-border glass px-4 py-3 shadow-vkm-float"
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

      {/* Install banner (Android/desktop) + iOS hint */}
      <AnimatePresence>
        {(showInstall || iosHint) && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            className="fixed inset-x-0 z-[55] mx-auto w-[min(94%,460px)] px-1"
            style={{ bottom: "calc(env(safe-area-inset-bottom) + 5.25rem)" }}
          >
            <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-4 shadow-vkm-float">
              <span aria-hidden className="absolute inset-x-0 top-0 h-[3px] bg-gradient-gold" />
              <button
                onClick={dismiss}
                aria-label="Dismiss"
                className="absolute right-3 top-3 rounded-full p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="flex items-center gap-3 pr-6">
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-navy shadow-vkm">
                  <VKMLogo showWordmark={false} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">Install VK Mentorship</p>
                  <p className="text-xs text-muted-foreground">
                    Get the full-screen app — faster, offline-ready, on your home screen.
                  </p>
                </div>
              </div>

              {showInstall ? (
                <Button
                  onClick={install}
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
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
