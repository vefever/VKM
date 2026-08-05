-- =========================================================
-- REALTIME FIX — publish the tables the app subscribes to (2026-08-03)
--
-- The client opens postgres_changes subscriptions on many tables, but several
-- were never added to the `supabase_realtime` publication — so those channels
-- silently received NO events and the UI only updated on a manual reload
-- ("not showing realtime data"). This idempotently ensures every subscribed
-- table is published, and sets REPLICA IDENTITY FULL on the ones the client
-- filters by a non-primary-key column (user_id / status) so UPDATE and DELETE
-- events actually carry those columns.
-- =========================================================

do $$
declare
  t text;
  tables text[] := array[
    -- previously missing from the publication:
    'weekly_progress', 'habit_exemptions', 'business_snapshots',
    'dm_threads', 'dm_messages', 'meetings',
    'member_session_videos', 'member_certificates',
    -- re-assert the rest (idempotent — no-op if already published):
    'habit_logs', 'notifications', 'points_ledger', 'water_events',
    'daily_water', 'daily_steps', 'workout_logs', 'messages', 'conversations',
    'chat_read_state', 'support_tickets', 'support_ticket_messages',
    'program_week_resources', 'meeting_attendees', 'program_settings'
  ];
begin
  foreach t in array tables loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception
      when duplicate_object then null; -- already in the publication
      when undefined_table then null;  -- table doesn't exist (defensive)
    end;
  end loop;
end $$;

-- Full row image on the tables whose subscriptions filter by user_id / status,
-- so filtered UPDATE/DELETE events include those columns in the old record.
alter table public.weekly_progress      replica identity full;
alter table public.habit_exemptions     replica identity full;
alter table public.business_snapshots   replica identity full;
alter table public.member_session_videos replica identity full;
alter table public.member_certificates  replica identity full;
alter table public.meetings             replica identity full;
alter table public.dm_threads           replica identity full;
alter table public.dm_messages          replica identity full;
