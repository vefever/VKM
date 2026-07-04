-- =========================================================
-- EMAIL AUDIT LOG (2026-07-06)
--
-- One append-only row per email the platform ATTEMPTS to send — any provider
-- (Resend / MailerSend / SES / ZeptoMail), any trigger (login OTP, 2FA code,
-- daily reminders, bulk meeting invites, admin one-offs, provider tests).
-- Written by the `messaging` edge function with the service role (bypasses
-- RLS); read by super admins in the Messaging + Workflow Automation pages.
-- Mirrors the reminder_log pattern (20260702140000). NEVER stores the email
-- body or any OTP/2FA code — only recipient, subject, kind, status, time.
-- =========================================================

create table if not exists public.email_log (
  id bigint generated always as identity primary key,
  to_email text not null,
  subject text,
  kind text not null,        -- otp | mfa | reminder | bulk | admin | test
  status text not null,      -- sent | failed
  detail text,               -- provider error message when status = failed
  provider text,             -- resend | mailersend | ses | zeptomail
  user_id uuid,              -- recipient's user id when known
  created_at timestamptz not null default now()
);
create index if not exists email_log_created_idx on public.email_log (created_at desc);

alter table public.email_log enable row level security;
revoke all on public.email_log from anon;
grant select on public.email_log to authenticated;   -- gated by the policy below
grant all on public.email_log to service_role;

-- Audit log → super-admin read only (matches the messaging function's
-- checkAdmin gate; tighter than reminder_log's is_staff since this exposes
-- who received login/2FA codes and when).
drop policy if exists email_log_admin_read on public.email_log;
create policy email_log_admin_read on public.email_log
  for select to authenticated
  using (public.has_role(auth.uid(), 'super_admin'));

-- Live updates so the admin log view streams new sends as they happen.
alter publication supabase_realtime add table public.email_log;
