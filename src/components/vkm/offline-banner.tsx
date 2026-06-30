import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { WifiOff } from "lucide-react";

// #10 — offline awareness. Optimistic writes already update the UI immediately;
// this tells the user when they're offline and re-syncs data on reconnect.
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = () => {
      const off = !navigator.onLine;
      setOffline(off);
      if (!off) window.dispatchEvent(new Event("vkm:refresh"));
    };
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return (
    <AnimatePresence>
      {offline && (
        <motion.div
          initial={{ y: -48, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -48, opacity: 0 }}
          className="fixed inset-x-0 top-0 z-[60] flex items-center justify-center gap-2 bg-navy px-4 text-xs font-medium text-primary-foreground pt-safe"
          style={{ minHeight: "calc(1.75rem + env(safe-area-inset-top))" }}
        >
          <WifiOff className="h-3.5 w-3.5 shrink-0" />
          You're offline — showing saved data. Changes sync when you reconnect.
        </motion.div>
      )}
    </AnimatePresence>
  );
}
