-- Usage log for participant-facing AI image generation (Vision Board).
--
-- Exists to enforce a per-user daily cap: image models are the most expensive
-- call in the platform and this is the first participant-triggered one, so
-- without a counter a single owner could run up a real bill on the shared org
-- key. Doubles as a record of what was generated.
create table if not exists public.ai_image_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  prompt text not null,
  model text,
  created_at timestamptz not null default now()
);

-- The cap counts a user's rows over a rolling 24h window; this index is what
-- keeps that count cheap.
create index if not exists ai_image_generations_user_created_idx
  on public.ai_image_generations (user_id, created_at desc);

grant select, insert on public.ai_image_generations to authenticated;
grant all on public.ai_image_generations to service_role;

alter table public.ai_image_generations enable row level security;

-- Own rows only: a participant may read their own usage (so the UI can show
-- what's left) and add to it. No update or delete — the counter must not be
-- clearable by the account it limits.
drop policy if exists ai_image_generations_own_read on public.ai_image_generations;
create policy ai_image_generations_own_read on public.ai_image_generations
  for select to authenticated using (user_id = auth.uid());

drop policy if exists ai_image_generations_own_insert on public.ai_image_generations;
create policy ai_image_generations_own_insert on public.ai_image_generations
  for insert to authenticated with check (user_id = auth.uid());
