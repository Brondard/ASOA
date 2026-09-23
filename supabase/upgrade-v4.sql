-- =====================================================================
--  ASOA — mise à jour v4
--  VMA (vitesse maximale aérobie) sur la fiche de chaque adhérent.
--  À lancer dans Supabase > SQL Editor (relançable sans casse).
-- =====================================================================

alter table public.profiles add column if not exists vma numeric(4,1)
  check (vma is null or (vma > 5 and vma < 30));
