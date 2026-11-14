# Plan de reconstruction de Forma3D

Branche : `claude/forma3d-reconstruction` (créée depuis `claude/forma3d-refonte`, commit 7e258bc). Rien sur `main`, rien en production.
**Je n'ai écrit aucun code de la reconstruction : j'attends ton « ok » sur ce plan et tes réponses aux décisions du §5.**

## 1. Ce que j'ai vérifié moi-même aujourd'hui (et ce que je ne sais pas)

| Ton constat | Vérifié ? | Ce que j'ai trouvé |
| --- | --- | --- |
| Le moteur 3D est trop pauvre, pas de vrai « soustraire » | **Oui** | Aucune librairie de volumes solides dans `package.json`. Les huit formes de base (bloc, cylindre, tube, cône, sphère, tore, capsule, extrusion) sont dessinées séparément. Les opérations « percer », « évider », « congé » de l'éditeur (`ops.ts`, 829 lignes) fabriquent d'autres formes ou des trous dans un profil 2D : le résultat n'est jamais un seul volume fermé. |
| Questions en anglais | **Oui, reproduit** | Avec un navigateur en anglais, l'appel renvoie « Roughly what size? Small / Medium / Large » ; en français, « Quelle taille approximative ? ». Cause : le serveur choisit la langue d'après le navigateur, alors que les écrans du parcours Simple sont écrits en dur en français. |
| Thème incohérent | **Oui, reproduit** | La page est marquée « sombre » (`class="dark"`) mais le parcours s'affiche en clair, car j'ai forcé un thème clair par-dessus. Le reste du site (éditeur, galerie) reste sombre : deux apparences mélangées. |
| Aperçus sans IA ni base, résultats sans rapport | **Oui, par construction** | Décision D2 de la refonte : démonstration forcée en Preview. Et mon dernier correctif a **élargi la liste de mots-clés** : presque toute demande reçoit un « exemple le plus proche ». Tu as raison, c'est un faux résultat ; je le supprime en phase C. |
| Gris uniforme, idées cachées, bulle « Compris » | **Oui, ce sont mes choix** | Gris imposé à tout le modèle (direction A), bouton « Voir des idées » (ton option 3, mais les idées ne lancent pas la génération), bulle à fermer dès le résultat. À refaire en phase D. |
| « Avec supports ≈ 5 h 11 » pour un support de téléphone | **Oui** | Vu sur la capture. Le calcul de supports est approximatif et l'orientation n'est pas optimisée pour l'éviter. Sera traité avec les archétypes (phase B). |
| Qualité réelle de la génération IA | **Non, jamais mesurée** | Je n'ai jamais lancé la vraie IA sur des demandes variées. La phase A sert à ça : on ne peut pas améliorer ce qu'on n'a pas mesuré. |

## 2. Ce que je garde, reconstruis, déplace

