# Mettre CinéMood en ligne

Ce guide part de zéro : aucun compte, aucune clé, rien d'installé. Compte
**une petite heure** la première fois. À la fin, tu auras une adresse
`https://…` à ouvrir sur ton iPhone et à ajouter à ton écran d'accueil.

> **À lire avant de commencer.** Je ne peux pas déployer à ta place : les
> comptes TMDB, Supabase et Vercel se créent avec **ton** e-mail, et les clés
> qui en sortent sont personnelles — elles ne doivent jamais transiter par une
> conversation. Le code, lui, est prêt : il est dans ce dépôt, sur la branche
> `claude/cinemood-recommendation-app-ua4t5d`.
>
> Bonne nouvelle : **l'étape 4 suffit** pour avoir une URL publique qui
> fonctionne. TMDB et Supabase (étapes 2 et 3) peuvent attendre — sans eux,
> l'app démarre en mode démo, avec un catalogue local de 145 titres.

---

## Sommaire

- [Étape 1 — Récupérer le code](#étape-1--récupérer-le-code)
- [Étape 2 — La clé TMDB (gratuite, 10 minutes)](#étape-2--la-clé-tmdb-gratuite-10-minutes)
- [Étape 3 — Supabase : les comptes (gratuit, 15 minutes)](#étape-3--supabase--les-comptes-gratuit-15-minutes)
- [Étape 4 — Déployer sur Vercel (gratuit, 10 minutes)](#étape-4--déployer-sur-vercel-gratuit-10-minutes)
- [Étape 5 — Claude, facultatif](#étape-5--claude-facultatif)
- [Étape 6 — Installer l'app sur l'iPhone](#étape-6--installer-lapp-sur-liphone)
- [Récapitulatif des variables](#récapitulatif-des-variables)
- [Checklist de test sur iPhone](#checklist-de-test-sur-iphone)
- [Si ça ne marche pas](#si-ça-ne-marche-pas)
- [Idées pour la V2](#idées-pour-la-v2)

---

## Étape 1 — Récupérer le code

Le code est déjà poussé sur GitHub, dans le dossier `cinemood/` du dépôt
`naiimlb/flipcalc-demo`, sur la branche
**`claude/cinemood-recommendation-app-ua4t5d`**.

Deux possibilités :

- **Tu veux juste déployer** → rien à faire ici, passe à l'étape 2. Vercel ira
  chercher le code directement sur GitHub.
- **Tu veux aussi le faire tourner sur ton ordinateur** → installe
  [Node.js 20 ou plus](https://nodejs.org), puis :

  ```bash
  git clone https://github.com/naiimlb/flipcalc-demo.git
  cd flipcalc-demo
  git checkout claude/cinemood-recommendation-app-ua4t5d
  cd cinemood
  npm install
  npm run dev
  ```

  Ouvre `http://localhost:3000`. L'app fonctionne déjà, en mode démo.

> **Fusionner la branche ?** Si tu veux que `cinemood/` rejoigne `main`, ouvre
> une pull request depuis GitHub et fusionne-la. Ce n'est pas nécessaire pour
> déployer : Vercel sait déployer n'importe quelle branche.

---

## Étape 2 — La clé TMDB (gratuite, 10 minutes)

TMDB (*The Movie Database*) fournit les titres, affiches, synopsis, notes,
genres, mots-clés, casting, classifications d'âge, bandes-annonces **et les
disponibilités par plateforme en France**. C'est la source de données de
CinéMood.

1. Va sur **<https://www.themoviedb.org/signup>** et crée un compte
   (e-mail + mot de passe). Valide l'e-mail de confirmation.
2. Connecte-toi, puis clique sur ton avatar en haut à droite →
   **Paramètres** (*Settings*).
3. Dans le menu de gauche, choisis **API**.
4. Clique sur **Créer** / *Request an API Key* → choisis **Developer**.
5. Accepte les conditions d'utilisation.
6. Un formulaire apparaît. Réponses qui passent sans problème :
   - *Type of Use* : **Personal / Educational**
   - *Application Name* : `CinéMood`
   - *Application URL* : `https://cinemood.vercel.app` (tu pourras corriger
     plus tard — mets n'importe quelle adresse plausible)
   - *Application Summary* : « Application personnelle de recommandation de
     films et séries selon l'humeur et les plateformes de streaming. »
   - Nom, adresse, pays : tes coordonnées.
7. Validation immédiate. Tu arrives sur une page qui affiche deux choses :

   | Ce que tu vois | Ce qu'il te faut |
   |---|---|
   | **API Key (v3 auth)** — 32 caractères | ❌ pas celle-ci |
   | **API Read Access Token (v4 auth)** — très long, commence par `eyJ…` | ✅ **celle-ci** |

8. Copie l'**API Read Access Token**. C'est la valeur de `TMDB_ACCESS_TOKEN`.

> ⚠️ Cette clé est **secrète**. Dans CinéMood elle n'est lue que côté serveur,
> jamais envoyée au navigateur. Ne la colle jamais dans un fichier que tu
> commites, ni dans un message.

---

## Étape 3 — Supabase : les comptes (gratuit, 15 minutes)

Supabase gère l'inscription, la connexion et la sauvegarde des profils.

### 3.1 Créer le projet

1. Va sur **<https://supabase.com>** → **Start your project** → connecte-toi
   avec GitHub (le plus simple).
2. **New project**.
   - *Name* : `cinemood`
   - *Database Password* : clique sur **Generate a password** et **garde-le
     dans ton gestionnaire de mots de passe**. Tu n'en auras pas besoin pour
     CinéMood, mais il est irrécupérable.
   - *Region* : **Frankfurt** ou **Paris** (le plus proche de tes utilisateurs).
   - *Plan* : **Free**.
3. Clique sur **Create new project** et patiente une à deux minutes.

### 3.2 Créer les tables

1. Menu de gauche → **SQL Editor** → **New query**.
2. Ouvre le fichier [`supabase/schema.sql`](supabase/schema.sql) de ce dépôt,
   **copie tout son contenu**, colle-le dans l'éditeur.
3. Clique sur **Run** (ou `Ctrl`/`Cmd` + `Entrée`).
4. Tu dois voir `Success. No rows returned`. C'est normal : le script crée des
   tables, il n'en lit aucune.
5. Vérifie : menu **Table Editor** → tu dois voir `profils`, `liste`,
   `interactions`, `expositions`, chacune marquée **RLS enabled**.

> Le script est rejouable : si tu le relances, rien ne casse.

### 3.3 Récupérer les deux valeurs

Menu **Project Settings** (l'engrenage) → **API** :

| Champ affiché | Variable CinéMood |
|---|---|
| **Project URL** (`https://xxxx.supabase.co`) | `NEXT_PUBLIC_SUPABASE_URL` |
| **Project API keys → `anon` `public`** | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |

> ⚠️ **Ne touche jamais à la clé `service_role`.** Elle contourne toutes les
> règles de sécurité. CinéMood ne l'utilise nulle part, et elle ne doit jamais
> quitter Supabase.
>
> La clé `anon`, elle, est *faite* pour être publique : c'est la Row Level
> Security (étape 3.2) qui décide de ce qu'elle peut lire ou écrire.

### 3.4 Régler l'authentification

Menu **Authentication** → **Providers** :

- **Email** est activé par défaut. Pour tester vite, va dans
  **Authentication → Sign In / Providers → Email** et **désactive**
  *Confirm email* : tu pourras créer un compte sans passer par ta boîte mail.
  Réactive-le quand l'app sera partagée à d'autres.
- **Google** et **Apple** sont facultatifs. Ils demandent chacun un compte
  développeur chez le fournisseur (et Apple est payant, 99 €/an). Les boutons
  sont déjà dans l'app : ils s'activeront d'eux-mêmes une fois les providers
  configurés côté Supabase. **Tu peux très bien t'en passer.**

Menu **Authentication → URL Configuration** : une fois l'étape 4 faite,
reviens ici et renseigne ton adresse Vercel dans **Site URL** et dans
**Redirect URLs** (`https://ton-app.vercel.app/**`).

---

## Étape 4 — Déployer sur Vercel (gratuit, 10 minutes)

1. Va sur **<https://vercel.com/signup>** → **Continue with GitHub**.
2. Autorise Vercel à accéder à tes dépôts (tu peux n'en autoriser qu'un).
3. **Add New… → Project** → trouve `flipcalc-demo` → **Import**.
4. **⚠️ Le réglage à ne pas rater** : ouvre **Root Directory**, clique sur
   **Edit**, et choisis le dossier **`cinemood`**.
   Sans ça, Vercel cherche une app à la racine du dépôt et échoue.
5. *Framework Preset* doit afficher **Next.js** tout seul. Laisse les
   commandes de build par défaut.
6. Déplie **Environment Variables** et ajoute ce que tu as :

   | Name | Value |
   |---|---|
   | `TMDB_ACCESS_TOKEN` | le token `eyJ…` de l'étape 2 |
   | `TMDB_REGION` | `FR` |
   | `TMDB_LANGUE` | `fr-FR` |
   | `NEXT_PUBLIC_SUPABASE_URL` | l'URL de l'étape 3.3 |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | la clé `anon` de l'étape 3.3 |

   Tu n'as encore aucune de ces valeurs ? **Déploie quand même** : l'app
   démarrera en mode démo, et tu ajouteras les variables plus tard.

7. **Deploy**. Une à trois minutes.
8. Vercel affiche ton adresse : `https://flipcalc-demo-xxxx.vercel.app`.
   **C'est ton URL publique.**

### Changer de branche déployée

Par défaut Vercel déploie `main`. Pour déployer la branche CinéMood :

**Settings → Git → Production Branch** → saisis
`claude/cinemood-recommendation-app-ua4t5d` → **Save** → puis
**Deployments → ⋯ → Redeploy**.

*(Ou, plus simple : fusionne la branche dans `main` sur GitHub, et Vercel
déploiera automatiquement à chaque push.)*

### Après coup : ajouter ou corriger une variable

**Settings → Environment Variables** → ajoute ou modifie → puis
**Deployments → ⋯ sur le dernier déploiement → Redeploy**.
Les variables ne sont lues qu'au build : sans redéploiement, rien ne change.

---

## Étape 5 — Claude, facultatif

Cette clé sert **uniquement** à reformuler la phrase « Pourquoi pour toi » de
façon plus naturelle. Sans elle, la phrase calculée par l'algorithme s'affiche
telle quelle — et elle est déjà bonne. Ajoute-la seulement si tu en as envie.

1. **<https://console.anthropic.com>** → crée un compte.
2. **Settings → API Keys → Create Key**. Copie la clé (`sk-ant-…`), elle ne
   sera plus affichée.
3. Ajoute du crédit (**Billing**) : quelques euros suffisent largement, les
   phrases coûtent une fraction de centime.
4. Dans Vercel, ajoute :

   | Name | Value |
   |---|---|
   | `ANTHROPIC_API_KEY` | `sk-ant-…` |
   | `ANTHROPIC_MODEL` | `claude-haiku-4-5-20251001` |

5. Redéploie.

---

## Étape 6 — Installer l'app sur l'iPhone

1. Ouvre ton adresse Vercel dans **Safari** (pas Chrome : sur iOS, seul Safari
   sait installer une app sur l'écran d'accueil).
2. Appuie sur le bouton **Partager** — le carré avec une flèche vers le haut,
   en bas de l'écran.
3. Fais défiler et choisis **« Sur l'écran d'accueil »**.
4. Le nom proposé est **CinéMood**. Appuie sur **Ajouter**.
5. L'icône dorée apparaît sur ton écran d'accueil.

Lancée depuis cette icône, l'app s'ouvre **en plein écran, sans la barre
d'adresse de Safari** : elle se comporte comme une application installée.

> **Si tu mets l'app à jour** (nouveau déploiement), ferme-la complètement
> (glisse-la hors du sélecteur d'apps) et rouvre-la. Le service worker
> récupère alors la nouvelle version.

---

## Récapitulatif des variables

| Variable | Obligatoire ? | Où la trouver | Secrète ? |
|---|---|---|---|
| `TMDB_ACCESS_TOKEN` | Pour les vraies données | TMDB → Paramètres → API → *API Read Access Token* | 🔒 **Oui** |
| `TMDB_REGION` | Non (`FR` par défaut) | — | Non |
| `TMDB_LANGUE` | Non (`fr-FR` par défaut) | — | Non |
| `NEXT_PUBLIC_SUPABASE_URL` | Pour les comptes | Supabase → Project Settings → API | Non |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Pour les comptes | Supabase → Project Settings → API (`anon public`) | Non |
| `ANTHROPIC_API_KEY` | Non | console.anthropic.com → API Keys | 🔒 **Oui** |
| `ANTHROPIC_MODEL` | Non | — | Non |

Règle simple : tout ce qui commence par `NEXT_PUBLIC_` part dans le
navigateur ; **tout le reste doit rester sur le serveur**. Ne préfixe jamais
`TMDB_ACCESS_TOKEN` ni `ANTHROPIC_API_KEY` par `NEXT_PUBLIC_`.

---

## Checklist de test sur iPhone

À faire une fois, tranquillement, sur ton téléphone. Coche au fur et à mesure.

### Installation et affichage

- [ ] L'adresse s'ouvre dans Safari sans erreur.
- [ ] « Sur l'écran d'accueil » fonctionne, l'icône dorée est nette.
- [ ] Lancée depuis l'icône : **pas de barre d'adresse**.
- [ ] Rien n'est masqué par l'encoche ou la Dynamic Island en haut.
- [ ] La barre d'onglets n'est pas coupée par la barre d'accueil en bas.
- [ ] En mode paysage, rien ne déborde sur les côtés.
- [ ] **Aucune barre de défilement horizontale** sur aucun écran.

### Saisie — le piège classique de Safari

- [ ] Champ « prénom » du test : **l'écran ne zoome pas** à la saisie.
- [ ] Champ de recherche de *Découvrir* : pas de zoom non plus.
- [ ] Champs e-mail et mot de passe : pas de zoom.
      *(Si l'un zoome, c'est qu'une police est passée sous 16 px.)*

### Parcours d'installation

- [ ] La vitrine s'affiche, le bouton « Commencer » réagit au doigt.
- [ ] **« Continuer » reste inactif tant qu'aucune plateforme n'est cochée.**
- [ ] « Je n'ai aucun abonnement » décoche tout et permet de continuer.
- [ ] Le test enchaîne bien 10 écrans, la barre de progression avance.
- [ ] « Retour » revient à l'écran précédent sans perdre les réponses.
- [ ] La grille « 5 préférés » bloque au 5ᵉ choix (les autres grisent).
- [ ] La grille « ton enfance » propose des titres cohérents avec ton année
      de naissance.
- [ ] L'écran final affiche un profil cinéma et un résumé.

### Recommandations

- [ ] La sélection s'affiche en moins de 3 secondes en 4G.
- [ ] Des squelettes de chargement apparaissent : **jamais d'écran vide**.
- [ ] **Chaque titre est sur une de tes plateformes** — vérifies-en trois.
- [ ] Chaque carte porte une phrase « Pourquoi pour toi » qui a du sens.
- [ ] Changer d'humeur change réellement la liste (compare « rire » et
      « envie de frissonner »).
- [ ] « En famille » ne propose que du tout public.
- [ ] Tirer vers le bas depuis le haut de la page recharge la sélection.
- [ ] Glisser une carte vers la gauche la fait disparaître ; vers la droite,
      elle rejoint « Ma liste ».

### Bande-annonce

- [ ] Un seul appui sur « Bande-annonce » ouvre le lecteur plein écran.
- [ ] La lecture démarre seule, **sans quitter l'app**.
- [ ] La croix ferme et rend le défilement à la page.

### Listes et profil

- [ ] « Ajouter à ma liste » remplit le marque-page, le titre est dans
      *Ma liste → À voir*.
- [ ] « Déjà vu 👍 » le déplace vers *Déjà vus*.
- [ ] *Profil* → décocher une plateforme fait disparaître ses titres de la
      sélection suivante.
- [ ] « Refaire le test » repart bien de l'écran 1.
- [ ] La suppression de compte demande confirmation avant d'agir.

### Robustesse

- [ ] Mode avion → l'app s'ouvre quand même, *Ma liste* reste consultable.
- [ ] Retour du réseau → la sélection se recharge.
- [ ] Fermer et rouvrir l'app : profil et liste sont toujours là.
- [ ] Réglages iOS → *Accessibilité → Réduire les animations* : l'app reste
      utilisable et calme.
- [ ] Texte agrandi (*Réglages → Affichage → Taille du texte*) : rien ne se
      chevauche.

---

## Si ça ne marche pas

| Symptôme | Cause la plus probable | Solution |
|---|---|---|
| Le build Vercel échoue tout de suite | *Root Directory* n'est pas `cinemood` | Settings → General → Root Directory → `cinemood` → Redeploy |
| L'app affiche « Mode démo » alors que tu as la clé TMDB | Variable absente, mal nommée, ou pas de redéploiement | Vérifie l'orthographe exacte `TMDB_ACCESS_TOKEN`, puis Redeploy |
| « Rien ne passe les filtres » | Peu de titres sur tes plateformes à cette humeur | Enlève l'humeur, ajoute une plateforme, augmente la durée max |
| Erreur 401 dans les logs Vercel | Tu as copié la clé v3 (32 caractères) | Reprends l'*API Read Access Token* (v4), celui qui commence par `eyJ` |
| L'inscription ne finalise jamais | *Confirm email* actif et mail non reçu | Supabase → Authentication → Email → désactive *Confirm email* |
| « Invalid redirect URL » à la connexion | Adresse Vercel non déclarée | Supabase → Authentication → URL Configuration → ajoute `https://ton-app.vercel.app/**` |
| Les affiches sont des compositions colorées, pas de vraies affiches | Tu es en mode démo | C'est normal : ajoute la clé TMDB |
| L'app ne se met pas à jour sur l'iPhone | Service worker en cache | Ferme l'app complètement et rouvre-la |

Pour voir ce qui se passe côté serveur : **Vercel → ton projet → Logs**. Les
erreurs y sont préfixées `[recommandations]`, `[recherche]`, `[pourquoi]` ou
`[bande-annonce]`.

---

## Idées pour la V2

### Monétisation — abonnement Stripe

CinéMood gratuit pour 5 recommandations par jour, illimité à 2,99 €/mois.
Stripe Checkout + un webhook qui écrit dans une table `abonnements`, et une
règle RLS qui borne le quota. Le travail réel est dans la gestion des états
(essai, actif, impayé, résilié), pas dans le paiement lui-même.

### Soirée à plusieurs, avec vote

Une personne crée une soirée, les autres rejoignent avec un code à quatre
lettres. Chacun swipe sur le même paquet de cartes ; le premier titre que tout
le monde garde est déclaré gagnant. Techniquement : une table `soirees`, le
Realtime de Supabase, et une **intersection des catalogues** — on ne propose
que ce qui est disponible chez *tous* les participants. C'est la fonction qui
transforme l'app en habitude sociale.

### Notifications de sorties sur tes plateformes

« *Dune : Troisième Partie* arrive sur Max jeudi. » Une tâche planifiée
compare chaque semaine les nouveautés TMDB au vecteur de goûts de chacun, et
n'envoie que ce qui dépasse un seuil élevé de pertinence. Les Web Push
fonctionnent sur iOS 16.4+ pour les apps installées sur l'écran d'accueil.

### Plus loin

- **Filtrage collaboratif** : « les gens qui ont ton profil ont adoré… ».
  Il faut quelques centaines d'utilisateurs avant que ce soit utile.
- **Reprendre où tu en étais** : mémoriser l'épisode en cours d'une série.
- **Humeur devinée** : proposer l'humeur probable selon l'heure et le jour,
  en laissant toujours la main.
- **Widget iOS** : la recommandation du soir directement sur l'écran
  d'accueil.
- **Export de la liste** au format CSV ou Letterboxd.
- **Réglages d'algorithme visibles** : un curseur « surprends-moi » qui pilote
  `DIVERSITE.partPepites` et `lambda`. Transformer un réglage interne en
  fonctionnalité assumée.
