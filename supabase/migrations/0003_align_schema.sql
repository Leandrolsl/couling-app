-- =====================================================================
-- Couling — Migration 0003: ALIGN live schema with the app (supa.ts)
-- Safe to run: the app tables are EMPTY. This DROPS the six app tables
-- (public.messages/chats/contacts/calls/meetings/profiles) and recreates
-- them exactly as the frontend expects, with RLS + realtime.
-- Run in: Supabase Dashboard -> SQL Editor -> New query -> paste -> Run.
-- (auth.users is NOT touched.)
-- =====================================================================

-- Drop in FK-dependency order
drop table if exists public.messages cascade;
drop table if exists public.calls cascade;
drop table if exists public.meetings cascade;
drop table if exists public.chats cascade;
drop table if exists public.contacts cascade;
drop table if exists public.profiles cascade;

-- ---------- PROFILES ----------
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  phone text unique,
  email text,
  name text default '',
  avatar text default '',
  is_online boolean default false,
  last_seen timestamptz default timezone('utc', now()),
  created_at timestamptz default timezone('utc', now()) not null,
  updated_at timestamptz default timezone('utc', now()) not null
);
create unique index profiles_email_unique on public.profiles (email) where email is not null;
alter table public.profiles enable row level security;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = timezone('utc', now()); return new; end $$;
drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute procedure public.touch_updated_at();

create policy "profiles_read_all"    on public.profiles for select to authenticated using (true);
create policy "profiles_insert_self" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "profiles_update_self" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- ---------- CONTACTS ----------
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users on delete cascade,
  contact_user_id uuid not null references auth.users on delete cascade,
  display_name text not null,
  created_at timestamptz default timezone('utc', now()) not null,
  unique (owner_id, contact_user_id),
  check (owner_id <> contact_user_id)
);
alter table public.contacts enable row level security;
create policy "contacts_owner_select" on public.contacts for select to authenticated using (auth.uid() = owner_id);
create policy "contacts_owner_insert" on public.contacts for insert to authenticated with check (auth.uid() = owner_id);
create policy "contacts_owner_delete" on public.contacts for delete to authenticated using (auth.uid() = owner_id);

-- ---------- CHATS ----------
create table public.chats (
  id text primary key,
  participant_ids uuid[] not null,
  last_message text default '',
  last_at timestamptz default timezone('utc', now()),
  disappearing_seconds int,
  cleared_at jsonb default '{}'::jsonb,
  created_at timestamptz default timezone('utc', now()) not null
);
alter table public.chats enable row level security;
create policy "chats_participants_select" on public.chats for select to authenticated using (auth.uid() = any(participant_ids));
create policy "chats_participants_insert" on public.chats for insert to authenticated with check (auth.uid() = any(participant_ids));
create policy "chats_participants_update" on public.chats for update to authenticated using (auth.uid() = any(participant_ids)) with check (auth.uid() = any(participant_ids));

-- ---------- MESSAGES ----------
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  chat_id text not null references public.chats on delete cascade,
  sender_id uuid not null references auth.users on delete cascade,
  text text default '',
  hidden_for uuid[] default '{}'::uuid[],
  deleted_for_all boolean default false,
  deleted_at timestamptz,
  created_at timestamptz default timezone('utc', now()) not null
);
create index messages_chat_id_created_at_idx on public.messages (chat_id, created_at);
alter table public.messages enable row level security;
create policy "messages_chat_participants_select" on public.messages for select to authenticated
  using (exists (select 1 from public.chats c where c.id = messages.chat_id and auth.uid() = any(c.participant_ids)));
create policy "messages_sender_insert" on public.messages for insert to authenticated
  with check (auth.uid() = sender_id and exists (select 1 from public.chats c where c.id = messages.chat_id and auth.uid() = any(c.participant_ids)));
create policy "messages_participant_update" on public.messages for update to authenticated
  using (exists (select 1 from public.chats c where c.id = messages.chat_id and auth.uid() = any(c.participant_ids)))
  with check (exists (select 1 from public.chats c where c.id = messages.chat_id and auth.uid() = any(c.participant_ids)));
create policy "messages_sender_delete" on public.messages for delete to authenticated
  using (auth.uid() = sender_id or exists (select 1 from public.chats c where c.id = messages.chat_id and auth.uid() = any(c.participant_ids)));

-- ---------- MEETINGS ----------
create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null default 'Couling Meeting',
  organizer_id uuid not null references auth.users on delete cascade,
  participants uuid[] not null default '{}'::uuid[],
  muted uuid[] not null default '{}'::uuid[],
  all_muted boolean not null default false,
  private_talk jsonb,
  status text not null default 'live' check (status in ('live','ended')),
  created_at timestamptz default timezone('utc', now()) not null
);
create index meetings_code_idx on public.meetings (code);
alter table public.meetings enable row level security;
create policy "meetings_select_authenticated"      on public.meetings for select to authenticated using (true);
create policy "meetings_insert_self_organizer"     on public.meetings for insert to authenticated with check (auth.uid() = organizer_id);
create policy "meetings_update_org_or_participant" on public.meetings for update to authenticated
  using (auth.uid() = organizer_id or auth.uid() = any(participants))
  with check (auth.uid() = organizer_id or auth.uid() = any(participants));
create policy "meetings_delete_organizer"          on public.meetings for delete to authenticated using (auth.uid() = organizer_id);

-- ---------- CALLS ----------
create table public.calls (
  id uuid primary key default gen_random_uuid(),
  caller_id uuid not null references auth.users on delete cascade,
  callee_id uuid not null references auth.users on delete cascade,
  type text not null check (type in ('voice','video')),
  status text not null default 'initiated',
  created_at timestamptz default timezone('utc', now()) not null
);
create index calls_caller_idx on public.calls (caller_id, created_at desc);
create index calls_callee_idx on public.calls (callee_id, created_at desc);
alter table public.calls enable row level security;
create policy "calls_select_participant" on public.calls for select to authenticated using (auth.uid() = caller_id or auth.uid() = callee_id);
create policy "calls_insert_self"        on public.calls for insert to authenticated with check (auth.uid() = caller_id);
create policy "calls_update_participant" on public.calls for update to authenticated using (auth.uid() = caller_id or auth.uid() = callee_id) with check (auth.uid() = caller_id or auth.uid() = callee_id);

-- ---------- REALTIME ----------
do $$
begin
  begin alter publication supabase_realtime add table public.messages; exception when others then null; end;
  begin alter publication supabase_realtime add table public.chats;    exception when others then null; end;
  begin alter publication supabase_realtime add table public.profiles; exception when others then null; end;
  begin alter publication supabase_realtime add table public.meetings; exception when others then null; end;
  begin alter publication supabase_realtime add table public.calls;    exception when others then null; end;
end $$;
