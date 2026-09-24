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
  -- Ne s'applique qu'aux modifications faites depuis l'app.
  -- Le tableau de bord Supabase (SQL Editor, Table Editor) garde la main.
  if current_user in ('authenticated', 'anon')
     and new.is_admin is distinct from old.is_admin
     and not public.is_admin() then
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


-- =====================================================================
--  v2 : présences, inscriptions aux courses, notifications push
-- =====================================================================
-- =====================================================================

-- ---------- Séances : minimum de participants et annulation ----------
alter table public.sessions add column if not exists min_participants int check (min_participants > 0);
alter table public.sessions add column if not exists cancelled boolean not null default false;
alter table public.sessions add column if not exists cancel_reason text;

-- ---------- Présences (1 réponse par adhérent et par séance) ----------
create table if not exists public.session_attendance (
  session_id  uuid not null references public.sessions(id) on delete cascade,
  member_id   uuid not null references public.profiles(id) on delete cascade,
  status      text not null check (status in ('yes','maybe','no')),
  updated_at  timestamptz not null default now(),
  primary key (session_id, member_id)
);

-- ---------- Courses : infos, lien d'inscription, objectif club ---------
alter table public.races add column if not exists description text;
alter table public.races add column if not exists registration_url text;
alter table public.races add column if not exists is_club_goal boolean not null default false;

-- ---------- Inscriptions aux courses à venir ---------------------------
create table if not exists public.race_registrations (
  race_id     uuid not null references public.races(id) on delete cascade,
  member_id   uuid not null references public.profiles(id) on delete cascade,
  status      text not null check (status in ('going','interested')),
  created_at  timestamptz not null default now(),
  primary key (race_id, member_id)
);

-- ---------- Abonnements aux notifications (1 par appareil) -------------
create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references public.profiles(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now()
);

-- ---------- Sécurité -----------------------------------------------------
alter table public.session_attendance enable row level security;
alter table public.race_registrations enable row level security;
alter table public.push_subscriptions enable row level security;

-- Présences : tout le monde voit qui vient, chacun gère sa propre réponse
drop policy if exists "read attendance" on public.session_attendance;
create policy "read attendance" on public.session_attendance for select to authenticated using (true);
drop policy if exists "own attendance" on public.session_attendance;
create policy "own attendance" on public.session_attendance for all to authenticated
  using (member_id = auth.uid() or public.is_admin())
  with check (member_id = auth.uid() or public.is_admin());

-- Inscriptions courses : même principe
drop policy if exists "read registrations" on public.race_registrations;
create policy "read registrations" on public.race_registrations for select to authenticated using (true);
drop policy if exists "own registrations" on public.race_registrations;
create policy "own registrations" on public.race_registrations for all to authenticated
  using (member_id = auth.uid() or public.is_admin())
  with check (member_id = auth.uid() or public.is_admin());

-- Abonnements push : chacun ne voit que les siens (l'envoi passe par l'Edge Function)
drop policy if exists "own push" on public.push_subscriptions;
create policy "own push" on public.push_subscriptions for all to authenticated
  using (member_id = auth.uid()) with check (member_id = auth.uid());

-- Enregistre l'appareil pour l'utilisateur connecté (reprend l'appareil
-- s'il était déjà lié à un autre compte, ex. téléphone partagé)
create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text)
returns void language sql security definer set search_path = public as $$
  insert into public.push_subscriptions (member_id, endpoint, p256dh, auth)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update
    set member_id = auth.uid(), p256dh = excluded.p256dh, auth = excluded.auth;
$$;
revoke all on function public.save_push_subscription(text, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text) to authenticated;


-- =====================================================================
--  v3 : plusieurs formats sous une même épreuve
-- =====================================================================

alter table public.races add column if not exists parent_id uuid references public.races(id) on delete cascade;
create index if not exists races_parent_idx on public.races(parent_id);

-- Une épreuve ne peut pas être le format d'une autre épreuve (un seul niveau)
create or replace function public.check_race_depth()
returns trigger language plpgsql as $$
begin
  if new.parent_id is not null and exists (select 1 from public.races where id = new.parent_id and parent_id is not null) then
    raise exception 'Une épreuve ne peut avoir qu''un niveau de formats';
  end if;
  return new;
end $$;

drop trigger if exists check_race_depth on public.races;
create trigger check_race_depth
  before insert or update on public.races
  for each row execute function public.check_race_depth();


-- =====================================================================
--  v4 : VMA des adhérents
-- =====================================================================

alter table public.profiles add column if not exists vma numeric(4,1)
  check (vma is null or (vma > 5 and vma < 30));


