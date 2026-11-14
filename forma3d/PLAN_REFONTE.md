# Plan de refonte de Forma3D

Branche de travail : `claude/forma3d-refonte` (créée depuis `claude/forma3d-phase1`, avec `main` fusionnée dedans).
Rien n'a été modifié dans l'application pendant cette phase 0 : seuls un outil de mesure (`scripts/baseline.mjs`),
son branchement dans la CI et les captures « avant » (`docs/refonte/avant/`) ont été ajoutés.

## 0. En bref

1. Le point de départ est la branche phase 1 : elle est complète (118 tests verts) et c'est elle qui utilise la base Supabase réelle.
2. `main` n'avait rien de plus pour Forma3D (ses 9 commits d'avance concernent uniquement l'application Hifz) : la fusion est faite, sans conflit.
3. La production tourne aujourd'hui sur `main` (ancienne version simple) : elle est redéployée automatiquement à chaque fusion dans `main`, y compris pour Hifz.
4. La génération réelle prend **112 s en moyenne** (69 à 203 s, 9 générations mesurées en base) ; Claude y écrit 7 000 à 11 000 jetons à chaque fois.
5. Le studio actuel affiche **38 à 111 éléments cliquables d'un coup** selon l'écran : c'est le cœur du problème d'ergonomie.
6. Accessibilité automatique déjà bonne sur l'accueil (0 violation sérieuse), quelques défauts dans le studio (contraste, boutons sans nom).
7. Je propose de construire un **parcours Simple** neuf (demande → précisions → résultat → fabriquer) **par-dessus** le moteur actuel, et de garder l'éditeur complet tel quel en **mode avancé**.
8. Phase 1 commence par **deux directions visuelles claires** à comparer en captures : tu choisis avant que j'applique partout.
9. Il me faut 6 décisions de ta part (section 6), dont deux sur Vercel pour que les **Preview** fonctionnent.
10. Aucune migration de base n'est nécessaire pour la phase 1.

## 1. État des lieux (constaté, pas supposé)

### 1.1 Branches et production

| Élément | Constat |
| --- | --- |
| `main` | Ce qui est en ligne (forma3d-gilt.vercel.app), déployé le 8 novembre lors d'une fusion Hifz. Version simple de Forma3D. |
| `claude/forma3d-phase1` | 34 commits d'avance sur `main` pour Forma3D (≈ +19 300 lignes) : assistant de questions, streaming, cache, crédits, éditeur, Fabrication, galerie, FR/EN/AR, Meshy, design « outil d'ingénierie ». |
| `main` → refonte | Les 9 commits propres à `main` ne touchent que `hifz/` (et une ligne du README racine). Fusionnés dans la branche de refonte : 0 fichier de `forma3d/` modifié. |
| Base Supabase | Contient déjà toutes les migrations de la phase 1 (y compris crédits, Meshy). **La même base héberge aussi les tables de Hifz** (`hifz_*`). |
| Vercel | Le projet `forma3d` ne construit que `main`, `claude/forma3d` et `claude/forma3d-phase1` (« Ignored Build Step ») : la branche de refonte est donc **annulée** automatiquement, pas de Preview pour l'instant (décision D1). Les Preview sont protégées par l'authentification Vercel. |

### 1.2 Vérifications de départ (branche de refonte)

