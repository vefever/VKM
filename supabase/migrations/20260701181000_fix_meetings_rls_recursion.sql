-- =========================================================
-- FIX: infinite recursion between meetings <-> meeting_attendees RLS.
-- meetings_select referenced meeting_attendees, and ma_select referenced
-- meetings — each policy triggered the other. Route both cross-checks through
-- SECURITY DEFINER helpers, which bypass RLS, breaking the cycle.
-- =========================================================

create or replace function public.is_meeting_attendee(_meeting uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.meeting_attendees ma
    where ma.meeting_id = _meeting and ma.user_id = auth.uid()
  );
$$;
revoke execute on function public.is_meeting_attendee(uuid) from anon, public;
grant execute on function public.is_meeting_attendee(uuid) to authenticated;

create or replace function public.is_meeting_host(_meeting uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.meetings m
    where m.id = _meeting and m.host_id = auth.uid()
  );
$$;
revoke execute on function public.is_meeting_host(uuid) from anon, public;
grant execute on function public.is_meeting_host(uuid) to authenticated;

drop policy if exists meetings_select on public.meetings;
create policy meetings_select on public.meetings
  for select to authenticated using (
    auth.uid() = host_id
    or auth.uid() = participant_id
    or public.is_staff()
    or public.is_meeting_attendee(id)
  );

drop policy if exists ma_select on public.meeting_attendees;
create policy ma_select on public.meeting_attendees
  for select to authenticated using (
    user_id = auth.uid()
    or public.is_staff()
    or public.is_meeting_host(meeting_id)
  );
