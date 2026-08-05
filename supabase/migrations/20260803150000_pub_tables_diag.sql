-- Diagnostic: list tables in the supabase_realtime publication (staff/service).
create or replace function public._pub_tables()
returns setof text
language sql
security definer
set search_path = public
as $$ select tablename::text from pg_publication_tables where pubname = 'supabase_realtime' order by 1 $$;
revoke all on function public._pub_tables() from anon, authenticated;