- **Je garde** : base de données, comptes, crédits et quotas, sécurité (CSP, limites, filtre de contenu, pièces critiques), pages légales, tests (148 aujourd'hui), vérifications automatiques, export 3MF, parcours en 4 étapes, mode avancé.
- **Je reconstruis** : le moteur de géométrie (nouveau, phase B), la génération (phase C), l'accueil et l'écran de résultat (phase D).
- **Je déplace en mode avancé** : l'éditeur actuel à base de formes simples (ancien schéma, dit « v1 ») reste utilisable tel quel pour les anciens projets. Rien n'est supprimé.
- **Si un morceau me paraît irrécupérable**, je te le dis avant de le jeter.

## 3. Les phases (arrêt et rapport à la fin de chacune)

### Phase A — Mesurer la qualité réelle (aucun changement du produit)
1. `tests/golden/requests.json` : les 12 demandes que tu as listées, plus pour chacune ce qu'on doit y voir (ex. « boîte à lunettes : 2 pièces, couvercle emboîtable, intérieur ≥ 160 × 60 mm »).
2. Script de génération avec **plafond de dépense strict de 3 $** (il s'arrête avant de dépasser). Pour chaque demande : résultat, capture d'écran, temps, jetons, coût, vérifications.
3. Notes 0 à 5 sur 4 critères (ressemble, géométrie crédible, beauté, imprimable) dans `docs/baseline-qualite.md`. **Je note moi-même** à partir des captures et des vérifications ; je t'en montre un échantillon pour que tu confirmes ou corriges mes notes.
4. Livrable : tableau de référence « à battre ». **Dépend de ta réponse D1 (accès à l'IA).**

### Phase B — Nouveau moteur de géométrie
1. **Choix de la librairie, avec mesures** (1 page, `docs/choix-moteur-3d.md`) :
   - `manifold-3d` : licence Apache-2.0, ≈ 2,8 Mo dans son paquet (une partie est du code WASM, à mesurer une fois compressée). Conçue pour ne produire que des volumes fermés.
   - `three-bvh-csg` : licence MIT, ≈ 1,4 Mo, JavaScript pur. Plus légère, mais sans garantie que le résultat soit fermé.
   - Mon avis **provisoire** : `manifold-3d`, parce que ton critère n° 1 est « 100 % étanche ». Je le confirme par un essai chiffré (temps d'un trou + congé + couvercle sur iPad émulé, poids téléchargé) avant de m'engager. Aucun coût, ce sont des logiciels libres.
2. **Schéma v2** (validé par Zod, aucune exécution de code) : l'IA renvoie soit un **archétype + ses réglages**, soit, hors catalogue, un **arbre d'opérations** (formes de base, union / différence / intersection, trous, fentes, congés, chanfreins, répétitions, symétrie, révolution) avec paramètres nommés (min, max, unité).
3. **Bibliothèque d'archétypes testés** : boîte + couvercle emboîtable, support téléphone/tablette, crochet, clip, cache-trou, pied de meuble, range-câbles, adaptateur cylindrique, équerre/étagère, organiseur à compartiments. Chacun a ses tests : volume fermé, épaisseurs, cotes exactes. L'IA choisit et règle ; la forme libre est le dernier recours.
4. **Anciens projets (v1)** : ils continuent de s'ouvrir (chargeur v1 dans le mode avancé), sans conversion forcée et sans toucher à la base.
5. **Vérifications sur le vrai maillage** (fermé, nombre de morceaux, volume, épaisseurs, cotes retrouvées, volume d'impression, orientation qui minimise les supports) + une seule correction guidée, sinon verdict « à vérifier ».
6. **Exports** STL, 3MF (déjà fait, repris sur le maillage solide) et GLB depuis le même maillage.
7. **Critère de réussite** : moyenne ≥ 4/5 sur les 12 demandes, aucun résultat sans rapport, 100 % fermés. Si je ne bats pas la référence de la phase A, je te le dis.

### Phase C — Génération honnête et rapide
1. **Fin des faux résultats** : plus aucun « exemple le plus proche » pour une demande personnalisée. Sans IA : « La génération n'est pas disponible dans cet aperçu » + exemples cliquables étiquetés « exemple ».
2. **Aperçus qui génèrent pour de vrai** : je rédige la configuration (clé dédiée aux aperçus avec plafond, base, limites). **Tu décides, je ne touche à aucune variable Vercel.**
3. **Questions** : 0 à 2, seulement si elles changent la pièce, **dans la langue de l'écran** (le bug de langue est corrigé en faisant suivre la langue du parcours, pas celle du navigateur ; test automatique avec un navigateur anglais).
4. **Vitesse** : affichage progressif, cache, cache d'instructions, effort de réflexion minimal. Objectif : moins de 30 s pour 80 % des demandes (mesuré, pas promis).
5. **Modèles** : Sonnet 5.5 par défaut, Haiku 5.5 pour les retouches, Opus 5.5 en « réflexion approfondie » ; le comparatif chiffré existant est gardé et relancé. Les pièces critiques, le filtre de contenu et la mention « générée par IA » sont conservés.

### Phase D — Reconstruction de l'interface
1. **Deux directions visuelles en captures** avant de généraliser : « sobre atelier » et « chaleureux coloré ». Tu choisis (arrêt dédié).
2. **Accueil** : titre court, grande zone de saisie, « Créer ma pièce », photo, imprimante repliable ; **6 à 8 cartes d'exemples visibles** avec miniature 3D pré-rendue (un clic = affichage instantané, étiqueté « exemple ») ; « Comment ça marche » en 3 étapes ; 3 preuves de confiance ; mentions légales en pied de page.
3. **Résultat** : modèle en vedette (lumière de studio, ombre, couleurs par fonction, cotes sur le modèle, vue « pièces séparées »), panneau court (titre, phrase, dimensions, matière, verdict clair, « Télécharger pour imprimer » en 3MF, 3 à 6 curseurs en direct, « Plus petit / Plus solide / Moins cher »), détails repliés, plus de bandeau « Compris ».
4. **États vides, chargement, erreur, hors-ligne** en français humain avec « Réessayer » ; le texte saisi n'est jamais effacé.
5. **Thème** : une seule règle claire (clair par défaut, sombre cohérent en option) appliquée à tout le site, y compris l'éditeur.
6. **Responsive** : iPad (portrait et paysage) et MacBook d'abord, puis iPhone ; un doigt tourne, deux doigts zooment, la page ne défile pas dans le viewer. Cibles ≥ 44 px, contrastes AA, clavier complet.

### Phase E — Preuves et finitions
Tests unitaires (moteur, archétypes, vérifications), parcours complet automatisé (demande → résultat → curseur → export), captures aux 5 tailles (390, 820, 1180, 1280, 1512), Lighthouse accessibilité ≥ 95 et performance mobile ≥ 80 (Three.js et WASM chargés à la demande), README, CHANGELOG, `docs/baseline-qualite.md`, liste de ce qui reste fragile.

## 4. Budget et temps (estimations, pas des mesures)

- Phase A : 12 générations. Estimation grossière : environ 0,1 à 0,2 $ chacune → **1 à 3 $** selon le modèle (Opus est le plus cher). Le script s'arrête à 3 $ ; si ça ne suffit pas, je te rapporte un résultat partiel plutôt que de dépasser.
- Phase B : quelques générations de contrôle (≈ 1 $), mêmes plafonds. Le reste est du calcul local, gratuit.
- Aucun service payant ni nouvelle dépendance payante : `manifold-3d` et `three-bvh-csg` sont libres.

## 5. Ce dont j'ai besoin de toi

- **D1 — Accès à l'IA pour mes essais.** Je tourne dans un conteneur cloud, pas sur ton ordinateur : un `.env.local` sur ta machine ne m'est pas visible. Deux voies sûres : (a) tu ajoutes ta clé comme **secret de l'environnement** du projet Claude Code (menu de l'environnement dans la barre de titre de la session, puis Éditer, section « Network secrets » ou variable `ANTHROPIC_API_KEY`) et tu démarres une nouvelle session ; (b) tu m'autorises à tester un appel minimal (quelques centimes) pour voir si cette session peut déjà appeler l'IA sans ta clé. **Je recommande (b) d'abord, puis (a) si ça ne marche pas.** Je ne te demanderai jamais de coller une clé ici.
- **D2 — Plafond de la phase A.** Le plafond de 3 $ suffit probablement avec Sonnet 5.5 ; avec le modèle actuel du site (Opus 5.5) il sera peut-être juste. Je recommande : générer avec **Sonnet 5.5** (le futur modèle par défaut) et ajouter 3 demandes en Opus pour comparer. OK ?
- **D3 — Quota Vercel.** Le projet est bloqué (« Deployment rate limited ») parce que 4 projets du dépôt se déploient à chaque envoi. Tu pourras donc difficilement voir des aperçus pendant la reconstruction. Je te propose de regrouper mes envois (un par phase) ; la vraie solution (exclure les autres projets) touche à la configuration Vercel : **ton accord requis**.
- **D4 — Mes notes de qualité** : tu relis un échantillon de captures et tu corriges si tu n'es pas d'accord.
- **Rappel** : à la fin de chaque phase je m'arrête et j'attends ton feu vert.

## 6. Risques

| Risque | Parade |
| --- | --- |
| L'IA se trompe en construisant une forme libre | Archétypes testés d'abord ; arbre d'opérations seulement hors catalogue ; vérifications + une correction ; sinon « à vérifier » honnête. |
| Poids du moteur (WASM) sur iPad | Chargement à la demande, mesure avant de m'engager (phase B, étape 1). |
| Casser les anciens projets | Chargeur v1 conservé, aucune conversion en base, tests dédiés. |
| La reconstruction ne bat pas la référence | Je te le dis avec les chiffres ; tu décides de continuer ou d'ajuster. |
| Aperçus sans IA | Message honnête + exemples étiquetés ; configuration sûre proposée, décision à toi. |
| Quota de déploiements Vercel | Un envoi par phase, aperçus à la demande, décision D3. |
