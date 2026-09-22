-- =====================================================================
--  Rappels automatiques tous les jours à 18h (heure d'été ; 17h en hiver)
--  - rappel aux inscrits des séances du lendemain
--  - alerte aux coachs si le minimum d'inscrits n'est pas atteint
--  - rappel J-7 aux inscrits d'une course
--
--  Avant de lancer : Database > Extensions > activer « pg_cron » et « pg_net ».
--  Remplace les 3 valeurs ENTRE CHEVRONS, puis Run.
-- =====================================================================
select cron.unschedule('asoa-rappels') where exists (select 1 from cron.job where jobname = 'asoa-rappels');

select cron.schedule(
  'asoa-rappels',
  '0 16 * * *',   -- 16h UTC
  $$
  select net.http_post(
    url     := 'https://<ID-DU-PROJET>.supabase.co/functions/v1/notify',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer <CLE-ANON>',
      'x-cron-secret', '<CRON_SECRET>'
    ),
    body    := '{"type":"daily"}'::jsonb
  );
  $$
);
