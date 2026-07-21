-- Make the exemption note mandatory (staff need context to decide fairly).
-- Enforced in the guard trigger so it holds regardless of the client.

create or replace function public.guard_habit_exemption()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if TG_OP = 'INSERT' then
    -- A participant can never self-approve.
    new.status := 'pending';
    new.reviewed_by := null;
    new.reviewed_at := null;

    -- A reason note is required.
    if new.note is null or length(btrim(new.note)) < 3 then
      raise exception 'A short note is required so your coach can review the request.'
        using errcode = 'check_violation';
    end if;

    -- Monthly cap: at most 3 non-rejected in the exemption's calendar month.
    select count(*) into v_count
    from public.habit_exemptions e
    where e.user_id = new.user_id
      and e.status in ('pending', 'approved')
      and date_trunc('month', e.exempt_date) = date_trunc('month', new.exempt_date);
    if v_count >= 3 then
      raise exception 'Monthly exemption limit reached (3 per month).'
        using errcode = 'check_violation';
    end if;

  elsif TG_OP = 'UPDATE' then
    if new.status is distinct from old.status then
      new.reviewed_by := auth.uid();
      new.reviewed_at := now();
      if new.status = 'approved' and old.status <> 'approved' then
        select count(*) into v_count
        from public.habit_exemptions e
        where e.user_id = new.user_id
          and e.status = 'approved'
          and e.id <> new.id
          and date_trunc('month', e.exempt_date) = date_trunc('month', new.exempt_date);
        if v_count >= 3 then
          raise exception 'This member already has 3 approved exemptions this month.'
            using errcode = 'check_violation';
        end if;
      end if;
    end if;
  end if;
  return new;
end;
$$;
