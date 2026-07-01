-- =====================================================================
-- Couling — Migration 0004: fix signup (auth.users -> profiles trigger)
-- After 0003 recreated public.profiles with RLS, the pre-existing
-- auth.users insert trigger that writes to profiles fails (RLS/columns),
-- causing HTTP 500 "Database error saving new user" on EVERY signup.
-- This removes any auth.users trigger that references profiles and
-- installs a clean SECURITY DEFINER trigger that bootstraps the profile.
-- Run in: Supabase Dashboard -> SQL Editor -> New query -> Run.
-- =====================================================================

-- 1) Drop any non-internal trigger on auth.users whose function touches profiles
do $$
declare r record;
begin
  for r in
    select t.tgname
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_proc p on p.oid = t.tgfoid
    where n.nspname = 'auth' and c.relname = 'users'
      and not t.tgisinternal
      and pg_get_functiondef(p.oid) ilike '%profiles%'
  loop
    execute format('drop trigger if exists %I on auth.users', r.tgname);
  end loop;
end $$;

-- 2) Clean bootstrap function (SECURITY DEFINER bypasses RLS during signup)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end $$;

-- 3) (Re)create the trigger
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
