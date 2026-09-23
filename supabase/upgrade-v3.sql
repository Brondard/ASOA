-- =====================================================================
--  ASOA — mise à jour v3
--  Une épreuve peut regrouper plusieurs formats (10 km, semi, marathon…).
--  Chaque format reste une ligne de `races`, rattachée à l'épreuve par parent_id.
--  À lancer dans Supabase > SQL Editor (relançable sans casse).
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
