# Forma3D

Décrivez un problème ou un objet (« une solution pour ranger mes câbles », « un support de
téléphone »…) : Forma3D analyse la demande avec Claude, propose une solution fabricable et la
modélise en **3D interactive** (rotation, zoom, fil de fer, vue éclatée, matières), avec
dimensions, matériaux, étapes de fabrication, coût estimé et exports **GLB / STL / PNG**.

- Next.js 15 (App Router) · TypeScript · Tailwind · Framer Motion
- React Three Fiber / Three.js (rendu néon « hologramme » ou réaliste)
- Supabase : authentification, base de données, Row Level Security, rôles admin / utilisateur
- API Claude côté serveur (sortie JSON structurée, validée par Zod)
- Déployable sur Vercel

## Lancer en local

```bash
cd forma3d
npm install
npm run dev            # http://localhost:3000
```

Sans aucune variable d'environnement, le site démarre en **mode démo** : quatre projets
d'exemple, génération par le « modèle d'exemple le plus proche », rien n'est sauvegardé.
Ajoutez `ANTHROPIC_API_KEY` dans `.env.local` pour que les demandes passent par Claude
(en mode démo, Claude n'est appelé qu'en développement, jamais en production).

Pour la version complète (comptes, historique, admin) :

```bash
cp .env.example .env.local   # puis remplir les valeurs (voir ci-dessous)
npm run dev
```

## Mise en place de Supabase

1. Créez un projet sur [supabase.com](https://supabase.com).
2. **SQL Editor** → collez et exécutez `supabase/migrations/20261101000000_forma3d_schema.sql`
   (ou `supabase db push` avec la CLI). Le script crée les tables, la RLS, les quotas et les
   fonctions d'administration.
3. **Authentication → URL Configuration** : *Site URL* = l'URL du site
   (`http://localhost:3000` en local) et ajoutez `https://votre-domaine/auth/callback` aux
   *Redirect URLs*.
4. **Project Settings → API** : copiez l'URL, la clé publique (*publishable* / *anon*) et la clé
   secrète (*secret* / *service_role*) dans `.env.local`.
5. Lancez le site : il redirige vers **`/setup`** pour créer le compte administrateur.

### Premier lancement : `/setup`

`/setup` affiche une liste de contrôle de la configuration puis crée le **premier compte, qui
devient administrateur**. Dès qu'un administrateur existe, la page se verrouille (vérifié en base
par `setup_required()` ; deux installations simultanées sont sérialisées par un verrou SQL).
Sur un déploiement public, définissez **`SETUP_TOKEN`** : le jeton est alors exigé pour créer
l'administrateur.

## Variables d'environnement

| Nom | Rôle | Obligatoire |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet Supabase | oui (sinon mode démo) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clé publique Supabase (navigateur, protégée par la RLS) | oui (sinon mode démo) |
| `SUPABASE_SECRET_KEY` | Clé secrète Supabase, **serveur uniquement** (`SUPABASE_SERVICE_ROLE_KEY` accepté aussi) | oui |
| `ANTHROPIC_API_KEY` | Clé Claude. Peut aussi être saisie dans `/admin/cles` | recommandé |
| `SECRETS_ENCRYPTION_KEY` | 32 octets en base64 : chiffre les clés saisies dans l'admin | recommandé |
| `SETUP_TOKEN` | Jeton demandé par `/setup` | recommandé en production |
| `MESHY_API_KEY` | Fournisseur text-to-3D expérimental | non |
| `NEXT_PUBLIC_SITE_URL` | URL publique (liens des emails) | non |

Générer une clé de chiffrement :

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## Déployer sur Vercel

1. Importez le dépôt sur Vercel et choisissez **Root Directory = `forma3d`** (framework Next.js
   détecté automatiquement).
2. Ajoutez les variables d'environnement ci-dessus (Production + Preview).
3. Déployez, puis ajoutez `https://<votre-projet>.vercel.app/auth/callback` aux *Redirect URLs*
   de Supabase et réglez la *Site URL*.
4. Ouvrez `/setup` pour créer l'administrateur.

La route de génération déclare `maxDuration = 300` s (une génération dure en général 30 à 90 s).
Sur l'offre Hobby sans Fluid Compute, la limite est plus basse : baissez l'effort de réflexion
ou choisissez un modèle plus rapide dans `/admin/ia`.

