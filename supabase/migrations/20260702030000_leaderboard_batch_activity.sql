-- =========================================================
-- Leaderboard v3 (2026-07-02)
--  • Exclude staff — a user who is ALSO a coach/mentor/admin must not appear.
--  • Add each participant's batch (id + name) so the UI can show "my batch" vs
--    "all batches". Ranking is computed client-side per selected scope.
--  • Real cohort activity feed from points_ledger (was hardcoded/illustrative).
-- =========================================================

drop function if exists public.get_leaderboard();
create or replace function public.get_leaderboard()
returns table (
  user_id uuid,
  full_name text,
  avatar_url text,
  business_name text,
  batch_id uuid,
  batch_name text,
  points bigint,
  weeks_approved bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id as user_id,
    p.full_name,
    p.avatar_url,
    bb.business_name,
    bmx.batch_id,
    b.name as batch_name,
    coalesce((select sum(pl.points) from points_ledger pl where pl.user_id = p.id), 0) as points,
    (select count(*) from weekly_progress wp
       where wp.user_id = p.id and wp.proof_status = 'approved') as weeks_approved
  from profiles p
  join user_roles ur on ur.user_id = p.id and ur.role = 'participant'
  left join business_brains bb on bb.user_id = p.id
  left join lateral (
    select bm.batch_id
    from batch_members bm
    where bm.user_id = p.id and bm.role = 'participant'
    order by bm.batch_id
    limit 1
  ) bmx on true
  left join batches b on b.id = bmx.batch_id
  -- Drop anyone who is also staff (coaches/mentors/admins never rank).
  where not exists (
    select 1 from user_roles s
    where s.user_id = p.id and s.role in ('coach', 'mentor', 'super_admin')
  )
  order by points desc, p.full_name
  limit 500;
$$;
grant execute on function public.get_leaderboard() to authenticated;

-- Recent cohort point awards (participants only, no staff). Powers the live
-- activity feed. SECURITY DEFINER so participants can see peers' activity
-- (points_ledger RLS otherwise limits them to their own rows).
drop function if exists public.get_leaderboard_activity(int);
create or replace function public.get_leaderboard_activity(_limit int default 40)
returns table (
  id uuid,
  user_id uuid,
  full_name text,
  avatar_url text,
  source text,
  reference text,
  points int,
  batch_id uuid,
  awarded_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    pl.id, pl.user_id, p.full_name, p.avatar_url, pl.source, pl.reference, pl.points,
    bmx.batch_id, pl.awarded_at
  from points_ledger pl
  join profiles p on p.id = pl.user_id
  join user_roles ur on ur.user_id = pl.user_id and ur.role = 'participant'
  left join lateral (
    select bm.batch_id from batch_members bm
    where bm.user_id = pl.user_id and bm.role = 'participant'
    order by bm.batch_id limit 1
  ) bmx on true
  where not exists (
    select 1 from user_roles s
    where s.user_id = pl.user_id and s.role in ('coach', 'mentor', 'super_admin')
  )
  order by pl.awarded_at desc
  limit greatest(1, least(_limit, 100));
$$;
grant execute on function public.get_leaderboard_activity(int) to authenticated;
