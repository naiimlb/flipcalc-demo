// Le BANGERS, de bas en haut (d'après le visuel officiel du menu).
// Toute l'animation (ouverture, visite, fermeture, BANG!) est pilotée depuis cette liste :
// ajouter / retirer / réordonner une couche ici suffit.
//
//  part   : constructeur procédural (src/three/parts.js) ou nom du nœud dans un futur .glb
//  height : épaisseur de la couche quand le burger est fermé (unités 3D, pain ≈ rayon 1)
//  gap    : espace ajouté sous la couche quand le burger est éclaté
//  fx     : comportement continu une fois la couche détachée
export const LAYERS = [
  { id: 'bun-bottom', part: 'bunBottom', height: 0.40, gap: 0.0,  fx: 'bun',
    name: 'Sesame bun', note: 'la base', desc: 'Toasté, moelleux, il encaisse tout sans broncher.' },
  { id: 'roquette', part: 'roquette', height: 0.05, gap: 0.30, fx: 'leaf',
    name: 'Roquette', note: 'frais !', desc: 'Le quota de vert. Pour ta conscience.' },
  { id: 'beef-1', part: 'beef', height: 0.24, gap: 0.36, fx: 'beef',
    name: 'Beef smash', note: 'smash !', desc: 'Écrasé à la plancha, croûte qui croustille.' },
  { id: 'cheddar-1', part: 'cheddar', height: 0.03, gap: 0.34, fx: 'cheese',
    name: 'Cheddar US', note: 'ça coule', desc: 'Il fond, il coule, tu craques.' },
  { id: 'beef-2', part: 'beef', height: 0.24, gap: 0.36, fx: 'beef',
    name: 'Beef smash #2', note: 'encore !', desc: "Parce qu'un seul, c'était pas un Bangers." },
  { id: 'cheddar-2', part: 'cheddar', height: 0.03, gap: 0.34, fx: 'cheese',
    name: 'Cheddar US #2', note: 'x2', desc: 'Double dose, double dégoulinade.' },
  { id: 'egg', part: 'egg', height: 0.11, gap: 0.42, fx: 'egg',
    name: 'Œuf au plat', note: 'coulant', desc: 'Jaune brillant, prêt à exploser.' },
  { id: 'crunch', part: 'crunch', height: 0.10, gap: 0.40, fx: 'crunch',
    name: 'Lardons & crispy onions', note: 'crunch', desc: 'Fumés, dorés, ça croque de partout.' },
  { id: 'sauce', part: 'sauce', height: 0.05, gap: 0.38, fx: 'sauce',
    name: 'Sauce Bangers & BBQ', note: 'secret', desc: 'La recette maison. Demande pas.' },
  { id: 'bun-top', part: 'bunTop', height: 0.76, gap: 0.42, fx: 'lid',
    name: 'Sesame bun', note: 'le chapeau', desc: 'Doré, brillant, sésame qui danse.' },
];

export const CHIPS = ['2× beef smash', '2× cheddar US', 'œuf au plat', 'lardons fumés', 'crispy onions', 'sauce Bangers & BBQ'];
