import { useCallback, useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type SeoSettings = {
  site_title: string;
  meta_description: string;
  keywords: string;
  canonical_url: string;
  robots_index: boolean;
  og_title: string;
  og_description: string;
  og_image_url: string;
  twitter_handle: string;
  ga_enabled: boolean;
  ga_measurement_id: string;
};

// Must match the seeded defaults in the migration (and the static <head> in
// __root) so an untouched config leaves the current behaviour exactly as-is.
export const SEO_DEFAULTS: SeoSettings = {
  site_title: "VK Mentorship — The operating system for Venu Kalyan Mentorship",
  meta_description:
    "VK Mentorship is the premium coaching, learning, and business transformation platform for the Venu Kalyan Mentorship community.",
  keywords: "VK Mentorship, Venu Kalyan, business coaching, mentorship, entrepreneur",
  canonical_url: "https://vkmentorship.com",
  robots_index: true,
  og_title: "VK Mentorship",
  og_description: "Premium coaching, learning, and business transformation OS.",
  og_image_url: "/icon-512.png",
  twitter_handle: "",
  ga_enabled: false,
  ga_measurement_id: "",
};

// seo_settings isn't in the generated types yet — read/write via a cast client.
const sdb = supabase as unknown as SupabaseClient;

/** Publicly-readable SEO config (works pre-login). Falls back to defaults. */
export async function fetchSeoSettings(): Promise<SeoSettings> {
  try {
    const { data } = await sdb.from("seo_settings").select("*").eq("id", true).maybeSingle();
    if (!data) return SEO_DEFAULTS;
    const d = data as Partial<SeoSettings>;
    return {
      site_title: d.site_title || SEO_DEFAULTS.site_title,
      meta_description: d.meta_description || SEO_DEFAULTS.meta_description,
      keywords: d.keywords ?? SEO_DEFAULTS.keywords,
      canonical_url: d.canonical_url ?? SEO_DEFAULTS.canonical_url,
      robots_index: d.robots_index ?? SEO_DEFAULTS.robots_index,
      og_title: d.og_title || SEO_DEFAULTS.og_title,
      og_description: d.og_description || SEO_DEFAULTS.og_description,
      og_image_url: d.og_image_url || SEO_DEFAULTS.og_image_url,
      twitter_handle: d.twitter_handle ?? SEO_DEFAULTS.twitter_handle,
      ga_enabled: d.ga_enabled ?? SEO_DEFAULTS.ga_enabled,
      ga_measurement_id: d.ga_measurement_id ?? SEO_DEFAULTS.ga_measurement_id,
    };
  } catch {
    return SEO_DEFAULTS;
  }
}

export function useSeoSettings() {
  const [settings, setSettings] = useState<SeoSettings>(SEO_DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setSettings(await fetchSeoSettings());
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(
    async (patch: Partial<SeoSettings>) => {
      setSaving(true);
      try {
        const { error } = await sdb
          .from("seo_settings")
          .update({ ...patch, updated_at: new Date().toISOString() })
          .eq("id", true);
        if (error) throw error;
        await load();
      } finally {
        setSaving(false);
      }
    },
    [load],
  );

  return { settings, loading, saving, save, reload: load };
}
