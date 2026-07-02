-- =========================================================
-- PWA SETTINGS (2026-07-01)
--
-- Admin-editable installable-app identity: name, icon, colors (splash), iOS
-- title. A single row; publicly readable (the client applies it, even pre-login,
-- to the manifest / meta tags) and writable only by super admins. Seeded with
-- the CURRENT static values so behaviour is unchanged until an admin edits.
-- =========================================================

create table if not exists public.pwa_settings (
  id boolean primary key default true check (id),   -- enforces a single row
  app_name text not null default 'VK Mentorship',
  short_name text not null default 'VKM',
  description text not null default 'The operating system for Venu Kalyan Mentorship — your premium coaching, learning, and business transformation platform.',
  theme_color text not null default '#0B2545',
  background_color text not null default '#0B2545',
  apple_title text not null default 'VKM',
  icon_url text not null default '/icon-512.png',
  updated_at timestamptz not null default now()
);

insert into public.pwa_settings (id) values (true) on conflict (id) do nothing;

grant select on public.pwa_settings to anon, authenticated;
grant update on public.pwa_settings to authenticated;
grant all on public.pwa_settings to service_role;
alter table public.pwa_settings enable row level security;

-- Everyone (incl. logged-out visitors) can read the app identity.
drop policy if exists pwa_select on public.pwa_settings;
create policy pwa_select on public.pwa_settings for select to anon, authenticated using (true);

-- Only super admins can change it.
drop policy if exists pwa_update on public.pwa_settings;
create policy pwa_update on public.pwa_settings for update to authenticated
  using (public.has_role(auth.uid(), 'super_admin'))
  with check (public.has_role(auth.uid(), 'super_admin'));
