-- Add today's Focus engagement to the cohort overview (return type change → recreate).
drop function if exists public.coach_cohort_overview();

create or replace function public.coach_cohort_overview()
returns table (
  user_id uuid,
  full_name text,
  avatar_url text,
  business_name text,
  mrr_inr integer,
  points bigint,
  weeks_approved bigint,
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
  with my_batches as (
    select batch_id
    from batch_members
    where user_id = auth.uid() and role in ('coach', 'mentor')
  ),
  parts as (
    select distinct bm.user_id
    from batch_members bm
    where bm.role = 'participant'
      and (
        bm.batch_id in (select batch_id from my_batches)
        or public.has_role(auth.uid(), 'super_admin')
      )
  )
  select
    pr.id as user_id,
    pr.full_name,
    pr.avatar_url,
    bb.business_name,
    bb.current_mrr_inr as mrr_inr,
    coalesce((select sum(pl.points) from points_ledger pl where pl.user_id = pr.id), 0) as points,
    (select count(*) from weekly_progress wp
       where wp.user_id = pr.id and wp.proof_status = 'approved') as weeks_approved,
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
  left join business_brains bb on bb.user_id = pr.id
  left join program_enrollments pe on pe.user_id = pr.id
  order by pr.full_name;
$$;

grant execute on function public.coach_cohort_overview() to authenticated;
