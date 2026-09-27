-- =====================================================================
--  ASOA — mise à jour v7 (retours des coachs)
--  1. « Pas dispo » sur les courses, comme pour les séances.
--  2. Date du test de VMA.
--  À lancer dans Supabase > SQL Editor (relançable sans casse),
--  AVANT de mettre en ligne la nouvelle version de l'app.
-- =====================================================================

-- ---------- Courses : réponse « Pas dispo » -------------------------------
do $$
declare c text;
begin
  for c in select conname from pg_constraint
           where conrelid = 'public.race_registrations'::regclass and contype = 'c'
             and pg_get_constraintdef(oid) ilike '%status%' loop
    execute format('alter table public.race_registrations drop constraint %I', c);
  end loop;
end $$;
alter table public.race_registrations add constraint race_registrations_status_check
  check (status in ('going', 'interested', 'no'));

-- ---------- Date du test de VMA ------------------------------------------
alter table public.profiles add column if not exists vma_date date;

-- Relier une fiche sans compte : la date du test suit la VMA
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
    vma_date = case when vma is null then g.vma_date else vma_date end,
    vma = coalesce(vma, g.vma),
    avatar_url = coalesce(avatar_url, g.avatar_url)
  where id = p_account;

  delete from public.profiles where id = p_guest;
end $$;
revoke all on function public.link_guest(uuid, uuid) from public, anon;
grant execute on function public.link_guest(uuid, uuid) to authenticated;
