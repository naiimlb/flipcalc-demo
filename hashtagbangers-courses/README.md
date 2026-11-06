# Hashtagbangers Courses

PWA iPhone pour faire les courses du resto **Hashtagbangers** (Roubaix) chez Métro et Salamarket.
On colle la liste, elle se range par rayon, on coche en magasin, et ce qui manque devient une liste
« Manquants » prête à envoyer au responsable (feuille de partage iOS, WhatsApp ou copier).

**En ligne : <https://hashtagbangers-courses.vercel.app>** (projet Vercel `hashtagbangers-courses`, dossier racine `hashtagbangers-courses/`).

Vite + React + TypeScript + Tailwind 4, sans backend : tout est stocké sur le téléphone (IndexedDB, avec une copie de secours
localStorage), et l'app marche hors ligne (service worker Workbox via `vite-plugin-pwa`).

## Lancer

```sh
cd hashtagbangers-courses
npm install
npm run dev          # http://localhost:5173 (et l'URL « Network » pour l'iPhone, même Wi-Fi)
npm test             # tests unitaires du parser, du classement et des manquants (Vitest)
npm run build        # typecheck + build dans dist/
```

Vérification complète au format iPhone 390 × 844 (Playwright, 54 contrôles + captures : parcours, fermeture brutale de l'onglet, mémoire des catégories, export / import) :

```sh
npm run build && npx vite preview --port 4173 &
node scripts/check-iphone.mjs http://localhost:4173/ captures
```

`npm run icons` régénère les icônes (180 / 192 / 512 / maskable), le favicon et les écrans de démarrage iOS.

## Où est quoi

| Fichier | Rôle |
| --- | --- |
| `src/lib/parser.ts` | Liste collée → articles (`2 x Huile 10L`, `Huile 10L x2`, `Frites - 8`, `3 Cheddar`, puces, numéros, prix, tabulations, totaux et en-têtes ignorés, doublons fusionnés). |
| `src/lib/categories.ts` | Les 11 catégories, leurs emojis, l'ordre de parcours par défaut et le dictionnaire de mots-clés. |
| `src/lib/categorize.ts` | Classement : règles apprises d'abord, puis le mot-clé le plus spécifique (insensible aux accents et à la casse, pluriels reconnus). |
| `src/lib/normalize.ts` | `productKey` : identité d'un produit (sans accents, casse, quantités, formats, pluriel) : « Poulet pané 5kg » = « poulet pane ». |
| `src/lib/lists.ts` | États (à prendre / partiel / complet), progression, regroupement, calcul des manquants (demandé − pris). |
| `src/lib/message.ts` | Message pour le responsable et lien WhatsApp. |
| `src/state/store.ts` | État de l'app et actions : chaque action est enregistrée aussitôt. |
| `src/state/db.ts`, `src/state/persistence.ts` | IndexedDB (une entrée par liste, transaction atomique) + copie localStorage synchrone ; au lancement la révision la plus récente gagne. |
| `src/state/snapshot.ts`, `src/lib/backup.ts` | Validation / nettoyage de tout ce qui est relu (stockage, fichier importé) ; export et import JSON. |
| `tests/` | Tests unitaires (dont la liste d'exemple, 100 % bien classée). |

## Utilisation en magasin

- **Tap** sur la ligne : tout est pris (ligne grisée, barrée, descend en bas de sa catégorie).
- **− / +** : prise partielle (ligne orange, « manque N »).
- **Glisser à gauche** : supprimer (avec « Annuler »).
- **Appui long** : renommer, changer la quantité demandée ou la catégorie (retenue pour les prochaines listes).
- **+** : ajouter un article à la main (catégorie détectée en direct).
- **Terminer les courses** : récap « ✅ Pris / ⚠️ Manquants » et envoi.

Les mots-clés, l'ordre des rayons et les catégories mémorisées se modifient dans **Réglages**.

## Sauvegarde automatique

- **Aucun bouton « Sauvegarder »** : coche, quantité, ajout, suppression, changement de catégorie, rayon replié, liste ouverte… tout est écrit tout de suite. Fermer l'app en plein milieu des courses puis la rouvrir redonne exactement le même écran.
- **IndexedDB** est la copie principale, avec `navigator.storage.persist()` demandé au lancement (l'état est visible dans Réglages > Sauvegarde). Une **copie localStorage synchrone** sert de filet : si iOS tue l'app avant la fin d'une écriture IndexedDB, la révision la plus récente est retrouvée au prochain lancement et IndexedDB est réparée.
- L'onglet **Listes** archive chaque liste : date, heure, magasin (Metro Lomme / Metro Wattrelos / Salamarket / Autre), statut (en cours / terminée), nombre pris et manquants.
- **Réglages > Sauvegarde** : « Exporter mes données » (fichier JSON via la feuille de partage iOS) et « Importer une sauvegarde » (remplace les données du téléphone, avec « Annuler » juste après). Les données de la v1 (localStorage seul) sont migrées automatiquement, l'ancienne copie n'est jamais effacée.

## Mémoire des catégories

- Appui long sur un article > **Changer de catégorie** : le choix est mémorisé pour ce produit (« Je m'en souviendrai pour la prochaine fois ✅ ») et **prime sur le dictionnaire de mots-clés**.
- Le produit est reconnu malgré les accents, la casse, les quantités, les formats et le pluriel (`Poulet pané 5kg` = `poulet pane`, `sauce algerienne 1L` = `Sauce algérienne`).
- **Renommer** un article dont la catégorie est mémorisée fait suivre la mémoire sous le nouveau nom.
- **Réglages > Mes catégories mémorisées** : voir les produits, modifier la catégorie de l'un, en oublier un, ou « Réinitialiser » (avec « Annuler »).

## Installer sur l'iPhone

1. Ouvrir l'URL dans **Safari**.
2. Bouton **Partager** (carré avec flèche ↑) → **« Sur l'écran d'accueil »** → **Ajouter**.
3. L'icône « HB Courses » s'ouvre en plein écran, sans barre Safari, et fonctionne sans réseau.

## Identité visuelle

Le « #HASHTAG® » est vectorisé à partir du logo officiel (`../hashtagbangers/public/logo.png`) et reste identique ;
« BANGERS. » devient « COURSES. » manuscrit avec un petit caddie au pinceau. Rose relevé sur le logo : `#ED1E79`,
trame de points en fond, Anton (titres), Permanent Marker (accents), police système iOS pour le texte.
