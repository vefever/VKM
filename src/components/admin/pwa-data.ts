import { useCallback, useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type PwaSettings = {
  app_name: string;
  short_name: string;
  description: string;
  theme_color: string;
  background_color: string;
  apple_title: string;
  icon_url: string;
};

// Must match the seeded defaults in the migration (and the static manifest) so
// an untouched config leaves the current behaviour exactly as-is.
export const PWA_DEFAULTS: PwaSettings = {
  app_name: "VK Mentorship",
  short_name: "VKM",
  description:
    "The operating system for Venu Kalyan Mentorship — your premium coaching, learning, and business transformation platform.",
  theme_color: "#0B2545",
  background_color: "#0B2545",
  apple_title: "VKM",
  icon_url: "/icon-512.png",
};

// pwa_settings isn't in the generated types yet — read/write via a cast client.
const sdb = supabase as unknown as SupabaseClient;

/** Publicly-readable app identity (works pre-login). Falls back to defaults. */
export async function fetchPwaSettings(): Promise<PwaSettings> {
  try {
    const { data } = await sdb.from("pwa_settings").select("*").eq("id", true).maybeSingle();
    if (!data) return PWA_DEFAULTS;
    const d = data as Partial<PwaSettings>;
    return {
      app_name: d.app_name || PWA_DEFAULTS.app_name,
      short_name: d.short_name || PWA_DEFAULTS.short_name,
      description: d.description || PWA_DEFAULTS.description,
      theme_color: d.theme_color || PWA_DEFAULTS.theme_color,
      background_color: d.background_color || PWA_DEFAULTS.background_color,
      apple_title: d.apple_title || PWA_DEFAULTS.apple_title,
      icon_url: d.icon_url || PWA_DEFAULTS.icon_url,
    };
  } catch {
    return PWA_DEFAULTS;
  }
}

export function usePwaSettings() {
  const [settings, setSettings] = useState<PwaSettings>(PWA_DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setSettings(await fetchPwaSettings());
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(
    async (patch: Partial<PwaSettings>) => {
      setSaving(true);
      try {
        const { error } = await sdb
          .from("pwa_settings")
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
