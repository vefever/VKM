-- =========================================================
-- MULTIPLE COACHES PER PARTICIPANT (2026-07-01)
--
-- A participant can now have SEVERAL coaches at once (each assigned coach sees
-- them through the existing EXISTS-based scoping helpers — coaches_participant(),
-- my_participants(), coach_cohort_overview() — which already work unchanged for
-- many-to-one). Only the primary key and the two spots that expected exactly one
-- coach per participant need updating.
-- =========================================================

-- ---------------------------------------------------------
-- 1. Composite primary key: (participant_id, coach_id) instead of participant_id.
--    Existing rows (≤1 coach each) remain valid.
-- ---------------------------------------------------------
alter table public.coach_assignments drop constraint if exists coach_assignments_pkey;
alter table public.coach_assignments
  add constraint coach_assignments_pkey primary key (participant_id, coach_id);

-- ---------------------------------------------------------
-- 2. admin_coach_map already returns one row per (participant, coach); with the
--    new key it naturally yields several rows per participant. The old inline
--    single-coach upsert RPC (admin_bulk_assign_coach) is replaced below.
-- ---------------------------------------------------------
drop function if exists public.admin_bulk_assign_coach(text[], uuid);

-- Bulk ADD one coach to many participants (by email). Idempotent.
create or replace function public.admin_bulk_add_coach(_emails text[], _coach_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer := 0;
begin
  if not public.has_role(auth.uid(), 'super_admin') then
    raise exception 'Forbidden: super admin only';
  end if;
  if _coach_id is null then
    raise exception 'A coach is required';
  end if;

  insert into public.coach_assignments (participant_id, coach_id, assigned_by, assigned_at)
  select u.id, _coach_id, auth.uid(), now()
  from auth.users u
  where lower(u.email) = any (select lower(e) from unnest(_emails) e)
  on conflict (participant_id, coach_id) do nothing;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke execute on function public.admin_bulk_add_coach(text[], uuid) from anon, public;
grant execute on function public.admin_bulk_add_coach(text[], uuid) to authenticated;

-- Bulk REMOVE one coach from many participants (by email).
create or replace function public.admin_bulk_remove_coach(_emails text[], _coach_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer := 0;
begin
  if not public.has_role(auth.uid(), 'super_admin') then
    raise exception 'Forbidden: super admin only';
  end if;

  delete from public.coach_assignments ca
  using auth.users u
  where ca.participant_id = u.id
    and ca.coach_id = _coach_id
    and lower(u.email) = any (select lower(e) from unnest(_emails) e);
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke execute on function public.admin_bulk_remove_coach(text[], uuid) from anon, public;
grant execute on function public.admin_bulk_remove_coach(text[], uuid) to authenticated;

-- ---------------------------------------------------------
-- 3. admin_user_detail: 'assigned_coach' (one) -> 'assigned_coaches' (array).
--    A scalar subquery would raise "more than one row" once a participant has
--    multiple coaches, so aggregate with jsonb_agg.
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
    'assigned_coaches', (
      select coalesce(jsonb_agg(
        jsonb_build_object('coach_id', ca.coach_id, 'name', cp.full_name, 'email', cu.email)
        order by cp.full_name
      ), '[]'::jsonb)
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
