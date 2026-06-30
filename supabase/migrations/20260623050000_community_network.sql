-- VKM Member Network: a member-controlled public profile + peer 1:1 DMs.
-- Privacy by design — a member chooses what's public; business_brains stays private.

-- ---------------------------------------------------------
-- 1. Member profile (public-facing, member-controlled).
-- ---------------------------------------------------------
create table if not exists public.member_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  headline text,
  bio text,
  business_name text,
  industry text,
  location text,
  skills text[] not null default '{}',
  batch_label text,
  status text not null default 'active' check (status in ('active', 'alumni')),
  is_public boolean not null default true,
  allow_messages boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.member_profiles enable row level security;

-- Read public profiles (directory); always read your own.
drop policy if exists member_profiles_read on public.member_profiles;
create policy member_profiles_read on public.member_profiles
  for select to authenticated
  using (is_public = true or user_id = auth.uid());

-- Write only your own.
drop policy if exists member_profiles_write on public.member_profiles;
create policy member_profiles_write on public.member_profiles
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------
-- 2. Peer 1:1 DM threads (canonical pair: user_lo < user_hi).
-- ---------------------------------------------------------
create table if not exists public.dm_threads (
  id uuid primary key default gen_random_uuid(),
  user_lo uuid not null references auth.users (id) on delete cascade,
  user_hi uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  constraint dm_threads_pair_unique unique (user_lo, user_hi),
  constraint dm_threads_order check (user_lo < user_hi)
);

alter table public.dm_threads enable row level security;

drop policy if exists dm_threads_rw on public.dm_threads;
create policy dm_threads_rw on public.dm_threads
  for all to authenticated
  using (auth.uid() in (user_lo, user_hi))
  with check (auth.uid() in (user_lo, user_hi));

-- ---------------------------------------------------------
-- 3. DM messages.
-- ---------------------------------------------------------
create table if not exists public.dm_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.dm_threads (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade,
  body text,
  attachments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists dm_messages_thread_idx on public.dm_messages (thread_id, created_at);

alter table public.dm_messages enable row level security;

drop policy if exists dm_messages_read on public.dm_messages;
create policy dm_messages_read on public.dm_messages
  for select to authenticated
  using (
    exists (
      select 1 from public.dm_threads t
      where t.id = thread_id and auth.uid() in (t.user_lo, t.user_hi)
    )
  );

drop policy if exists dm_messages_insert on public.dm_messages;
create policy dm_messages_insert on public.dm_messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.dm_threads t
      where t.id = thread_id and auth.uid() in (t.user_lo, t.user_hi)
    )
  );

-- Keep the thread's last_message_at fresh for inbox ordering.
create or replace function public.dm_bump_thread()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.dm_threads set last_message_at = now() where id = new.thread_id;
  return new;
end;
$$;

drop trigger if exists dm_messages_bump on public.dm_messages;
create trigger dm_messages_bump
  after insert on public.dm_messages
  for each row execute function public.dm_bump_thread();
