# flipcalc-demo

Deux mini-applis web autonomes (un seul fichier HTML chacune, aucune dépendance,
données conservées dans le navigateur via `localStorage`).

## `index.html` — FlipCalc
Calculateur de bénéfice pour l'achat-revente (Vinted, eBay, LeBonCoin, Facebook).

## `courses.html` — Ma Liste Métro (charte #HASHTAGBANGERS)
Liste de courses qui **trie automatiquement les articles dans l'ordre des rayons** :

1. Fruits & légumes
2. Épicerie (farine, lait, citron, vinaigre, Kinder…)
3. Sauces
4. Boissons
5. Hygiène & entretien
6. Produits frais (fromage)
7. Autres (articles non reconnus, à classer)

L'ordre est défini par le tableau `CATEGORIES` en haut du `<script>` : le déplacer suffit
à changer l'ordre d'affichage.

Le classement se fait en trois niveaux de priorité, pour que le parfum d'un produit
ne décide jamais du rayon :
1. **produit ou marque** (`oasis`, `chips`, `yaourt`, `sauce`, `lessive`…) ;
2. les autres mots reconnus ;
3. **parfums et variétés** (`pomme`, `fraise`, `citron`, `chocolat`…), en dernier recours.

Ainsi `oasis pomme poire` part en boissons, `chips pomme paille` en épicerie et
`pommes` en fruits & légumes. Ce qui suit « saveur », « goût » ou « parfum » est ignoré
pour le classement (`chips saveur poulet` reste en épicerie).

Utilisation : coller une liste (un article par ligne ou séparés par des virgules),
puis « Trier ma liste ». Les doublons sont ignorés.

**Listes copiées depuis Métro** — dans `METRO PROFESSIONAL Mini bobine 2 plis 200 feuilles
x 6 — 1 Pack` ou `REBLOCHON DE SAVOIE 450G — 5 Piece`, c'est **ce qui suit le tiret final**
qui donne la quantité (1 pack, 5 pièces) ; les contenances citées dans le nom (750 ml, 450 g,
x 6) ne sont que la description du produit. Cette fin de ligne est retirée du nom affiché,
la quantité passe dans la pastille.

**Quantités** — détectées à l'ajout et affichées en pastille sur chaque article :
`8 yaourts` → ×8, `2 kg farine` → 2 kg, `coca x6` → ×6, `1,5 l lait` → 1,5 l ;
1 par défaut. Un conditionnement compte pour un article à prendre, pas pour son contenu :
`pack de 6 bobines` → 1 pack, `lot de 4 compotes` → 1 lot, mais `2 packs de coca` → 2 packs
et `6 bouteilles d'eau` → 6 bouteilles. Un appui sur la pastille permet de la corriger.
C'est cette quantité que le bilan de fin de courses propose d'ajuster.

**Rayon mémorisé** — un article non reconnu part dans « Autres », signalé en pointillé
avec « Choisis son rayon → ». Le rayon choisi (là ou sur un article mal classé) est
mémorisé : il s'applique aux prochaines listes, aux libellés qui contiennent ce produit
(ranger `pommes paille` range aussi `chips pommes paille`) et aux articles déjà présents
dans la liste.

- Cocher un article pendant les courses (il descend en bas de son rayon)
- Corriger le rayon d'un article via le menu déroulant : **la correction est mémorisée**
  (le lien « Réinitialiser les rayons mémorisés » les efface et reclasse la liste)
- Copier la liste triée, tout décocher, retirer les articles cochés, tout effacer

### Fin des courses et historique
Le bouton **« Fin des courses »** ouvre un bilan : chaque article y affiche la quantité
demandée (déduite du texte : « 8 yaourts », « 2 kg farine », « coca x3 » — 1 par défaut)
et la quantité réellement prise, ajustable avec `+` / `−` ou au clavier.

À l'enregistrement :
- ce qui a été pris en entier sort de la liste ;
- ce qui manque **reste dans la liste**, marqué d'une étiquette rose
  (« MANQUE 3 SUR 8 », « MANQUE 1 KG SUR 2 KG », « PAS PRIS »), et sa quantité
  devient ce qu'il reste à prendre ;
- la course part dans l'**historique** avec le détail des manquants, sous la forme
  `5 au lieu de 8`, `1 kg au lieu de 2 kg` ou `pas pris (0 / 1)`.

L'historique garde les 30 dernières courses (date, heure, articles pris sur le total).
Chaque course se déplie et propose de **remettre les manquants dans la liste** en un clic,
ou de la supprimer.

Ouvrir le fichier directement dans un navigateur, ou l'ajouter à l'écran d'accueil du téléphone.

### Personnalisation du design
- Charte reprise du logo : rose de marque `#EA1F79` sur fond noir, typo condensée
  capitales (Anton) et lettrage marqueur (Permanent Marker), trame de points façon
  halftone du logo.
- Toutes les couleurs sont regroupées dans le bloc `:root` en haut du `<style>`
  (`--bg`, `--surface`, `--accent`, `--accent-2`, `--ink`…) : une seule modification
  suffit à recaler toute l'appli.
- Le logo est le fichier `logo.jpg` placé à côté de `courses.html` ; s'il est absent
  ou remplacé, le lettrage texte `#HASHTAGBANGERS®` prend le relais automatiquement.
