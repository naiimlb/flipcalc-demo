# Commande Express

**Compte ton stock, envoie ta commande fournisseur en 2 minutes.**

Application web mobile-first, en français, pour les gérants de fast-food, snacks et
traiteurs indépendants. Elle tient dans un dossier statique : ni build, ni bundler,
ni dépendance npm. HTML + CSS + modules ES.

👉 **[https://naiimlb.github.io/flipcalc-demo/commande/](https://naiimlb.github.io/flipcalc-demo/commande/)**

Installation, configuration Supabase et vérification de la sécurité :
**[DEPLOIEMENT.md](DEPLOIEMENT.md)**.

---

## Ce qu'elle fait

| Écran | Rôle |
|---|---|
| **Accueil** | Bouton « Faire l'inventaire », produits sous le seuil, dernières commandes |
| **Inventaire** | Produits groupés par zone, stock modifiable en − / + ou saisie directe. Orange = sous le stock cible, rouge = rupture |
| **Commande** | Lignes groupées par fournisseur, quantités proposées et modifiables, envoi WhatsApp / SMS / Email / Copier |
| **Historique** | Commandes passées, statut brouillon / envoyée / reçue, « recommander à l'identique » |
| **Produits / Fournisseurs** | Liste, recherche, ajout, modification, suppression |
| **Réglages** | Profil, thème, sauvegarde cloud, mentions légales, RGPD, déconnexion, suppression du compte |

### Quantité proposée

```
besoin  = max(0, stock cible − stock actuel)
quantité = arrondi au multiple de conditionnement supérieur
```

Exemple : cible 12, stock 4, carton de 6 → besoin 8 → **12** (2 cartons).
La quantité reste modifiable ligne par ligne avant l'envoi.

### Message envoyé

```
Bonjour Frais & Co, commande de Burger du Coin du 21 septembre 2026 :
- 12 x Cheddar en tranches 1 kg (carton de 6)
- 10 x Tomates rondes (cageot de 5 kg)

Livraison souhaitée : 22 septembre 2026. Merci !
```

Le message part par `wa.me`, `sms:` ou `mailto:` avec le texte encodé — donc par
l'application déjà installée sur le téléphone. **Aucune API externe, aucun message
ne transite par un serveur tiers.**

---

## Installer sur iPhone

1. Ouvrir l'URL de l'app dans **Safari** (pas dans une app tierce).
2. Bouton **Partager** → **Sur l'écran d'accueil**.
3. L'app se lance en plein écran, avec son icône, son écran de lancement et le
   respect des zones sûres (encoche, barre d'accueil).

Fonctionne également sur Android (Chrome → « Installer l'application ») et sur
ordinateur.

Détails iOS pris en charge : `viewport-fit=cover` + `env(safe-area-inset-*)`,
hauteurs en `dvh`, cibles tactiles ≥ 44 px, champs de saisie à 16 px (pas de zoom
automatique), clavier numérique pour les quantités, aucune interaction au survol.

---

## Réseau faible

Toutes les écritures passent d'abord par l'appareil (`localStorage`), puis sont
poussées vers le cloud dès que la connexion revient. Un bandeau indique l'état
« hors ligne » et le nombre de modifications en attente. Un service worker met
l'app en cache : elle démarre même sans réseau, en cave comme en chambre froide.

---

## Brancher la sauvegarde cloud (Supabase)

> Procédure complète, URL de redirection et test de sécurité :
> **[DEPLOIEMENT.md](DEPLOIEMENT.md)**.

Sans configuration, l'app démarre en **mode local** : tout reste sur l'appareil.
Pour retrouver ses données après reconnexion sur un autre téléphone :

1. Créer un projet gratuit sur [supabase.com](https://supabase.com).
2. **SQL Editor → New query** : coller et exécuter [`supabase/schema.sql`](supabase/schema.sql).
   Ce script crée les tables, les index, les politiques **Row Level Security**
   (chaque utilisateur ne voit que ses propres lignes) et la fonction
   `delete_my_account()` utilisée par la suppression RGPD.
3. **Project Settings → API** : copier l'`URL` du projet et la clé publique `anon`.
4. Renseigner les deux valeurs dans [`js/config.js`](js/config.js) (site public),
   ou, pour un essai sur un seul appareil, écran de connexion →
   **Configurer la sauvegarde cloud**.

La clé `anon` est publique par nature ; c'est la RLS qui protège les données.

La clé `service_role` ne doit **jamais** figurer dans ces fichiers : elle
contourne la RLS et `config.js` est téléchargé par chaque navigateur.

> **Authentification par email** : si la confirmation d'email est activée dans
> Supabase (Authentication → Providers → Email), le nouvel utilisateur doit cliquer
> le lien reçu avant de pouvoir se connecter. Le « mot de passe oublié » renvoie sur
> l'URL de l'app.

---

## Modèle de données

```
restaurants  nom, type (fast-food | snack | traiteur), adresse
suppliers    nom, téléphone/WhatsApp, email, jours de commande
products     nom, zone, unité, conditionnement, fournisseur, stock cible, stock actuel
orders       fournisseur, date, date de livraison, statut, canal, message
order_lines  commande, produit, quantité, conditionnement
```

Zones : Frigo, Congélateur, Sec, Boissons, Emballages.
Chaque ligne porte `updated_at` et `deleted_at` : la synchro est un simple
« la dernière écriture gagne », et les suppressions se propagent entre appareils.

---

## Kits de départ

À la troisième étape de l'onboarding, au choix : un catalogue vide, ou un kit
pré-rempli et entièrement modifiable.

- **Fast-food** — 26 produits, 3 fournisseurs (steaks, pain burger, frites, cheddar,
  salade, tomates, sauces, nuggets, boissons, gobelets, boîtes à emporter…)
- **Snack** — 18 produits, 3 fournisseurs
- **Traiteur** — 18 produits, 3 fournisseurs

Les fournisseurs des kits sont fictifs (`…@example`) : à remplacer par les vrais
contacts avant le premier envoi.

---

## Structure

```
commande/
├── index.html              coquille + métadonnées PWA / iOS
├── manifest.webmanifest
├── sw.js                   cache de l'app pour le hors-ligne
├── css/styles.css          thème sombre + clair, tous les composants
├── icons/                  icônes PWA et écrans de lancement iOS
├── js/
│   ├── app.js              démarrage, routeur, barre d'onglets
│   ├── store.js            base locale d'abord + synchro Supabase
│   ├── auth.js             comptes cloud ou local
│   ├── config.js           URL + clé anon Supabase (le fichier à remplir)
│   ├── cloud.js            client Supabase
│   ├── seed.js             kits de départ
│   ├── message.js          message de commande, liens wa.me / sms: / mailto:
│   ├── theme.js, ui.js     thème, icônes, feuilles modales, toasts, formats
│   └── screens/            un module par écran
└── supabase/schema.sql     tables + Row Level Security + suppression RGPD
```

## Hors périmètre

Pas de connexion caisse, food cost, fiches techniques, comparateur de prix,
multi-sites, facturation, paiement ni gestion d'équipe — volontairement.
