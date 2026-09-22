-- =====================================================================
--  ASOA — mise à jour v2
--  Présences aux séances, inscriptions aux courses, notifications push.
--  À lancer UNE fois dans Supabase > SQL Editor (relançable sans casse).
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
