-- Todo app schema (v2) for a FRESH project. Run in Supabase: SQL Editor -> New query -> paste -> Run.
--
-- WARNING: this file DROPS and recreates the tables, which deletes all data. Never re-run it on a project that
-- already has data; apply the files in supabase/migrations/ instead.
--
-- Every row belongs to one user, and row level security (RLS) makes sure people can only ever see and change
-- their own rows. The app's public key is safe to ship because of these policies.
--
-- v2 changes vs the first version: the primary key is (user_id, id) so two people can both have a list called
-- "work"; the server stamps updated_at on every write (sync cursor); realtime is enabled so other devices update
-- instantly. The v1 tables were empty, so they are dropped and recreated.

drop table if exists public.tasks cascade;
drop table if exists public.lists cascade;
drop table if exists public.profiles cascade;

create table public.lists (
  id          text not null,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null,
  color       text not null,
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,           -- set instead of deleting, so deletions reach other devices
  primary key (user_id, id)
);

create table public.tasks (
  id          text not null,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  list_id     text not null,
  title       text not null,
  date        text not null,         -- local day, YYYY-MM-DD
  time        text,                  -- optional, HH:MM
  done        boolean not null default false,
  position    double precision,      -- manual drag-and-drop order
  created_at  bigint not null,
  completed_at bigint,               -- when the task was ticked off (ms since epoch)
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  primary key (user_id, id)
);

create table public.profiles (
  user_id     uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  name        text not null default '',
  updated_at  timestamptz not null default now()
);

create index lists_sync_idx on public.lists (user_id, updated_at);
create index tasks_sync_idx on public.tasks (user_id, updated_at);

-- The server clock decides updated_at, so devices with a wrong clock can't break syncing.
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger lists_touch    before insert or update on public.lists    for each row execute function public.touch_updated_at();
create trigger tasks_touch    before insert or update on public.tasks    for each row execute function public.touch_updated_at();
create trigger profiles_touch before insert or update on public.profiles for each row execute function public.touch_updated_at();

alter table public.lists    enable row level security;
alter table public.tasks    enable row level security;
alter table public.profiles enable row level security;

create policy "own lists"   on public.lists    for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own tasks"   on public.tasks    for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own profile" on public.profiles for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Realtime: lets the app hear about changes made on another device.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'lists') then
    alter publication supabase_realtime add table public.lists;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'tasks') then
    alter publication supabase_realtime add table public.tasks;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'profiles') then
    alter publication supabase_realtime add table public.profiles;
  end if;
end $$;

-- Lets a signed-in user delete their own account from the app (required by the App Store).
create or replace function public.delete_my_account() returns void
language sql security definer set search_path = public, auth as $$
  delete from auth.users where id = auth.uid();
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
