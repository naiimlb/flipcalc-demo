# Hifz

Application web de **mémorisation du Coran** (hifz), pensée pour l'iPhone et installable sur
l'écran d'accueil (PWA). Chaque verset suit une **répétition espacée** : l'app propose chaque
jour les versets à réviser et quelques nouveaux versets, que l'on récite de mémoire avant de
s'auto-évaluer. Chaque utilisateur a son **espace personnel** (compte e-mail + mot de passe) : sa
progression et son historique sont enregistrés sur son compte et retrouvés sur tous ses appareils.
Pas de publicité.

## Fonctionnalités

- **Programme** : une sourate entière ou une plage de versets (plusieurs programmes possibles).
  Recherche par numéro, translittération (« Fatiha », « Yasin ») ou nom arabe.
- **Session du jour** : les versets dus (dans l'ordre du mushaf) puis N nouveaux versets
  (limite réglable, 3 par défaut).
- **Mode récitation** :
  - un nouveau verset est d'abord découvert (texte, traduction, audio), puis masqué ;
  - un verset en révision est masqué d'emblée, avec le verset précédent comme repère et un
    indice (premier mot) ;
  - on révèle le verset, puis on s'évalue : « Je sais », « Hésitant » ou « À revoir ».
    Chaque bouton affiche le délai avant la prochaine révision.
  - un verset « À revoir » est reproposé une fois en fin de session.
- **Audio** verset par verset (EveryAyah) : lecture, boucle de 1 à 10 écoutes, vitesse de
  0,5× à 1,5×, 15 récitateurs (Alafasy par défaut). Les versets écoutés restent disponibles
  hors ligne. Un bouton garde l'audio de tout un programme.
- **Suivi** :
  - série de jours consécutifs (et record) ;
  - versets acquis, en cours et nouveaux ;
  - régularité et révisions par jour sur 30 jours (colonnes et tableau) ;
  - progression par sourate ;
  - révisions à venir.
- **Réglages** :
  - récitateur, répétitions, vitesse ;
  - police (Amiri Quran ou Scheherazade New) et taille du texte arabe ;
  - traduction française (Hamidullah) ;
  - thème système, clair ou sombre ;
  - nouveaux versets par jour ;
  - cache audio ;
  - **export et import JSON**.
- **Compte** : inscription et connexion par e-mail et mot de passe, « mot de passe oublié »,
  déconnexion. Chaque compte a ses propres données, y compris sur un appareil partagé.
- **Synchronisation** : l'app reste utilisable hors ligne. Les modifications sont gardées sur
  l'appareil puis envoyées au retour du réseau, et les autres appareils les récupèrent.
  Quand une même fiche est modifiée sur deux appareils, la modification la plus récente gagne ;
  le journal des révisions est toujours conservé en entier.
- **Reprise** : si l'appareil contenait déjà de la progression d'avant les comptes, l'app
  propose, à la première connexion, de la rattacher au compte.
- **Hors ligne** : l'app et les sourates déjà chargées fonctionnent sans réseau. Un bandeau
  discret l'indique, et un message clair s'affiche si un audio n'a pas encore été téléchargé.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript strict · Tailwind CSS 4 · Dexie 4
(IndexedDB, copie locale) · Supabase (comptes et synchronisation) · Zod 4 · Vitest · Playwright
(tests de bout en bout). Service worker écrit à la main
(`public/sw.js`), sans plugin. Polices auto-hébergées via `next/font`.

## Lancer en local

Prérequis : Node.js 22.12 ou plus récent.

```bash
cd hifz
npm ci
npm run dev          # http://localhost:3000
```

Sans configuration, l'app fonctionne en **mode local** (aucun compte, données sur l'appareil).
Pour activer les comptes, copiez `.env.example` en `.env.local` et renseignez les deux variables
(voir « Comptes et synchronisation »).

Le service worker n'est actif qu'en production : `npm run build && npm start`.

Pour essayer sur l'iPhone avant déploiement, lancez `npm run dev -- -H 0.0.0.0` et ouvrez
`http://<IP-de-l-ordinateur>:3000` sur le même Wi-Fi. L'installation et le hors-ligne
demandent cependant HTTPS : utilisez pour cela le déploiement Vercel.

