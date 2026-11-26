# HB Rappels

Maquette d'une PWA iPhone de **rappels de tâches pour les caissiers de Hashtag Bangers** (75 Grande Rue, Roubaix, ouvert 11h–2h).
Next.js 16 + Tailwind 4, comptes et données dans Supabase (plan gratuit) : chaque caissier a son espace perso.

## Lancer en local

```bash
cd rappels
npm install
cp .env.example .env.local   # puis remplis-le : voir docs/COMPTES.md
npm run dev        # http://localhost:3000
npm run check      # typecheck + lint + tests
```

Ouvre-la en vue mobile (390 px). Pour la tester sur ton iPhone, passe plutôt par le déploiement Vercel (HTTPS obligatoire pour la PWA et les notifications).

## Écrans

| Route | Écran |
|---|---|
| `/connexion`, `/inscription`, `/mot-de-passe-oublie`, `/reinitialiser` | Connexion, création de compte libre (une question par écran), mot de passe oublié |
| `/equipe`, `/equipe/[id]` | Responsable : liste des caissiers et assignation d'une tâche |
| `/taches` | Mes tâches : modifier, dupliquer, mettre en pause, supprimer (y compris les exemples) |
| `/` | Aujourd'hui : tâches du service triées par heure, cases à cocher, retards en évidence, progression « 3/6 faites » |
| `/tache/nouvelle`, `/tache/[id]` | Ajouter / modifier (titre, catégorie, heure, jours L M M J V S D, rappel, note) |
| `/semaine` | Un bloc par journée de service, avec l'équipe du jour |
| `/planning` | Mon planning : Jour / Soir / Repos pour chaque jour de la semaine |
| `/reglages` | Activer les notifications, aperçu + test, mon compte (prénom, déconnexion), rappels par défaut, import des tâches du téléphone, tâches d'exemple |
| `/apercu` | Faux écran verrouillé avec la notification (logo, titre, heure) |
| `/caisse` | Calculette de caisse : détail billets / pièces, total billets, total pièces, fond de caisse, recette, écart avec le ticket Z (calculs en centimes, dernier comptage gardé par utilisateur) |

## Comptes (Supabase)

Tout est expliqué pas à pas dans **[docs/COMPTES.md](docs/COMPTES.md)** : création du projet, `supabase/schema.sql` (tables + sécurité RLS), clés, `.env.local`, Vercel, test avec 2 comptes.

