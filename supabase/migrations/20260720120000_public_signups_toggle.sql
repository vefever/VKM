-- Admin-controlled public sign-ups (default OFF — invite-only).
--
-- This platform provisions accounts ONLY through the invite flow. An admin may
-- temporarily open public sign-ups from User Management; that flips this flag.
-- Enforcement lives in the messaging edge function's `public_signup` action
-- (which checks this flag before creating any account) — the Supabase GoTrue
-- signup endpoint itself stays disabled, so this is the single real gate.
--
-- Mirrors otp_login_enabled(): a public (anon-readable) boolean so the sign-in
-- page can decide whether to show the "Create account" tab pre-login.

create or replace function public.signups_enabled()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select (config->>'signups_enabled')::boolean
     from public.messaging_settings where id = 'general'),
    false
  );
$$;

grant execute on function public.signups_enabled() to anon, authenticated;

-- Ensure the flag exists on the singleton 'general' row (default false),
-- without disturbing otp_login_enabled.
update public.messaging_settings
set config = coalesce(config, '{}'::jsonb) || '{"signups_enabled": false}'::jsonb
where id = 'general'
  and not (config ? 'signups_enabled');
