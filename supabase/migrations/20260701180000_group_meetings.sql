-- =========================================================
-- GROUP MEETINGS (2026-07-01)
--
-- Extends the 1:1 Zoom meetings into scheduled meetings with MANY attendees
-- across roles (participants + coach + mentor + admin). Staff schedule; every
-- attendee gets a calendar block (in-app), a notification and an email invite.
-- Meeting join can be an auto-created Zoom, any pasted link, or in-person.
-- =========================================================

alter table public.meetings
  add column if not exists meeting_type text not null default 'link', -- zoom | link | in_person
  add column if not exists location text,
  add column if not exists notes text;

-- Attendees (many-to-many). Rows are written by the scheduler server fn (service
-- role); attendees can update their own RSVP status.
create table if not exists public.meeting_attendees (
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text,                                       -- snapshot at invite time
  status text not null default 'invited',          -- invited | accepted | declined
  created_at timestamptz not null default now(),
  primary key (meeting_id, user_id)
);
create index if not exists meeting_attendees_user_idx on public.meeting_attendees (user_id);

grant select, insert, update, delete on public.meeting_attendees to authenticated;
grant all on public.meeting_attendees to service_role;
alter table public.meeting_attendees enable row level security;

drop policy if exists ma_select on public.meeting_attendees;
create policy ma_select on public.meeting_attendees
  for select to authenticated using (
    user_id = auth.uid()
    or public.is_staff()
    or exists (select 1 from public.meetings m where m.id = meeting_id and m.host_id = auth.uid())
  );

-- Attendees may update their own RSVP; host/admin manage the rest via service role.
drop policy if exists ma_update_own on public.meeting_attendees;
create policy ma_update_own on public.meeting_attendees
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Invited attendees can see the meeting (in addition to host / participant / staff).
drop policy if exists meetings_select on public.meetings;
create policy meetings_select on public.meetings
  for select to authenticated using (
    auth.uid() = host_id
    or auth.uid() = participant_id
    or public.is_staff()
    or exists (
      select 1 from public.meeting_attendees ma
      where ma.meeting_id = meetings.id and ma.user_id = auth.uid()
    )
  );

do $$
begin
  begin
    alter publication supabase_realtime add table public.meeting_attendees;
  exception when duplicate_object then null;
  end;
end $$;
