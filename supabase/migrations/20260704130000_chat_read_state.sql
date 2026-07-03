-- =========================================================
-- CHAT READ STATE (2026-07-04)
--
-- Backs "seen" ticks on messages/dm_messages. One row per (thread, user),
-- shared by BOTH conversation kinds (coach support thread + peer DMs) so read
-- tracking lives in one place instead of duplicating columns across
-- `conversations` and `dm_threads`. Typing indicators and online presence need
-- no table at all — they ride Supabase Realtime's broadcast/presence features
-- on the same channel each thread hook already opens.
-- =========================================================

create table if not exists public.chat_read_state (
  thread_kind text not null check (thread_kind in ('coach', 'dm')),
  thread_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (thread_kind, thread_id, user_id)
);

-- True when the CALLER (auth.uid()) is a legitimate participant of the given
-- thread — used both to gate writes to their own row and to let a thread's
-- other participant read this row (so the sender can see "seen").
create or replace function public.is_chat_thread_participant(_kind text, _thread_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when _kind = 'coach' then exists(
      select 1 from public.conversations c
      where c.id = _thread_id and (c.participant_id = auth.uid() or public.is_staff())
    )
    when _kind = 'dm' then exists(
      select 1 from public.dm_threads t
      where t.id = _thread_id and auth.uid() in (t.user_lo, t.user_hi)
    )
    else false
  end;
$$;
revoke all on function public.is_chat_thread_participant(text, uuid) from anon, public;
grant execute on function public.is_chat_thread_participant(text, uuid) to authenticated;

grant select, insert, update on public.chat_read_state to authenticated;
grant all on public.chat_read_state to service_role;
alter table public.chat_read_state enable row level security;

-- Any participant of the thread can see every read marker for it (needed so
-- the sender's UI can tell whether the other side has caught up).
drop policy if exists chat_read_state_select on public.chat_read_state;
create policy chat_read_state_select on public.chat_read_state
  for select to authenticated
  using (public.is_chat_thread_participant(thread_kind, thread_id));

-- You may only write your OWN marker, and only for a thread you're really in.
drop policy if exists chat_read_state_insert on public.chat_read_state;
create policy chat_read_state_insert on public.chat_read_state
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_chat_thread_participant(thread_kind, thread_id));

drop policy if exists chat_read_state_update on public.chat_read_state;
create policy chat_read_state_update on public.chat_read_state
  for update to authenticated
  using (user_id = auth.uid() and public.is_chat_thread_participant(thread_kind, thread_id))
  with check (user_id = auth.uid() and public.is_chat_thread_participant(thread_kind, thread_id));

create index if not exists chat_read_state_thread_idx on public.chat_read_state (thread_kind, thread_id);

-- Live "seen" ticks without a manual refetch.
do $$
begin
  alter publication supabase_realtime add table public.chat_read_state;
exception when duplicate_object then null;
end $$;
