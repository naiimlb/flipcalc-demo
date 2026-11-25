# Vrais Web Push (iPhone inclus)

Aujourd'hui les rappels sont simulés. Pour qu'ils arrivent **app fermée, iPhone verrouillé**, il faut un serveur qui envoie les push. Voici ce qu'il faut.

## Prérequis iPhone (non négociables)

1. **iOS / iPadOS 16.4 minimum.**
2. L'app doit être **ajoutée à l'écran d'accueil** (Safari → Partager → Sur l'écran d'accueil) et **ouverte depuis l'icône**. Dans un onglet Safari classique, le push n'existe pas.
3. **Manifest** avec `display: standalone` (c'est fait).
4. **HTTPS** (Vercel s'en charge).
5. La permission doit être demandée **sur un geste de l'utilisateur** (clic sur « Activer les notifications », c'est fait).
6. `pushManager.subscribe({ userVisibleOnly: true, … })` : sur iOS **chaque push doit afficher une notification** (sinon iOS révoque l'abonnement). Le handler `push` de `public/sw.js` le fait toujours.
7. Pas de mode Ne pas déranger / Concentration qui bloque l'app, et notifications autorisées dans Réglages iPhone → Notifications → HB Rappels.

## Brique par brique

1. **Clés VAPID** : `npx web-push generate-vapid-keys`.
   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (client, lu par `src/lib/push.ts`)
   - `VAPID_PRIVATE_KEY` + `VAPID_SUBJECT=mailto:…` (serveur uniquement, variables Vercel)
2. **Base de données** (Supabase ou Vercel Postgres) :
   - `subscriptions` : endpoint, clés `p256dh` / `auth`, fuseau `Europe/Paris`, `user_id`
   - `tasks` : mêmes champs que `Task` (voir `src/lib/types.ts`), rattachées à l'utilisateur
   - `sent` : (`task_id`, `service_date`) pour ne jamais envoyer deux fois
3. **Routes API** Next.js :
   - `POST /api/push/subscribe` : enregistre l'abonnement renvoyé par `subscribeToPush()`
   - `POST /api/push/cron` : protégée par un secret ; calcule les rappels dus et envoie avec la lib `web-push`
4. **Cron** : il faut un déclencheur toutes les minutes (ou toutes les 5 min).
   - ⚠️ **Vercel Cron en offre Hobby est limité à 1 exécution par jour** ; la fréquence à la minute demande le plan Pro.
   - Alternatives gratuites : cron-job.org, GitHub Actions (5 min mini, peu précis), Supabase `pg_cron` + Edge Function, Upstash QStash.
5. **Logique du cron** : réutiliser `planForService` / `reminderAt` de `src/lib/service.ts` pour les services d'hier et d'aujourd'hui (c'est ce qui gère les tâches d'après minuit), en heure de Paris, et envoyer celles dont l'heure de rappel est passée depuis moins de quelques minutes et pas encore dans `sent`.
6. **Payload** attendu par le service worker : `{ "title": "⏰ Clôture caisse", "body": "01h30 · Caisse — dans 15 min", "url": "/", "tag": "<taskId>@<date>" }`. Utiliser `buildNotification` pour garder le même texte.
7. **Remplacer `store.ts`** par des appels API (synchronisation des tâches serveur ↔ appareil) et brancher `subscribeToPush()` au bouton « Activer les notifications ».
8. **Cocher une tâche** doit aussi être enregistré côté serveur, pour ne pas notifier une tâche déjà faite.

## Limites à connaître

- iOS ne garantit pas la minute exacte (économie d'énergie) ; compter quelques secondes de variation.
- Un abonnement expire si l'app est désinstallée : traiter les réponses 404/410 de `web-push` en supprimant l'abonnement.
