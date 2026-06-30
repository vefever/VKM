-- =========================================================
-- USER-WISE COACH ASSIGNMENT (2026-06-29)
--
-- Introduces a direct participant→coach assignment. A coach now sees ONLY the
-- participants assigned to them (data, proof queue, cohort, chat, notes — every
-- RLS-scoped read), while mentor/super_admin keep org-wide oversight.
--
-- The whole model funnels through one helper, coaches_participant(), which every
-- participant-data RLS policy already calls — so redefining it here re-scopes the
-- entire coach surface at once. The two places that enumerate participants by
-- role/batch (cohort overview, participants overview) get explicit scoping.
-- =========================================================

-- ---------------------------------------------------------
-- 1. Assignment table — one active coach per participant (reassignable).
-- ---------------------------------------------------------
create table if not exists public.coach_assignments (
  participant_id uuid primary key references auth.users(id) on delete cascade,
  coach_id uuid not null references auth.users(id) on delete cascade,
  assigned_by uuid references auth.users(id),
  assigned_at timestamptz not null default now()
);
create index if not exists coach_assignments_coach_idx on public.coach_assignments(coach_id);

grant select, insert, update, delete on public.coach_assignments to authenticated;
grant all on public.coach_assignments to service_role;
alter table public.coach_assignments enable row level security;

-- Read: the participant, their assigned coach, or any staff member.
drop policy if exists ca_select on public.coach_assignments;
create policy ca_select on public.coach_assignments
  for select to authenticated using (
    participant_id = auth.uid()
    or coach_id = auth.uid()
    or public.is_staff()
  );

-- Write (assign / reassign / unassign): mentors and super admins only.
drop policy if exists ca_write on public.coach_assignments;
create policy ca_write on public.coach_assignments
  for all to authenticated using (
    public.has_role(auth.uid(), 'mentor') or public.has_role(auth.uid(), 'super_admin')
  ) with check (
    public.has_role(auth.uid(), 'mentor') or public.has_role(auth.uid(), 'super_admin')
  );

