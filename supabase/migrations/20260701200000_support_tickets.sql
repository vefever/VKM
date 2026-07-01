-- =========================================================
-- SUPPORT TICKETS (2026-07-01)
--
-- Participants raise support tickets; mentors + admins triage and reply in a
-- threaded conversation. Notifications fire to the right party on create/reply.
-- "Support staff" = mentor OR super_admin (coaches use direct chat instead).
-- =========================================================

-- Who can handle tickets. SECURITY DEFINER so it can be used inside RLS.
create or replace function public.is_support_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(auth.uid(), 'mentor') or public.has_role(auth.uid(), 'super_admin');
$$;
revoke execute on function public.is_support_staff() from anon, public;
grant execute on function public.is_support_staff() to authenticated;

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,   -- requester
  subject text not null,
  category text not null default 'general',   -- technical | program | billing | coaching | account | general
  priority text not null default 'normal',    -- low | normal | high | urgent
  status text not null default 'open',         -- open | in_progress | resolved | closed
  assigned_to uuid references auth.users(id) on delete set null,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists support_tickets_user_idx on public.support_tickets (user_id, last_message_at desc);
create index if not exists support_tickets_status_idx on public.support_tickets (status, last_message_at desc);

create table if not exists public.support_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text,
  attachments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists support_msgs_ticket_idx on public.support_ticket_messages (ticket_id, created_at);

grant select, insert, update on public.support_tickets to authenticated;
grant select, insert on public.support_ticket_messages to authenticated;
grant all on public.support_tickets to service_role;
grant all on public.support_ticket_messages to service_role;
alter table public.support_tickets enable row level security;
alter table public.support_ticket_messages enable row level security;

-- Ownership check for message policies — SECURITY DEFINER avoids RLS recursion.
create or replace function public.owns_support_ticket(_ticket uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.support_tickets t where t.id = _ticket and t.user_id = auth.uid());
$$;
revoke execute on function public.owns_support_ticket(uuid) from anon, public;
grant execute on function public.owns_support_ticket(uuid) to authenticated;

-- Tickets: requester sees own; support staff see all.
drop policy if exists st_select on public.support_tickets;
create policy st_select on public.support_tickets for select to authenticated
  using (user_id = auth.uid() or public.is_support_staff());
drop policy if exists st_insert on public.support_tickets;
create policy st_insert on public.support_tickets for insert to authenticated
  with check (user_id = auth.uid());
-- Requester may update own (e.g. reopen/close); support staff may update any.
drop policy if exists st_update on public.support_tickets;
create policy st_update on public.support_tickets for update to authenticated
  using (user_id = auth.uid() or public.is_support_staff())
  with check (user_id = auth.uid() or public.is_support_staff());

-- Messages: visible/insertable if you own the ticket or are support staff.
drop policy if exists stm_select on public.support_ticket_messages;
create policy stm_select on public.support_ticket_messages for select to authenticated
  using (public.owns_support_ticket(ticket_id) or public.is_support_staff());
drop policy if exists stm_insert on public.support_ticket_messages;
create policy stm_insert on public.support_ticket_messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and (public.owns_support_ticket(ticket_id) or public.is_support_staff())
  );

-- Portal path for a staff recipient's notification link.
create or replace function public.support_link_for(_uid uuid)
returns text language sql stable security definer set search_path = public as $$
  select case when public.has_role(_uid, 'super_admin') then '/admin/support' else '/mentor/support' end;
$$;

-- New ticket → notify every mentor + admin.
create or replace function public.notify_support_ticket()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, type, title, body, link, actor_id)
  select ur.user_id, 'support', 'New support ticket', left(NEW.subject, 120),
         public.support_link_for(ur.user_id), NEW.user_id
  from public.user_roles ur
  where ur.role in ('mentor', 'super_admin') and ur.user_id <> NEW.user_id;
  return NEW;
end;
$$;
drop trigger if exists support_ticket_notify on public.support_tickets;
create trigger support_ticket_notify after insert on public.support_tickets
  for each row execute function public.notify_support_ticket();

-- New message → bump ticket, auto-progress/assign, notify the other side.
create or replace function public.notify_support_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  t public.support_tickets;
  staff_sender boolean;
begin
  select * into t from public.support_tickets where id = NEW.ticket_id;
  staff_sender := (NEW.sender_id <> t.user_id);

  update public.support_tickets
    set last_message_at = NEW.created_at,
        updated_at = now(),
        status = case when staff_sender and status = 'open' then 'in_progress' else status end,
        assigned_to = case when staff_sender and assigned_to is null then NEW.sender_id else assigned_to end
    where id = NEW.ticket_id;

  if staff_sender then
    insert into public.notifications (user_id, type, title, body, link, actor_id)
    values (t.user_id, 'support', 'Support replied to your ticket',
            left(coalesce(NEW.body, 'You have a new reply.'), 120),
            '/participant/support', NEW.sender_id);
  elsif t.assigned_to is not null then
    insert into public.notifications (user_id, type, title, body, link, actor_id)
    values (t.assigned_to, 'support', 'Ticket reply',
            left(coalesce(NEW.body, 'New reply on a ticket.'), 120),
            public.support_link_for(t.assigned_to), NEW.sender_id);
  else
    insert into public.notifications (user_id, type, title, body, link, actor_id)
    select ur.user_id, 'support', 'Ticket reply',
           left(coalesce(NEW.body, 'New reply on a ticket.'), 120),
           public.support_link_for(ur.user_id), NEW.sender_id
    from public.user_roles ur
    where ur.role in ('mentor', 'super_admin') and ur.user_id <> NEW.sender_id;
  end if;
  return NEW;
end;
$$;
drop trigger if exists support_message_notify on public.support_ticket_messages;
create trigger support_message_notify after insert on public.support_ticket_messages
  for each row execute function public.notify_support_message();

do $$
begin
  begin alter publication supabase_realtime add table public.support_tickets; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.support_ticket_messages; exception when duplicate_object then null; end;
end $$;
