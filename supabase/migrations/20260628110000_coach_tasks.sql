-- =========================================================
-- Coach productivity: personal tasks / reminders (optionally tied to a
-- participant) that surface on the coach dashboard, plus a server-side helper
-- to send a single participant a notification.
-- =========================================================

create table if not exists public.coach_tasks (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references auth.users(id) on delete cascade,
  participant_id uuid references auth.users(id) on delete set null,
  title text not null,
  due_on date,
  done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists coach_tasks_owner_idx on public.coach_tasks (coach_id, done, due_on);

grant select, insert, update, delete on public.coach_tasks to authenticated;
grant all on public.coach_tasks to service_role;
alter table public.coach_tasks enable row level security;

-- A coach owns their own tasks; super admins can read all. Participants never see them.
drop policy if exists coach_tasks_owner on public.coach_tasks;
create policy coach_tasks_owner on public.coach_tasks
  for all to authenticated
  using (coach_id = auth.uid())
  with check (coach_id = auth.uid());

drop policy if exists coach_tasks_admin_read on public.coach_tasks;
create policy coach_tasks_admin_read on public.coach_tasks
  for select to authenticated using (public.has_role(auth.uid(), 'super_admin'));

-- ---------------------------------------------------------
-- Send one participant a notification. Staff only, and a coach may only notify
-- a participant who is in one of their own batches (mentors/super_admins: any).
-- ---------------------------------------------------------
create or replace function public.notify_participant(
  _user_id uuid, _title text, _body text, _link text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception 'Forbidden: staff only';
  end if;

  if not (
    public.has_role(auth.uid(), 'super_admin')
    or public.has_role(auth.uid(), 'mentor')
    or exists (
      select 1
      from batch_members me
      join batch_members them on them.batch_id = me.batch_id
      where me.user_id = auth.uid() and me.role in ('coach', 'mentor')
        and them.user_id = _user_id and them.role = 'participant'
    )
  ) then
    raise exception 'Not your participant';
  end if;

  insert into public.notifications (user_id, type, title, body, link, actor_id)
  values (_user_id, 'system', _title, nullif(btrim(_body), ''), _link, auth.uid());
end;
$$;

grant execute on function public.notify_participant(uuid, text, text, text) to authenticated;
