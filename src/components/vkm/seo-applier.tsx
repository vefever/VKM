import { useEffect } from "react";
import { fetchSeoSettings } from "@/components/admin/seo-data";

// Applies the admin-configured SEO metadata at runtime and loads Google
// Analytics (GA4) when enabled. The static <head> in __root keeps the current
// defaults (so an untouched config is identical to today); here we override the
// live values and inject gtag.js only when an admin has turned analytics on.
export function SeoApplier() {
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const cfg = await fetchSeoSettings();
      if (cancelled) return;

      if (cfg.site_title) document.title = cfg.site_title;
      setMeta("name", "description", cfg.meta_description);
      setMeta("name", "keywords", cfg.keywords);
      setMeta(
        "name",
        "robots",
        cfg.robots_index ? "index, follow" : "noindex, nofollow",
      );

      // Open Graph (link/social previews)
      setMeta("property", "og:title", cfg.og_title);
      setMeta("property", "og:description", cfg.og_description);
      if (cfg.og_image_url) setMeta("property", "og:image", absolute(cfg.og_image_url));
      if (cfg.canonical_url) setMeta("property", "og:url", cfg.canonical_url);

      // Twitter card
      setMeta("name", "twitter:title", cfg.og_title);
      setMeta("name", "twitter:description", cfg.og_description);
      if (cfg.og_image_url) setMeta("name", "twitter:image", absolute(cfg.og_image_url));
      if (cfg.twitter_handle) {
        const handle = cfg.twitter_handle.startsWith("@")
          ? cfg.twitter_handle
          : `@${cfg.twitter_handle}`;
        setMeta("name", "twitter:site", handle);
        setMeta("name", "twitter:creator", handle);
      }

      if (cfg.canonical_url) setCanonical(cfg.canonical_url);

      const gaId = (cfg.ga_measurement_id || "").trim();
      if (cfg.ga_enabled && /^G-[A-Z0-9]+$/i.test(gaId)) {
        loadGoogleAnalytics(gaId);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}

function absolute(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  if (typeof window === "undefined") return url;
  return window.location.origin + (url.startsWith("/") ? url : `/${url}`);
}

function setMeta(attr: "name" | "property", key: string, content: string) {
  if (!content) return;
  let el = document.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setCanonical(href: string) {
  let el = document.querySelector('link[rel="canonical"]');
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

// Standard GA4 gtag.js bootstrap. Guarded so it only injects once.
function loadGoogleAnalytics(id: string) {
  if (document.getElementById("ga-gtag-js")) return;

  const s = document.createElement("script");
  s.id = "ga-gtag-js";
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  document.head.appendChild(s);

  const inline = document.createElement("script");
  inline.id = "ga-gtag-init";
  inline.text = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${id}');`;
  document.head.appendChild(inline);
}
