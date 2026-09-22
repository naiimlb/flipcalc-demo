# CinéMood — version de démonstration

**URL publique** (une fois la branche fusionnée dans `main`) :

```
https://naiimlb.github.io/flipcalc-demo/cinemood-demo/
```

Ouvrable directement dans Safari sur iPhone, sans installation, sans
compte, sans clé d'API.

---

## Pourquoi cette version existe

L'application de production est [`cinemood/`](../cinemood/) : Next.js,
TMDB et Supabase côté serveur. Elle a besoin d'un hébergeur qui exécute
du code — Vercel — et de deux clés d'API.

Ce dépôt, lui, publie déjà des pages statiques via GitHub Pages. Cette
version-ci en profite : elle est **ouvrable immédiatement**, et elle fait
tourner **exactement le même moteur de recommandation**.

| | Version statique (ici) | App Next.js |
|---|---|---|
| Hébergement | GitHub Pages | Vercel |
| Clés nécessaires | aucune | TMDB, Supabase |
| Catalogue | 237 titres locaux | TMDB, région FR, temps réel |
| Affiches | compositions typographiques | vraies affiches TMDB |
| Bandes-annonces | recherche YouTube | lecteur intégré |
| Comptes | données sur l'appareil | Supabase, synchronisé |
| **Moteur** | **identique** | **identique** |

## Aucune logique dupliquée

Le moteur (`cinemood/src/lib/reco/`) est du TypeScript sans aucune
dépendance. Le script [`construire-demo.mjs`](../cinemood/scripts/construire-demo.mjs)
en retire les types avec l'API native de Node et réécrit les chemins
d'import : on obtient des modules ES que le navigateur lit directement.

```bash
cd cinemood
npm run construire:demo    # régénère cinemood-demo/moteur/
```

`cinemood-demo/moteur/` est donc **généré** : il ne se modifie jamais à
la main. Corriger l'algorithme dans `cinemood/src/lib/reco/`, relancer
la commande, et les deux versions restent alignées — ce qui garantit que
les 152 tests unitaires valident bien ce qui tourne ici.

## Ce qui est réellement testé

```bash
cd cinemood
npm run tester:iphone      # parcours complet dans un vrai navigateur
```

Le script pilote Chromium en **390 × 844 à densité 3** (iPhone 14/15/16),
avec émulation tactile et user-agent Safari iOS, et déroule tout le
parcours : vitrine → plateformes → les dix écrans du test → accueil →
changement d'humeur → mode famille → bande-annonce → Découvrir →
Ma liste → Profil.

À chaque étape il capture l'écran et vérifie l'absence de défilement
horizontal. En fin de course il contrôle la police de tous les champs
(sous 16 px, Safari zoome), la taille des cibles tactiles (44 px
minimum) et les erreurs JavaScript.

## Structure

```
cinemood-demo/
├── index.html              Coquille et métadonnées PWA
├── manifest.webmanifest    Installation sur l'écran d'accueil
├── css/styles.css          Système de design, en CSS natif
├── js/
│   ├── app.js              Amorçage et routage par ancre
│   ├── noyau.js            État, rendu, briques d'interface
│   └── ecrans.js           Les sept écrans
├── moteur/                 ⚠ GÉNÉRÉ — ne pas modifier
└── icons/                  Icônes et écrans de lancement
```

Le routage passe par l'ancre (`#/accueil`) : GitHub Pages sert des
fichiers statiques et ne sait pas réécrire les URL.

## Installer sur l'écran d'accueil

1. Ouvrir l'adresse dans **Safari** (pas Chrome : sur iOS, seul Safari
   installe une app sur l'écran d'accueil).
2. Bouton **Partager** → **« Sur l'écran d'accueil »** → **Ajouter**.
3. Lancée depuis l'icône, l'app s'ouvre en plein écran, sans barre
   d'adresse.

## Limites assumées

- Les **disponibilités par plateforme** du catalogue local sont
  illustratives et figées : elles servent à démontrer le filtrage
  strict, pas à renseigner sur l'offre réelle du jour.
- Les **affiches** sont des compositions typographiques déterministes :
  sans clé TMDB, aucune image n'est disponible.
- Les **données restent sur l'appareil** : pas de compte, pas de
  synchronisation entre téléphone et ordinateur.

Ce produit utilise l'API TMDB mais n'est pas approuvé ni certifié par
TMDB. Les pastilles de plateformes sont des marqueurs colorés : aucun
logo de marque déposée n'est embarqué.
