# Comptes : mise en route pas à pas

Chaque caissier crée librement son compte (email + mot de passe) et se connecte et retrouve ses tâches, ses rappels et ses réglages sur n'importe quel téléphone. Les données sont dans Supabase (plan gratuit).

> Les libellés de Supabase évoluent un peu : si un nom de menu diffère, cherche son équivalent.

## 1. Créer le projet Supabase
1. Va sur <https://supabase.com>, **Start your project**, connecte-toi (GitHub ou email).
2. **New project** : nom `hb-rappels`, choisis un **mot de passe de base de données** (note-le dans un gestionnaire de mots de passe), région **Europe** (Paris ou Frankfurt), plan **Free**.
3. Attends ~2 minutes que le projet soit prêt.

## 2. Créer les tables et la sécurité
1. Menu **SQL Editor** → **New query**.
2. Ouvre le fichier `supabase/schema.sql` de ce dépôt, copie **tout** son contenu, colle-le dans l'éditeur, clique **Run**.
3. Tu dois voir « Success. No rows returned ». Tu peux relancer le fichier sans risque.
4. Vérification : **Table Editor** → chaque table (`profiles`, `tasks`, `task_done`, `settings`, `push_subscriptions`) doit porter le badge **RLS enabled**.

## 3. Régler l'authentification
Menu **Authentication** :
- **Sign In / Providers → Email** : garde Email activé, garde **« Allow new users to sign up » activé** (inscription libre) et **désactive « Confirm email »**.
  Sans ça, chaque nouveau compte devrait cliquer sur un lien reçu par email, et l'envoi d'emails gratuit de Supabase est très limité (voir plus bas).
- **URL Configuration** :
  - *Site URL* : `https://hb-rappels.vercel.app`
  - *Redirect URLs* : ajoute `https://hb-rappels.vercel.app/reinitialiser` et `http://localhost:3000/reinitialiser`.

> Inscription libre = **toute personne qui connaît l'adresse de l'app peut créer un compte**. Elle n'a accès qu'à son propre espace vide (la base interdit de voir les données des autres), mais le responsable verra son prénom et son email dans « Mon équipe ». Si tu veux restreindre plus tard, on pourra remettre un code d'équipe.

### Emails de « Mot de passe oublié »
Le service d'email gratuit intégré à Supabase est **très limité** (quelques mails par heure, et seulement vers les adresses de ton équipe Supabase). Pour que le lien arrive chez tes caissiers, configure un envoi d'emails : **Authentication → Emails → SMTP Settings** (Resend, Brevo… ont un plan gratuit).
En attendant, si un caissier oublie son mot de passe : supprime son compte (**Authentication → Users**) et il en recrée un (ses tâches seront perdues).

## 4. Récupérer les clés
Menu **Project Settings → API** (ou *API Keys*) :

| Variable | Où la trouver | Secret ? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | *Project URL* | non |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | clé **anon / public** (ou *Publishable key*) | non (publique par conception) |

Ne copie **jamais** la clé `service_role` / *secret* dans l'app : elle donne tous les pouvoirs sur la base et n'est pas utilisée ici.

## 5. En local (`.env.local`)
```bash
cd rappels
cp .env.example .env.local
```
Remplis les 2 valeurs (URL et clé publique), puis :
```bash
npm install
npm run dev        # http://localhost:3000
```
Redémarre `npm run dev` après chaque modification de `.env.local`.

## 6. Désigner un responsable (jamais depuis l'app)
**SQL Editor** → New query :
```sql
update public.profiles set role = 'responsable' where email = 'toi@exemple.fr';
```
(Le compte doit déjà exister : crée-le d'abord depuis l'app.) Reconnecte-toi ou recharge l'app : « Mon équipe » apparaît dans Réglages. Pour repasser caissier : même requête avec `'caissier'`.

## 7. Tester avec 2 comptes différents
Un navigateur = une session. Utilise **deux fenêtres qui ne partagent pas leurs données** : une fenêtre normale et une fenêtre de **navigation privée** (ou deux navigateurs).
1. Fenêtre A : `http://localhost:3000` → *Créer mon compte* → prénom (ex. Léa), email, mot de passe. Ajoute la tâche « Tâche de Léa » (bouton **+** sur l'écran Aujourd'hui).
2. Fenêtre B (privée) : crée un 2e compte (ex. Tom) et ajoute « Tâche de Tom ».
3. Vérifie : A ne voit que « Tâche de Léa », B que « Tâche de Tom ». Recharge chaque fenêtre : c'est pareil.
4. Désigne Léa responsable (étape 6), recharge A : Réglages → **Mon équipe** → Tom → assigne « Nettoyer la friteuse ». Dans B, la tâche apparaît (avec 📌 *Assignée*) au rechargement ou au retour sur l'app. Léa, elle, ne voit pas les tâches de Tom.
5. Test de déconnexion : Réglages → **Me déconnecter** → tu retombes sur l'écran de connexion, et ouvrir `/` te renvoie dessus.

## 8. Déployer sur Vercel
1. Vercel → projet **hb-rappels** → **Settings → Environment Variables**. Ajoute les 2 variables `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Production + Preview), valeurs normales.
2. **Redéploie** (Deployments → ⋯ → Redeploy) : les variables `NEXT_PUBLIC_…` sont intégrées à la construction de l'app, elles ne sont prises en compte qu'au déploiement suivant.
3. Teste sur <https://hb-rappels.vercel.app> avec ton téléphone.

## Ce que la base stocke
Prénom, email, tâches (et leur état « fait »), réglages, et plus tard les abonnements aux notifications push. Rien d'autre.

## À savoir (v1)
- Les pages sont protégées côté app (redirection vers la connexion) ; la vraie barrière, ce sont les règles RLS de la base, testées dans `tests/rls.test.ts`.
- Un caissier peut modifier ou supprimer une tâche que son responsable lui a assignée.
- Le responsable ne voit **que** la liste des caissiers (prénom, email) et peut leur créer des tâches : il ne lit ni leurs tâches, ni leur avancement.
- Les changements d'un autre téléphone apparaissent quand on revient sur l'app (ou en rechargeant), pas en temps réel.
- Le rappel « envoyé » est mémorisé par téléphone : les rappels sonnent tant que l'app est ouverte (vrais push : voir `PUSH.md`).
