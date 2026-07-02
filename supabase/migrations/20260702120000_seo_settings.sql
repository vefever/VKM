-- =========================================================
-- SEO & ANALYTICS SETTINGS (2026-07-02)
--
-- Admin-editable SEO metadata + Google Analytics (GA4). A single row, publicly
-- readable (the client applies meta tags / loads GA even pre-login) and writable
-- only by super admins. Seeded with the CURRENT static <head> values so an
-- untouched config leaves behaviour unchanged. GA is OFF until a measurement id
-- is set and analytics is enabled.
-- =========================================================

create table if not exists public.seo_settings (
  id boolean primary key default true check (id),   -- enforces a single row
  site_title text not null default 'VK Mentorship — The operating system for Venu Kalyan Mentorship',
  meta_description text not null default 'VK Mentorship is the premium coaching, learning, and business transformation platform for the Venu Kalyan Mentorship community.',
  keywords text not null default 'VK Mentorship, Venu Kalyan, business coaching, mentorship, entrepreneur',
  canonical_url text not null default 'https://vkmentorship.com',
  robots_index boolean not null default true,       -- allow search engines to index
  og_title text not null default 'VK Mentorship',
  og_description text not null default 'Premium coaching, learning, and business transformation OS.',
  og_image_url text not null default '/icon-512.png',
  twitter_handle text not null default '',
  ga_enabled boolean not null default false,        -- master switch for Google Analytics
  ga_measurement_id text not null default '',       -- GA4 id, e.g. G-XXXXXXXXXX
  updated_at timestamptz not null default now()
);

insert into public.seo_settings (id) values (true) on conflict (id) do nothing;

grant select on public.seo_settings to anon, authenticated;
grant update on public.seo_settings to authenticated;
grant all on public.seo_settings to service_role;
alter table public.seo_settings enable row level security;

-- Everyone (incl. logged-out visitors / crawlers) can read the SEO config.
drop policy if exists seo_select on public.seo_settings;
create policy seo_select on public.seo_settings for select to anon, authenticated using (true);

-- Only super admins can change it.
drop policy if exists seo_update on public.seo_settings;
create policy seo_update on public.seo_settings for update to authenticated
  using (public.has_role(auth.uid(), 'super_admin'))
  with check (public.has_role(auth.uid(), 'super_admin'));
