-- =====================================================================
-- Couling — Supabase Migration 0002
-- Email auth ready · Meetings · Calls
-- Run AFTER 0001_init.sql in: Supabase Dashboard → SQL Editor → New query
-- =====================================================================

-- ---------- 0002.1: PROFILES — allow email + name during signup ----------
-- Phone is now nullable (filled later when phone/SMS login is added).
alter table public.profiles
  alter column phone drop not null;

alter table public.profiles
  add column if not exists email text;

create unique index if not exists profiles_email_unique
  on public.profiles (email) where email is not null;

-- ---------- 0002.2: MEETINGS ----------
create table if not exists public.meetings (
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

create index if not exists meetings_code_idx on public.meetings (code);
create index if not exists meetings_organizer_idx on public.meetings (organizer_id);

alter table public.meetings enable row level security;

-- SELECT: any authenticated user (so they can look up by code to join)
drop policy if exists "meetings_select_authenticated" on public.meetings;
create policy "meetings_select_authenticated"
  on public.meetings for select
  to authenticated
  using (true);

-- INSERT: only by self as organizer
drop policy if exists "meetings_insert_self_organizer" on public.meetings;
create policy "meetings_insert_self_organizer"
  on public.meetings for insert
  to authenticated
  with check (auth.uid() = organizer_id);

-- UPDATE: organizer OR participant (organizer-only actions are enforced in app)
drop policy if exists "meetings_update_org_or_participant" on public.meetings;
create policy "meetings_update_org_or_participant"
  on public.meetings for update
  to authenticated
  using (auth.uid() = organizer_id or auth.uid() = any(participants))
  with check (auth.uid() = organizer_id or auth.uid() = any(participants));

-- DELETE: organizer only
drop policy if exists "meetings_delete_organizer" on public.meetings;
create policy "meetings_delete_organizer"
  on public.meetings for delete
  to authenticated
  using (auth.uid() = organizer_id);

-- ---------- 0002.3: CALLS (log only) ----------
create table if not exists public.calls (
  id uuid primary key default gen_random_uuid(),
  caller_id uuid not null references auth.users on delete cascade,
  callee_id uuid not null references auth.users on delete cascade,
  type text not null check (type in ('voice','video')),
  status text not null default 'initiated',
  created_at timestamptz default timezone('utc', now()) not null
);

create index if not exists calls_caller_idx on public.calls (caller_id, created_at desc);
create index if not exists calls_callee_idx on public.calls (callee_id, created_at desc);

alter table public.calls enable row level security;

drop policy if exists "calls_select_participant" on public.calls;
create policy "calls_select_participant"
  on public.calls for select
  to authenticated
  using (auth.uid() = caller_id or auth.uid() = callee_id);

drop policy if exists "calls_insert_self" on public.calls;
create policy "calls_insert_self"
  on public.calls for insert
  to authenticated
  with check (auth.uid() = caller_id);

drop policy if exists "calls_update_participant" on public.calls;
create policy "calls_update_participant"
  on public.calls for update
  to authenticated
  using (auth.uid() = caller_id or auth.uid() = callee_id)
  with check (auth.uid() = caller_id or auth.uid() = callee_id);

-- ---------- 0002.4: REALTIME PUBLICATION ----------
do $$
begin
  begin
    alter publication supabase_realtime add table public.meetings;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.calls;
  exception when duplicate_object then null;
  end;
end $$;
