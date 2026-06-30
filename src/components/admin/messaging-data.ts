import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ChannelId = "email" | "sms" | "whatsapp" | "general" | "zoom";

export type MessagingSetting = {
  provider: string | null;
  enabled: boolean;
  config: Record<string, string | boolean>;
};

export type MessageTemplate = {
  id: string;
  channel: "email" | "sms" | "whatsapp";
  key: string;
  name: string;
  subject: string | null;
  body: string;
  enabled: boolean;
};

const EMPTY: MessagingSetting = { provider: null, enabled: false, config: {} };

/** Call the `messaging` edge function; throws on { ok:false }. */
export async function invokeMessaging(action: string, payload: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke("messaging", {
    body: { action, ...payload },
  });
  if (error) throw error;
  if (data && data.ok === false) throw new Error(data.error || "Request failed");
  return data;
}

export function useMessagingSetting(id: ChannelId) {
  const [setting, setSetting] = useState<MessagingSetting>(EMPTY);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    void supabase
      .from("messaging_settings")
      .select("provider, enabled, config")
      .eq("id", id)
      .maybeSingle()
      .then(
        ({ data }) => {
          setSetting(
            data
              ? {
                  provider: data.provider,
                  enabled: data.enabled,
                  config: (data.config as MessagingSetting["config"]) ?? {},
                }
              : EMPTY,
          );
          setLoading(false);
        },
        () => setLoading(false),
      );
  }, [id]);

  useEffect(load, [load]);

  const save = useCallback(
    async (patch: Partial<MessagingSetting>) => {
      const next = { ...setting, ...patch };
      setSetting(next);
      const { error } = await supabase.from("messaging_settings").upsert(
        {
          id,
          provider: next.provider,
          enabled: next.enabled,
          config: next.config,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      );
      if (error) throw error;
    },
    [id, setting],
  );

  return { setting, loading, save, reload: load };
}

export function useTemplates(channel: "email" | "sms" | "whatsapp") {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    void supabase
      .from("message_templates")
      .select("id, channel, key, name, subject, body, enabled")
      .eq("channel", channel)
      .order("created_at")
      .then(
        ({ data }) => {
          setTemplates((data ?? []) as MessageTemplate[]);
          setLoading(false);
        },
        () => setLoading(false),
      );
  }, [channel]);

  useEffect(load, [load]);

  const create = useCallback(
    async (t: { key: string; name: string; subject?: string; body: string }) => {
      const { error } = await supabase.from("message_templates").insert({ channel, ...t });
      if (error) throw error;
      load();
    },
    [channel, load],
  );

  const update = useCallback(
    async (id: string, patch: Partial<MessageTemplate>) => {
      const { error } = await supabase
        .from("message_templates")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      load();
    },
    [load],
  );

  const remove = useCallback(
    async (id: string) => {
      await supabase.from("message_templates").delete().eq("id", id);
      load();
    },
    [load],
  );

  return { templates, loading, create, update, remove };
}

/** Pre-auth check used by the login screen to show/hide OTP sign-in. */
export async function otpLoginEnabled(): Promise<boolean> {
  const { data } = await supabase.rpc("otp_login_enabled");
  return !!data;
}
