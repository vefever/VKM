import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { invokeMessaging } from "@/components/admin/messaging-data";

export type SecuritySettings = {
  totp_enabled: boolean;
  email_otp_2fa_enabled: boolean;
};

export const SECURITY_DEFAULTS: SecuritySettings = {
  totp_enabled: false,
  email_otp_2fa_enabled: false,
};

export async function fetchSecuritySettings(): Promise<SecuritySettings> {
  const { data } = await supabase.from("security_settings").select("totp_enabled, email_otp_2fa_enabled").eq("id", true).maybeSingle();
  if (!data) return SECURITY_DEFAULTS;
  return {
    totp_enabled: data.totp_enabled ?? false,
    email_otp_2fa_enabled: data.email_otp_2fa_enabled ?? false,
  };
}

export function useSecuritySettings() {
  const [settings, setSettings] = useState<SecuritySettings>(SECURITY_DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setSettings(await fetchSecuritySettings());
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(
    async (patch: Partial<SecuritySettings>) => {
      setSaving(true);
      try {
        const { error } = await supabase
          .from("security_settings")
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

export type TotpFactor = { id: string; friendly_name: string | null; status: "verified" | "unverified"; created_at: string };

export function useMyMfaFactors() {
  const [factors, setFactors] = useState<TotpFactor[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (!error && data) setFactors(data.totp as TotpFactor[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { factors, loading, reload: load, verifiedFactor: factors.find((f) => f.status === "verified") ?? null };
}

// ---------------------------------------------------------------------------
// Authenticator app (TOTP) — thin wrappers over Supabase's native MFA API.
// ---------------------------------------------------------------------------

export async function enrollTotp() {
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", issuer: "VK Mentorship" });
  if (error) throw error;
  return data; // { id, totp: { qr_code, secret, uri }, ... }
}

export async function cancelTotpEnrollment(factorId: string) {
  // Unverified factors can be removed without an aal2 session.
  await supabase.auth.mfa.unenroll({ factorId });
}

export async function verifyTotpFactor(factorId: string, code: string) {
  const { data, error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  if (error) throw error;
  return data;
}

export async function unenrollTotp(factorId: string) {
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Email code as a second factor — custom flow (see migration 20260705100000
// for why this can't use supabase.auth.verifyOtp: that mints a brand-new
// session outright, which is wrong for a check layered on an existing one).
// ---------------------------------------------------------------------------

export async function requestEmailMfaCode() {
  await invokeMessaging("request_mfa_email_otp", {});
}

export async function verifyEmailMfaCode(code: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("verify_mfa_email_otp", { _code: code });
  if (error) throw error;
  return !!data;
}

// sessionStorage flag — email-OTP-as-2FA has no native Supabase AAL, so
// "completed this session" is tracked client-side, scoped per-user so a
// device shared between accounts (or a stale tab) can't leak a pass.
const EMAIL_MFA_KEY = "vkm.mfa_email_verified_for";

export function markEmailMfaVerified(userId: string) {
  try {
    sessionStorage.setItem(EMAIL_MFA_KEY, userId);
  } catch {
    /* private mode — flag just won't persist, gate will re-prompt next check */
  }
}

export function isEmailMfaVerified(userId: string): boolean {
  try {
    return sessionStorage.getItem(EMAIL_MFA_KEY) === userId;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// The single gate-decision function — used by both the _authenticated route
// guard (to decide whether to redirect to /verify-2fa) and the /verify-2fa
// page itself (to decide which step to render). Keeping this in one place is
// what guarantees the two never disagree about what's required.
// ---------------------------------------------------------------------------
export type MfaGateMode = "none" | "totp-challenge" | "totp-enroll" | "choose" | "email-otp";

const STAFF_ROLES = new Set(["super_admin", "mentor", "coach"]);

export async function computeMfaGateMode(userId: string, roles: string[]): Promise<MfaGateMode> {
  if (!roles.some((r) => STAFF_ROLES.has(r))) return "none";

  const settings = await fetchSecuritySettings();
  const wantsTotp = settings.totp_enabled;
  const wantsEmail = settings.email_otp_2fa_enabled;
  if (!wantsTotp && !wantsEmail) return "none";

  let hasVerifiedTotp = false;
  if (wantsTotp) {
    const { data } = await supabase.auth.mfa.listFactors();
    hasVerifiedTotp = !!data?.totp?.some((f) => f.status === "verified");
  }

  if (hasVerifiedTotp) {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    return aal?.currentLevel === "aal2" ? "none" : "totp-challenge";
  }
  if (wantsTotp && wantsEmail) {
    return isEmailMfaVerified(userId) ? "none" : "choose";
  }
  if (wantsTotp) {
    return "totp-enroll";
  }
  return isEmailMfaVerified(userId) ? "none" : "email-otp";
}
