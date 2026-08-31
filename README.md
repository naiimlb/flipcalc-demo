# flipcalc-demo

Deux mini-applis web autonomes (un seul fichier HTML chacune, aucune dépendance,
données conservées dans le navigateur via `localStorage`).

## `index.html` — FlipCalc
Calculateur de bénéfice pour l'achat-revente (Vinted, eBay, LeBonCoin, Facebook).

## `courses.html` — Ma Liste Métro
Liste de courses qui **trie automatiquement les articles dans l'ordre des rayons** :

1. Fruits & légumes
2. Hygiène & entretien
3. Boissons
4. Farine, lait, citron, vinaigre, Kinder… (épicerie)
5. Sauces
6. Produits frais (fromage)
7. Autres (articles non reconnus, à classer)

Utilisation : coller une liste (un article par ligne ou séparés par des virgules),
puis « Trier et ajouter ». Les quantités (`2 kg farine`, `x3 bananes`) sont conservées,
les doublons ignorés.

- Cocher un article pendant les courses (il descend en bas de son rayon)
- Corriger le rayon d'un article via le menu déroulant : **la correction est mémorisée**
  et appliquée automatiquement aux listes suivantes
- Copier la liste triée, tout décocher, retirer les articles cochés, tout effacer

Ouvrir le fichier directement dans un navigateur, ou l'ajouter à l'écran d'accueil du téléphone.