## Fonctionnement

1. L'utilisateur écrit sa demande (photo de référence optionnelle, réduite à 1024 px dans le
   navigateur).
2. `POST /api/generate` valide l'entrée (Zod), vérifie l'origine, puis appelle la fonction SQL
   `create_design_request` qui applique **atomiquement** la pause globale, les quotas par heure
   et par jour, la limite de générations simultanées, et insère la demande.
3. Le serveur appelle Claude (`claude-opus-5-5` par défaut, réflexion adaptative, effort
   réglable) avec une **sortie JSON structurée** (`output_config.format`) : analyse, solution,
   dimensions, matériaux, étapes, coût, recommandations et **description 3D** (liste de formes :
   pavé arrondi, cylindre, tube, cône, sphère, tore, capsule, extrusion de profil avec trous ;
   positions, tailles, rotations, couleurs, matériaux). En cas de refus des classifieurs de
   sécurité, le repli serveur (`fallbacks: "default"`) relance la demande sur le modèle
   recommandé.
4. Le JSON est validé et **normalisé** par Zod (bornes, couleurs, nombre de pièces, identifiants
   uniques), enregistré dans Supabase avec la réponse brute (table réservée aux admins), puis
   converti en scène React Three Fiber.
5. Exports côté navigateur : **GLB** (mètres, couleurs PBR), **STL** binaire (millimètres, pour
   les trancheurs d'impression 3D) et **capture PNG**.

Sans clé Claude, l'option « Modèles d'exemple si l'IA est absente » (activée par défaut) produit
le modèle d'exemple le plus proche, clairement signalé à l'écran.

### Brancher un service text-to-3D (Meshy, Tripo…)

`src/lib/providers/types.ts` définit l'interface `ModelProvider` (`start` lance une tâche,
`poll` suit son avancement). Les primitives de Claude restent toujours disponibles ; quand le
fournisseur externe a fini, la visionneuse propose « Voir le maillage IA ». Le GLB passe par
`/api/requests/[id]/asset/file` (l'URL du fournisseur n'est jamais exposée et seuls ses hôtes
déclarés sont autorisés). Un adaptateur **Meshy expérimental** est fourni
(`src/lib/providers/meshy.ts`, à valider avec la documentation à jour) ; pour en ajouter un
autre, implémentez l'interface et enregistrez-le dans `src/lib/providers/index.ts`, puis
ajoutez son identifiant à `PROVIDERS_3D` (`src/lib/settings.ts`).

## Espace administrateur (`/admin`)

| Page | Contenu |
| --- | --- |
| Vue d'ensemble | Demandes, taux de réussite, utilisateurs, durée moyenne, jetons, générations par jour, dernières erreurs |
| Apparence | Nom du site, textes du titre, sous-titre, pied de page, couleurs du dégradé et d'accent, logo, **aperçu en direct** |
| Prompt IA | Éditeur du prompt système, modèle, effort, jetons max, fournisseur 3D ; bouton **Tester** (appel réel, rien n'est enregistré, aperçu 3D du résultat) |
| Clés d'API | Saisie / remplacement / suppression ; chiffrées en AES-256-GCM, jamais renvoyées au navigateur (seuls les 4 derniers caractères) |
| Demandes | Toutes les demandes, filtre par statut, JSON validé et réponse brute, suppression |
| Utilisateurs | Comptes, générations sur 24 h / 30 jours, promotion / rétrogradation admin |
| Fonctionnalités | Exports GLB / STL / PNG, ajout de photo, pause des demandes, inscriptions, modèles d'exemple, mode Dev, quotas |
| Mode Dev · logs | Journal des erreurs (refus, validations échouées, erreurs d'API…) ; avec le mode Dev activé, bouton « JSON » sur la visionneuse |

## Sécurité

- **Authentification Supabase** (email + mot de passe, confirmation par email), session
  rafraîchie par le middleware ; `/admin` vérifie le rôle côté serveur dans le layout **et** dans
  chaque action.
- **Row Level Security** sur toutes les tables : chacun ne lit et ne supprime que ses demandes ;
  la création passe par `create_design_request` ; les résultats sont écrits par le serveur avec la
  clé secrète ; le rôle n'est **pas modifiable** via l'API (droit de mise à jour limité à
  `display_name`) ; `app_secrets` n'a aucune politique (inaccessible hors clé secrète) ; réponses
  brutes, registre et journal réservés aux admins.
- **Quotas** appliqués en base (verrou par utilisateur, registre `usage_events` que l'utilisateur
  ne peut pas effacer), réglables dans l'admin ; les inscriptions peuvent être fermées (bloquées
  aussi par le déclencheur SQL).
- **Validation des entrées** côté serveur (Zod) : longueur de la demande, type et poids de
  l'image, valeurs de l'admin (couleurs, logo, prompt, quotas) ; **validation de la sortie de
  l'IA** avant tout enregistrement ou rendu.
- Le prompt système demande d'ignorer les instructions contenues dans la demande ; la demande est
  passée comme donnée dans une balise dédiée et la sortie est contrainte par le schéma.
- Clés d'API uniquement côté serveur (`server-only`), protections CSRF (vérification d'origine
  sur les routes API, actions serveur Next), en-têtes de sécurité (`nosniff`, `DENY`…).

