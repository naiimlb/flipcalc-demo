# HB Rappels

Maquette d'une PWA iPhone de **rappels de tâches pour les caissiers de Hashtag Bangers** (75 Grande Rue, Roubaix, 19h–3h).
Next.js 16 + Tailwind 4, données en `localStorage`, pas de backend.

## Lancer en local

```bash
cd rappels
npm install
npm run dev        # http://localhost:3000
npm run check      # typecheck + lint + tests
```

Ouvre-la en vue mobile (390 px). Pour la tester sur ton iPhone, passe plutôt par le déploiement Vercel (HTTPS obligatoire pour la PWA et les notifications).

## Écrans

| Route | Écran |
|---|---|
| `/` | Aujourd'hui : tâches du service triées par heure, cases à cocher, retards en évidence, progression « 3/6 faites » |
| `/tache/nouvelle`, `/tache/[id]` | Ajouter / modifier (titre, catégorie, heure, jours L M M J V S D, rappel, note) |
| `/semaine` | Un bloc par jour de service |
| `/reglages` | Activer les notifications, aperçu + test, nom du poste, remise à zéro des exemples |
| `/apercu` | Faux écran verrouillé avec la notification (logo, titre, heure) |
| `/caisse` | Comptage de caisse guidé : une ligne par coupure, total automatique, comparaison avec le montant attendu (calculs faits par le code, sans IA) |

## Le service de nuit (19h → 3h)

Tout est dans [`src/lib/service.ts`](src/lib/service.ts) (testé dans `tests/service.test.ts`) :

- Les **jours cochés sont des jours de service** : un service « du lundi » commence lundi 19h et finit mardi 3h.
- Une heure **avant 03h00 appartient au service de la veille** : une tâche à 01h30 cochée « Lun » sonne dans la nuit de lundi à mardi.
- À 01h10 un mardi, « Aujourd'hui » affiche donc le **service du lundi**. À partir de 03h00 on bascule sur le service du jour.
- Tri : 19h00 → 23h59, puis 00h00 → 02h55 (séparateur « 🌙 Après minuit » dans la liste).
- Le suivi (fait / rappel envoyé) est clé par `tâche@date-du-service`, donc pas de confusion minuit.
- Les heures proposées dans le formulaire vont de 19h à 02h55 (pas de 5 min).

## Logo

Dépose ton fichier dans `public/logo.png` : il remplace automatiquement le placeholder « #HB » dans les en-têtes. Les icônes de l'app (écran d'accueil iPhone) sont dans `public/icons/` ; régénère-les depuis le vrai logo en adaptant `scripts/generate-icons.mjs` (`npm run icons`, nécessite Playwright).

## PWA

- `src/app/manifest.ts` → `/manifest.webmanifest` (standalone, rose #ff1f6e)
- `public/sw.js` : hors-ligne simple (réseau d'abord, cache en secours, désactivé en local), + gestion `push` et `notificationclick` déjà prête
- Icônes 192 / 512 / maskable / apple-touch-icon

## Notifications : ce qui est simulé

- **Tester la notification** (Réglages et Aperçu) : bandeau dans l'app + notification système si autorisée, 5 s après le clic.
- Tant que l'app est **ouverte**, un planificateur local (`src/components/Reminders.tsx`) déclenche les rappels à l'heure choisie.
- App fermée ou iPhone verrouillé : il faut le vrai Web Push → [docs/PUSH.md](docs/PUSH.md) (VAPID, backend, cron, prérequis iPhone).

## Mettre en ligne sur Vercel

1. Pousse le dépôt sur GitHub (déjà fait pour ce repo).
2. Sur <https://vercel.com/new>, importe `naiimlb/flipcalc-demo`.
3. **Root Directory : `rappels`** (le dépôt contient plusieurs apps). Framework : Next.js (détecté), Node 22.
4. Deploy. Aucune variable d'environnement n'est nécessaire pour la maquette.
5. Sur l'iPhone, ouvre l'URL `*.vercel.app` dans **Safari** → Partager → **Sur l'écran d'accueil**.

(CLI : `cd rappels && npx vercel` puis `npx vercel --prod`.)

## Architecture prévue pour la suite

`src/lib/store.ts` est la seule porte d'accès aux données (`useAppState` / `updateState`) : c'est lui qu'on remplacera par des appels API. `src/lib/push.ts` contient déjà l'abonnement push côté client (non branché).
