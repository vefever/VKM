-- =========================================================
-- Co-Admins (2026-07-06)
--
-- A co-admin has the EXACT same powers as a super admin — they hold the real
-- `super_admin` role, so every existing RLS check and SECURITY DEFINER guard
-- (has_role(..,'super_admin')) already applies with zero changes. The only
-- difference is a cosmetic tag: profiles.is_co_admin = true, so the app can
-- label them "Co-Admin" instead of "Super Admin".
--
-- The original super admin(s) keep is_co_admin = false and are protected: the
-- demote path only ever strips a CO-admin, never an original super admin.
-- =========================================================

alter table public.profiles     add column if not exists is_co_admin boolean not null default false;
alter table public.user_invites add column if not exists is_co_admin boolean not null default false;

-- Promote an existing user to co-admin (grant super_admin + tag) or revoke it.
-- Super-admin only. You cannot change your OWN status (avoids self-lockout), and
-- demotion is refused unless the target is actually a co-admin (so an original
-- super admin can never be stripped through this path).
create or replace function public.admin_set_co_admin(_user_id uuid, _value boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_role(auth.uid(), 'super_admin') then
    raise exception 'Forbidden: super admin only';
  end if;
  if _user_id = auth.uid() then
    raise exception 'You cannot change your own admin status';
  end if;

  if _value then
    insert into public.user_roles (user_id, role)
    values (_user_id, 'super_admin')
    on conflict (user_id, role) do nothing;
    update public.profiles set is_co_admin = true, updated_at = now() where id = _user_id;
  else
    if not exists (select 1 from public.profiles where id = _user_id and is_co_admin) then
      raise exception 'That account is not a co-admin';
    end if;
    delete from public.user_roles where user_id = _user_id and role = 'super_admin';
    update public.profiles set is_co_admin = false, updated_at = now() where id = _user_id;
  end if;
end;
$$;
revoke execute on function public.admin_set_co_admin(uuid, boolean) from anon, public;
grant execute on function public.admin_set_co_admin(uuid, boolean) to authenticated;


-- Recreate admin_user_detail so the user dialog can read is_co_admin (only the
-- profile sub-select changed — is_co_admin added).
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
        select full_name, avatar_url, phone, must_reset_password, is_co_admin
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
