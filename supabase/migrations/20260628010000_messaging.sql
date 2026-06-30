-- =========================================================
-- MESSAGING — admin-configured Email / SMS / WhatsApp providers, templates,
-- and an optional email-OTP login toggle.
--
-- Secrets (API keys) live in messaging_settings.config and are SUPER_ADMIN-only.
-- The edge function reads them with the service role (bypasses RLS). They are
-- never exposed to participants or shipped in the client bundle.
-- =========================================================

create table if not exists public.messaging_settings (
  id text primary key, -- 'email' | 'sms' | 'whatsapp' | 'general'
  provider text, -- resend | mailersend | ses | twilio | meta | custom
  config jsonb not null default '{}'::jsonb,
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.messaging_settings enable row level security;

drop policy if exists messaging_settings_admin on public.messaging_settings;
create policy messaging_settings_admin on public.messaging_settings
  for all to authenticated
  using (public.has_role(auth.uid(), 'super_admin'))
  with check (public.has_role(auth.uid(), 'super_admin'));

-- ---------------------------------------------------------
-- Reusable message templates ({{variable}} placeholders).
-- ---------------------------------------------------------
create table if not exists public.message_templates (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('email', 'sms', 'whatsapp')),
  key text not null,
  name text not null,
  subject text, -- email only
  body text not null default '',
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (channel, key)
);

alter table public.message_templates enable row level security;

drop policy if exists message_templates_admin on public.message_templates;
create policy message_templates_admin on public.message_templates
  for all to authenticated
  using (public.has_role(auth.uid(), 'super_admin'))
  with check (public.has_role(auth.uid(), 'super_admin'));

drop policy if exists message_templates_staff_read on public.message_templates;
create policy message_templates_staff_read on public.message_templates
  for select to authenticated using (public.is_staff());

-- ---------------------------------------------------------
-- Public read for just the OTP-login toggle (the login screen is pre-auth and
-- can't read the super-admin-only settings table directly).
-- ---------------------------------------------------------
create or replace function public.otp_login_enabled()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select (config->>'otp_login_enabled')::boolean
     from public.messaging_settings where id = 'general'),
    false
  );
$$;

grant execute on function public.otp_login_enabled() to anon, authenticated;

-- ---------------------------------------------------------
-- Seed the singleton config rows.
-- ---------------------------------------------------------
insert into public.messaging_settings (id, provider, enabled, config) values
  ('email', 'resend', false, '{}'::jsonb),
  ('sms', 'twilio', false, '{}'::jsonb),
  ('whatsapp', 'twilio', false, '{}'::jsonb),
  ('general', null, true, '{"otp_login_enabled": false}'::jsonb)
on conflict (id) do nothing;
