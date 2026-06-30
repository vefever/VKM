-- =========================================================
-- ZOOM MEETINGS — coaches/mentors schedule 1:1 Zoom calls with participants.
-- Meetings are created server-side (edge function via Zoom Server-to-Server
-- OAuth) and joined in-app with the Zoom Meeting SDK (no redirect).
--
-- Zoom credentials live in messaging_settings(id='zoom') — super_admin only.
-- =========================================================

create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  zoom_meeting_id text, -- Zoom numeric meeting id (as text)
  topic text not null,
  host_id uuid not null references auth.users(id) on delete cascade,
  participant_id uuid references auth.users(id) on delete cascade,
  batch_id uuid references public.batches(id) on delete set null,
  start_time timestamptz not null,
  duration_min int not null default 30,
  join_url text,
  start_url text,
  password text,
  status text not null default 'scheduled', -- scheduled | started | ended | cancelled
  created_at timestamptz not null default now()
);

create index if not exists meetings_participant_idx on public.meetings (participant_id, start_time);
create index if not exists meetings_host_idx on public.meetings (host_id, start_time);

grant select, insert, update, delete on public.meetings to authenticated;
grant all on public.meetings to service_role;
alter table public.meetings enable row level security;

-- Host, the invited participant, and staff can see a meeting.
drop policy if exists meetings_select on public.meetings;
create policy meetings_select on public.meetings
  for select to authenticated
  using (
    auth.uid() = host_id
    or auth.uid() = participant_id
    or public.is_staff()
  );

-- Staff may create meetings they host (the edge function uses the service role,
-- but this keeps direct writes safe too).
drop policy if exists meetings_insert on public.meetings;
create policy meetings_insert on public.meetings
  for insert to authenticated
  with check (public.is_staff() and auth.uid() = host_id);

-- The host (or a super admin) can reschedule / cancel.
drop policy if exists meetings_update on public.meetings;
create policy meetings_update on public.meetings
  for update to authenticated
  using (auth.uid() = host_id or public.has_role(auth.uid(), 'super_admin'))
  with check (auth.uid() = host_id or public.has_role(auth.uid(), 'super_admin'));

drop policy if exists meetings_delete on public.meetings;
create policy meetings_delete on public.meetings
  for delete to authenticated
  using (auth.uid() = host_id or public.has_role(auth.uid(), 'super_admin'));

-- Seed the Zoom credential row (super_admin-only via messaging_settings RLS).
insert into public.messaging_settings (id, provider, enabled, config)
values ('zoom', 'zoom', false, '{}'::jsonb)
on conflict (id) do nothing;
