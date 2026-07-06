-- =========================================================
-- WHATSAPP AUDIT LOG (2026-07-08)
--
-- One append-only row per WhatsApp message the platform ATTEMPTS to send — any
-- provider (Meta Cloud API / Twilio / AiSensy), any trigger (daily reminders,
-- admin one-offs, provider tests). Written by the `messaging` edge function with
-- the service role (bypasses RLS); read by super admins on the Messaging page.
-- Mirrors email_log (20260706100000). Stores recipient, message, kind, status,
-- time — never any credential.
-- =========================================================

create table if not exists public.whatsapp_log (
  id bigint generated always as identity primary key,
  to_phone text not null,
  body text,                 -- the message text / a short description
  kind text not null,        -- reminder | admin | test
  status text not null,      -- sent | failed
  detail text,               -- provider error message when status = failed
  provider text,             -- meta | twilio | aisensy
  user_id uuid,              -- recipient's user id when known
  created_at timestamptz not null default now()
);
create index if not exists whatsapp_log_created_idx on public.whatsapp_log (created_at desc);

alter table public.whatsapp_log enable row level security;
revoke all on public.whatsapp_log from anon;
grant select on public.whatsapp_log to authenticated;   -- gated by the policy below
grant all on public.whatsapp_log to service_role;

drop policy if exists whatsapp_log_admin_read on public.whatsapp_log;
create policy whatsapp_log_admin_read on public.whatsapp_log
  for select to authenticated
  using (public.has_role(auth.uid(), 'super_admin'));

-- Live updates so the admin log view streams new sends as they happen.
alter publication supabase_realtime add table public.whatsapp_log;
