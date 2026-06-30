-- =========================================================
-- Real leaderboard + coach cohort overview.
--
-- Both are SECURITY DEFINER aggregates that expose only curated fields (name,
-- avatar, business name, points) — never raw points_ledger rows. The cohort
-- overview is scoped server-side to the CALLING coach's own batches, so a coach
-- only ever sees their assigned participants (super_admin sees all). A plain
-- participant calling it gets an empty set.
-- =========================================================

-- ---- Leaderboard: ranked participants by total points --------------------
create or replace function public.get_leaderboard()
returns table (
  user_id uuid,
  full_name text,
  avatar_url text,
  business_name text,
  points bigint,
  rank bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with pts as (
    select
      p.id as user_id,
      p.full_name,
      p.avatar_url,
      bb.business_name,
      coalesce(
        (select sum(pl.points) from points_ledger pl where pl.user_id = p.id), 0
      ) as points
    from profiles p
    join user_roles ur on ur.user_id = p.id and ur.role = 'participant'
    left join business_brains bb on bb.user_id = p.id
  )
  select
    user_id, full_name, avatar_url, business_name, points,
    rank() over (order by points desc) as rank
  from pts
  order by points desc, full_name
  limit 100;
$$;

grant execute on function public.get_leaderboard() to authenticated;

-- ---- Coach cohort overview: one aggregated row per assigned participant ----
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
  habit_active_3d boolean
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
    ) as habit_active_3d
  from parts
  join profiles pr on pr.id = parts.user_id
  left join business_brains bb on bb.user_id = pr.id
  left join program_enrollments pe on pe.user_id = pr.id
  order by pr.full_name;
$$;

grant execute on function public.coach_cohort_overview() to authenticated;
