import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { invokeMessaging } from "@/components/admin/messaging-data";

// Config stored in messaging_settings(id='automation').config. cron_secret is
// server-managed and never edited in the form — we preserve it on save.
export type AutomationConfig = {
  daily_reminders_enabled: boolean;
  email_enabled: boolean;
  whatsapp_enabled: boolean;
  email_subject: string;
  email_heading: string;
  email_intro: string;
  whatsapp_message: string;
  whatsapp_template_name: string;
  whatsapp_template_lang: string;
};

export const AUTOMATION_DEFAULTS: AutomationConfig = {
  daily_reminders_enabled: false,
  email_enabled: true,
  whatsapp_enabled: false,
  email_subject: "Finish today's tasks ⏰",
  email_heading: "Keep your streak alive",
  email_intro:
    "You still have tasks left for today. A few focused minutes now keeps your momentum going strong.",
  whatsapp_message:
    "Hi {name}! ⏰ You still have {remaining} of 6 daily tasks left today. Finish them now to keep your streak going: https://vkmentorship.com/participant/habits",
  whatsapp_template_name: "",
  whatsapp_template_lang: "en",
};

type RawConfig = Record<string, unknown>;

function coerce(raw: RawConfig): AutomationConfig {
  const b = (k: keyof AutomationConfig, d: boolean) =>
    typeof raw[k] === "boolean" ? (raw[k] as boolean) : d;
  const s = (k: keyof AutomationConfig, d: string) =>
    typeof raw[k] === "string" && raw[k] ? (raw[k] as string) : d;
  return {
    daily_reminders_enabled: b("daily_reminders_enabled", AUTOMATION_DEFAULTS.daily_reminders_enabled),
    email_enabled: b("email_enabled", AUTOMATION_DEFAULTS.email_enabled),
    whatsapp_enabled: b("whatsapp_enabled", AUTOMATION_DEFAULTS.whatsapp_enabled),
    email_subject: s("email_subject", AUTOMATION_DEFAULTS.email_subject),
    email_heading: s("email_heading", AUTOMATION_DEFAULTS.email_heading),
    email_intro: s("email_intro", AUTOMATION_DEFAULTS.email_intro),
    whatsapp_message: s("whatsapp_message", AUTOMATION_DEFAULTS.whatsapp_message),
    whatsapp_template_name: s("whatsapp_template_name", AUTOMATION_DEFAULTS.whatsapp_template_name),
    whatsapp_template_lang: s("whatsapp_template_lang", AUTOMATION_DEFAULTS.whatsapp_template_lang),
  };
}

export function useAutomationSettings() {
  const [config, setConfig] = useState<AutomationConfig>(AUTOMATION_DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Full raw config (incl. server-managed cron_secret) so we don't drop it on save.
  const rawRef = useRef<RawConfig>({});

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("messaging_settings")
      .select("config")
      .eq("id", "automation")
      .maybeSingle();
    const raw = (data?.config as RawConfig) ?? {};
    rawRef.current = raw;
    setConfig(coerce(raw));
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(
    async (patch: Partial<AutomationConfig>) => {
      setSaving(true);
      try {
        const nextConfig = { ...rawRef.current, ...config, ...patch };
        const { error } = await supabase
          .from("messaging_settings")
          .update({ config: nextConfig, updated_at: new Date().toISOString() })
          .eq("id", "automation");
        if (error) throw error;
        rawRef.current = nextConfig;
        setConfig(coerce(nextConfig));
      } finally {
        setSaving(false);
      }
    },
    [config],
  );

  return { config, loading, saving, save, reload: load };
}

export type LastRun = {
  target_date: string;
  channel: string;
  status: string;
  count: number;
};

/** Aggregate the most recent day's reminder_log for the admin summary. */
export async function fetchLastRun(): Promise<LastRun[]> {
  const { data } = await supabase
    .from("reminder_log")
    .select("target_date, channel, status")
    .order("target_date", { ascending: false })
    .limit(500);
  const rows = (data ?? []) as { target_date: string; channel: string; status: string }[];
  if (!rows.length) return [];
  const latest = rows[0].target_date;
  const byKey = new Map<string, LastRun>();
  for (const r of rows.filter((x) => x.target_date === latest)) {
    const k = `${r.channel}:${r.status}`;
    const cur = byKey.get(k) ?? { target_date: latest, channel: r.channel, status: r.status, count: 0 };
    cur.count++;
    byKey.set(k, cur);
  }
  return [...byKey.values()];
}

export type CronStatus = { scheduled: boolean; schedule: string | null; active: boolean };

/** Is the pg_cron daily-reminder job live? Powers the "Schedule active" badge. */
export async function fetchCronStatus(): Promise<CronStatus> {
  const { data, error } = await supabase.rpc("automation_cron_status");
  if (error || !data || !data[0]) return { scheduled: false, schedule: null, active: false };
  return data[0] as CronStatus;
}

export const runReminders = () => invokeMessaging("run_reminders", { force: true });
export const testReminder = (channel: "email" | "whatsapp", to: string) =>
  invokeMessaging("test_reminder", { channel, to });
