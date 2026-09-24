-- =====================================================================
--  ASOA — mise à jour v6
--  1. L'adhérent saisit lui-même ses résultats (publiés tout de suite).
--  2. Adhérents sans compte : un coach crée une fiche (nom, résultats),
--     qu'on relie plus tard au compte de la personne si elle s'inscrit.
--  À lancer dans Supabase > SQL Editor (relançable sans casse).
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
