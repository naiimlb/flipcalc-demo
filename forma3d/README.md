# Forma3D

Décrivez un problème ou un objet (« une solution pour ranger mes câbles », « un support de
téléphone »…) : Forma3D précise la demande si elle est floue, l'analyse avec Claude, propose une
solution fabricable et la modélise en **3D interactive** (rotation, zoom, fil de fer, vue éclatée,
matières conseillées), avec dimensions, matériaux, étapes de fabrication, coût estimé et exports
**GLB / STL / PNG**. Le site est une **application installable** (iPad, téléphone, ordinateur).

- Next.js 15 (App Router) · TypeScript · Tailwind · Framer Motion
- React Three Fiber / Three.js (rendu néon « hologramme » ou réaliste)
- Supabase : authentification, base de données, Row Level Security, Storage, rôles admin / utilisateur
- API Claude côté serveur (JSON décrit dans le prompt, validé par Zod, une seconde tentative si besoin)
- Déployable sur Vercel (déploiement automatique depuis `main`)

## Où en est le projet

| Phase | Contenu | État |
| --- | --- | --- |
| Prototype + v2 | Génération, visionneuse 3D, matières conseillées, mise à jour automatique, espace personnel, admin | fait |
| **1** | Assistant de questions, streaming, cache, performance, gestes tactiles, PWA | **fait** (voir « Phase 1 ») |
| 2 | Fabrication et impression 3D (imprimabilité, estimations, plans cotés, « où fabriquer », versions) | **fait** (voir « Phase 2 ») |
| 3 | Photo vers solution, réalité augmentée | **fait** (voir « Phase 3 ») |
| 4 | Design (mode sombre/clair), partage, galerie, langues | **fait** (voir « Phase 4 ») |
| 5 | Crédits et quotas (sans paiement) | **fait** (voir « Phase 5 ») |
| Refonte 1 | Identité visuelle néon (sombre par défaut) et nouvelle page d'accueil | **fait** (voir « Refonte — phase 1 ») |
| Refonte 2 | Structure de l'éditeur (outils, vue 3D, propriétés, versions) | **fait** (voir « Refonte — phase 2 ») |
| Refonte 3 | Outils de création + génération Meshy (coûts affichés) | **fait** (voir « Refonte — phase 3 ») |
| Refonte 4 | Finitions, écran de génération Meshy, PWA, tests Safari, performance de l'accueil | **fait** (voir « Refonte — phase 4 ») |

Meshy est le service de génération 3D détaillée (voir « Refonte — phase 3 ») : il reste masqué tant que `MESHY_API_KEY`
et la migration 7 ne sont pas en place, et chaque action affiche son coût en crédits avant confirmation.
Il n'y a aucun paiement en ligne dans ce projet.

## Lancer en local

```bash
cd forma3d
npm install
npm run dev            # http://localhost:3000
```

Sans aucune variable d'environnement, le site démarre en **mode démo** : quatre projets d'exemple,
génération par le « modèle d'exemple le plus proche », rien n'est sauvegardé. Ajoutez
`ANTHROPIC_API_KEY` dans `.env.local` pour que les demandes passent par Claude (en mode démo,
Claude n'est appelé qu'en développement, jamais en production).

Pour la version complète (comptes, historique, admin) : `cp .env.example .env.local`, remplir les
valeurs (voir ci-dessous), puis `npm run dev`.

## Mise en place de Supabase

