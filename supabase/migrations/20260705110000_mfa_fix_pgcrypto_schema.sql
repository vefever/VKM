-- =========================================================
-- FIX: pgcrypto functions live in the `extensions` schema on Supabase
-- (not `public`), so `set search_path = public` in the previous migration's
-- SECURITY DEFINER functions couldn't resolve crypt()/gen_salt(). Schema-
-- qualify both calls explicitly instead of widening the search_path.
-- =========================================================

create or replace function public.admin_generate_mfa_email_code(_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  v_code := lpad(floor(random() * 1000000)::text, 6, '0');
  insert into public.mfa_email_challenges (user_id, code_hash, expires_at, attempts, created_at)
  values (_user_id, extensions.crypt(v_code, extensions.gen_salt('bf')), now() + interval '10 minutes', 0, now())
  on conflict (user_id) do update
    set code_hash = excluded.code_hash,
        expires_at = excluded.expires_at,
        attempts = 0,
        created_at = now();
  return v_code;
end;
$$;
revoke all on function public.admin_generate_mfa_email_code(uuid) from anon, authenticated, public;

create or replace function public.verify_mfa_email_otp(_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.mfa_email_challenges%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized';
  end if;

  select * into v_row from public.mfa_email_challenges where user_id = auth.uid();
  if not found then
    return false;
  end if;

  if v_row.expires_at < now() or v_row.attempts >= 5 then
    delete from public.mfa_email_challenges where user_id = auth.uid();
    return false;
  end if;

  if v_row.code_hash = extensions.crypt(_code, v_row.code_hash) then
    delete from public.mfa_email_challenges where user_id = auth.uid();
    return true;
  end if;

  update public.mfa_email_challenges set attempts = attempts + 1 where user_id = auth.uid();
  return false;
end;
$$;
revoke all on function public.verify_mfa_email_otp(text) from anon, public;
grant execute on function public.verify_mfa_email_otp(text) to authenticated;