## Scripts

| Commande | Rôle |
| --- | --- |
| `npm run dev` | Serveur de développement |
| `npm run build` / `npm start` | Build et serveur de production |
| `npm run typecheck` | Vérification TypeScript (routes typées comprises) |
| `npm run lint` | ESLint (règles Next.js, React, TypeScript) |
| `npm test` | Tests unitaires Vitest |
| `npm run check` | Les trois précédents |
| `npm run smoke -- http://localhost:3100` | Parcours complet dans Chromium au format iPhone, mode local (serveur lancé au préalable) |
| `npm run smoke:auth -- http://localhost:3101` | Parcours des comptes contre un faux serveur Supabase (build avec `NEXT_PUBLIC_SUPABASE_URL=https://fake.supabase.test`) |
| `npm run data:fetch` | Récupère à nouveau le texte et la liste des récitateurs |
| `npm run icons` | Régénère les icônes (Playwright) |

## Tests

- **Unitaires** (`tests/`, 104 tests) :
  - algorithme de répétition espacée : bonne réponse, hésitation, échec, retards, révision
    en avance, même jour, plancher et plafond, session du jour ;
  - dates (mois, années bissextiles, heure d'été) et statistiques ;
  - stockage IndexedDB (`fake-indexeddb`), export et import ;
  - intégrité des 114 fichiers coraniques (empreintes SHA-256, numérotation, basmala) ;
  - chargement réseau (hors ligne, HTTP, données altérées) ;
  - synchronisation avec un faux serveur : deux appareils, conflits, suppressions, échec réseau,
    lignes distantes invalides, import, migration de l'ancienne base ;
  - messages d'erreur d'authentification en français et pages protégées.
- **Test de fumée** (`scripts/smoke.mjs`) :
  - programme, session complète, suivi ;
  - thème sombre, export puis import ;
  - passage hors ligne : pages, versets, navigation par onglets, audio absent.
  
  Il enregistre des captures dans `.smoke/`. L'audio EveryAyah y est bloqué pour que le test
  ne dépende d'aucun service extérieur.

- **Test des comptes** (`scripts/smoke-auth.mjs`) : le navigateur parle à un faux serveur
  Supabase (authentification et API de données avec isolation par utilisateur), sans aucun appel
  réseau réel :
  - accès protégé, mauvais mot de passe, inscription ;
  - synchronisation vers le serveur et second appareil ;
  - modification hors ligne puis rattrapage ;
  - déconnexion, isolation entre deux comptes sur un même appareil ;
  - reprise des données d'une ancienne base.

La CI GitHub (`.github/workflows/hifz.yml`) lance typecheck, lint, tests, build et les deux tests de fumée.
Les captures y sont jointes comme artefact.

## Comptes et synchronisation

Les données de chaque utilisateur sont dans Supabase (Postgres) et copiées dans IndexedDB :
l'app lit et écrit toujours en local, puis synchronise en arrière-plan.

| Variable | Rôle |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clé publique (« publishable »). Elle peut être publique : l'accès aux données est protégé par la sécurité par ligne de la base. |

Sans ces variables, l'app fonctionne en mode local.

**Base de données** : `supabase/migrations/…_hifz_user_data.sql` crée quatre tables préfixées
`hifz_` (programmes, fiches, révisions, réglages). Chacune a la sécurité par ligne activée : un
utilisateur ne peut lire ni modifier que ses propres lignes, et le rôle anonyme n'a aucun
accès. Les tables peuvent cohabiter avec d'autres apps dans le même projet Supabase.

**À configurer dans le tableau de bord Supabase** (Authentication → URL Configuration) pour que
les liens des e-mails ramènent vers Hifz :

1. **Redirect URLs** : ajouter l'adresse de l'app suivie de `/**`, par exemple
   `https://hifz-eta.vercel.app/**`.
2. Vérifier que **Confirm email** correspond à ce que vous voulez : activé, l'inscription envoie
   un e-mail de confirmation ; désactivé, l'utilisateur est connecté tout de suite.

Si le projet Supabase est partagé avec une autre app, ses utilisateurs, ses e-mails et ses
règles d'inscription sont communs.

Fonctionnement de la synchronisation (`src/lib/sync/`) :

- chaque modification locale est inscrite dans une file d'envoi (`outbox`) ;
- à chaque passe : lecture des changements du serveur (curseur par table, avec chevauchement
  de 5 s), puis envoi de la file ; rien n'est perdu si le réseau coupe en cours de route ;
- une fiche porte la date de sa dernière modification (horloge de l'appareil) : la plus récente
  gagne, une suppression locale plus récente que la version du serveur reste supprimée ;
- les lignes du serveur sont validées avant d'être appliquées (une ligne invalide est ignorée) ;
- le journal des révisions est ajouté sans jamais être écrasé.

Limite connue : deux appareils qui modifient *la même fiche* dans la même seconde, hors ligne,
sont départagés par leur horloge ; si l'heure d'un appareil est très décalée, sa modification
peut l'emporter à tort.

## Déployer sur Vercel

1. Sur [vercel.com/new](https://vercel.com/new), importez le dépôt GitHub.
2. **Root Directory** : `hifz`. Next.js est détecté automatiquement.
3. Ajoutez les deux variables `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   (sans elles, l'app tourne en mode local, sans compte), puis déployez.

En ligne de commande : `cd hifz && npx vercel`, puis `npx vercel --prod`.

Chaque déploiement sert le texte coranique depuis `public/quran/` : l'app ne dépend pas de
la disponibilité d'AlQuran Cloud.

## Ajouter l'app à l'écran d'accueil de l'iPhone

1. Ouvrez l'adresse Vercel dans **Safari**.
2. Touchez le bouton **Partager** (carré avec une flèche), puis **Sur l'écran d'accueil**.
3. Gardez le nom « Hifz » et touchez **Ajouter**.
4. Ouvrez Hifz depuis l'icône une première fois avec du réseau. Choisissez un programme : le
   texte des sourates choisies est enregistré automatiquement. Dans **Programme**, touchez
   « Garder l'audio hors ligne » pour pouvoir écouter sans réseau.

Les données sont enregistrées sur votre compte et copiées dans l'app installée, séparément de
Safari : connectez-vous une fois dans l'app installée. Vous pouvez aussi faire
**Réglages → Exporter** pour une sauvegarde de plus : la feuille de partage d'iOS propose
« Enregistrer dans Fichiers ».

## Architecture

```
hifz/
  scripts/fetch-quran.mjs     récupération et contrôle du texte (voir plus bas)
  public/quran/surah/         114 sourates (JSON), générées par le script
  public/sw.js                service worker
  src/
    app/                      routes : / · /hifz/programme · /hifz/session · /hifz/suivi · /reglages · /sources
    modules/
      registry.ts             modules déclarés et onglets
      today.tsx               carte « Aujourd'hui » de chaque module
      hifz/                   écrans et composants du hifz
      assistant/, quotidien/  modules prévus (déclaration seulement)
    components/               interface générique (boutons, ArabicText, lecteur audio, réglages)
      auth/, providers/       connexion, garde d'accès, base du compte, reprise des données
    lib/
      srs/                    répétition espacée (pur, sans dépendance au navigateur)
      stats/                  série, régularité, progression (pur)
      quran/                  catalogue, recherche, URL audio, chargement vérifié
      storage/                Dexie : schéma, opérations, file d'envoi, export/import, réglages
      sync/                   moteur de synchronisation (indépendant du serveur), contrôleur, adaptateur Supabase
      auth/                   configuration, client Supabase, messages d'erreur en français
      audio/                  cache audio hors ligne et lecteur (boucle, vitesse)
  tests/
```

### Ajouter un module (par exemple l'assistant)

1. Créez `src/modules/assistant/` avec son code. Mettez `status: "active"` dans son
   `manifest.ts` et déclarez ses onglets.
2. Ajoutez ses écrans sous `src/app/assistant/`. Les routes serveur (`route.ts`) sont
   possibles, car l'app n'est pas un export statique.
3. Facultatif : ajoutez une carte dans `src/modules/today.tsx` pour l'écran « Aujourd'hui ».
4. S'il a besoin de stockage, ajoutez ses tables dans une nouvelle version du schéma
   (`db.version(2).stores({ … })` dans `lib/storage/db.ts`), sans toucher aux tables existantes.

La barre d'onglets, l'accueil et les réglages communs s'adaptent sans autre changement.

## Données coraniques

**Règle : le texte arabe n'est jamais saisi ni modifié à la main.** Il est récupéré par
`scripts/fetch-quran.mjs`, auprès de trois sources :

| Donnée | Source |
| --- | --- |
| Texte arabe, rasm uthmani | [AlQuran Cloud](https://alquran.cloud/api), édition `quran-uthmani` (texte du [projet Tanzil](https://tanzil.net)) |
| Traduction française | AlQuran Cloud, édition `fr.hamidullah` (Muhammad Hamidullah) |
| Audio et récitateurs | [EveryAyah](https://everyayah.com) (`data/recitations.js`, présence des fichiers vérifiée) |

Le script vérifie :

- 114 sourates et 6 236 versets ;
- l'ordre et la numérotation ;
- l'alignement de la traduction ;
- l'absence d'espaces parasites.

Il échoue au moindre écart. Seules deux opérations techniques, vérifiées, sont appliquées :

1. Retrait du caractère invisible U+FEFF (BOM) en tête du verset 1:1.
2. AlQuran Cloud colle la basmala au début du verset 1 des sourates 2 à 114 (sauf 9). Elle
   n'est retirée que si le début du verset est identique au verset 1:1 (ou à sa variante
   Tanzil avec chadda sur le bā', présente en 95 et 97, dérivée de 1:1). Elle est alors
   affichée au-dessus de la sourate.

Chaque fichier est référencé par son empreinte SHA-256 dans
`src/lib/quran/generated/quran-index.json`. L'app la vérifie avant d'enregistrer une
sourate sur l'appareil, et les tests la vérifient à chaque exécution.

Pour mettre à jour les données : `npm run data:fetch`. Derrière un proxy, utilisez
`NODE_USE_ENV_PROXY=1 npm run data:fetch`.

Les sources sont citées dans l'app (page **Sources**, et mention sous chaque verset révélé).
Le texte Tanzil est reproduit sans modification, avec un lien vers tanzil.net. La traduction
reste soumise aux conditions de ses ayants droit : usage personnel et non commercial.

## Répétition espacée

SM-2 adapté à trois boutons, dans `src/lib/srs/scheduler.ts` :

| Bouton | Facilité | Intervalles |
| --- | --- | --- |
| Je sais | +0,10 | 1 j, 3 j, puis intervalle × facilité |
| Hésitant | −0,14 | 1 j, 2 j, puis intervalle × 1,2 |
| À revoir | −0,20 | retour à demain, série remise à zéro |

Règles complémentaires :

- **Facilité** : comprise entre 1,3 et 3,0. Il n'y a pas de pénalité si le verset n'a encore
  jamais été réussi.
- **Retards** : si le verset est encore su, la moitié des jours de retard est créditée (un
  quart pour « Hésitant »).
- **Révision en avance** : l'intervalle ne diminue jamais.
- **Même jour** : une seule révision compte. Une seconde note ne peut que rapprocher la
  révision.
- **États** : un verset est *nouveau*, puis *en cours*, puis *acquis* quand son intervalle
  atteint 21 jours. Un échec le repasse « en cours ».
- **Plafond** : 180 jours, pour qu'un verset acquis revienne régulièrement.
- **Dates** : tout raisonne en jours locaux (AAAA-MM-JJ), sans aléa, avec la date du jour
  passée en paramètre.

## Confidentialité

- Avec un compte : votre adresse e-mail, votre programme, vos fiches de révision, votre
  historique et vos réglages sont enregistrés dans Supabase, accessibles uniquement avec votre
  compte. Ni publicité, ni suivi.
- Sans compte (mode local) : aucune donnée ne quitte l'appareil.
- Dans tous les cas, l'audio est téléchargé depuis EveryAyah.