1. Créez un projet sur [supabase.com](https://supabase.com).
2. **SQL Editor** : exécutez, dans l'ordre, les fichiers de `supabase/migrations/` (ou `supabase db push`) :
   1. `20261101000000_forma3d_schema.sql` : tables, RLS, quotas, fonctions d'administration ;
   2. `20261102000000_espace_personnel.sql` : espace personnel (dossiers, favoris, Storage, export / suppression de compte, essai sans compte, premier administrateur par jeton) ;
   3. `20261103000000_phase1_cache_ratelimit.sql` : **cache** des demandes identiques et **limite de débit** de l'assistant de questions ;
   4. `20261104000000_phase4_galerie_partage.sql` : thème et arabe dans le profil, **galerie publique** (signalements,
      modération), **liens de partage** et **commentaires**. Sans lui, la galerie et le partage affichent « pas encore activé » ;
   5. `20261105000000_phase5_credits.sql` : **crédits** (comptes, registre, renouvellement mensuel, fonctions
      d'administration). Sans lui, aucune limite de crédits ne s'applique et le solde n'est pas affiché.
   6. `20261106000000_refonte2_editeur.sql` : **sauvegarde des modifications de l'éditeur** dans le compte
      (fonction `save_design_edit`, quotas). Sans lui, les modifications restent sur l'appareil ;
   7. `20261107000000_refonte3_outils.sql` : **coûts des actions Meshy et de « Modifie la pièce »**, facturation Meshy
      à la réussite (`charge_meshy_task`), limite de lancements (`meshy_start_check`), remboursements limités.
      Sans lui, les actions Meshy restent masquées ;
   Les scripts sont rejouables sans danger. L'application fonctionne même si le 3ᵉ n'est pas appliqué
   (le cache est alors simplement désactivé et la limite de débit se fait en mémoire).
3. **Authentication → URL Configuration** : *Site URL* = l'URL du site et, dans *Redirect URLs*,
   `https://votre-domaine/auth/callback`. Sans cela, les liens des emails (confirmation,
   mot de passe oublié) ne fonctionnent pas.
4. **Project Settings → API** : copiez l'URL et la clé publique (*publishable*). La clé secrète
   (*service_role*) est **facultative** : l'application fonctionne avec la session de l'utilisateur
   et des fonctions SQL.
5. Google (facultatif) : *Authentication → Providers → Google* ; le bouton apparaît tout seul
   quand le fournisseur est activé.

### Premier lancement : `/setup`

Le premier compte devient administrateur. Sans clé secrète Supabase, le jeton d'installation est
enregistré en base (table `private.setup_secret`, empreinte SHA-256) : créez votre compte, puis
ouvrez `/setup` connecté et saisissez le jeton. Dès qu'un administrateur existe, la page se
verrouille (vérifié en base par `setup_required()`).

## Variables d'environnement

| Nom | Rôle | Obligatoire |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet Supabase | oui (sinon mode démo) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clé publique Supabase (navigateur, protégée par la RLS) | oui (sinon mode démo) |
| `ANTHROPIC_API_KEY` | Clé Claude (variable Vercel de type *Sensitive*). Peut aussi être saisie dans `/admin/cles` | recommandé |
| `SUPABASE_SECRET_KEY` | Clé secrète Supabase, **serveur uniquement** | non |
| `SECRETS_ENCRYPTION_KEY` | 32 octets en base64 : chiffre les clés saisies dans l'admin | recommandé si clés saisies dans l'admin |
| `SETUP_TOKEN` | Jeton supplémentaire demandé par `/setup` | non |
| `CACHE_SECRET` | Secret du cache des demandes identiques (sinon dérivé de `SECRETS_ENCRYPTION_KEY` ou de la clé Claude) | non |
| `CLARIFY_MODEL` | Modèle de l'assistant de questions (défaut `claude-haiku-5-5`) | non |
| `NEXT_PUBLIC_SITE_URL` | URL publique (liens des emails) | recommandé |
| `MESHY_API_KEY` | Clé Meshy (variable Vercel *Sensitive*, ou saisie dans `/admin/cles`) : modèle 3D détaillé, texture, remesh, échelle, imprimabilité. Sans elle, les actions Meshy sont masquées | non |

## Déployer sur Vercel

1. Importez le dépôt, **Root Directory = `forma3d`** (Next.js détecté automatiquement).
2. Ajoutez les variables d'environnement ci-dessus.
3. Branche de production = `main` : chaque fusion dans `main` déploie automatiquement. Les autres
   branches ne sont pas construites (règle « Ignored Build Step ») afin d'économiser le quota gratuit
   (100 déploiements par jour).
4. Le bouton **« Mettre à jour »** apparaît à tous les visiteurs ouverts quand un nouveau déploiement
   est en ligne (`/api/version`, vérifié toutes les 60 s et au retour sur l'onglet) ; la demande en
   cours de saisie est conservée.

La route de génération déclare `maxDuration = 300` s (une génération dure en général 30 à 90 s).

## Fonctionnement d'une demande

1. L'utilisateur écrit sa demande (photo optionnelle, réduite dans le navigateur).
2. **Assistant de questions** (`POST /api/clarify`) : si la demande est floue, 2 à 3 questions courtes
   avec réponses cliquables et « Passer » (dimensions, intérieur/extérieur, budget, matière,
   imprimante). Une demande détaillée (≈ 20 mots, ou 10 mots avec une cote) ne déclenche **aucune**
   question ni appel à l'IA. Le petit modèle (Haiku) décide ; sans IA, des questions de repli
   s'appliquent aux demandes très courtes. L'assistant ne bloque jamais : erreur ou limite atteinte
   = la demande part telle quelle.
3. `POST /api/generate` valide l'entrée (Zod : texte, 3 réponses maximum, image), vérifie l'origine,
   puis :
   - **cache** : une demande identique (même texte, mêmes réponses, même langue, mêmes réglages d'IA)
     est servie instantanément, sans rappeler l'IA ;
   - sinon la fonction SQL `create_design_request` applique atomiquement pause globale, quotas
     horaires/journaliers et générations simultanées, puis Claude est appelé.
4. **Streaming** : avec `Accept: application/x-ndjson`, la réponse est diffusée ligne par ligne. Le
   serveur lit le JSON de Claude pendant qu'il s'écrit et envoie des évènements d'avancement : titre,
   **analyse écrite en direct**, rubriques terminées (Analyse → Solution → Dimensions → Matériaux →
   Fabrication → Coût → Modèle 3D). Une dernière ligne `result` contient la réponse finale (la même
   qu'en mode classique). Les panneaux apparaissent ensuite un par un. Si le navigateur se
   déconnecte, la génération se termine et est enregistrée.
5. Le JSON est validé et normalisé par Zod avant tout enregistrement ou rendu, puis converti en scène
   React Three Fiber. Exports côté navigateur : GLB, STL binaire (mm), PNG.

Sans clé Claude (ou crédit épuisé), l'option « Modèles d'exemple si l'IA est absente » sert le modèle
d'exemple le plus proche, clairement signalé à l'écran.

## Phase 1 : détails

- **Cache** : clé = HMAC-SHA256 calculé par le serveur avec un secret (`CACHE_SECRET`, sinon dérivé de
  la clé de chiffrement ou de la clé Claude). Personne ne peut deviner ni calculer la clé de la
  demande d'un autre. Seules les conceptions générées par Claude, sans photo, sont mises en cache ;
  une conception ne ressort que pour une demande strictement identique. Un visiteur sans compte
  profite du cache sans consommer son essai gratuit.
- **Limite de débit** de l'assistant de questions : 20 appels par heure et par personne, 3 000 par jour
  pour tout le site (fonction SQL `consume_rate_limit`, repli en mémoire). Limite connue : un appel
  direct à cette fonction peut consommer le plafond global du jour ; l'effet se limite à la
  désactivation temporaire des questions (la génération n'est pas touchée).
- **Performance** : le moteur 3D (Three.js) n'est téléchargé qu'une fois la zone visible et le
  navigateur au repos ; sur téléphone ou appareil modeste (ou si l'affichage rame) : moitié moins de
  facettes, résolution réduite, ombre figée, pas d'anticrénelage matériel ; rendu « à la demande »
  (l'image se fige quand rien ne bouge, en continu seulement pendant la rotation automatique) ;
  les exports GLB/STL gardent le plein détail. La CI mesure un score **Lighthouse mobile**
  (informatif, publié avec les captures). Il n'y a pas d'image de contenu à optimiser (le décor est en
  CSS, les icônes sont de petits PNG).
- **Gestes tactiles** : un doigt tourne, deux doigts pincent pour zoomer (et déplacent la vue),
  double-tap (ou double-clic) recentre ; un rappel s'affiche la première fois sur écran tactile.
- **Application installable (PWA)** : manifeste (`/manifest.webmanifest`, plein écran « standalone »),
  icônes dont une « maskable », écrans de lancement iOS (iPhone et iPad, portrait et paysage),
  service worker minimal (`public/sw.js`) et page hors-ligne (`public/offline.html`). Le service worker
  ne met **pas** en cache les pages ni l'API (le bouton « Mettre à jour » reste fiable) : il garde
  seulement la page hors-ligne et les fichiers statiques versionnés. Installation : Android et
  ordinateur → Réglages → « Installer l'application » ; iPhone / iPad → Safari → Partager → « Sur
  l'écran d'accueil ». Les icônes se régénèrent avec `node scripts/make-pwa-assets.cjs`.

## Phase 2 : fabrication et impression 3D

Onglet **Fabriquer** (calculs faits dans le navigateur, chargés seulement à l'ouverture de l'onglet) :

- **Contrôle d'imprimabilité** (`src/lib/fabrication/printability.ts`) : volume d'impression réglable
  (220 × 220 × 250 mm par défaut, mémorisé dans le navigateur), parois de moins de 1,2 mm (erreur sous
  0,8 mm), surfaces en porte-à-faux de plus de 45° (hors plateau et hors appui sur une autre pièce),
  supports nécessaires ou non, risque de basculement, et **meilleure orientation** parmi 6 (moins de
  supports, tient dans le volume). Chaque problème est accompagné d'une correction suggérée.
- **Estimation** (`estimate.ts`) : matière (g), durée et coût selon la matière (PLA, PETG, ABS, ASA,
  TPU, nylon, résine), le remplissage et la hauteur de couche ; modèle « coque + remplissage » et débit
  moyen d'une imprimante grand public, supports compris si besoin. Toujours présenté comme une estimation.
- **Plans cotés** (`drawing.ts`, `plan-layout.ts`, `pdf.ts`) : vues de face, de droite et de dessus
  rendues en projection orthographique, à **échelle normalisée** (1:1, 1:2, 1:5…), cotes hors-tout,
  nomenclature et cartouche ; export **PDF A4** (écrit sans bibliothèque) et **PNG**.
- **Exports STL, GLB, PNG** depuis l'onglet Fabriquer, pour toutes les solutions (exemples, essais,
  versions), en plus des exports de la visionneuse.
- **Où fabriquer** (`sourcing.ts`) : uniquement des **liens de recherche génériques** (services
  d'impression en ligne, fablabs proches, fournisseurs de la matière, découpe laser) et une **liste
  d'achats** (matière estimée + éléments de la conception), prix marqués « ≈ » ou « à vérifier ».
- **Ajuster et comparer** : « Plus petit », « Plus solide », « Moins cher », « Plus esthétique » créent
  une **nouvelle version** (la précédente est conservée). Avec l'IA, la conception actuelle lui est
  envoyée avec l'objectif ; sans IA, la version est calculée localement (`src/lib/design/variants.ts`)
  et signalée. Les versions d'un projet partagent la même demande ; l'écran **Comparer** affiche deux
  versions côte à côte (deux modèles 3D, dimensions, masse, matière, coût, impression, imprimabilité).
  Le champ `variante` de la conception indique l'objectif et la version de départ.

## Phase 3 : photo et réalité augmentée

- **Photo vers solution** : bouton appareil photo sur téléphone et tablette (photo prise sur le
  moment) et bouton « joindre » partout. La photo est **redimensionnée** (1024 px max), **compressée**
  (JPEG, qualité réduite si nécessaire), remise à l'endroit (orientation de l'appareil) et convertie
  si besoin (HEIC de l'iPhone) avant l'envoi. Sans cote dans la demande, l'assistant demande une
  **mesure de référence** (réponse libre). Claude analyse l'image (objets, place, fixations) et estime
  les tailles par proportion à partir de cette mesure ; le petit modèle de l'assistant voit aussi la photo.
- **Voir chez moi** (réalité augmentée, à taille réelle) : sur **iPhone / iPad**, AR Quick Look avec un
  fichier **USDZ** généré dans le navigateur (`exportUsdz`, en mètres, redimensionnement désactivé) ;
  sur **Android**, **WebXR** (Chrome + ARCore) : un réticule suit le sol, un toucher pose l'objet. Sur
  les appareils sans réalité augmentée, le bouton n'est **pas affiché** (aucune erreur).

## Phase 4 : design et partage

- **Mode sombre / clair** (`auto`, `clair`, `sombre`) : sélecteur dans l'en-tête (☀/☾) et dans Paramètres ;
  choix gardé dans un cookie (appliqué avant l'affichage, sans clignotement) et dans le compte (`profiles.theme`).
  Les couleurs passent par des variables CSS (`--surface`, `--paper`, `--ink`, `--line`, `--night`) : le
  bleu-violet de la marque reste identique dans les deux modes.
- **Visionneuse plus réaliste** : éclairage studio (lumière principale, débouchage, contre-jour), carte
  d'environnement à boîtes à lumière (reflets), matériaux physiques (vernis sur le plastique), ombres douces au
  sol, rendu néon toujours disponible, **capture PNG en haute définition** (rendu 2 à 3× la taille affichée).
- **Animations** : transition entre les pages (`src/app/template.tsx`), panneaux révélés un par un, écran de
  chargement en 4 étapes **Analyse → Conception → Contrôle → Prêt** suivant le flux de l'IA ; le réglage système
  « réduire les animations » est respecté (Framer Motion `MotionConfig` + CSS).
- **Accueil des visiteurs** (`/`) : titre à badge noir, exemples de solutions en **3D** (dernières publications
  de la galerie, sinon exemples), fonctionnement en 3 étapes, boutons **Essayer** (→ `/studio`) et **Créer un
  compte**. Une personne connectée arrive directement dans le studio. Le studio est aussi à `/studio`.
- **Galerie publique** (`/galerie`) : publication par un **choix explicite** (bouton « Partager · Publier » sur
  la fiche du projet, nom affiché ou non), copie figée de la conception ; recherche et filtre par catégorie ;
  page de détail avec 3D, **Utiliser comme point de départ** (la conception est copiée dans l'espace, ou gardée
  dans le navigateur pour un visiteur) et **Signaler** (limité ; masquage automatique au 5e signalement) ;
  **modération** dans `/admin/galerie` (masquer, réafficher, supprimer, motifs des signalements).
- **Partage** : lien en lecture seule `/p/<jeton>` (jeton aléatoire), **désactivable** à tout moment,
  renouvelable (l'ancien lien cesse de fonctionner), commentaires avec **pseudo** activables ou non, limités
  par adresse. La page partagée n'affiche jamais l'identité de l'auteur et n'est pas indexée.
- **Langues** : français (par défaut), anglais et arabe ; détection automatique (`Accept-Language`),
  sélecteur dans l'en-tête et dans Paramètres, choix mémorisé (cookie + compte), **lecture de droite à gauche**
  pour l'arabe (`dir="rtl"`). Les réponses de l'IA (conception, questions) suivent la langue choisie.
  Textes traduits : accueil, studio (barre, colonnes, visionneuse, onglet Fabriquer, comparaison, réglages),
  galerie, partage. **Restent en français** : l'administration, `/setup`, Mon espace, les pages de connexion et
  les 4 projets d'exemple.

## Phase 5 : crédits et quotas (sans paiement)

- **Aucun paiement en ligne** : ni Stripe ni autre moyen de paiement. Les crédits sont seulement une unité de
  mesure gérée par l'administrateur.
- Chaque action consomme un nombre de crédits **réglable dans `/admin/credits`** : conception (1 par défaut),
  nouvelle version (1), **maillage 3D par le futur service text-to-3D (5)** ; ce dernier est déjà branché
  dans la route de génération (consommé avant de lancer le fournisseur, remboursé s'il échoue) : il suffira
  d'activer un fournisseur pour qu'il coûte plus qu'une conception simple, sans rien refaire.
- Chaque utilisateur reçoit des **crédits gratuits renouvelés chaque mois** (30 par défaut, réglable ; allocation
  propre possible par utilisateur). Les crédits offerts par l'administrateur ne disparaissent pas au renouvellement.
- Le **solde est affiché en permanence** dans l'en-tête (⚡), mis à jour après chaque conception ; quand il est
  épuisé, la demande est refusée avec un **message clair** (date de renouvellement) et le texte reste dans la barre.
- Une génération **échouée** ou servie **sans IA** (cache, modèle d'exemple, version calculée localement) est
  **remboursée** automatiquement ; les administrateurs ne consomment pas de crédits ; l'essai sans compte garde
  son propre quota.
- `/admin/credits` : allocation mensuelle et coûts, consommation **par jour** (14 jours), **par utilisateur et par
  jour** (7 jours) et par utilisateur sur 30 jours, **offrir ou retirer** des crédits (avec motif), allocation par
  utilisateur. Les quotas horaires et journaliers existants restent dans `/admin/fonctionnalites`.
- Sécurité : le solde n'est modifiable que par des fonctions SQL (`consume_credits`, `refund_credits`,
  `admin_adjust_credits`, `admin_set_allowance`) ; RLS : chacun ne voit que son compte et ses mouvements.

## Refonte — phase 1 : identité visuelle et accueil

**Identité.** Fond noir profond par défaut, thème clair au choix (sélecteur ☾/☀ de l'en-tête, « Auto » suit
l'appareil). Palette en jetons réutilisables (`src/app/globals.css`, `tailwind.config.ts`) :

| Jeton | Rôle | Sombre | Clair |
| --- | --- | --- | --- |
| `canvas` | fond de page | `#05060a` | `#f4f5fa` |
| `fg` | texte posé sur le fond | presque blanc | presque noir |
| `neon-blue` | bleu électrique (boutons, lueurs) | `#3d7aff` | `#2f6bff` |
| `neon-coral` | corail (lueurs, accents) | `#ff7050` | `#ff6b4a` |
| `neon-violet` | touches de violet | `#9668ff` | `#8b5cf6` |
| `surface`, `paper`, `ink`, `line`, `night` | panneaux, textes, bordures (inchangés, réglés pour le noir) | | |

Classes prêtes : `btn-neon` (bouton principal), `btn-line` (secondaire), `btn-fg`, `neon-rim` (contour
dégradé bleu → corail), `text-neon` (texte en dégradé), `tap` (cible tactile ≥ 44 px), `pt-nav`.
Titres : Inter 800/900 (`font-display`), texte : Plus Jakarta Sans. Les couleurs de marque par défaut de
`/admin/apparence` passent au bleu électrique / violet (une couleur personnalisée reste prioritaire).
Icônes et écrans de lancement de l'application installée régénérés (`node scripts/make-pwa-assets.cjs`).

**Navigation.** Accueil, Éditeur (`/studio`), Galerie, Mon espace, crédits, thème/langue, avatar. Sur l'accueil
et la galerie elle flotte au-dessus de la page et se réduit (fond flouté) au défilement ; dans l'éditeur elle reste
compacte. Sous 768 px : bouton « Menu » avec des liens de 48 px. Zone sûre de l'encoche respectée.

**Accueil (`/`, pour tout le monde).** L'accueil n'ouvre plus l'éditeur pour les personnes connectées :
la connexion, l'inscription et l'application installée mènent à `/studio` ; les anciens liens `/?p=<id>`
redirigent vers `/studio?p=<id>`.
- Héros plein écran : titre géant avec badge noir en pilule (contour néon, cube qui tourne), étiquette flottante,
  sous-titre gris, boutons « Essayer » et « Créer un compte ».
- Objets 3D flottants : support de téléphone, boîte de rangement, figurine et roue dentée — de vraies pièces
  Forma3D décrites en formes simples (`src/lib/design/hero.ts`), donc aucun fichier à télécharger et aucune
  génération en direct. Éclairage de contour bleu à gauche, corail à droite. Ils tournent lentement et suivent
  le curseur, le doigt, et l'inclinaison de l'iPad / iPhone (bouton « Activer l'inclinaison », l'autorisation est
  demandée par Safari).
- Performance : le titre s'affiche immédiatement (rendu serveur), la 3D se charge après la page (ou au premier
  toucher), se met en pause hors écran et onglet masqué, et baisse sa résolution si l'appareil peine
  (`PerformanceMonitor`). « Réduire les animations » : objets immobiles, révélations et rotations coupées.
- Sections révélées au défilement : 1. comment ça marche, 2. exemples de solutions (3D manipulable),
  3. outils de création (aperçu de l'éditeur), 4. avant / après d'une photo (curseur au doigt, à la souris ou
  aux flèches), 5. dernières créations de la galerie, 6. appel à l'action final.
- Indicateur de progression vertical à gauche (iPad et ordinateur) et bouton rond en bas à droite
  (section suivante, puis retour en haut), avec anneau de progression.
- Toutes les pages publiques (galerie, partage, Mon espace) passent en pleine largeur.

**Rendu 3D : WebGL.** WebGPU n'est pas activé dans cette phase : avec Three.js r180, mélanger `three` et
`three/webgpu` duplique le moteur et casse les composants existants ; ce sera réévalué en phase 4 de la refonte.
La qualité est adaptative (résolution, détail des formes).

## Refonte — phase 2 : structure de l'éditeur

L'éditeur (`/studio`) occupe tout l'écran, sans cadre autour :

| Zone | Contenu |
| --- | --- |
| Barre du haut | accueil, **nom du projet** (crayon pour renommer), **annuler / rétablir**, **enregistrer** (état de la sauvegarde), onglets Éditeur · Fabriquer · Historique · Paramètres, recherche, notifications, **exporter** (STL, GLB, PNG HD), crédits, thème / langue, compte |
| Gauche | **barre d'outils** : panneau Pièces, Sélection (V), Déplacer (W), Tourner (E), Échelle (R), **1 / 2 / 4 vues**, grille (G), axes, **règle** (M), recadrer (F), panneau Propriétés |
| Panneau Pièces | fiche du projet (favori, partage, alertes), **arborescence** (assemblage → pièces : sélectionner, masquer / afficher, renommer d'un double-clic, dupliquer, supprimer), dernières demandes |
| Centre | vue 3D (perspective) ; en 2 vues + face, en 4 vues + dessus, face, droite (orthographiques, sélection partagée) |
| Panneau Propriétés | onglets **Objet** (nom, position, rotation, taille en mm / degrés), **Matière** (couleur et matière de la pièce, matières conseillées), **Dimensions** (encombrement mesuré en direct, taille de chaque pièce), **Analyse** (analyse, versions « plus petit / plus solide… »), **Fabrication** (étapes, coût, accès à l'atelier) |
| Barre du bas | **historique des versions** du projet (v1, v2…, comparer) et barre de saisie |

**iPad et iPhone** : les deux panneaux deviennent des **tiroirs** (bouton de la barre d'outils, fermés par Échap,
la croix ou un toucher à côté) ; boutons de 44 px. **Mac** (≥ 1 280 px) : panneaux ancrés, **redimensionnables**
(poignée à la souris / au trackpad, flèches du clavier, double-clic pour la largeur d'origine), largeur mémorisée.

**Annuler / rétablir illimités**, par projet (les frappes successives d'un même champ comptent pour une étape).
**Sauvegarde automatique** 1,2 s après la dernière modification (et à la fermeture de la page) :
- connecté : dans le compte (`PATCH /api/requests/<id>/design` → conception **revalidée côté serveur**, puis fonction
  SQL `save_design_edit` : propriétaire uniquement, projet terminé, 600 sauvegardes / heure / projet et 2 000 / heure /
  personne). Le fichier 3D enregistré (GLB) est régénéré automatiquement ;
- visiteur, exemple, ou script SQL pas encore exécuté : sur l'appareil (« Enregistré sur l'appareil »), sans erreur ;
  les modifications sont renvoyées en ligne dès que c'est possible.

Raccourcis (Mac : ⌘ ; Windows : Ctrl) : **⌘Z** annuler, **⇧⌘Z** ou **Ctrl+Y** rétablir, **⌘D** dupliquer la pièce,
**Suppr / ⌫** supprimer la pièce, **⌘S** enregistrer, **V W E R** outils, **F** recadrer (sur la pièce sélectionnée),
**G** grille, **M** règle, **H** masquer la pièce, **Échap** désélectionner, **← →** projet précédent / suivant.
Tactile : un doigt tourne, deux doigts déplacent et pincent pour zoomer, double-tap recentre.

Les poignées 3D de déplacement / rotation / échelle et le magnétisme sont décrits dans « Refonte — phase 3 ».

**Configuration** : exécuter `supabase/migrations/20261106000000_refonte2_editeur.sql` dans Supabase › SQL Editor
pour la sauvegarde dans le compte (sans lui, tout fonctionne avec la sauvegarde sur l'appareil).

## Refonte — phase 3 : outils de création et de personnalisation

Tous les outils marchent au doigt, à l'Apple Pencil, au trackpad et à la souris ; chaque modification s'annule (⌘Z).

**Transformation.** Poignées visibles sur la pièce sélectionnée : Déplacer (W), Tourner (E), Échelle (R).
Magnétisme réglable (pas en mm, angle en degrés), échelle uniforme ou non, saisie exacte en mm / degrés dans l'onglet Objet,
« Mettre à l'échelle réelle » (onglet Dimensions : la plus grande dimension prend la valeur saisie).
Sélection multiple (Maj / ⌘ + clic, dans la vue ou la liste) ; une pièce assemblée se sélectionne avec tout son assemblage.

**Ajouter (bouton + de la barre d'outils).** Cube, cylindre, sphère, cône, anneau, tube ; **texte** en relief (posé sur la pièce
sélectionnée) ou **gravé** (creusé dans un pavé), 4 polices ; **forme libre** tracée au doigt ou au Pencil puis extrudée.

**Opérations (onglet Objet, pièce sélectionnée).** Dupliquer, miroir (copie symétrique), répétition en ligne ou en cercle,
couper en deux, évider (boîte ouverte / tube avec fond, épaisseur réglable), percer un trou au diamètre exact, congé, chanfrein,
assembler / séparer, verrouiller (une pièce verrouillée ne se sélectionne plus dans la vue). Les opérations travaillent sur des
formes paramétriques : quand une opération ne s'applique pas à une forme (ex. couper une sphère), elle est grisée et la raison s'affiche.

**Matières et rendu (onglet Matière).** Bibliothèque PLA, PETG, ABS, résine, bois, métal, verre, caoutchouc (aspect réaliste,
appliquée à la pièce ou au modèle), couleur par pièce, matières conseillées par l'analyse, rendu néon en option.
Éclairage studio / néon bleu-orange / jour, fond au choix, ombres douces, image HD et **vidéo 360°** (MP4 sur Safari, WebM sur Chrome).

**Mesure.** Outil Mesurer (U) : deux points touchés sur le modèle donnent leur distance ; règle et encombrement en continu.

**Personnalisation guidée.** Curseurs « Plus petit / Plus solide / Moins cher / Plus esthétique » (léger, moyen, fort) qui créent
une nouvelle version ; champ **« Modifie la pièce »** (ex. « agrandis le trou de 2 mm », « arrondis les angles ») : Claude
modifie la scène (coût `ai_edit`, 1 crédit par défaut, remboursé en cas d'échec ; résultat revalidé côté serveur). Sans compte ou
sans clé, quelques consignes simples sont appliquées localement (trous, angles, pourcentages, épaisseur).

**Meshy (service 3D principal).** Points d'accès et coûts lus dans la documentation officielle (https://docs.meshy.ai —
pages Text to 3D, Retexture, Remesh, Resize, Analyze / Repair Printability, Balance, Pricing) :

| Action dans Forma3D | API Meshy | Coût Meshy |
| --- | --- | --- |
| Générer le modèle détaillé / Régénérer une variante | `POST /openapi/v2/text-to-3d` (`mode: preview`) | 20 crédits |
| Ajouter la texture | `POST /openapi/v2/text-to-3d` (`mode: refine`) | 10 crédits (2K) |
| Retexturer (« Décris la texture ») | `POST /openapi/v1/retexture` (`text_style_prompt`) | 10 crédits (2K) |
| Simplifier le maillage | `POST /openapi/v1/remesh` (`target_polycount`) | 5 crédits |
| Mettre à l'échelle réelle | `POST /openapi/v1/resize` (`resize_height`) | 1 crédit |
| Analyser l'imprimabilité | `POST /openapi/v1/print/analyze` | gratuit |
| Réparer pour l'impression | `POST /openapi/v1/print/repair` | 10 crédits |

Le coût en crédits Forma3D de chaque action (réglable dans /admin/credits, par défaut égal au coût Meshy) s'affiche avant
confirmation, avec le solde avant / après ; le serveur vérifie le solde Forma3D, la fréquence (4 lancements / 10 min, 40 / jour)
et le solde du compte Meshy (`GET /openapi/v1/balance`). **Les crédits ne sont débités que si la tâche Meshy réussit**
(une seule fois par tâche). Le résultat s'affiche dans la vue 3D (« Voir le modèle Meshy »), les versions Meshy précédentes restent
accessibles, et le GLB est copié dans Supabase Storage (les liens Meshy expirent). La clé reste côté serveur.
Le lancement automatique de Meshy à chaque conception est supprimé (il facturait sans confirmation).

**Configuration** : 1) ajouter `MESHY_API_KEY` dans Vercel (Settings › Environment Variables, type *Sensitive*,
environnement Production) puis redéployer, ou la saisir dans /admin/cles ; 2) exécuter
`supabase/migrations/20261107000000_refonte3_outils.sql`. Tant que l'un des deux manque, les panneaux Meshy sont masqués.

Raccourcis ajoutés : **U** mesurer, **L** verrouiller, **⌘G** assembler, **⇧⌘G** séparer, **⌘D** / **Suppr** sur la sélection multiple.

## Raccourcis clavier et gestes

Mac : **⌘** ; Windows / Linux : **Ctrl**. Les raccourcis à une touche sont désactivés pendant la saisie dans un champ.

| Raccourci | Action |
| --- | --- |
| **⌘S** | Enregistrer maintenant |
| **⌘Z** · **⇧⌘Z** ou **Ctrl+Y** | Annuler · rétablir |
| **⌘D** | Dupliquer la pièce (ou la sélection) |
| **⌘G** · **⇧⌘G** | Assembler · séparer les pièces sélectionnées |
| **Suppr** ou **⌫** | Supprimer la sélection |
| **V** (ou **Q**) · **W** · **E** · **R** | Sélectionner · déplacer · pivoter · redimensionner |
| **U** | Règle : mesurer entre deux points du modèle |
| **L** | Verrouiller / déverrouiller la pièce |
| **H** | Masquer la pièce |
| **F** | Recadrer la vue (sur la pièce sélectionnée) |
| **G** · **M** | Grille · règle des dimensions globales |
| **Échap** | Désélectionner, fermer le menu Ajouter |
| **←** **→** | Projet précédent / suivant (sans pièce sélectionnée) |
| **Maj** ou **⌘** + clic (liste ou vue 3D) | Ajouter une pièce à la sélection |
| **Double-clic** sur un nom de pièce | Renommer |

Tactile (iPad, iPhone) et Apple Pencil : un doigt tourne la vue, deux doigts déplacent et pincent pour zoomer, double-tap
recentre ; les poignées se saisissent au doigt ou au Pencil ; la forme libre se trace au doigt ou au Pencil.

## Refonte — phase 4 : finitions, PWA et performance

- **Écran de génération Meshy** : sur la vue 3D, une carte « Analyse → Génération → Texturage → Prêt » avec barre
  d'avancement et nom de l'action. Elle ne masque pas le modèle et reste « Prêt » quelques secondes. En cas d'échec, le
  panneau Meshy indique « aucun crédit débité ».
- **Chargement** : squelettes (vue 3D, liste des pièces, galerie, Mon espace, éditeur) et états vides avec une phrase
  qui explique quoi faire. Les animations se figent quand le système demande de les réduire.
- **Transitions** : fondu entre les pages, apparition douce des onglets de propriétés.
- **Application installable (PWA)** : plein écran sur iPad, iPhone, Mac et Android, démarrage sur l'éditeur, icônes,
  écrans de lancement iOS, page hors ligne, et raccourcis (appui long sur l'icône) vers « Nouvelle conception » et
  « Galerie ». Sur iPad / iPhone : Safari › Partager › *Sur l'écran d'accueil*. Sur Mac : Safari › Fichier › *Ajouter au
  Dock*, ou Chrome / Edge › *Installer*.
- **Performance de l'accueil** : le moteur 3D du héros (le plus gros script du site, ≈ 4 à 6 s de calcul sur un
  téléphone modeste) ne se charge qu'à la première interaction (souris, doigt, clavier, défilement), et jamais en mode
  « économie de données ». Avant cela, le titre et les lueurs s'affichent seuls.
- **Tests** : la CI rejoue le parcours dans **WebKit** (le moteur de Safari) : accueil, éditeur au toucher sur un iPad Pro 11"
  émulé, manifeste PWA. Résultats publiés avec les captures (`webkit.txt`). Limite : c'est WebKit sous Linux, pas un
  vrai Safari (ni Pencil, ni capteur d'inclinaison), donc un essai sur un vrai iPad reste à faire. Le score Lighthouse
  (mobile) est publié à chaque envoi (`lighthouse.txt`).

## Mon espace et administration

- `/espace` : demandes, modèles 3D (GLB dans Supabase Storage), favoris, dossiers, matières préférées,
  paramètres, export JSON de toutes les données, suppression du compte.
- `/admin` : vue d'ensemble, apparence en direct, prompt IA avec test, clés d'API chiffrées (AES-256-GCM),
  demandes, utilisateurs, fonctionnalités et quotas, journal d'erreurs (mode Dev).

## Sécurité

- **Authentification Supabase** ; `/admin` vérifie le rôle côté serveur dans le layout **et** dans chaque action.
- **Row Level Security** sur toutes les tables et les buckets Storage : chacun ne voit que ses données.
  Les colonnes modifiables par l'utilisateur sont limitées (`title`, `folder_id`, `is_favorite`…) ; le
  rôle n'est pas modifiable via l'API. Un test d'isolation automatique (CI) le vérifie depuis l'extérieur.
- **Quotas** en base (verrou par utilisateur, registre que l'utilisateur ne peut pas effacer) et quota
  d'essai sans compte par adresse (empreinte salée, l'IP n'est jamais stockée).
- **Validation des entrées côté serveur** (Zod) et **validation de la sortie de l'IA** avant tout
  enregistrement ou rendu. La demande est passée à l'IA comme une donnée dans une balise dédiée.
- Clés d'API uniquement côté serveur (`server-only`), protection CSRF (vérification d'origine),
  en-têtes de sécurité. Limite connue : sans clé secrète Supabase, le prompt système (réglage `ai`)
  est lisible via l'API publique de la base (il ne contient aucun secret).

## Scripts

`npm run dev` · `npm run build` · `npm run typecheck` · `npm run lint` · `npm test` (Vitest : schéma,
géométries, chiffrement, réglages, génération et repli, appel à Claude, lecture du JSON en cours
d'écriture, assistant de questions, cache) · `npm run smoke` (bout en bout en mode démo : génération
classique et diffusée, assistant de questions, PWA). La CI (`.github/workflows/forma3d.yml`) enchaîne
types, lint, tests, build, test de fumée, captures d'écran, Lighthouse et un parcours complet contre
le vrai projet Supabase (comptes de test, Storage, export, suppression, isolation).

## Arborescence

```
forma3d/
├─ supabase/migrations/        schéma SQL (tables, RLS, fonctions, cache, limite de débit)
├─ public/                     icônes PWA, écrans de lancement iOS, service worker, page hors-ligne
├─ src/app/                    pages (accueil, connexion, espace, setup, admin) et routes API
├─ src/components/studio/      tableau de bord : barre de demande, assistant, colonnes, visionneuse
├─ src/components/viewer/      visionneuse React Three Fiber (qualité, gestes, captures)
├─ src/lib/design/             schéma de conception, prompt, exemples, lecture du JSON partiel
├─ src/lib/ai/                 appels à Claude (conception en flux, assistant de questions)
├─ src/lib/cache.ts            cache des demandes identiques
├─ src/lib/providers/          interface « fournisseur 3D » (aucun service payant branché)
├─ src/lib/three/              géométries, vue éclatée, exports GLB / STL
└─ tests/                      tests Vitest
```

## Reste à faire (hors phases suivantes)

- Appliquer la migration `20261103000000_phase1_cache_ratelimit.sql` dans Supabase (activer le cache).
- Réglages Supabase : Site URL et Redirect URLs ; Google si souhaité (non testés : emails, Google, photo de profil).
- Supprimer les comptes de test `e2e-*@forma3d.test` laissés par la CI.
- Réduire les limites de l'essai sans compte dans `/admin` si le crédit Claude est limité.
- Phase 2 : estimations simples (pas de vrai trancheur) ; les pièces qui se chevauchent comptent deux
  fois dans le volume (léger surplus). Les ponts courts sont comptés comme des porte-à-faux.
- Phase 3 : réalité augmentée non testée sur un vrai iPhone / Android (la CI n'a pas de caméra) ; à
  vérifier : « Voir chez moi » dans Safari (iPhone/iPad) et dans Chrome (Android).
- Phase 4 : appliquer `20261104000000_phase4_galerie_partage.sql` (galerie, partage, thème dans le compte) ;
  traduire l'administration, Mon espace et la connexion ; vignettes d'aperçu dans la galerie (aujourd'hui une icône).
- Phase 5 : appliquer `20261105000000_phase5_credits.sql` ; afficher le coût en crédits avant de lancer une
  demande ; historique des crédits dans Mon espace.
