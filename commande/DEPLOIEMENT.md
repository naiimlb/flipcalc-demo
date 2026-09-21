# Déploiement — Commande Express

L'app est un site **statique** : aucun serveur, aucun build, aucune variable
d'environnement au sens classique. Elle est publiée par **GitHub Pages** depuis
ce dépôt, et la configuration Supabase tient dans un seul fichier versionné.

## URL publique

```
https://naiimlb.github.io/flipcalc-demo/commande/
```

Accessible en HTTPS, sans compte, partageable par message. Chaque `git push`
sur `main` redéploie le site (compter une à deux minutes).

---

## 1. Les deux valeurs à renseigner

Elles vont dans **[`js/config.js`](js/config.js)** — le seul fichier à modifier :

```js
export const SUPABASE_URL = 'https://xxxxxxxxxxxx.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6...';
```

| Valeur | Où la trouver | Nature |
|---|---|---|
| `SUPABASE_URL` | Supabase → **Project Settings → API** → *Project URL* | publique |
| `SUPABASE_ANON_KEY` | même page → *Project API keys* → **`anon` `public`** | publique |

> ### ⚠️ Ne jamais mettre la clé `service_role` dans ce fichier
> Le navigateur télécharge `config.js` : tout ce qu'il contient est lisible par
> n'importe qui. La clé `service_role` **contourne la RLS** et donnerait accès à
> toutes les données de tous les comptes. Elle ne doit jamais quitter Supabase.
> La clé `anon`, elle, est faite pour être publique : seules les règles RLS
> décident de ce qu'elle peut lire ou écrire.

Sans ces deux valeurs, l'app reste utilisable mais démarre en **mode local**
(données sur l'appareil, aucune synchro, pas de compte partagé entre téléphones).

Alternative sans toucher au code, pratique pour tester : écran de connexion →
**Configurer la sauvegarde cloud**. La configuration n'est alors valable que sur
cet appareil — pour un site public partagé, remplir `config.js`.

---

## 2. Créer la base (une fois)

1. Projet gratuit sur [supabase.com](https://supabase.com) — choisir une région UE.
2. **SQL Editor → New query** : coller tout [`supabase/schema.sql`](supabase/schema.sql) → **Run**.

Le script crée les 5 tables, les index, **active la RLS sur chacune** avec quatre
politiques par table (`select` / `insert` / `update` / `delete`, toutes en
`auth.uid() = user_id`), et la fonction `delete_my_account()` utilisée par la
suppression RGPD.

---

## 3. Authentification : Site URL et Redirect URLs

**Authentication → URL Configuration**

| Champ | Valeur |
|---|---|
| **Site URL** | `https://naiimlb.github.io/flipcalc-demo/commande/` |
| **Redirect URLs** | `https://naiimlb.github.io/flipcalc-demo/commande/**` |

Ajouter aussi, si vous testez en local : `http://localhost:8000/commande/**`.

Sans ces réglages, les liens de confirmation d'email et de mot de passe oublié
renvoient vers `localhost:3000` ou échouent avec *redirect_to not allowed*.

L'app sait traiter le retour de ces liens : elle consomme les jetons présents
dans l'URL, nettoie l'adresse, puis affiche « Email confirmé » ou ouvre
directement l'écran **« Choisis un nouveau mot de passe »**.

### Confirmation d'email : la désactiver pour tester, la réactiver ensuite

Par défaut, Supabase exige un clic sur un lien avant la première connexion, et
la boîte d'envoi gratuite est limitée à quelques emails par heure — pénible en
test.

**Désactiver** : Authentication → **Sign In / Providers → Email** →
décocher **Confirm email** → *Save*. Les comptes créés ensuite sont utilisables
immédiatement.

**Réactiver avant de donner le lien à de vrais clients** : même écran, recocher
**Confirm email**. Les comptes déjà créés restent valides. Pour un usage réel,
brancher aussi un SMTP maison (Authentication → **Emails → SMTP Settings**),
l'envoi intégré de Supabase étant bridé et non garanti.

---

## 4. Vérifier la RLS avec deux comptes

### a. Contrôle SQL (10 secondes)

Dans **SQL Editor** :

```sql
-- 1. La RLS est-elle active partout ? (rowsecurity doit valoir true 5 fois)
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('restaurants','suppliers','products','orders','order_lines')
order by tablename;

-- 2. Les politiques sont-elles en place ? (4 lignes par table, soit 20)
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
order by tablename, cmd;
```

### b. Test réel avec deux comptes

1. Sur l'iPhone (Safari), créer le compte **A** (`a@exemple.fr`), nommer le
   restaurant « Chez A », charger le kit fast-food.
2. Sur un ordinateur (ou Safari en navigation privée), créer le compte **B**
   (`b@exemple.fr`), restaurant « Chez B », **catalogue vide**.
3. **Attendu** : B voit 0 produit et 0 fournisseur. Aucune donnée de A n'apparaît.
4. Se reconnecter en A sur un troisième appareil : « Chez A » et ses 26 produits
   reviennent intégralement.
5. Contrôle côté serveur — **Table Editor → products** : les lignes de A et de B
   coexistent avec des `user_id` différents. C'est normal : la RLS filtre à la
   lecture, elle ne sépare pas les tables.

### c. Preuve directe (facultatif, sur ordinateur)

Connecté en **B**, ouvrir la console du navigateur sur le site et demander
*toutes* les lignes de la table, sans filtre :

```js
const { client } = await import('./js/cloud.js');
const sb = await client();
const { data } = await sb.from('products').select('id,name,user_id');
console.log(data.length, 'produits visibles');
```

**Attendu : `0 produits visibles`** alors que ceux du compte A existent bel et
bien en base. La requête ne demande pourtant aucun filtre : c'est la RLS qui
l'applique côté serveur. Si ce compteur affichait les produits de A, c'est que
`schema.sql` n'a pas été exécuté — à corriger avant de partager le lien.

---

## 5. Si vous changez d'hébergeur

L'app n'a aucune dépendance à GitHub Pages : déposer le dossier `commande/` sur
n'importe quel hébergement statique HTTPS (Netlify, Vercel, OVH…) suffit. Penser
alors à reporter la nouvelle URL dans **Site URL** et **Redirect URLs** Supabase.

Deux ressources sont chargées depuis Internet et doivent rester joignables :
la police Inter (Google Fonts) et la librairie `@supabase/supabase-js`
(esm.sh, avec bascule automatique sur jsDelivr). Le reste est servi par
l'hébergeur et mis en cache par le service worker pour le hors-ligne.