## Format de conception (extrait)

```json
{
  "title": "Peigne range-câbles lesté",
  "dimensions": { "width": 160, "depth": 60, "height": 44, "weightGrams": 95, "notes": "" },
  "model": {
    "parts": [
      {
        "id": "base", "name": "Base lestée", "role": "…", "shape": "box",
        "size": { "x": 160, "y": 12, "z": 60 }, "position": { "x": 0, "y": 8, "z": 0 },
        "rotation": { "x": 0, "y": 0, "z": 0 }, "cornerRadius": 5,
        "profile": [], "holes": [], "color": "#5b6ee1", "material": "plastic"
      }
    ]
  }
}
```

Unités : millimètres, axe Y vers le haut, sol à `y = 0`. Schéma complet :
`src/lib/design/schema.ts`.

## Scripts

`npm run dev` · `npm run build` · `npm run typecheck` · `npm run lint` · `npm test` (Vitest :
schéma, normalisation, géométries, cohérence des dimensions, export STL, chiffrement, réglages) ·
`npm run smoke` (test de bout en bout en mode démo contre un serveur lancé : 1 demande → 1 modèle
3D). La CI (`.github/workflows/forma3d.yml`) enchaîne les cinq.

## Arborescence

```
forma3d/
├─ supabase/migrations/        schéma SQL complet (tables, RLS, fonctions)
├─ src/app/                    pages (accueil, connexion, setup, admin) et routes API
├─ src/components/studio/      tableau de bord (tablette) : barre, colonnes, visionneuse, dialogues
├─ src/components/viewer/      visionneuse React Three Fiber (néon / réaliste, éclaté, captures)
├─ src/components/landing/     fond dégradé, sphères en parallaxe, titre
├─ src/lib/design/             schéma de conception, prompt par défaut, exemples, générateur de démo
├─ src/lib/ai/                 appel Claude (sortie structurée, erreurs, refus)
├─ src/lib/providers/          interface « fournisseur 3D » + adaptateur Meshy
├─ src/lib/three/              géométries, vue éclatée, exports GLB / STL
└─ tests/                      tests Vitest
```

## Améliorations possibles

- **Affinage conversationnel** : « plus haut », « ajoute un tiroir » → nouvelle version du même
  projet, avec historique des versions et comparaison.
- **Vrai maillage** : finaliser un fournisseur text-to-3D (Meshy, Tripo, Rodin) et stocker les GLB
  dans Supabase Storage plutôt que de les relayer.
- **Opérations booléennes** (CSG, par ex. `three-bvh-csg`) pour percer des trous et creuser des
  formes, afin d'obtenir des STL directement imprimables d'un seul tenant.
- **Cotes dans la vue 3D** (lignes de cote, mesure au clic) et vérification d'imprimabilité
  (épaisseurs minimales, porte-à-faux, volume d'impression).
- **Diffusion en continu** de la génération (Server-Sent Events) pour afficher l'analyse avant
  la fin de la modélisation.
- **Partage public** d'un projet en lecture seule, export PDF de la fiche de fabrication.
- **Facturation** des crédits (Stripe) et quotas par offre ; limitation par IP en complément.
- **Photos stockées** (Supabase Storage, URLs signées) pour les retrouver dans l'historique.
- **Tests de bout en bout** Playwright (connexion, génération, admin) contre un projet Supabase de
  test, et vérification visuelle des captures.
- Internationalisation (anglais) et mode sombre.
