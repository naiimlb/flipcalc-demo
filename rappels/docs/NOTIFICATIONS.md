# Notifications : vrais rappels, même app fermée

Une app d'iPhone ne peut pas se réveiller toute seule : les rappels (surtout répétés, ex. « toutes les 30 min ») sont donc envoyés par un **serveur** via **Web Push**, et arrivent même quand l'app est fermée ou le téléphone verrouillé.

## Comment ça marche
```
Supabase pg_cron (chaque minute, gratuit)
   └─► POST https://hb-rappels.vercel.app/api/push/tick   (avec un secret)
          └─► calcule les rappels dus (tâches, équipe, planning, pause, « cochée »…)
          └─► réserve chaque créneau dans push_sent (anti-doublon) puis envoie le push
                 └─► serveur Apple / Google ─► ton téléphone
```
- **Pas de cron Vercel** (le plan gratuit n'en permet qu'un par jour) : c'est `pg_cron`, inclus dans Supabase, qui appelle la route chaque minute.
- **Aucun doublon** : la clé primaire de `push_sent` (tâche + journée + créneau) fait qu'un même rappel ne peut être réservé, donc envoyé, qu'une seule fois, même si deux appels se chevauchent. Les rappels en retard de plus de 5 minutes ne sont pas rattrapés.
- **Cochée = arrêt** : si « Répéter jusqu'à ce que je coche la tâche » est activé, plus aucun rappel ne part dès que tu la coches.
- **Fuseau Europe/Paris**, heure d'été/hiver incluse. Un rappel à 01h30 appartient à la journée de la veille et part bien à 01h30.
- Quand les push serveur sont activés sur un téléphone, le planificateur de l'app s'efface sur ce téléphone (pas de doublon avec l'app ouverte).
- Sécurité : la route exige `Authorization: Bearer <CRON_SECRET>` ; les fonctions SQL `push_*` exigent le même secret (stocké dans le Vault de Supabase). Aucune clé `service_role` n'est utilisée.

## Mise en place (une seule fois)

### 1. Migration SQL
Supabase → SQL Editor → New query → colle `supabase/migrations/2026-11-26_taches-libres-et-push.sql` → Run. (Ajouts seulement, rien n'est supprimé.)

### 2. Clés VAPID et secret
Dans un terminal : `npx web-push generate-vapid-keys` (une clé publique, une clé privée).
Choisis aussi un secret long au hasard : `openssl rand -hex 32`.

### 3. Variables sur Vercel (projet `hb-rappels` → Settings → Environment Variables, Production)
| Variable | Valeur | Sensitive |
|---|---|---|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | clé publique VAPID | non |
| `VAPID_PRIVATE_KEY` | clé privée VAPID | **oui** |
| `CRON_SECRET` | ton secret | **oui** |
| `VAPID_SUBJECT` (facultatif) | `mailto:toi@exemple.fr` | non |

Puis **redéploie** (la clé publique est intégrée à la construction de l'app).

### 4. Le secret dans Supabase
SQL Editor :
```sql
select vault.create_secret('TON_CRON_SECRET', 'hb_cron_secret');
```
(Le même secret que `CRON_SECRET` sur Vercel. Pour le changer plus tard : modifie la variable Vercel, redéploie, puis `select vault.update_secret(id, 'NOUVEAU') from vault.secrets where name = 'hb_cron_secret';`.)

### 5. Le planificateur (chaque minute)
SQL Editor : colle et exécute `supabase/push-cron.sql`. Vérifie qu'il tourne :
```sql
select jobname, schedule, active from cron.job;                                   -- « hb-push-tick », « * * * * * »
select status_code, left(content::text, 120) from net._http_response order by id desc limit 3;   -- 200 attendu
```
Pour l'arrêter : `select cron.unschedule('hb-push-tick');`

#### Alternative : cron-job.org (si tu préfères un service externe gratuit)
1. Crée un compte sur cron-job.org → *Create cronjob*.
2. URL : `https://hb-rappels.vercel.app/api/push/tick`, méthode **POST**, exécution **toutes les minutes**.
3. Onglet *Advanced* → *Headers* : `Authorization` = `Bearer TON_CRON_SECRET`. Enregistre.
Les étapes 1 à 4 restent nécessaires (le secret doit aussi exister dans le Vault).

## Sur l'iPhone
1. **iOS 16.4 minimum** (Réglages → Général → Informations).
2. Ouvre l'app dans **Safari**, touche **Partager → Sur l'écran d'accueil**, puis **ouvre l'app depuis l'icône** (pas depuis Safari : sans ça iOS n'autorise pas les notifications web).
3. Connecte-toi **dans l'app installée** (la session de Safari n'est pas partagée avec elle).
4. Réglages → **Activer les notifications** → **Autoriser**. Tu dois voir « ✅ Notifications activées (même app fermée) ».
5. Si besoin : Réglages iPhone → Notifications → HB Rappels → tout autoriser. Les modes **Concentration / Ne pas déranger** bloquent les notifications.

## Tester
1. Crée une tâche **à 5 minutes d'ici**, « Répéter toutes les 15 min » jusqu'à dans 1 heure, avec « jusqu'à ce que je coche ».
2. Ferme complètement l'app, verrouille le téléphone : la notification arrive à l'heure, puis toutes les 15 min.
3. Rouvre l'app, **coche la tâche** : plus aucun rappel ne part.

## Si rien n'arrive
- `select * from cron.job_run_details order by start_time desc limit 5;` : le job tourne-t-il ? `net._http_response` : code 200 ? (401 = secret différent entre Vercel et Vault ; 503 = variable manquante sur Vercel).
- L'abonnement existe-t-il ? `select count(*) from push_subscriptions;` (doit être ≥ 1 après « Activer les notifications »).
- Planning : un jour de **repos** ou une tâche d'une **autre équipe** ne sonne pas. Une tâche **en pause** non plus.
- iOS peut retarder ou regrouper des notifications pour économiser la batterie (de quelques secondes) : ce n'est pas un bogue de l'app.
