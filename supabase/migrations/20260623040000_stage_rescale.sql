-- Rescale growth stages for the points-v2 ceiling.
-- Weekly proofs max 3,500 + daily habits (~6,700) + monthly bonuses → ~10k.
--   Starter         0 – 1,499
--   Builder     1,500 – 3,499
--   Operator    3,500 – 5,999
--   Closer      6,000 – 8,499
--   Growth Champion 8,500+
create or replace function public.current_stage(uid uuid)
returns text
language sql
stable
security invoker
set search_path = public
as $$
  select case
    when public.points_total(uid) >= 8500 then 'Growth Champion'
    when public.points_total(uid) >= 6000 then 'Closer'
    when public.points_total(uid) >= 3500 then 'Operator'
    when public.points_total(uid) >= 1500 then 'Builder'
    else 'Starter'
  end;
$$;
