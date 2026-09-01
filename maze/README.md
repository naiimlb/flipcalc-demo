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

## 50 niveaux en 10 mondes

Chaque monde (Prairie, Jungle, Plage, Désert, Montagne, Forêt d'automne, Volcan, Grotte de glace,
Ville néon, Espace) compte 5 niveaux : même décor, mais une **ambiance différente à chaque niveau**
(aube, jour, crépuscule, nuit, orage avec éclairs et tonnerre, brume) et une grille qui grandit d'un
cran (de 4×4 pour la démo à 24×24). Terminer un monde ouvre le suivant.

Le chrono est calculé à partir du trajet réel (≈ 0,72 s par case, hésitations comprises) avec une
marge qui se resserre au fil des niveaux, plus un budget d'exploration des impasses proportionnel à
la grille. Mode Expert : 40 % de temps en moins et pas d'indice. L'étoile du chrono demande 30 % du
temps restant.

## Ton visage sur le héros

Au premier lancement, le jeu propose de se prendre en photo (caméra frontale, ou appareil photo natif
si la caméra n'est pas accessible — par exemple dans une iframe). La photo est recadrée au doigt, la
tête du personnage l'affiche en direct (disque fondu dans la peau, teinte de peau déduite de la photo)
et tout reste dans le navigateur : rien n'est envoyé. Le bouton « 📸 Mettre mon visage » du menu
permet de changer ou retirer la photo à tout moment.

## Animations en jeu

Créatures propres à chaque décor (papillons, perroquets, mouettes, vautours, aigles, corbeaux,
chauves-souris, chouettes, drones, ovnis), étincelles qui montent du portail, halos pulsants sous les
étoiles, onde de choc à la collecte, néons et lave qui palpitent, caméra qui penche dans les virages,
orbite de victoire avec feu d'artifice, éclairs sous l'orage.

## Pour tous les publics

- **3 modes** choisis depuis le menu : 🐣 Détente (sans chrono, indices gratuits, idéal pour les petits),
  🙂 Normal, 🔥 Expert (temps réduit de 30 %, pas d'indice).
- **Tenues à débloquer** : 9 couleurs de t-shirt gagnées avec les étoiles (⭐ 3, 6, 9… jusqu'à 30).
- **🎲 Labyrinthe surprise** : un labyrinthe aléatoire (décor et taille tirés au sort) pour rejouer à l'infini.
- Le personnage accueille le joueur sur le menu, encouragements à chaque étoile, nouveau record signalé,
  écran de défaite bienveillant avec bouton « Réessayer sans chrono ».

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
- `js/critters.js` — créatures animées d'ambiance (une espèce par décor).
- `js/audio.js` — effets sonores synthétisés (WebAudio).
- `js/creator.js` — atelier du héros : photo du visage, recadrage, teinte de peau.
- `js/game.js` — boucle de jeu, caméra, entrées tactiles, HUD, mini-carte.
- `build-standalone.js` — assemble une version en un seul fichier.

## Version autonome

Les cinq scripts partagent déjà la portée globale : `build-standalone.js` les concatène dans un
`<script>` inline pour produire une page qui se suffit à elle-même.

```sh
node build-standalone.js              # -> standalone.html (page complète, ouvrable au double-clic)
node build-standalone.js --artifact   # -> artifact.html (fragment sans doctype/head/body)
```

`standalone.html` et `artifact.html` sont générés : modifier `index.html` ou `js/`, puis relancer
la commande. La variante `--artifact` omet le doctype, l'en-tête et les balises `<body>`, que le
conteneur d'artefact fournit lui-même.