-- ---------------------------------------------------------
-- 2. Re-scope the central helper: coach = assigned-only; mentor/admin = all.
--    Every participant-data SELECT policy calls this, so this is the switch.
-- ---------------------------------------------------------
create or replace function public.coaches_participant(_participant uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.has_role(auth.uid(), 'super_admin')
    or public.has_role(auth.uid(), 'mentor')
    or exists (
      select 1 from public.coach_assignments ca
      where ca.coach_id = auth.uid() and ca.participant_id = _participant
    );
$$;

revoke execute on function public.coaches_participant(uuid) from anon, public;
grant execute on function public.coaches_participant(uuid) to authenticated;

-- ---------------------------------------------------------
-- 3. notify_participant: gate on the same assignment rule.
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
  if not public.coaches_participant(_user_id) then
    raise exception 'Not your participant';
  end if;
  insert into public.notifications (user_id, type, title, body, link, actor_id)
  values (_user_id, 'system', _title, nullif(btrim(_body), ''), _link, auth.uid());
end;
$$;
grant execute on function public.notify_participant(uuid, text, text, text) to authenticated;

-- ---------------------------------------------------------
-- 4. The set of participants the caller coaches (used by list views that
--    enumerate by role rather than reading an RLS-scoped table).
-- ---------------------------------------------------------
create or replace function public.my_participants()
returns table (user_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select ur.user_id
  from public.user_roles ur
  where ur.role = 'participant'
    and (
      public.has_role(auth.uid(), 'super_admin')
      or public.has_role(auth.uid(), 'mentor')
      or exists (
        select 1 from public.coach_assignments ca
        where ca.coach_id = auth.uid() and ca.participant_id = ur.user_id
      )
    );
$$;
grant execute on function public.my_participants() to authenticated;

-- ---------------------------------------------------------
-- 5. Cohort overview: scope a coach to assigned participants (mentor/admin all).
-- ---------------------------------------------------------
drop function if exists public.coach_cohort_overview();
create or replace function public.coach_cohort_overview()
returns table (
  user_id uuid,
  full_name text,
  avatar_url text,
  business_name text,
  batch_id uuid,
  batch_name text,
  mrr_inr integer,
  points bigint,
  weeks_approved bigint,
  pending_proofs bigint,
  last_proof_at timestamptz,
  started_at timestamptz,
  total_weeks int,
  habit_active_3d boolean,
  focus_minutes_today bigint,
  actions_done bigint,
  actions_total bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with parts as (
    -- One row per participant the caller coaches, carrying their first batch.
    select distinct on (ur.user_id) ur.user_id, bm.batch_id
    from user_roles ur
    left join batch_members bm on bm.user_id = ur.user_id and bm.role = 'participant'
    where ur.role = 'participant'
      and (
        public.has_role(auth.uid(), 'super_admin')
        or public.has_role(auth.uid(), 'mentor')
        or exists (
          select 1 from coach_assignments ca
          where ca.coach_id = auth.uid() and ca.participant_id = ur.user_id
        )
      )
    order by ur.user_id, bm.batch_id
  )
  select
    pr.id as user_id,
    pr.full_name,
    pr.avatar_url,
    bb.business_name,
    parts.batch_id,
    b.name as batch_name,
    bb.current_mrr_inr as mrr_inr,
    coalesce((select sum(pl.points) from points_ledger pl where pl.user_id = pr.id), 0) as points,
    (select count(*) from weekly_progress wp
       where wp.user_id = pr.id and wp.proof_status = 'approved') as weeks_approved,
    (select count(*) from weekly_progress wp
       where wp.user_id = pr.id and wp.proof_status = 'pending') as pending_proofs,
    (select max(wp.updated_at) from weekly_progress wp
       where wp.user_id = pr.id and (wp.proof_url is not null or wp.proof_status <> 'none')) as last_proof_at,
    pe.started_at,
    coalesce(pe.total_weeks, 16) as total_weeks,
    exists(
      select 1 from habit_logs hl
      where hl.user_id = pr.id and hl.log_date >= (current_date - 3)
    ) as habit_active_3d,
    coalesce((select sum(fs.minutes) from focus_sessions fs
       where fs.user_id = pr.id and fs.created_at >= current_date), 0) as focus_minutes_today,
    (select count(*) from daily_actions da
       where da.user_id = pr.id and da.action_date = current_date and da.done) as actions_done,
    (select count(*) from daily_actions da
       where da.user_id = pr.id and da.action_date = current_date) as actions_total
  from parts
  join profiles pr on pr.id = parts.user_id
  left join batches b on b.id = parts.batch_id
  left join business_brains bb on bb.user_id = pr.id
  left join program_enrollments pe on pe.user_id = pr.id
  order by pr.full_name;
$$;
grant execute on function public.coach_cohort_overview() to authenticated;

-- ---------------------------------------------------------
-- 6. Admin: list coaches for the assignment picker (super admin only).
-- ---------------------------------------------------------
create or replace function public.admin_list_coaches()
returns table (id uuid, full_name text, email text, participant_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.full_name,
    u.email,
    (select count(*) from coach_assignments ca where ca.coach_id = p.id) as participant_count
  from user_roles ur
  join profiles p on p.id = ur.user_id
  join auth.users u on u.id = ur.user_id
  where ur.role = 'coach'
    and public.has_role(auth.uid(), 'super_admin')
  order by p.full_name;
$$;
revoke execute on function public.admin_list_coaches() from anon, public;
grant execute on function public.admin_list_coaches() to authenticated;

-- ---------------------------------------------------------
-- 7. Re-create admin_user_detail to include the assigned coach.
-- ---------------------------------------------------------
create or replace function public.admin_user_detail(_email text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_result jsonb;
begin
  if not public.has_role(auth.uid(), 'super_admin') then
    raise exception 'Forbidden: super admin only';
  end if;

  select id into v_uid
  from auth.users
  where lower(email) = lower(trim(_email))
  limit 1;

  if v_uid is null then
    raise exception 'No account found for %', _email;
  end if;

  select jsonb_build_object(
    'user_id', v_uid,
    'email', (select email from auth.users where id = v_uid),
    'profile', (
      select to_jsonb(p) from (
        select full_name, avatar_url, phone, must_reset_password
        from public.profiles where id = v_uid
      ) p
    ),
    'auth', (
      select jsonb_build_object(
        'last_sign_in_at', u.last_sign_in_at,
        'created_at', u.created_at,
        'email_confirmed_at', u.email_confirmed_at,
        'phone', u.phone,
        'is_banned', (u.banned_until is not null and u.banned_until > now())
      )
      from auth.users u where u.id = v_uid
    ),
    'roles', (
      select coalesce(jsonb_agg(role::text order by role::text), '[]'::jsonb)
      from public.user_roles where user_id = v_uid
    ),
    'batches', (
      select coalesce(jsonb_agg(
        jsonb_build_object('batch_id', b.id, 'name', b.name, 'role', bm.role::text)
        order by b.name
      ), '[]'::jsonb)
      from public.batch_members bm
      join public.batches b on b.id = bm.batch_id
      where bm.user_id = v_uid
    ),
    'assigned_coach', (
      select case when ca.coach_id is null then null
        else jsonb_build_object('coach_id', ca.coach_id, 'name', cp.full_name, 'email', cu.email)
      end
      from public.coach_assignments ca
      left join public.profiles cp on cp.id = ca.coach_id
      left join auth.users cu on cu.id = ca.coach_id
      where ca.participant_id = v_uid
    ),
    'performance', jsonb_build_object(
      'points', coalesce((select sum(points) from public.points_ledger where user_id = v_uid), 0),
      'weeks_approved', (select count(*) from public.weekly_progress where user_id = v_uid and proof_status = 'approved'),
      'weeks_pending', (select count(*) from public.weekly_progress where user_id = v_uid and proof_status = 'pending'),
      'milestones', (select count(*) from public.milestone_awards where user_id = v_uid),
      'habit_days_30', (select count(distinct log_date) from public.habit_logs where user_id = v_uid and log_date >= current_date - 30),
      'focus_minutes_total', coalesce((select sum(minutes) from public.focus_sessions where user_id = v_uid), 0),
      'focus_minutes_7d', coalesce((select sum(minutes) from public.focus_sessions where user_id = v_uid and created_at >= current_date - 7), 0),
      'actions_done_today', (select count(*) from public.daily_actions where user_id = v_uid and action_date = current_date and done),
      'mrr_inr', (select current_mrr_inr from public.business_brains where user_id = v_uid),
      'monthly_leads', (select monthly_leads from public.business_brains where user_id = v_uid),
      'business_name', (select business_name from public.business_brains where user_id = v_uid)
    ),
    'last_active_at', (
      select greatest(
        coalesce((select last_sign_in_at from auth.users where id = v_uid), 'epoch'::timestamptz),
        coalesce((select max(awarded_at) from public.points_ledger where user_id = v_uid), 'epoch'::timestamptz),
        coalesce((select max(created_at) from public.focus_sessions where user_id = v_uid), 'epoch'::timestamptz),
        coalesce((select max(updated_at) from public.weekly_progress where user_id = v_uid), 'epoch'::timestamptz),
        coalesce((select max(updated_at) from public.daily_actions where user_id = v_uid), 'epoch'::timestamptz)
      )
    ),
    'recent_activity', (
      select coalesce(jsonb_agg(to_jsonb(a) order by a.ts desc), '[]'::jsonb)
      from (
        select kind, label, ts from (
          select 'points'::text as kind, ('+' || points || ' pts · ' || source) as label, awarded_at as ts
          from public.points_ledger where user_id = v_uid
          union all
          select 'proof', ('Week ' || week_no || ' proof ' || proof_status), updated_at
          from public.weekly_progress where user_id = v_uid and proof_status <> 'pending'
          union all
          select 'focus', (minutes || ' min focus session'), created_at
          from public.focus_sessions where user_id = v_uid
          union all
          select 'milestone', ('Milestone: ' || milestone_code), awarded_at
          from public.milestone_awards where user_id = v_uid
        ) u
        order by ts desc
        limit 15
      ) a
    )
  ) into v_result;

  return v_result;
end;
$$;
revoke execute on function public.admin_user_detail(text) from anon, public;
grant execute on function public.admin_user_detail(text) to authenticated;