-- =====================================================================
--  v5 : validation des comptes par un coach, suppression de compte (RGPD)
-- =====================================================================
-- ---------- Validation des comptes ------------------------------------
-- Les comptes qui existent déjà au moment de la migration sont validés d'office
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'profiles' and column_name = 'approved') then
    alter table public.profiles add column approved boolean not null default false;
    update public.profiles set approved = true;
  end if;
end $$;

-- Membre du club = compte validé (un coach l'est toujours)
create or replace function public.is_member()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select approved or is_admin from public.profiles where id = auth.uid()), false);
$$;

-- Seul un coach peut changer is_admin et approved depuis l'app
create or replace function public.protect_admin_flag()
returns trigger language plpgsql as $$
begin
  -- Ne s'applique qu'aux modifications faites depuis l'app.
  -- Le tableau de bord Supabase (SQL Editor, Table Editor) garde la main.
  if current_user in ('authenticated', 'anon') and not public.is_admin() then
    new.is_admin := old.is_admin;
    new.approved := old.approved;
  end if;
  return new;
end $$;

-- Lecture réservée aux comptes validés (chacun voit toujours son propre profil)
drop policy if exists "read profiles" on public.profiles;
create policy "read profiles" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_member());
drop policy if exists "read sessions" on public.sessions;
create policy "read sessions" on public.sessions for select to authenticated using (public.is_member());
drop policy if exists "read races" on public.races;
create policy "read races" on public.races for select to authenticated using (public.is_member());
drop policy if exists "read results" on public.results;
create policy "read results" on public.results for select to authenticated using (public.is_member());
drop policy if exists "read attendance" on public.session_attendance;
create policy "read attendance" on public.session_attendance for select to authenticated using (public.is_member());
drop policy if exists "read registrations" on public.race_registrations;
create policy "read registrations" on public.race_registrations for select to authenticated using (public.is_member());

-- Présences et inscriptions : seulement une fois validé
drop policy if exists "own attendance" on public.session_attendance;
create policy "own attendance" on public.session_attendance for all to authenticated
  using ((member_id = auth.uid() and public.is_member()) or public.is_admin())
  with check ((member_id = auth.uid() and public.is_member()) or public.is_admin());
drop policy if exists "own registrations" on public.race_registrations;
create policy "own registrations" on public.race_registrations for all to authenticated
  using ((member_id = auth.uid() and public.is_member()) or public.is_admin())
  with check ((member_id = auth.uid() and public.is_member()) or public.is_admin());

-- Pas de notifications pour un compte non validé
create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_member() then
    raise exception 'Ton compte doit être validé par un coach avant d''activer les notifications.';
  end if;
  insert into public.push_subscriptions (member_id, endpoint, p256dh, auth)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update
    set member_id = auth.uid(), p256dh = excluded.p256dh, auth = excluded.auth;
end $$;
revoke all on function public.save_push_subscription(text, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text) to authenticated;

-- ---------- Suppression de compte --------------------------------------
-- Supprimer l'utilisateur efface en cascade : profil, résultats, présences,
-- inscriptions, abonnements push. Les séances créées restent (créateur vidé).
-- La photo est retirée du Storage par l'app juste avant.

create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'Non connecté.';
  end if;
  if (select is_admin from public.profiles where id = auth.uid())
     and (select count(*) from public.profiles where is_admin) = 1 then
    raise exception 'Tu es le seul coach : nomme un autre coach avant de supprimer ton compte.';
  end if;
  delete from auth.users where id = auth.uid();
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- Un coach refuse une inscription en attente (jamais un compte déjà validé)
create or replace function public.refuse_member(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Action réservée aux coachs.';
  end if;
  if not exists (select 1 from public.profiles where id = p_id and not approved and not is_admin) then
    raise exception 'Ce compte n''est pas en attente de validation.';
  end if;
  delete from auth.users where id = p_id;
end $$;
revoke all on function public.refuse_member(uuid) from public, anon;
grant execute on function public.refuse_member(uuid) to authenticated;

-- Photos : chacun peut supprimer les siennes, un coach celles d'un compte refusé
drop policy if exists "avatar delete" on storage.objects;
create policy "avatar delete" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));


