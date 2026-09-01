# Maze Run — Labyrinthe 3D pour iPhone

Jeu de labyrinthe 3D jouable directement dans Safari (aucune installation, aucune
dépendance externe : moteur WebGL maison, sons synthétisés, tout fonctionne hors-ligne).

## Jouer

1. Héberger le dossier `maze/` (GitHub Pages, ou n'importe quel serveur statique).
2. Ouvrir `maze/index.html` sur l'iPhone.
3. Optionnel : **Partager → Sur l'écran d'accueil** pour jouer en plein écran comme une app.

Commandes : glisser le pouce n'importe où sur l'écran (joystick virtuel).
Sur ordinateur : flèches / ZQSD / WASD, `P` pause, `H` indice.

## Niveaux

| # | Décor | Taille | Difficulté |
|---|-------|--------|------------|
| 0 | 🌼 Prairie (démo guidée, sans chrono) | 4×4 | Apprentissage |
| 1 | 🌴 Jungle | 6×6 | Facile |
| 2 | 🏖️ Plage | 8×8 | Facile |
| 3 | 🏜️ Désert | 10×10 | Moyen |
| 4 | 🏔️ Montagne | 12×12 | Moyen |
| 5 | 🍂 Forêt d'automne | 14×14 | Moyen + |
| 6 | 🌋 Volcan | 16×16 | Difficile |
| 7 | ❄️ Grotte de glace | 18×18 | Difficile |
| 8 | 🌃 Ville néon | 21×21 | Expert |
| 9 | 🪐 Espace | 24×24 | Légende |

Le temps imparti est calculé à partir de la longueur du chemin de sortie, avec une marge
qui se réduit de niveau en niveau. Chaque niveau se débloque en terminant le précédent.
Notation : 1 étoile pour sortir, +1 s'il reste 40 % du temps, +1 pour les 3 étoiles ramassées.

## Fonctionnalités

- Survol cinématique du labyrinthe au lancement de chaque niveau, puis caméra qui suit le joueur.
- Personnage 3D stylisé modélisé d'après les photos de référence (cheveux bouclés, t-shirt blanc
  avec imprimé au dos, short noir, baskets noires) avec animations marche / victoire / défaite.
- Mini-carte qui se dévoile au fur et à mesure, portail de sortie lumineux, étoiles à collecter.
- Bouton 💡 indice : affiche la direction pendant 4 s (coûte 5 s de chrono).
- Particules d'ambiance par décor (pollen, lucioles, neige, feuilles, braises, pluie, étoiles…).
- Progression et meilleurs temps sauvegardés sur l'appareil.

## Fichiers

- `index.html` — interface, styles, HUD.
- `js/engine.js` — mini moteur WebGL (matrices, géométrie, scène, particules).
- `js/character.js` — modèle 3D du personnage et animations.
- `js/levels.js` — niveaux, thèmes, génération de labyrinthe, décors.
- `js/audio.js` — effets sonores synthétisés (WebAudio).
- `js/game.js` — boucle de jeu, caméra, entrées tactiles, HUD, mini-carte.
