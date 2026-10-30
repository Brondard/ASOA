-- =====================================================================
--  ASOA — mise à jour v8
--  Connexion avec un compte Google : la création automatique du profil
--  accepte aussi ce que Google fournit (given_name / family_name / name /
--  picture), en plus du prénom / nom saisis à l'inscription par e-mail.
--  Comme toute inscription, le compte attend ensuite la validation d'un coach.
--  À lancer dans Supabase > SQL Editor (relançable sans casse).
-- =====================================================================

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  meta  jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  full_name text := coalesce(meta->>'full_name', meta->>'name', '');
  first text;
  last  text;
begin
  -- Inscription par e-mail : prénom et nom saisis dans l'app
  first := nullif(trim(coalesce(meta->>'first_name', '')), '');
  last  := nullif(trim(coalesce(meta->>'last_name', '')), '');

  -- Compte Google : on prend ce que Google fournit
  first := coalesce(first, nullif(trim(coalesce(meta->>'given_name', '')), ''));
  last  := coalesce(last,  nullif(trim(coalesce(meta->>'family_name', '')), ''));

  -- Dernier recours : on coupe le nom complet au premier espace
  if first is null and full_name <> '' then
    first := split_part(full_name, ' ', 1);
    last  := coalesce(last, nullif(trim(substr(full_name, length(split_part(full_name, ' ', 1)) + 1)), ''));
  end if;

  insert into public.profiles (id, first_name, last_name, avatar_url)
  values (
    new.id,
    coalesce(first, ''),
    coalesce(last, ''),
    nullif(coalesce(meta->>'avatar_url', meta->>'picture', ''), '')
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
