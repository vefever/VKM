-- Add weeks_approved to the leaderboard rows (return type change → drop+recreate).
drop function if exists public.get_leaderboard();

create or replace function public.get_leaderboard()
returns table (
  user_id uuid,
  full_name text,
  avatar_url text,
  business_name text,
  points bigint,
  weeks_approved bigint,
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
      ) as points,
      (select count(*) from weekly_progress wp
         where wp.user_id = p.id and wp.proof_status = 'approved') as weeks_approved
    from profiles p
    join user_roles ur on ur.user_id = p.id and ur.role = 'participant'
    left join business_brains bb on bb.user_id = p.id
  )
  select
    user_id, full_name, avatar_url, business_name, points, weeks_approved,
    rank() over (order by points desc) as rank
  from pts
  order by points desc, full_name
  limit 100;
$$;

grant execute on function public.get_leaderboard() to authenticated;
