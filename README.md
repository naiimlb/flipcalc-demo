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

Utilisation : coller une liste (un article par ligne ou séparés par des virgules),
puis « Trier et ajouter ». Les quantités (`2 kg farine`, `x3 bananes`) sont conservées,
les doublons ignorés.

- Cocher un article pendant les courses (il descend en bas de son rayon)
- Corriger le rayon d'un article via le menu déroulant : **la correction est mémorisée**
  et appliquée automatiquement aux listes suivantes
- Copier la liste triée, tout décocher, retirer les articles cochés, tout effacer

### Fin des courses et historique
Le bouton **« Fin des courses »** ouvre un bilan : chaque article y affiche la quantité
demandée (déduite du texte : « 8 yaourts », « 2 kg farine », « coca x3 » — 1 par défaut)
et la quantité réellement prise, ajustable avec `+` / `−` ou au clavier.

À l'enregistrement :
- ce qui a été pris en entier sort de la liste ;
- ce qui manque **reste dans la liste** pour la prochaine fois ;
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
