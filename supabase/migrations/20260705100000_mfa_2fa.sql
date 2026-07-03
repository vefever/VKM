-- =========================================================
-- TWO-FACTOR AUTHENTICATION FOR STAFF (2026-07-05)
--
-- Two independently toggleable second factors for staff logins (coach /
-- mentor / super_admin — participants are never affected):
--   1. Authenticator app (TOTP) — uses Supabase's NATIVE MFA API
--      (supabase.auth.mfa.*). No secret is stored in our own schema; GoTrue
--      owns enrollment/verification/AAL elevation. Nothing to create here
--      beyond the platform-wide on/off toggle.
--   2. Email one-time code as a second factor — NOT the same as the existing
--      passwordless "sign in with an email code" (that's a first-factor
--      alternative to password, verified via supabase.auth.verifyOtp, which
--      mints a brand-new session). This is a genuinely separate mechanism:
--      a random 6-digit code, hashed and stored server-side with an
--      expiry, checked against auth.uid() of an ALREADY-signed-in (aal1)
--      session. The plaintext code only ever exists inside Postgres (this
--      function's return value, consumed immediately by the messaging edge
--      function using the service role) and inside the emailed message —
--      it is never sent to or stored by the browser.
--
-- security_settings: platform-wide toggles, single row (mirrors the
-- seo_settings singleton pattern). Publicly readable by any authenticated
-- user (needed right after password sign-in, before the client fully knows
-- what to show), writable only by super_admin.
-- =========================================================

create extension if not exists pgcrypto;

create table if not exists public.security_settings (
  id boolean primary key default true check (id),   -- enforces a single row
  totp_enabled boolean not null default false,
  email_otp_2fa_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into public.security_settings (id) values (true) on conflict (id) do nothing;

grant select on public.security_settings to authenticated;
grant update on public.security_settings to authenticated;
grant all on public.security_settings to service_role;
alter table public.security_settings enable row level security;

drop policy if exists security_settings_select on public.security_settings;
create policy security_settings_select on public.security_settings
  for select to authenticated using (true);

drop policy if exists security_settings_update on public.security_settings;
create policy security_settings_update on public.security_settings
  for update to authenticated
  using (public.has_role(auth.uid(), 'super_admin'))
  with check (public.has_role(auth.uid(), 'super_admin'));

-- ---------------------------------------------------------
-- Email-OTP-as-2FA challenge storage — invisible to clients; only the two
-- SECURITY DEFINER functions below (and service_role, for the edge function)
-- ever touch this table.
-- ---------------------------------------------------------
create table if not exists public.mfa_email_challenges (
  user_id uuid primary key references auth.users (id) on delete cascade,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.mfa_email_challenges enable row level security;
revoke all on public.mfa_email_challenges from anon, authenticated;
grant all on public.mfa_email_challenges to service_role;
-- No policies for anon/authenticated → invisible to clients, matching the
-- existing otp_requests table's convention.

-- Generates a fresh 6-digit code, stores only its bcrypt hash + a 10-minute
-- expiry (resetting attempts), and returns the PLAINTEXT code so the caller
-- (the messaging edge function, using the service role) can email it. Not
-- reachable by anon/authenticated — only service_role can invoke this.
create or replace function public.admin_generate_mfa_email_code(_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  v_code := lpad(floor(random() * 1000000)::text, 6, '0');
  insert into public.mfa_email_challenges (user_id, code_hash, expires_at, attempts, created_at)
  values (_user_id, crypt(v_code, gen_salt('bf')), now() + interval '10 minutes', 0, now())
  on conflict (user_id) do update
    set code_hash = excluded.code_hash,
        expires_at = excluded.expires_at,
        attempts = 0,
        created_at = now();
  return v_code;
end;
$$;
revoke all on function public.admin_generate_mfa_email_code(uuid) from anon, authenticated, public;

-- Verifies a code against the CALLER's own pending challenge (auth.uid() —
-- never a client-supplied user id). One-time use (deletes on success);
-- rate-limited to 5 wrong attempts before the code is invalidated outright.
create or replace function public.verify_mfa_email_otp(_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.mfa_email_challenges%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized';
  end if;

  select * into v_row from public.mfa_email_challenges where user_id = auth.uid();
  if not found then
    return false;
  end if;

  if v_row.expires_at < now() or v_row.attempts >= 5 then
    delete from public.mfa_email_challenges where user_id = auth.uid();
    return false;
  end if;

  if v_row.code_hash = crypt(_code, v_row.code_hash) then
    delete from public.mfa_email_challenges where user_id = auth.uid();
    return true;
  end if;

  update public.mfa_email_challenges set attempts = attempts + 1 where user_id = auth.uid();
  return false;
end;
$$;
revoke all on function public.verify_mfa_email_otp(text) from anon, public;
grant execute on function public.verify_mfa_email_otp(text) to authenticated;
