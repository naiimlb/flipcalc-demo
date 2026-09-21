# CinéMood

> Arrête de chercher. Commence à regarder.

CinéMood recommande un film ou une série en croisant quatre choses : **ce que
tu aimes**, **ton humeur du moment**, **ta génération**, et **les plateformes
auxquelles tu es réellement abonné**. Le dernier point est une règle dure :
un titre indisponible sur tes services n'apparaît jamais.

Application web mobile-first, installable sur l'écran d'accueil d'un iPhone.

---

## Sommaire

1. [Démarrer en deux minutes](#1-démarrer-en-deux-minutes)
2. [Architecture](#2-architecture)
3. [L'algorithme de recommandation](#3-lalgorithme-de-recommandation)
4. [Le schéma de base de données](#4-le-schéma-de-base-de-données)
5. [Tests](#5-tests)
6. [Les trois profils de démonstration](#6-les-trois-profils-de-démonstration)
7. [Mode démo et mode complet](#7-mode-démo-et-mode-complet)
8. [Sécurité](#8-sécurité)

Pour **créer les comptes, obtenir les clés et mettre en ligne**, tout est dans
[`DEPLOIEMENT.md`](DEPLOIEMENT.md) — écrit pas à pas, sans rien supposer connu.

---

## 1. Démarrer en deux minutes

```bash
cd cinemood
npm install
cp .env.example .env.local   # facultatif : l'app démarre sans aucune clé
npm run dev                  # http://localhost:3000
```

Sans clé d'API, l'app démarre en **mode démo** : elle tourne sur un catalogue
local de 145 titres (1963 → 2024, films et séries, 16 plateformes). Tout est
fonctionnel — test de personnalité, humeurs, filtrage par plateforme, listes —
seules les données sont locales au lieu de venir de TMDB.

Autres commandes :

| Commande | Effet |
|---|---|
| `npm test` | Les 96 tests unitaires du moteur (lanceur natif de Node) |
| `npm run typecheck` | Vérification TypeScript, sans génération |
| `npm run demo:profils` | Affiche les sélections de trois profils fictifs |
| `node scripts/generer-icones.mjs` | Régénère les icônes et écrans de lancement |

---

## 2. Architecture

```
cinemood/
├── src/
│   ├── app/
│   │   ├── page.tsx                    Vitrine publique
│   │   ├── connexion/                  Inscription et connexion
│   │   ├── bienvenue/
│   │   │   ├── plateformes/            Étape 1 — OBLIGATOIRE
│   │   │   └── test/                   Étape 2 — test en 10 écrans
│   │   ├── (app)/                      Zone connectée, avec barre d'onglets
│   │   │   ├── accueil/                Humeur + sélection du soir
│   │   │   ├── decouvrir/              Recherche et filtres
│   │   │   ├── ma-liste/               À voir / déjà vus
│   │   │   └── profil/                 Plateformes, préférences, compte
│   │   └── api/                        SEUL endroit qui parle à TMDB et à Claude
│   │       ├── recommandations/
│   │       ├── recherche/
│   │       ├── bande-annonce/[type]/[id]/
│   │       └── pourquoi/
│   ├── lib/
│   │   ├── reco/                       ⭐ Le moteur, isolé et testé
│   │   ├── tmdb/                       Accès TMDB (server-only)
│   │   ├── supabase/                   Clients navigateur / serveur
│   │   ├── etat/magasin.tsx            État partagé + persistance
│   │   └── validation.ts               Contrôle des corps de requête
│   ├── data/catalogue-demo.ts          Catalogue du mode démo
│   └── components/                     Interface
├── supabase/schema.sql                 Tables + Row Level Security
├── scripts/
│   ├── demo-profils.ts                 Démonstration des trois profils
│   └── generer-icones.mjs              Icônes et écrans de lancement PWA
└── public/                             Manifeste, service worker, icônes
```

**Le principe qui structure tout** : le moteur (`src/lib/reco/`) ne dépend de
rien — ni de React, ni de Next, ni de TMDB, ni du réseau. Il reçoit un
catalogue, un profil, un historique et un contexte ; il renvoie une liste
classée. C'est ce qui le rend testable en une milliseconde et réglable sans
toucher à l'interface.

---

## 3. L'algorithme de recommandation

Tout le calcul vit dans `src/lib/reco/`, et **toutes les pondérations sont
rassemblées dans [`poids.ts`](src/lib/reco/poids.ts)** — un seul fichier à
ouvrir pour rendre l'app plus nostalgique, plus audacieuse ou plus exigeante
sur la qualité.

### Le score d'un titre

```
score =  0,42 · affinité de goûts      (vecteur utilisateur)
       + 0,14 · bonus d'époque          (nostalgie + culture de génération)
       + 0,24 · correspondance humeur   (humeur × contexte × durée)
       + 0,13 · qualité                 (note TMDB amortie par les votes)
       + 0,07 · fraîcheur               (récence + tendance)
       −        pénalités
```

Chaque composante est ramenée entre 0 et 1 avant pondération : les réglages de
`poids.ts` restent donc lisibles.

### A. Le vecteur de goûts — `profil.ts`

Sept facettes, chacune un dictionnaire `clé → poids` entre −1 et +1 : genres,
mots-clés TMDB, réalisateurs, acteurs, pays, décennies, tonalités.

Il est **amorcé par le test** (genres adorés/détestés, 5 titres préférés,
titres d'enfance, ambiance préférée), puis **déplacé à chaque interaction**.

Deux règles de conception :

- Un genre explicitement rejeté au test ne peut pas être « racheté » par un
  titre préféré : le malus est réappliqué en dernier.
- Les facettes à grand vocabulaire (mots-clés, casting) sont dites *creuses* :
  si aucune de leurs clés n'est connue du profil, la facette est **ignorée**
  plutôt que comptée comme neutre. Un film n'est jamais pénalisé parce qu'on
  ne connaît pas encore ses acteurs.

### B. L'adaptation à l'époque — `epoque.ts`

- **Nostalgie** : bonus maximal pour les titres sortis entre les 8 et les
  20 ans de la personne — la fenêtre où l'on se construit une cinéphilie.
- **Culture de génération** : décroissance douce de part et d'autre.
- **Garde-fou anti-passéisme** : toute sortie des trois dernières années
  conserve un bonus plancher de 0,62. Impossible d'enfermer quelqu'un dans
  ses souvenirs.
- **Classification d'âge** : filtrage *strict*, jamais une pénalité. Un mineur
  ne voit aucun titre -16 ou -18, et une soirée « en famille » plafonne tout
  le monde au tout public.

### C. Humeur et contexte — `humeur.ts` + `poids.ts`

Neuf humeurs, chacune décrite par des genres bonifiés, des genres à malus, des
tonalités, des rythmes et une durée idéale. Trois éléments de contexte s'y
ajoutent :

| Contexte | Effet |
|---|---|
| Après 22 h | La durée pèse deux fois plus lourd (0,34 contre 0,16) |
| Week-end | Les formats longs sont pardonnés |
| Avec qui | « En famille » impose le tout public ; « entre potes » bonifie comédie, action, horreur |

### D. Pénalités — `score.ts`

Déjà vu et aimé (0,55), déjà vu et détesté (1,5 → éliminatoire), refusé (1,5),
déjà dans la liste (0,8), par genre détesté (0,45), sur-exposition (0,09 par
proposition, plafonnée à 0,36), rotation sur sept jours (0,5), dépassement de
la durée maximale (0,22 par demi-heure), sujet à éviter (1,5 → éliminatoire).

### E. Diversité et découverte — `diversite.ts`

- **MMR** (λ = 0,72) : à chaque tour, on retient le titre qui maximise
  `λ · pertinence − (1 − λ) · similarité_max_avec_les_déjà_choisis`.
  La similarité croise genres, mots-clés, réalisateur, décennie, et détecte
  les volets d'une même franchise.
- **Quotas** : trois titres maximum par genre principal, un seul par
  réalisateur. Avec une soupape : si les quotas bloquent tout, on les relâche
  plutôt que de rendre une liste trop courte.
- **Pépites** : ~18 % de titres peu exposés mais compatibles. Le seuil de
  « peu exposé » est le 35ᵉ centile du vivier du moment, pas une constante —
  la popularité TMDB n'a pas la même échelle d'un catalogue à l'autre.
- **Rotation** : un titre proposé cette semaine cède sa place.

### F. Apprentissage continu — `profil.ts`

Neuf signaux déplacent le vecteur, avec des amplitudes **symétriques** :
un « je n'ai pas aimé » (−0,16) pèse exactement autant qu'un « j'ai adoré »
(+0,16). C'est vérifié par un test dédié.

### G. Transparence — `explication.ts`

Chaque carte porte une phrase construite à partir du détail du score : la
référence citée (« Parce que tu as adoré *Interstellar* »), l'humeur du
moment, et un second argument au plus (nostalgie, pépite, qualité, fraîcheur).
Les formulations tournent d'une carte à l'autre : dix phrases identiques
sonneraient comme un robot.

L'API Claude, **si** une clé est configurée, ne fait que reformuler cette
phrase. Sans clé, ou en cas d'échec, la phrase locale s'affiche telle quelle :
l'IA est un confort, jamais une dépendance.

---

## 4. Le schéma de base de données

Quatre tables, toutes protégées par Row Level Security (`supabase/schema.sql`) :

| Table | Rôle | Clé |
|---|---|---|
| `profils` | Résultat du test, plateformes, vecteur de goûts | `id` = `auth.users.id` |
| `liste` | À voir / déjà vus, avec copie du titre | `(utilisateur_id, titre_id)` |
| `interactions` | Journal des signaux, pour l'apprentissage | `id` |
| `expositions` | Combien de fois un titre a été proposé | `(utilisateur_id, titre_id)` |

Une seule règle de sécurité, appliquée partout : **chacun ne voit et ne
modifie que ses propres lignes**. Un trigger crée le profil à l'inscription ;
une fonction `supprimer_mon_compte()` permet l'effacement depuis l'app, la
cascade nettoyant le reste.

---

## 5. Tests

```bash
npm test
```

96 tests, exécutés par le lanceur natif de Node — **aucune dépendance de
test** à installer. Ils couvrent :

- `epoque.test.ts` — générations, fenêtre de nostalgie, plancher d'actualité,
  et surtout : *aucun contenu -16/-18 pour un mineur*, *plafond « en famille »*.
- `score.test.ts` — amortissement bayésien de la note, facettes creuses,
  chaque pénalité.
- `profil.test.ts` — amorçage par le test, symétrie des signaux, pureté des
  fonctions.
- `humeur.test.ts` — « adrénaline » ≠ « fatigué », effet de l'heure tardive.
- `diversite.test.ts` — le MMR ouvre bien la sélection, quotas, pépites.
- `moteur.test.ts` — bout en bout sur le vrai catalogue : filtrage strict,
  rotation, refus définitifs, effet de l'humeur, états vides.

Deux de ces tests ont d'ailleurs révélé de vrais défauts pendant le
développement (une définition de « pépite » trop large, et une hypothèse
fausse sur l'ordre de sortie du MMR).

---

## 6. Les trois profils de démonstration

```bash
npm run demo:profils
```

Trois personnes fictives volontairement éloignées :

| | Camille, 58 ans | Yanis, 31 ans | Louna, 15 ans |
|---|---|---|---|
| Plateformes | Canal+, arte.tv, france.tv | Netflix, Max, Prime Video | Netflix, Crunchyroll, Disney+ |
| Goûts | Drame, histoire, polar français | SF, action, thriller | Animation, fantastique, aventure |
| Contexte | Dimanche 21 h, seule, réflexion | Vendredi 22 h, entre potes, adrénaline | Mercredi 19 h, en famille, évasion |
| Éligibles après filtrage | 47 / 145 | 95 / 145 | 25 / 145 |

**Recouvrement des sélections** : Camille ∩ Yanis = 1/10, Camille ∩ Louna =
0/10, Yanis ∩ Louna = 0/10. Le script vérifie aussi, à chaque exécution, que
zéro titre hors plateforme et zéro titre interdit à l'âge ne passe — et que la
soirée en famille de Louna ne contient que du tout public.

---

## 7. Mode démo et mode complet

| | Mode démo | Mode complet |
|---|---|---|
| Déclencheur | `TMDB_ACCESS_TOKEN` vide | Jeton TMDB renseigné |
| Catalogue | 145 titres locaux | TMDB, région FR |
| Affiches | Composition typographique déterministe | Vraies affiches TMDB |
| Bandes-annonces | Recherche YouTube | Lecteur intégré, vidéo officielle |
| Disponibilités | Figées, illustratives | `/watch/providers` en temps réel |
| Comptes | Local à l'appareil | Supabase, synchronisé |

En mode complet, les recommandations se construisent **en deux passes** :
`/discover` filtre d'abord par plateforme et par classification d'âge côté
TMDB (quelques appels, mis en cache), puis seuls les 20 titres présélectionnés
sont détaillés — durée, réalisateur, casting, mots-clés, bande-annonce. Une
vingtaine d'appels au lieu de plusieurs centaines : c'est ce qui rend l'écran
utilisable en 4G.

---

## 8. Sécurité

- **Aucune clé secrète dans le navigateur.** `TMDB_ACCESS_TOKEN` et
  `ANTHROPIC_API_KEY` ne sont lues que dans des modules marqués
  `import 'server-only'` : une erreur de build survient si l'un d'eux est
  importé côté client.
- La clé `NEXT_PUBLIC_SUPABASE_ANON_KEY` est publique **par conception** ; ce
  sont les règles RLS qui protègent les données. La clé `service_role`
  n'apparaît nulle part dans ce projet.
- Les corps de requête sont normalisés par `src/lib/validation.ts` : types,
  bornes, longueurs maximales. Un champ absurde donne une erreur claire, pas
  un plantage.
- Le service worker ne met jamais en cache les routes `/api/`.
- Les erreurs TMDB ne sont pas renvoyées telles quelles au client.

---

## Mentions

Ce produit utilise l'API TMDB mais n'est pas approuvé ni certifié par TMDB.

Les pastilles de plateformes sont des marqueurs colorés portant des
initiales : **aucun logo de marque déposée n'est embarqué** dans le projet.

Les disponibilités du catalogue de démonstration sont *illustratives* et
figées ; elles servent à démontrer le filtrage strict. Les vraies
disponibilités viennent de TMDB dès que le jeton est configuré.
