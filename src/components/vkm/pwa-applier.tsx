import { useEffect } from "react";
import { fetchPwaSettings, PWA_DEFAULTS, type PwaSettings } from "@/components/admin/pwa-data";

// Applies the admin-configured PWA identity at runtime. The static
// manifest.webmanifest + <head> remain the defaults (so an untouched config is
// identical to today); when an admin customises, we update the values that can
// change at runtime:
//   • theme-color meta (address/status bar + Android splash background)
//   • apple-mobile-web-app-title (iOS home-screen name)
//   • apple-touch-icon (iOS home-screen icon + splash glyph)
//   • the web manifest (Android install name/short_name/colors/icon) — swapped
//     to a regenerated same-origin blob ONLY when something actually changed.
export function PwaApplier() {
  useEffect(() => {
    let blobUrl: string | null = null;
    let cancelled = false;

    (async () => {
      const cfg = await fetchPwaSettings();
      if (cancelled) return;

      setMeta("theme-color", cfg.theme_color);
      setMeta("apple-mobile-web-app-title", cfg.apple_title);
      if (cfg.icon_url && cfg.icon_url !== PWA_DEFAULTS.icon_url) {
        setLink("apple-touch-icon", cfg.icon_url);
      }

      if (isCustomised(cfg)) {
        try {
          const res = await fetch("/manifest.webmanifest");
          const m = (await res.json()) as Record<string, unknown>;
          m.name = cfg.app_name;
          m.short_name = cfg.short_name;
          m.description = cfg.description;
          m.theme_color = cfg.theme_color;
          m.background_color = cfg.background_color;
          if (cfg.icon_url && cfg.icon_url !== PWA_DEFAULTS.icon_url) {
            const ext = cfg.icon_url.split("?")[0].split(".").pop()?.toLowerCase();
            const type =
              ext === "webp" ? "image/webp" : ext === "svg" ? "image/svg+xml" : "image/png";
            m.icons = [
              { src: cfg.icon_url, sizes: "512x512", type, purpose: "any" },
              { src: cfg.icon_url, sizes: "512x512", type, purpose: "maskable" },
              { src: cfg.icon_url, sizes: "192x192", type, purpose: "any" },
            ];
          }
          if (cancelled) return;
          const blob = new Blob([JSON.stringify(m)], { type: "application/manifest+json" });
          blobUrl = URL.createObjectURL(blob);
          const link = document.querySelector('link[rel="manifest"]');
          if (link) link.setAttribute("href", blobUrl);
        } catch {
          /* keep the static manifest on any failure */
        }
      }
    })();

    return () => {
      cancelled = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, []);

  return null;
}

function isCustomised(cfg: PwaSettings): boolean {
  return (Object.keys(PWA_DEFAULTS) as (keyof PwaSettings)[]).some(
    (k) => cfg[k] !== PWA_DEFAULTS[k],
  );
}

function setMeta(name: string, content: string) {
  if (!content) return;
  let el = document.querySelector(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("name", name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setLink(rel: string, href: string) {
  if (!href) return;
  let el = document.querySelector(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}
