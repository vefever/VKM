-- =========================================================
-- PERSONAL 2FA OPT-IN (2026-07-05)
--
-- The Security page's totp_enabled / email_otp_2fa_enabled toggles are
-- platform-wide (super_admin only). This adds a PER-USER opt-in on top of
-- that: any coach or mentor can require a second factor on their OWN
-- account from their profile settings page, independent of what the
-- platform-wide setting is. computeMfaGateMode() (security-data.ts) ORs
-- the platform-wide flags with these personal ones — either can trigger
-- the login-time gate for that individual.
--
-- Self-read/self-write already covered by the existing profiles RLS
-- policies (profiles_select_self_or_staff, profiles_update_own — both use
-- auth.uid() = id), so no new policy is needed.
-- =========================================================

alter table public.profiles
  add column if not exists mfa_totp_opt_in boolean not null default false,
  add column if not exists mfa_email_otp_opt_in boolean not null default false;