-- =====================================================================
--  v6 : résultats saisis par l'adhérent, adhérents sans compte
-- =====================================================================
-- ---------- Résultats saisis par l'adhérent -------------------------------
-- Sur une course (ou un format) déjà courue ou courue aujourd'hui, jamais sur
-- une épreuve qui a des formats (les résultats vont sur les formats).
drop policy if exists "own results" on public.results;
create policy "own results" on public.results for all to authenticated
  using (member_id = auth.uid() and public.is_member())
  with check (
    member_id = auth.uid() and public.is_member()
    and exists (
      select 1 from public.races r
      where r.id = race_id
        and r.race_date <= (now() at time zone 'Europe/Paris')::date
        and not exists (select 1 from public.races f where f.parent_id = r.id)
    )
  );

-- ---------- Adhérents sans compte -------------------------------------
alter table public.profiles add column if not exists guest boolean not null default false;
alter table public.profiles alter column id set default gen_random_uuid();
-- Une fiche sans compte n'a pas d'utilisateur Supabase : on retire le lien obligatoire...
do $$
declare c text;
begin
  for c in select conname from pg_constraint
           where conrelid = 'public.profiles'::regclass and contype = 'f' and confrelid = 'auth.users'::regclass loop
    execute format('alter table public.profiles drop constraint %I', c);
  end loop;
end $$;
alter table public.profiles drop constraint if exists guest_not_admin;
alter table public.profiles add constraint guest_not_admin check (not (guest and is_admin));

-- ...et on garde la suppression en cascade avec un trigger : supprimer un
-- utilisateur (app ou dashboard) supprime toujours son profil et ses données
create or replace function public.handle_deleted_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.profiles where id = old.id;
  return old;
end $$;

drop trigger if exists on_auth_user_deleted on auth.users;
create trigger on_auth_user_deleted
  after delete on auth.users
  for each row execute function public.handle_deleted_user();

-- Seul un coach change is_admin, approved et guest depuis l'app
create or replace function public.protect_admin_flag()
returns trigger language plpgsql as $$
begin
  -- Ne s'applique qu'aux modifications faites depuis l'app.
  -- Le tableau de bord Supabase (SQL Editor, Table Editor) garde la main.
  if current_user in ('authenticated', 'anon') and not public.is_admin() then
    new.is_admin := old.is_admin;
    new.approved := old.approved;
    new.guest := old.guest;
  end if;
  return new;
end $$;

-- Un coach crée et supprime les fiches sans compte (jamais un vrai compte)
drop policy if exists "admin insert guest" on public.profiles;
create policy "admin insert guest" on public.profiles for insert to authenticated
  with check (public.is_admin() and guest and approved and not is_admin);
drop policy if exists "admin delete guest" on public.profiles;
create policy "admin delete guest" on public.profiles for delete to authenticated
  using (public.is_admin() and guest);

-- Relie une fiche sans compte au compte de la personne : ses résultats,
-- inscriptions et présences passent sur le compte, la fiche disparaît,
-- et le compte est validé au passage.
create or replace function public.link_guest(p_guest uuid, p_account uuid)
returns void language plpgsql security definer set search_path = public as $$
declare g public.profiles;
begin
  if not public.is_admin() then
    raise exception 'Action réservée aux coachs.';
  end if;
  select * into g from public.profiles where id = p_guest and guest;
  if not found then
    raise exception 'Fiche sans compte introuvable.';
  end if;
  if not exists (select 1 from public.profiles where id = p_account and not guest) then
    raise exception 'Compte introuvable.';
  end if;

  -- Si le compte a déjà une ligne pour la même course / séance, on garde la sienne
  update public.results set member_id = p_account
    where member_id = p_guest
      and race_id not in (select race_id from public.results where member_id = p_account);
  update public.race_registrations set member_id = p_account
    where member_id = p_guest
      and race_id not in (select race_id from public.race_registrations where member_id = p_account);
  update public.session_attendance set member_id = p_account
    where member_id = p_guest
      and session_id not in (select session_id from public.session_attendance where member_id = p_account);

  -- Le compte récupère ce que la fiche avait et que lui n'a pas encore
  update public.profiles set
    approved = true,
    city = coalesce(nullif(city, ''), g.city),
    disciplines = case when cardinality(disciplines) = 0 then g.disciplines else disciplines end,
    vma = coalesce(vma, g.vma),
    avatar_url = coalesce(avatar_url, g.avatar_url)
  where id = p_account;

  delete from public.profiles where id = p_guest;
end $$;
revoke all on function public.link_guest(uuid, uuid) from public, anon;
grant execute on function public.link_guest(uuid, uuid) to authenticated;

-- Photos : un coach peut aussi mettre la photo d'une fiche sans compte
drop policy if exists "avatar upload own" on storage.objects;
create policy "avatar upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
drop policy if exists "avatar update own" on storage.objects;
create policy "avatar update own" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
