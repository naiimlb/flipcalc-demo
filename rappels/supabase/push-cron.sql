-- =============================================================================
--  Planificateur des rappels : appelle la route /api/push/tick CHAQUE MINUTE (gratuit, dans Supabase).
--  À exécuter UNE FOIS dans Supabase → SQL Editor, après avoir :
--    1. exécuté la migration (supabase/migrations/2026-11-26_taches-libres-et-push.sql),
--    2. créé le secret :  select vault.create_secret('<ton CRON_SECRET>', 'hb_cron_secret');
--    3. déployé l'app avec les variables d'environnement (docs/NOTIFICATIONS.md).
--  Pour arrêter les rappels du serveur :  select cron.unschedule('hb-push-tick');
-- =============================================================================
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'hb-push-tick',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://hb-rappels.vercel.app/api/push/tick',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'hb_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
  $$
);
