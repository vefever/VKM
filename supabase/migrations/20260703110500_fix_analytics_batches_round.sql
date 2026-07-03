-- Fix: round(double precision, integer) doesn't exist in Postgres (only
-- round(numeric, integer)) — avg(my_week) over an integer/floor expression
-- comes back as double precision. Cast to numeric before rounding.
create or replace function public.admin_analytics_batches()
returns table (
  batch_id uuid,
  name text,
  status text,
  participant_count bigint,
  avg_week numeric,
  avg_completion_pct int,
  at_risk_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.has_role(auth.uid(), 'super_admin') then
    raise exception 'Forbidden: super admin only';
  end if;

  return query
  with members as (
    select bm.batch_id, bm.user_id
    from batch_members bm
    where bm.role = 'participant'
  ),
  today_done as (
    select hl.user_id, count(distinct hl.habit_id) as done
    from habit_logs hl
    where hl.log_date = current_date
    group by hl.user_id
  ),
  risk as (
    select
      pe.user_id,
      least(coalesce(pe.total_weeks, 16), greatest(1, floor((current_date - pe.started_at::date) / 7) + 1)) as my_week,
      (select count(*) from weekly_progress wp where wp.user_id = pe.user_id and wp.proof_status = 'approved') as weeks_done
    from program_enrollments pe
    where pe.status = 'active' and pe.started_at is not null
  )
  select
    b.id as batch_id,
    b.name,
    b.status,
    count(distinct me.user_id) as participant_count,
    round(avg(r.my_week)::numeric, 1) as avg_week,
    coalesce(round(avg(least(coalesce(td.done, 0), 6)) / 6.0 * 100)::int, 0) as avg_completion_pct,
    count(distinct r.user_id) filter (where r.my_week >= 3 and r.weeks_done < r.my_week - 2) as at_risk_count
  from batches b
  left join members me on me.batch_id = b.id
  left join today_done td on td.user_id = me.user_id
  left join risk r on r.user_id = me.user_id
  group by b.id, b.name, b.status
  order by (b.status = 'active') desc, participant_count desc, b.name;
end;
$$;

revoke all on function public.admin_analytics_batches() from anon, public;
grant execute on function public.admin_analytics_batches() to authenticated;