- Connexion et création de compte libres (email + mot de passe). **Connexion persistante** : cookies de 400 jours renouvelés par un proxy, jeton renouvelé en silence, lancement tolérant au hors-ligne, déconnexion seulement par le bouton (avec confirmation) : voir [docs/COMPTES.md](docs/COMPTES.md#connexion-persistante-rester-connecté-des-semaines).
- Rôles `caissier` (par défaut) et `responsable` (désigné à la main dans Supabase). Un caissier ne voit jamais les données d'un autre ; le responsable voit la liste des caissiers et peut leur assigner une tâche, rien de plus.
- Sécurité testée sur le vrai schéma SQL dans un Postgres embarqué : `npm test` (`tests/rls.test.ts`).
- `.env.local` : `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY` (publiques) ; pour les push : `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `CRON_SECRET` (voir `.env.example`).

## Journée de service et équipes (11h → 2h)

Tout est dans [`src/lib/service.ts`](src/lib/service.ts) (testé dans `tests/service.test.ts`) :

- Une **journée de service** va de **11h à 2h du matin**. Les **jours cochés sont des jours de service** : une journée « du lundi » commence lundi 11h et finit mardi 2h.
- Une heure **avant 02h00 appartient à la journée de la veille** : une tâche à 01h30 cochée « Lun » sonne dans la nuit de lundi à mardi. À 01h10 un mardi, « Aujourd'hui » affiche donc la **journée du lundi** ; à partir de 02h00 on bascule sur la journée du jour.
- Tri : 10h30 → 23h59, puis 00h00 → 01h55 (séparateur « 🌙 Après minuit »). Les heures proposées dans le formulaire vont de 10h00 (ouverture de caisse) à 01h55, par pas de 5 min.
- **Deux équipes** : Jour (11h → relève) et Soir (relève → 2h). L'**heure de relève** (18h00 ou 18h30, par défaut 18h30) se règle dans Réglages, sans toucher au code.
- **Mon planning** (`/planning`) : chaque caissier indique pour chaque jour de la semaine Jour, Soir ou Repos. « Aujourd'hui », « Semaine » et les rappels ne montrent que les tâches de son équipe (planning non indiqué : toutes les tâches ; repos : aucune).
- Chaque tâche est pour l'**équipe jour, l'équipe soir ou les deux**. Si l'heure sort de la plage de l'équipe (jour : 10h30 → relève, soir : relève → 2h), le formulaire affiche un avertissement mais n'empêche pas d'enregistrer.
- **Fuseau Europe/Paris**, quel que soit le fuseau du téléphone, avec passage heure d'été / heure d'hiver : un rappel à 01h30 part bien à 01h30 heure de Paris, y compris la nuit du changement d'heure.
- Le suivi (fait / rappel envoyé) est clé par `tâche@date-de-la-journée`, donc pas de confusion à minuit.
- **Tâches d'exemple** : 5 pour l'équipe jour et 5 pour l'équipe soir ; les heures de transmission (relève − 15 min) et de vérification du fond de caisse (relève + 5 min) suivent l'heure de relève au moment où on les ajoute.
- **Anciennes tâches** : elles restent visibles pour les deux équipes. Celles dont l'heure tombe entre 02h et 10h30 (hors des nouveaux horaires) sont signalées sur l'écran Aujourd'hui pour être corrigées ; rien n'est supprimé.

## Logo

Dépose ton fichier dans `public/logo.png` : il remplace automatiquement le placeholder « #HB » dans les en-têtes. Les icônes de l'app (écran d'accueil iPhone) sont dans `public/icons/` ; régénère-les depuis le vrai logo en adaptant `scripts/generate-icons.mjs` (`npm run icons`, nécessite Playwright).

## PWA

- `src/app/manifest.ts` → `/manifest.webmanifest` (standalone, rose #ff1f6e)
- `public/sw.js` : hors-ligne simple (réseau d'abord, cache en secours, désactivé en local), + gestion `push` et `notificationclick` déjà prête
- Icônes 192 / 512 / maskable / apple-touch-icon

## Tâches libres et notifications

- **Tâches libres** : bouton **+** toujours visible sur « Aujourd'hui ». Titre libre, note et catégorie facultatives ; une **date unique** ou une **répétition** (tous les jours ou jours choisis) ; heure de début ; équipe (Jour / Soir / Les deux). Chaque tâche (exemples compris) peut être modifiée, dupliquée, mise en pause ou supprimée depuis « Mes tâches ».
- **Fréquence des rappels, par tâche** : une seule fois à l'heure, ou **toutes les 15 / 30 / 45 / 60 min** (ou durée personnalisée) dans une fenêtre jusqu'à une heure de fin, avec l'option **« jusqu'à ce que je coche la tâche »** et un premier rappel **X min avant**. Les répétitions peuvent passer minuit. Le formulaire affiche un aperçu : « Tu seras notifié toutes les 30 min, de 11h00 à 18h00… ».
- **Partage de tâches entre collègues**, **ouverture de la tâche depuis la notification** (lien profond, connexion puis retour) et **relance automatique** après 5 min sans réaction (délai et maximum réglables en base) : **[docs/PARTAGE.md](docs/PARTAGE.md)**.
- **Vraies notifications push**, même app fermée : un planificateur (Supabase `pg_cron`, chaque minute) appelle `/api/push/tick`, qui envoie les rappels dus par Web Push (VAPID), sans doublon. Mise en place, iPhone et dépannage : **[docs/NOTIFICATIONS.md](docs/NOTIFICATIONS.md)**.
- Sans push serveur, l'app ouverte déclenche quand même les rappels (planificateur local) ; « Tester la notification » reste disponible dans Réglages.

## Mettre en ligne sur Vercel

1. Pousse le dépôt sur GitHub (déjà fait pour ce repo).
2. Sur <https://vercel.com/new>, importe `naiimlb/flipcalc-demo`.
3. **Root Directory : `rappels`** (le dépôt contient plusieurs apps). Framework : Next.js (détecté), Node 22.
4. Ajoute les variables d'environnement (Supabase : [docs/COMPTES.md](docs/COMPTES.md) ; notifications : [docs/NOTIFICATIONS.md](docs/NOTIFICATIONS.md)), puis Deploy.
5. Sur l'iPhone, ouvre l'URL `*.vercel.app` dans **Safari** → Partager → **Sur l'écran d'accueil**.

(CLI : `cd rappels && npx vercel` puis `npx vercel --prod`.)

## Architecture prévue pour la suite

`src/lib/store.ts` est la seule porte d'accès aux données (`useAppState` / `updateState`) : l'écran change tout de suite, puis Supabase suit en arrière-plan. `src/lib/push.ts` contient déjà l'abonnement push côté client (non branché).