| Vérification | Résultat |
| --- | --- |
| Installation | `npm ci` impossible : **il n'y a pas de fichier de verrouillage** (`package-lock.json`) dans le dépôt, donc les versions installées peuvent changer d'un build à l'autre (décision D3). `npm install` : OK (478 paquets). |
| Typecheck | OK |
| Lint | OK, 0 erreur, 3 avertissements (dépendances de hooks React dans `Studio.tsx`) |
| Tests unitaires | **118 / 118** (16 fichiers) |
| Build | **OK en CI** ; **échoue dans mon environnement** : `next/font` n'arrive pas à télécharger les polices Google à travers le proxy réseau. Je n'ai rien contourné dans le code. Proposition : auto-héberger les polices (`next/font/local`), ce qui rend le build indépendant du réseau (décision D4). |
| Smoke + captures fonctionnelles (CI) | 88 / 88 vérifications, 0 erreur console ; Safari (WebKit) 16 / 16 |
| `npm audit` (dépendances de production) | 3 alertes : **postcss** (via Next 15 ; correction = Next 16, cassante) et **zod < 4.6.6** (correction = Zod 4, cassante). À traiter dans un commit à part (phase 4). |

### 1.3 Mesures de référence (CI, mode démo, 5 tailles)

Fichiers : `docs/refonte/avant/` (15 captures + `mesures.txt`). « Résultat » = le studio tel qu'il s'ouvre sur une conception ;
« éditeur » = une pièce sélectionnée. Sur iPad et iPhone, l'écran tactile est émulé.

| Écran | iPhone 390 | iPad portrait 820 | iPad paysage 1180 | MacBook Air 1280 | MacBook Pro 1512 |
| --- | --- | --- | --- | --- | --- |
| Accueil : cliquables au 1er écran | 5 | 7 | 7 | 7 | 7 |
| Résultat : cliquables au 1er écran | 38 | 38 | 40 | 84 | 98 |
| Éditeur : cliquables au 1er écran | 38 | 38 | 40 | 92 | 111 |
| Cibles < 44 px (résultat) | 3 | 4 | 6 | 102 * | 102 * |
| Violations axe sérieuses (résultat) | 2 (boutons sans nom) | 0 | 0 | 1 (contraste) | 1 (contraste) |
| Débordement horizontal | 0 | 0 | 0 | 0 | 0 |

\* Sur Mac, les boutons font volontairement 32 px (souris) : la règle des 44 px vise le tactile, où elle est déjà presque respectée.

- Taille du texte courant : **14 px** partout (objectif : 16 px).
- Poids : accueil ≈ 400 Ko (200 Ko de JavaScript) ; studio ≈ 565 Ko (455 Ko de JavaScript).
- Lighthouse mobile — accueil : performance 95, accessibilité 100 ; **studio : performance 48, accessibilité 93**
  (LCP 6,6 s, 2,4 s de blocage, 223 Ko de JavaScript inutilisé au chargement).
- Les chiffres de ton audit sur la version en ligne (53 violations de contraste, 43 cibles sur 55 trop petites) concernent `main` ;
  la branche phase 1 en a déjà corrigé une bonne partie. Les « après » seront comparés à ces mesures-ci, dans le même environnement.

### 1.4 La génération en vrai (base de production, lecture seule)

