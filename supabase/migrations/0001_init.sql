-- =====================================================================
-- Couling — Supabase Schema Migration 0001
-- Run this in: Supabase Dashboard → SQL Editor → New query → Paste → Run
-- Pre-requisite: Enable "Allow anonymous sign-ins" in Auth → Providers
-- =====================================================================

-- ---------- PROFILES (linked to auth.users, holds hidden phone) ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  phone text unique,
  name text default '',
  avatar text default '',
  is_online boolean default false,
  last_seen timestamptz default timezone('utc', now()),
  created_at timestamptz default timezone('utc', now()) not null,
  updated_at timestamptz default timezone('utc', now()) not null
);

alter table public.profiles enable row level security;

-- Auto-update updated_at
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end $$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch
  before update on public.profiles
  for each row execute procedure public.touch_updated_at();

-- ---------- CONTACTS (one-way; phone hidden after add) ----------
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users on delete cascade,
  contact_user_id uuid not null references auth.users on delete cascade,
  display_name text not null,
  created_at timestamptz default timezone('utc', now()) not null,
  unique (owner_id, contact_user_id),
  check (owner_id <> contact_user_id)
);

alter table public.contacts enable row level security;

-- ---------- CHATS (1:1 only for now) ----------
create table if not exists public.chats (
  id text primary key,                       -- deterministic: chat_<sortedA>_<sortedB>
  participant_ids uuid[] not null,
  last_message text default '',
  last_at timestamptz default timezone('utc', now()),
  disappearing_seconds int,                  -- null = off
  cleared_at jsonb default '{}'::jsonb,      -- { user_id: iso_ts }
  created_at timestamptz default timezone('utc', now()) not null
);

alter table public.chats enable row level security;

-- ---------- MESSAGES ----------
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  chat_id text not null references public.chats on delete cascade,
  sender_id uuid not null references auth.users on delete cascade,
  text text default '',
  hidden_for uuid[] default '{}'::uuid[],
  deleted_for_all boolean default false,
  deleted_at timestamptz,
  created_at timestamptz default timezone('utc', now()) not null
);

create index if not exists messages_chat_id_created_at_idx
  on public.messages (chat_id, created_at);

alter table public.messages enable row level security;

-- =====================================================================
-- ROW LEVEL SECURITY POLICIES
-- =====================================================================

-- PROFILES: anyone authenticated can read (needed for contact lookup by phone);
-- only owner can update; insert allowed for self only.
drop policy if exists "profiles_read_all" on public.profiles;
create policy "profiles_read_all"
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- CONTACTS: only owner can read/write their own contact list
drop policy if exists "contacts_owner_select" on public.contacts;
create policy "contacts_owner_select"
  on public.contacts for select
  to authenticated
  using (auth.uid() = owner_id);

drop policy if exists "contacts_owner_insert" on public.contacts;
create policy "contacts_owner_insert"
  on public.contacts for insert
  to authenticated
  with check (auth.uid() = owner_id);

drop policy if exists "contacts_owner_delete" on public.contacts;
create policy "contacts_owner_delete"
  on public.contacts for delete
  to authenticated
  using (auth.uid() = owner_id);

-- CHATS: only participants can read/write
drop policy if exists "chats_participants_select" on public.chats;
create policy "chats_participants_select"
  on public.chats for select
  to authenticated
  using (auth.uid() = any(participant_ids));

drop policy if exists "chats_participants_insert" on public.chats;
create policy "chats_participants_insert"
  on public.chats for insert
  to authenticated
  with check (auth.uid() = any(participant_ids));

drop policy if exists "chats_participants_update" on public.chats;
create policy "chats_participants_update"
  on public.chats for update
  to authenticated
  using (auth.uid() = any(participant_ids))
  with check (auth.uid() = any(participant_ids));

-- MESSAGES: only chat participants can read/write
drop policy if exists "messages_chat_participants_select" on public.messages;
create policy "messages_chat_participants_select"
  on public.messages for select
  to authenticated
  using (
    exists (
      select 1 from public.chats c
      where c.id = messages.chat_id
        and auth.uid() = any(c.participant_ids)
    )
  );

drop policy if exists "messages_sender_insert" on public.messages;
create policy "messages_sender_insert"
  on public.messages for insert
  to authenticated
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.chats c
      where c.id = messages.chat_id
        and auth.uid() = any(c.participant_ids)
    )
  );

drop policy if exists "messages_participant_update" on public.messages;
create policy "messages_participant_update"
  on public.messages for update
  to authenticated
  using (
    exists (
      select 1 from public.chats c
      where c.id = messages.chat_id
        and auth.uid() = any(c.participant_ids)
    )
  )
  with check (
    exists (
      select 1 from public.chats c
      where c.id = messages.chat_id
        and auth.uid() = any(c.participant_ids)
    )
  );

drop policy if exists "messages_sender_delete" on public.messages;
create policy "messages_sender_delete"
  on public.messages for delete
  to authenticated
  using (
    auth.uid() = sender_id
    or exists (
      select 1 from public.chats c
      where c.id = messages.chat_id
        and auth.uid() = any(c.participant_ids)
    )
  );

-- =====================================================================
-- REALTIME PUBLICATION
-- =====================================================================
-- Make sure messages, chats, and profiles changes are streamed.
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.chats;
alter publication supabase_realtime add table public.profiles;
