-- =========================================================
-- WATER: DROP THE HARD 30-MIN LOCK, ALERT STAFF INSTEAD (2026-07-01)
--
-- Participants can now log a glass anytime (no cooldown block, no forced
-- reason). A glass logged within 30 minutes of the previous one is still flagged
-- `rapid` by the client — and now raises an ALERT to the participant's coach(es),
-- all mentors and super admins via a notification. Anti-spam: at most one alert
-- per participant per 30 minutes.
-- =========================================================

create or replace function public.notify_rapid_water()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_count int;
  v_body text;
begin
  if not coalesce(new.rapid, false) then
    return null;
  end if;

  -- Throttle bursts: if this participant already alerted in the last 30 min, skip.
  if exists (
    select 1 from public.notifications
    where type = 'alert'
      and actor_id = new.user_id
      and title = 'Rapid water logging'
      and created_at > now() - interval '30 minutes'
  ) then
    return null;
  end if;

  select full_name into v_name from public.profiles where id = new.user_id;
  select count(*) into v_count
    from public.water_events
    where user_id = new.user_id and rapid and log_date = new.log_date;

  v_body := coalesce(v_name, 'A participant')
    || ' logged water again within 30 minutes (' || v_count
    || ' rapid today). Possible over-logging — review their hydration.';

  -- Assigned coaches → their participant page.
  insert into public.notifications (user_id, type, title, body, link, actor_id)
  select ca.coach_id, 'alert', 'Rapid water logging', v_body,
         '/coach/participant/' || new.user_id, new.user_id
  from public.coach_assignments ca
  where ca.participant_id = new.user_id and ca.coach_id <> new.user_id;

  -- Mentors → their participant page.
  insert into public.notifications (user_id, type, title, body, link, actor_id)
  select ur.user_id, 'alert', 'Rapid water logging', v_body,
         '/mentor/participant/' || new.user_id, new.user_id
  from public.user_roles ur
  where ur.role = 'mentor' and ur.user_id <> new.user_id;

  -- Super admins → user management.
  insert into public.notifications (user_id, type, title, body, link, actor_id)
  select ur.user_id, 'alert', 'Rapid water logging', v_body,
         '/admin/users', new.user_id
  from public.user_roles ur
  where ur.role = 'super_admin' and ur.user_id <> new.user_id;

  return null;
end;
$$;

drop trigger if exists water_events_rapid_notify on public.water_events;
create trigger water_events_rapid_notify
  after insert on public.water_events
  for each row execute function public.notify_rapid_water();
