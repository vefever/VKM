-- 5-Year Vision: an owner's north-star statement + dated goals across 5 years,
-- plus an optional mood-board of images. Each owner sees only their own; staff
-- (coach/mentor/admin) can read to coach toward the vision.

create table if not exists public.vision_statements (
  user_id uuid primary key references auth.users (id) on delete cascade,
  statement text,
  target_revenue_inr bigint,
  target_team_size int,
  lifestyle_goal text,
  images jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.vision_statements enable row level security;

drop policy if exists vision_stmt_rw on public.vision_statements;
create policy vision_stmt_rw on public.vision_statements
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists vision_stmt_staff_read on public.vision_statements;
create policy vision_stmt_staff_read on public.vision_statements
  for select to authenticated using (public.is_staff());

create table if not exists public.vision_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  year int not null check (year between 1 and 5),
  title text not null,
  category text not null default 'Revenue & Profit'
    check (category in (
      'Revenue & Profit',
      'Team & Culture',
      'Product & Operations',
      'Brand & Market',
      'Personal & Lifestyle'
    )),
  target_value numeric,
  current_value numeric,
  unit text,
  target_date date,
  status text not null default 'not_started'
    check (status in ('not_started', 'on_track', 'at_risk', 'achieved')),
  why text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vision_goals_user_idx
  on public.vision_goals (user_id, year, sort_order);

alter table public.vision_goals enable row level security;

drop policy if exists vision_goals_rw on public.vision_goals;
create policy vision_goals_rw on public.vision_goals
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists vision_goals_staff_read on public.vision_goals;
create policy vision_goals_staff_read on public.vision_goals
  for select to authenticated using (public.is_staff());

-- Mood-board images.
insert into storage.buckets (id, name, public)
values ('vision-board', 'vision-board', true)
on conflict (id) do nothing;

drop policy if exists vision_img_read on storage.objects;
create policy vision_img_read on storage.objects
  for select to public using (bucket_id = 'vision-board');

drop policy if exists vision_img_write on storage.objects;
create policy vision_img_write on storage.objects
  for insert to authenticated with check (bucket_id = 'vision-board');

drop policy if exists vision_img_delete on storage.objects;
create policy vision_img_delete on storage.objects
  for delete to authenticated using (bucket_id = 'vision-board');
