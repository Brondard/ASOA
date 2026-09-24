-- =====================================================================
--  ASOA — mise à jour v5
--  1. Validation des nouveaux comptes par un coach : tant qu'un compte
--     n'est pas validé, il ne voit aucune donnée du club.
--  2. Suppression de compte (RGPD) : par l'adhérent lui-même, ou par un
--     coach pour refuser une inscription.
--  À lancer dans Supabase > SQL Editor (relançable sans casse).
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
