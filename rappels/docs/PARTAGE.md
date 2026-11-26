# Partage de tâches, ouverture depuis la notification, relances

Trois fonctions qui marchent ensemble. Tout le code SQL est dans `supabase/schema.sql` (section « PARTAGE ENTRE COLLÈGUES, LIEN PROFOND ET RELANCES ») et dans la migration prête à coller : `supabase/migrations/2026-11-27_partage-et-relances.sql`.

## 1. Partager une tâche

- **Partager** (page d'une tâche, « Mes tâches » ou formulaire de modification) → tu coches un ou plusieurs collègues dans la liste des caissiers inscrits. **Seul le prénom est visible** : ni l'email ni aucune autre donnée (la fonction SQL `colleagues()` ne renvoie que `id` et `prenom`, uniquement les caissiers, jamais toi ni les responsables).
- Deux modes :
  - **Chacun la fait** : la tâche apparaît chez chaque collègue, qui la coche de son côté.
  - **Un seul s'en occupe** : le premier qui appuie sur « Je m'en occupe » (ou coche « Fait ») la prend. La base garantit un seul gagnant même si deux personnes appuient en même temps. Les autres voient « 🙌 Prénom s'en occupe », la tâche est grisée, leurs rappels et relances s'arrêtent, et ils reçoivent une notification « Prénom s'en occupe : … ».
- Le collègue reçoit « Prénom t'a partagé une tâche : … », puis **accepte** (elle entre dans son planning) ou **refuse** (elle est masquée, il peut la reprendre dans « Mes tâches »). Tant qu'il n'a pas accepté : aucun rappel.
- Une tâche partagée apparaît dans le planning du collègue **quelle que soit son équipe** (jour/soir) mais respecte ses jours de **repos**.
- Seul le **créateur** peut modifier, mettre en pause, supprimer ou arrêter de partager. Les collègues peuvent seulement voir, prendre, cocher, reporter.
- La page de la tâche montre qui est concerné et où il en est : 📨 envoyé · 👀 vu · 🙋 en cours · ✅ fait.
- **Sécurité (RLS)** : un utilisateur ne lit que ses tâches et celles partagées avec lui ; il ne voit que ses propres lignes de partage ; il ne peut cocher que pour lui-même, et seulement une tâche à lui ou partagée **et acceptée**. Prouvé dans `tests/rls.test.ts` (base PostgreSQL réelle).

## 2. Toucher la notification ouvre la tâche

- Chaque notification contient le lien `/taches/<id>?j=<journée de service>`. Le service worker (`public/sw.js`) l'ouvre :
  - **app fermée** → nouvelle fenêtre directement sur la tâche ;
  - **app ouverte ou en arrière-plan** → la fenêtre existante est mise au premier plan et navigue vers la tâche **sans rechargement** (message `hb-open`) ; si la page ne répond pas (ancienne version), elle est rechargée sur le bon lien.
- **Pas connecté ?** → écran de connexion, puis retour exactement sur la tâche (`/connexion?suite=…`, lien interne uniquement). La session étant persistante, ça n'arrive presque jamais.
- La page de la tâche : titre, note, heure, équipe, collègues concernés, et de gros boutons **Vu · Je m'en occupe · Fait · Reporter de 10 min**. Les boutons sont dans la page (pas dans la notification) car iOS n'affiche pas toujours les boutons d'action.
- Ouvrir la page compte comme « Vu » (arrête les relances).

## 3. Relance automatique

Un **signe de vie** = ouvrir la notification/la page, appuyer sur Vu, Je m'en occupe, Fait, Reporter, ou cocher la tâche.

Chaque rappel envoyé crée une ligne dans `task_occurrences` (tâche, personne, envoyé à, nombre de relances, statut `sent / seen / taken / done / postponed / dropped`). Chaque minute, le planificateur (`pg_cron` → `/api/push/tick`, déjà en place) appelle `push_followups` :

- sans signe de vie depuis **5 min** → relance « 🔔 Rappel : titre » (même lien, même étiquette : elle remplace la précédente), puis toutes les 5 min ;
- **6 relances maximum** par rappel, puis abandon (`dropped / max`) ;
- jamais de relance si l'occurrence est vue, faite, prise par un collègue (mode « un seul »), reportée, ou si la tâche est en pause / les notifications coupées ;
- **pas de doublon** : la relance est « réservée » en base (`for update skip locked` + compteur mis à jour dans la même requête) avant l'envoi ;
- **Reporter de 10 min** : le rappel revient dans 10 min (« ⏱️ C'est reparti ») avec un compteur remis à zéro ;
- chaque nouveau créneau planifié (fréquence de la tâche) repart de zéro : c'est une nouvelle occurrence.

### Régler le délai et le maximum (sans toucher au code)

Dans Supabase → SQL Editor :

```sql
update public.app_config set value = 10 where key = 'relance_delay_min';  -- délai en minutes (défaut 5)
update public.app_config set value = 3  where key = 'relance_max';        -- nombre max de relances (défaut 6)
```

> Précision : le planificateur passe chaque minute, donc une relance part entre 5 min et 5 min 59 s après le rappel.
> Un partage ou une prise en charge est notifié(e) au plus tard environ 1 minute plus tard (même planificateur).

## Mise en place (une seule fois, dans cet ordre)

1. **Supabase → SQL Editor** : colle `supabase/migrations/2026-11-27_partage-et-relances.sql` → Run (peut être relancée sans risque). Attention : elle change la clé de `task_done` (une ligne par personne) : déploie la nouvelle version de l'app juste après.
2. **Déploie** l'app (Vercel).
3. Rien d'autre : le secret, le cron et les clés VAPID existants servent toujours.

## Tester avec 2 comptes sur 2 téléphones

Prépare : deux comptes caissiers (Léa sur le téléphone A, Tom sur le téléphone B), chacun a **activé les notifications** (Réglages → « Activer les notifications », sur iPhone : app installée sur l'écran d'accueil).

1. **Partage** — Léa crée une tâche à l'heure dans 3 minutes (rappel « à l'heure »), ouvre-la → **Partager** → coche Tom → mode « Un seul s'en occupe » → Partager.
2. **Réception** — Tom reçoit (≤ 1 min) « Léa t'a partagé une tâche : … ». Il touche la notification → la page de la tâche s'ouvre avec Accepter / Refuser → **Accepter**.
3. **Bon écran** — À l'heure, les deux reçoivent le rappel. Touche-le : app fermée, en arrière-plan ou ouverte, tu arrives sur la **page de la tâche** (essaie les trois cas).
4. **Relance** — Ne fais rien pendant 5 min : « 🔔 Rappel : … » arrive sur les deux téléphones, puis toutes les 5 min (6 fois max). Sur le téléphone de Léa, ouvre la notification : ses relances s'arrêtent (celles de Tom continuent).
5. **Je m'en occupe** — Tom appuie sur **Je m'en occupe**. Léa reçoit « Tom s'en occupe : … », sa tâche est grisée (« 🙌 Tom s'en occupe »), et elle ne reçoit plus de relance. Sur la page, le bloc « Concernés » montre Tom « 🙋 En cours ».
6. **Course** — Partage une 2ᵉ tâche en mode « Un seul s'en occupe », puis appuyez en même temps sur « Je m'en occupe » : un seul gagne, l'autre voit « Prénom s'en occupe déjà ».

## À savoir

- La création de compte est **libre** (pas de code d'équipe) : la liste des collègues contient donc toute personne inscrite comme caissier (prénoms seulement). Si l'app devient publique, remets un code d'équipe.
- Les relances sont des notifications **push** : un appareil sans push activé garde seulement les rappels locaux (app ouverte), sans relance.
