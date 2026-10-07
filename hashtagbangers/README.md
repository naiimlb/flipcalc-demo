# #HASHTAG BANGERS — prototype "BANGERS" 3D

Prototype one-page (iPhone / Safari iOS d'abord) : un seul burger, le **Bangers**, en 3D procédurale
(Three.js) avec sa séquence d'ouverture pilotée par GSAP.

## Lancer en local

```sh
cd hashtagbangers
npm install
npm run dev        # puis ouvre l'URL "Network" affichée sur ton iPhone (même Wi-Fi)
```

`npm run build` produit `dist/` (chemins relatifs, publiable tel quel sur GitHub Pages).

## Version en ligne (sans compilation)

`demo/` est une copie statique prête à servir (Three.js et GSAP inclus, import map) : <https://naiimlb.github.io/flipcalc-demo/hashtagbangers/demo/>.
Après une modification de `src/`, la régénérer avec `sh scripts/make-demo.sh` (après `npm install`).

## Ce qu'on peut faire

- **Glisser horizontalement** : faire tourner le burger (avec inertie), léger parallaxe au toucher.
- **OUVRE-MOI** : anticipation → le chapeau s'ouvre comme un coffre → les couches se détachent → visite guidée
  (10 arrêts de 5,5 s, façon story ; tap à gauche / à droite ou ‹ › pour naviguer).
- **Zip** (à droite) ou **glisser verticalement** sur le burger : ouvrir / refermer soi-même.
  Le relâcher tout en bas referme le burger.
- **REFERME-LE** : les couches retombent avec rebond, le chapeau claque (onde de choc + confettis).
- **BANG!** (apparaît après la première fermeture) : le moment signature.

## Structure

| Fichier | Rôle |
|---|---|
| `src/config/layers.js` | La liste des couches (de bas en haut) : textes, épaisseurs, écarts, comportements. Tout est piloté depuis là. |
| `src/three/parts.js` | Un constructeur procédural par ingrédient (pain, roquette, steak, cheddar, œuf, lardons/oignons, sauce). |
| `src/three/burger.js` | `buildBurger(layers)` : un `Group` nommé par couche + filaments de cheddar. Contient `fromGLTF()` pour brancher un `.glb` plus tard (nœuds nommés comme les `id`). |
| `src/three/particles.js` | Pool unique pré-alloué (vapeur, miettes, gouttes, étincelles, confettis). |
| `src/three/stage.js` | Rendu, éclairage studio, glow, ombre blob, onde de choc, baisse auto de qualité. |
| `src/anim/sequences.js` | Les timelines GSAP (ouverture, visite, scrub, fermeture, BANG!). |
| `src/ui/ui.js` | Étiquette + ligne de rappel SVG, story bars, zip, sticker. |

Perf : pixel ratio ≤ 2, la qualité descend toute seule si le FPS moyen passe sous 45, rendu en pause onglet caché,
perte de contexte WebGL gérée. `prefers-reduced-motion` : pas de particules ni de secousses, fondus simples.
