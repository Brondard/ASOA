-- =====================================================================
--  ASOA Antibes — schéma Supabase
--  À coller dans Supabase > SQL Editor > New query, puis "Run".
--  Le script peut être relancé sans casse (idempotent).
-- =====================================================================

-- ---------- Profils adhérents (1 ligne par compte) --------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  first_name   text not null default '',
  last_name    text not null default '',
  avatar_url   text,
  city         text,
  disciplines  text[] not null default '{}',   -- 'running' | 'trail' | 'triathlon'
  is_admin     boolean not null default false,
  created_at   timestamptz not null default now()
);

-- Création automatique du profil à l'inscription
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, first_name, last_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', '')
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helper : l'utilisateur courant est-il admin ?
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- Un adhérent ne peut pas se donner lui-même les droits admin
create or replace function public.protect_admin_flag()
returns trigger language plpgsql as $$
begin
  if new.is_admin is distinct from old.is_admin and not public.is_admin() then
    new.is_admin := old.is_admin;
  end if;
  return new;
end $$;

drop trigger if exists protect_admin_flag on public.profiles;
create trigger protect_admin_flag
  before update on public.profiles
  for each row execute function public.protect_admin_flag();

-- ---------- Séances d'entraînement ------------------------------------
create table if not exists public.sessions (
  id             uuid primary key default gen_random_uuid(),
  starts_at      timestamptz not null,
  duration_min   int,
  discipline     text not null check (discipline in ('running','trail','triathlon')),
  title          text not null,
  description    text,
  location_name  text not null,
  address        text,
  lat            double precision,
  lng            double precision,
  created_by     uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now()
);
create index if not exists sessions_starts_at_idx on public.sessions(starts_at);

-- ---------- Courses (compétitions) ------------------------------------
create table if not exists public.races (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  race_date    date not null,
  location     text,
  discipline   text not null check (discipline in ('running','trail','triathlon')),
  format       text,                                  -- ex. "10 km", "Distance M", "42 km / 2400 D+"
  distance_km  numeric(6,2) not null check (distance_km >= 0),   -- compte pour le challenge
  created_at   timestamptz not null default now()
);
create index if not exists races_date_idx on public.races(race_date desc);

-- ---------- Résultats (1 ligne par adhérent et par course) ------------
create table if not exists public.results (
  id             uuid primary key default gen_random_uuid(),
  race_id        uuid not null references public.races(id) on delete cascade,
  member_id      uuid not null references public.profiles(id) on delete cascade,
  time_seconds   int check (time_seconds > 0),   -- null = abandon / non classé
  rank_overall   int check (rank_overall > 0),   -- classement scratch
  finishers      int check (finishers > 0),      -- nb de classés (optionnel)
  podium         smallint check (podium between 1 and 3), -- podium catégorie
  note           text,
  created_at     timestamptz not null default now(),
  unique (race_id, member_id)
);

-- ---------- Sécurité (Row Level Security) -----------------------------
alter table public.profiles enable row level security;
alter table public.sessions enable row level security;
alter table public.races    enable row level security;
alter table public.results  enable row level security;

-- Lecture : tout adhérent connecté
drop policy if exists "read profiles" on public.profiles;
create policy "read profiles" on public.profiles for select to authenticated using (true);
drop policy if exists "read sessions" on public.sessions;
create policy "read sessions" on public.sessions for select to authenticated using (true);
drop policy if exists "read races" on public.races;
create policy "read races" on public.races for select to authenticated using (true);
drop policy if exists "read results" on public.results;
create policy "read results" on public.results for select to authenticated using (true);

-- Profils : chacun modifie le sien, l'admin modifie tout
drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- Écriture séances / courses / résultats : admin uniquement
drop policy if exists "admin write sessions" on public.sessions;
create policy "admin write sessions" on public.sessions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admin write races" on public.races;
create policy "admin write races" on public.races for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admin write results" on public.results;
create policy "admin write results" on public.results for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- Photos de profil (Storage) --------------------------------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatar read" on storage.objects;
create policy "avatar read" on storage.objects for select
  using (bucket_id = 'avatars');
drop policy if exists "avatar upload own" on storage.objects;
create policy "avatar upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "avatar update own" on storage.objects;
create policy "avatar update own" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- =====================================================================
--  Donner les droits admin à un compte (après son inscription) :
--    update public.profiles set is_admin = true
--    where id = (select id from auth.users where email = 'ton@email.fr');
-- =====================================================================