- 18 demandes au total, 4 comptes, du 1er au 12 novembre. 15 réussies, 3 en erreur (2 « clé API invalide » le 1er novembre, 1 « image invalide »).
- 9 générations par Claude Opus 5.5 : **69 à 203 s, moyenne 112 s**. Elles écrivent 7 000 à 11 000 jetons de sortie : c'est la sortie, pas l'entrée, qui coûte du temps.
- Coût indicatif par génération (tarifs publics, ≈ 8 500 jetons de sortie) : Opus 5.5 ≈ 0,17 $, Sonnet 5.5 ≈ 0,09 $, Haiku 5.5 ≈ 0,004 $.
  À confirmer par le comparatif de la phase 2 (il coûtera environ 2 à 3 $ d'appels réels : décision D6).
- Les questions de précision utilisent déjà Haiku 5.5.

### 1.5 Sécurité (déjà bonne, quelques trous)

- Bien : RLS partout, quotas et crédits en SQL, clés admin chiffrées, routes admin protégées, entrées validées par Zod, aucun secret côté navigateur.
- À corriger (phase 4) : **pas de Content-Security-Policy** ; `isSameOrigin` **accepte une requête sans en-tête Origin** ; mises à jour postcss / zod ;
  vérification des fonctions `SECURITY DEFINER` exécutables par `anon` (je proposerai les `REVOKE` exacts, sans les appliquer).

### 1.6 Ce qu'une Preview Vercel ferait aujourd'hui

Les Preview reçoivent les variables Supabase (donc **la vraie base**) mais pas la clé Claude. Résultat : une personne connectée verrait
« L'IA n'est pas encore configurée », et toute action écrirait dans la base de production. Je propose qu'en Preview l'application
**force le mode démonstration** (détection `VERCEL_ENV=preview` dans le code, aucune variable à toucher) : pas d'écriture en base réelle, et un badge clair
« Exemple de démonstration ». Si tu préfères tester la vraie génération en Preview, il faudra une clé Claude dédiée en Preview : c'est toi qui l'ajoutes.

## 2. Ce que je garde, supprime, simplifie, déplace

| Fonction | Décision |
| --- | --- |
| Comptes, sauvegarde, historique, crédits, quotas, RLS | **Gardé**, inchangé. |
| Assistant de questions (1 à 3 questions, bouton « Passer ») | **Gardé**, devient l'étape 1 du parcours. |
| Streaming, cache des demandes identiques | **Gardé** ; servira l'affichage progressif. |
| Visionneuse 3D, exports STL / GLB / PNG | **Gardé** ; un seul bouton principal « Télécharger pour imprimer ». |
| Onglet Fabrication (imprimabilité, estimation, plans) | **Simplifié** : verdict en une phrase à l'étape 3, le détail replié. |
| Analyse, contraintes, hypothèses, étapes, coût, liste des pièces | **Replié** sous « Voir le détail ». |
| Versions « Plus petit / Plus solide / Moins cher / Plus esthétique » | **Gardé**, en boutons de langage naturel sous le résultat. |
| Éditeur complet (pièces, poignées, ajout de formes, mesure, vues 1/2/4, JSON, opérations) | **Déplacé en mode avancé**, sans rien retirer. |
| Rendus « Néon / Fil de fer / Éclaté », fonds, éclairages | **Mode avancé** ; en mode Simple : un seul « Aperçu réaliste ». |
| Photo → solution | **Gardé** (« Ajouter une photo ») ; amélioré en phase 3 (photo + une cote). |
| Galerie, partage | **Gardé**, hors du parcours de base (lien dans « Mes projets »). |
| Meshy | **Désactivé par défaut** derrière un interrupteur dans `/admin/fonctionnalites`, libellé « Objets décoratifs (expérimental) ». À ne pas activer en public sans accord écrit de Meshy (leurs conditions interdisent de revendre l'accès). |
| Bandeau rouge « Mode démo / Supabase n'est pas configuré » | **Supprimé** ; remplacé par un badge neutre « Exemple de démonstration » et une phrase honnête sur l'accueil. |
| Demande absurde en démo → modèle sans rapport | **Corrigé** : « Je n'ai pas compris ce besoin » + exemples cliquables. |
| Thème sombre « logiciel de CAO » et accent bleu actuels | **Remplacés** par un thème clair par défaut (sombre en option), selon la direction que tu choisiras. Les variables de design existent déjà : le changement est central. |
| Page `/design-system` | **Gardée** et mise à jour : elle reste la référence. |

## 3. Le parcours visé (mode Simple, par défaut)

1. **Demande** (accueil = l'outil) : « Quel problème voulez-vous résoudre ? », un champ, « Ajouter une photo », « Mon imprimante », 6 idées cliquables.
   Au plus 7 éléments cliquables, un seul bouton principal.
2. **Précisions** (si utile) : 1 à 3 questions à boutons, toujours « Passer, générer directement ».
3. **Pendant la génération** : étapes en clair (« J'analyse votre besoin → Je dimensionne → Je construis la pièce → Je vérifie qu'elle est imprimable »),
   temps estimé, bouton « Annuler », modèle affiché dès qu'il existe. La saisie n'est jamais perdue (coupure, erreur, délai dépassé).
4. **Résultat** : le modèle en grand (≈ 65 % à gauche sur iPad paysage / Mac, en haut sur iPad portrait, une colonne et une barre d'action en bas sur mobile),
   un titre, 3 lignes (ce que c'est, dimensions, matière), **un seul bouton principal « Télécharger pour imprimer »**, 3 curseurs de dimensions
   et les boutons « Plus petit / Plus solide / Moins cher ».
5. **Fabriquer** : « Imprimable sans supports, ≈ 45 min, ≈ 85 g de PETG », avertissements, orientation, exports.
6. **Mode avancé** : un interrupteur ouvre l'éditeur complet actuel. Jamais par défaut, jamais nécessaire pour télécharger.

Honnêteté sur les curseurs : en phase 1, ce seront **Largeur / Profondeur / Hauteur** (mise à l'échelle par axe, recalculée localement, cotes affichées).
Les vrais paramètres nommés (« Diamètre du trou », « Épaisseur de paroi ») demandent que Claude les fournisse : c'est la phase 2.

## 4. Ordre des phases

### Phase 1 — Simplicité d'usage (priorité absolue)

| Lot | Contenu | Arrêt pour validation |
| --- | --- | --- |
| 1.0 Socle | Polices auto-hébergées, fichier de verrouillage, Preview Vercel en mode démo, captures automatiques de la refonte en CI. | — |
| 1.1 Deux directions | « Clair neutre » et « Clair coloré », appliquées à l'accueil et au résultat, en captures aux 5 tailles. | **Oui : tu choisis.** |
| 1.2 Système de design | Variables ajustées à la direction choisie, texte courant 16 px, 3 à 4 tailles, composants réutilisables (bouton, carte, curseur, onglet, toast, dialogue). | — |
| 1.3 Parcours Simple | Nouvel accueil-outil, étapes précisions → génération → résultat → fabriquer, mise en page responsive (iPad d'abord). | — |
| 1.4 Ajustements | Curseurs de dimensions, boutons « Plus petit / Plus solide / Moins cher », « Télécharger pour imprimer ». | — |
| 1.5 Mots et honnêteté | Vocabulaire sans jargon (FR d'abord, EN / AR suivent), badge de démonstration, « Je n'ai pas compris ce besoin ». | — |
| 1.6 Attente et erreurs | Étapes visibles, estimation, Annuler, restauration de la saisie, messages humains avec une action. | — |
| 1.7 Mode avancé | Interrupteur vers l'éditeur actuel (inchangé). | — |
| 1.8 Premier lancement | 3 bulles maximum, fermables, mémorisées. | — |
| 1.9 Preuves | axe 0 violation sérieuse, Lighthouse accessibilité ≥ 95 (accueil et résultat), cibles tactiles ≥ 44 px (test automatique), aucun débordement aux 5 tailles, rotation tactile du modèle sans défilement de page, tests Playwright du parcours complet (demande → résultat → curseur → export), captures avant / après. | **Oui : rapport + Preview.** |

### Phase 2 — Fiabilité et vitesse (résumé)

Comparatif Opus / Sonnet / Haiku 5.5 sur 10 demandes types (temps, coût, qualité) **montré avant de basculer** ; streaming partiel, cache des instructions,
effort réduit ; vérifications automatiques après génération (étanchéité, pièces flottantes, parois ≥ 1,2 mm, cotes demandées vs obtenues, volume de
l'imprimante, jeux d'emboîtement) avec un seul essai de correction et un verdict de confiance ; 3 à 6 paramètres nommés par solution (curseurs sans
rappel de l'IA) ; refus ou avertissement fort pour les pièces critiques. Objectif : résultat en moins de 30 s dans 80 % des cas.

### Phase 3 — Ce qui fait la différence (résumé)

Export 3MF orienté plateau ; profil « Mon imprimante » ; « Mes projets » avec miniatures ; photo + une cote → pièce sur mesure ; bibliothèque de pièces
normalisées (vis, écrous, inserts, aimants, roulements) ; partage et « Remixer » ; mode pédagogique plus tard ; Meshy reste désactivé.

### Phase 4 — Confiance, légal, sécurité, performance, SEO (résumé)

Mentions légales, CGU, confidentialité (champs `[À COMPLÉTER]`, rien d'inventé sur ton identité), bandeau cookies, avertissement sur chaque pièce,
mention « généré par IA » visible et dans les fichiers ; filtre de contenu (armes, marques, personnages protégés) ; durée de conservation des photos ;
CSP, contrôle d'origine durci, limitation de débit partout, mises à jour postcss / zod ; rendu 3D à la demande, chargement différé de l'éditeur ;
`robots.txt`, `sitemap.xml`, Open Graph, page 404. Point de repère : la directive européenne sur la responsabilité du fait des produits (9 décembre 2026).

## 5. Risques et parades

| Risque | Parade |
| --- | --- |
| Une Preview écrit dans la base réelle | Mode démonstration forcé en Preview (D2). |
| Une fusion Hifz dans `main` redéploie Forma3D en production | Aucune fusion de la refonte vers `main` sans ton accord ; je te préviens si une fusion Hifz approche d'une fusion Forma3D. |
| La base est partagée avec Hifz | Aucune migration sans ton accord ; aucune ne sera nécessaire en phase 1. |
| Quota Vercel de 100 déploiements / jour, consommé surtout par 3 autres projets branchés sur le dépôt | Peu de déploiements, regroupés ; je ne touche pas aux autres projets sans ton accord. |
| Casser une fonction existante en simplifiant | Rien n'est supprimé : tout ce qui sort du parcours Simple reste en mode avancé ; les 118 tests et les 88 vérifications restent verts. |
| Promesse de curseurs « intelligents » dès la phase 1 | Annoncé clairement : Largeur / Profondeur / Hauteur en phase 1, paramètres nommés en phase 2. |
| Mesures Lighthouse bruitées (rendu logiciel en CI) | Toujours comparer avant / après dans le même environnement. |
| Mises à jour cassantes (Next 16, Zod 4) | Commit séparé en phase 4, testé, et je te dis si c'est cassant. |
| Je ne peux pas tester sur un vrai iPad / Mac | Tests WebKit et tactile émulé en CI, et je te liste ce qui reste à essayer sur ton appareil. |

## 6. Ce dont j'ai besoin de toi

- **D1 — Preview Vercel.** Autoriser le projet `forma3d` à construire la branche `claude/forma3d-refonte`. Deux façons :
  (a) tu me dis « ok D1 » et je modifie l'« Ignored Build Step » du projet par l'API Vercel ;
  (b) ou tu le fais toi-même : Vercel › forma3d › Settings › Git › Ignored Build Step, et tu ajoutes `claude/forma3d-refonte` à la liste des branches construites.
- **D2 — Preview en mode démonstration** (rien d'écrit dans la vraie base, pas de clé Claude en Preview). Je recommande oui.
- **D3 — Ajouter `package-lock.json`** au dépôt (versions figées, builds reproductibles, `npm ci` possible). Je recommande oui.
- **D4 — Polices auto-hébergées** (Inter, licence libre OFL, fichiers dans le dépôt). Je recommande oui.
- **D5 — Meshy** : désactivé par défaut derrière un interrupteur admin, libellé « expérimental ». Je recommande oui.
- **D6 — Budget du comparatif de modèles (phase 2)** : environ 2 à 3 $ d'appels Claude réels, avec ta clé, une seule fois.

Je m'arrête ici. Réponds « ok » (et tes choix D1 à D6) pour que je commence la phase 1.
