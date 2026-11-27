# Mode test (réservé au responsable)

Onglet **Test** (🧪) : diagnostic en direct, 13 tests, rapport à copier, journal d'anomalies, nettoyage. Code : `src/app/test`, `src/lib/testmode/*`, routes `src/app/api/test/*`. SQL : `supabase/migrations/2026-11-29_mode-test.sql` (et `supabase/schema.sql`).

## Te donner le rôle « responsable »

Supabase → SQL Editor, une seule fois (jamais dans l'app) :

```sql
update public.profiles set role = 'responsable' where email = 'toi@exemple.fr';
```
Puis ferme et rouvre l'app : l'onglet **Test** apparaît (aussi dans Réglages → « 🧪 Mode test »).

## Sécurité : pas seulement un bouton caché

| Couche | Ce qui est vérifié |
|---|---|
| Base (SQL) | Chaque fonction `test_*` commence par `test_guard()` : un caissier ou un anonyme reçoit « réservé au responsable » (42501). Les tables `test_config`, `planner_state`, `anomalies` sont fermées à tout le monde. Seul un responsable peut créer une tâche `is_test`. |
| Routes API | `/api/test/push` et `/api/test/status` vérifient le jeton puis appellent `is_manager()` : **401** sans jeton, **403** pour un caissier. |
| Page | Un caissier qui tape `/test` voit « Accès refusé » et ne déclenche aucun appel. |

**Jamais un vrai collègue** : une tâche de test ne peut être partagée / transmise qu'au *compte de test* que tu désignes (`share_task`, `transfer_send`) ; elle n'est lisible que par toi et ce compte (règle RLS `tasks_select`, même si une ligne de partage était forcée) ; le vrai planificateur **ignore toutes les données de test** (`push_tick_data`, relances, notifications) ; `/api/test/push` n'envoie qu'à **tes appareils** ou à ceux du compte de test (`test_target_subs`). Toutes les notifications de test portent « 🧪 ».

**Données de test** : tâches `is_test = true` (le partage, l'historique, les transmissions, les occurrences et les notifications en attente en dépendent et partent avec elles), anomalies de test `is_test = true`. Bouton **Nettoyer les données de test** (avec confirmation) : supprime tout cela, jamais les vraies données.

## Comment fonctionnent les tests

- **Accélération** : on ne « patiente » pas 5 minutes, on **fait vieillir** les lignes de test en base (`test_age`) puis on lance la VRAIE logique SQL des relances (`followups_run`, la même que le planificateur, avec un délai en secondes, 30 par défaut). Même principe pour les reports et les transmissions sans réponse.
- **Planificateur simulé** (tests 5, 8, 13) : le vrai code `runTick` tourne sur des données de test avec l'horloge du test, sans rien envoyer à personne.
- **Agir comme le compte de test** : `test_as` (réservé au responsable) exécute les vraies fonctions (`respond_share`, `occ_act`, `transfer_respond`) au nom du compte de test, seulement sur une tâche `is_test`, puis rend l'identité. Aucun 2ᵉ téléphone n'est nécessaire pour les tests automatiques.
- **Simulateur d'horloge** : « Faire comme s'il était… » ne s'applique qu'aux tests (jamais à l'app ni au vrai planificateur).
- Les tests eux-mêmes sont testés (`tests/testmode*.test.ts`) : ils passent sur le vrai schéma SQL et passent au rouge quand on casse le comportement.

## Les 13 tests

1. **Notification** : envoie une notification à cet appareil.
2. **Ouverture au clic** (manuel, 3 boutons : app fermée / arrière-plan / ouverte) : envoie la notification d'une tâche de test ; la page détail, en s'ouvrant, marque la tâche « vue » : le test attend ce signe (2 min) et affiche OK + le temps.
3. **Page détail** : Fait, Plus tard (15 min), Refuser, Reprendre, Laisser tomber ; statuts et historique vérifiés en base.
4. **Relance automatique** : 3 relances à 30 s (réglable), arrêt dès « vue », plafond ; affiche leur nombre (+ envoi sur l'appareil si coché).
5. **Rappel répété** : série « toutes les 30 min » et « toutes les 5 min » rejouée par le planificateur, passages simultanés compris : un rappel par créneau, aucun doublon, aucun oubli.
6. **Rappel plus tard** : 10 / 15 / 30 / 60 min ; relance des 5 min suspendue pendant le délai, retour à l'heure choisie, une seule fois.
7. **Partage** *(compte de test)* : « Chacun la fait » et « Un seul s'en occupe » ; le compte reçoit la tâche ; les rappels s'arrêtent quand l'un la prend ; partage vers un vrai collègue refusé.
8. **Bilan de fin de service** : bilan généré tout de suite (3 tâches non faites), transmettre, laisser tomber, actions groupées.
9. **Transmission** *(compte de test)* : arrivée chez le prochain caissier, acceptation, refus, sans réponse, toute l'équipe.
10. **Calculette** : 3 × 20 €, 2 × 5 €, 4 × 0,50 €, 7 × 0,01 € → billets 70,00 € (5), pièces 2,07 € (11), total 72,07 €, comparés en centimes + cas limites.
11. **Journée de service** : 01h30 = veille, relève 18h00/18h30, minuit, heure d'été (29/03) et d'hiver (25/10) : attendu vs obtenu.
12. **Session** : session valide, cookie persistant, refresh du jeton, date d'expiration.
13. **Simulateur d'horloge** : déclenche une fin de service à l'heure simulée, sans toucher l'heure réelle.

**Lancer tous les tests** exécute dans l'ordre tout ce qui est automatisable (les 3 tests d'ouverture au clic restent « non testé » : il faut toucher la notification ; 7 et 9 sont « non testés » sans compte de test), avec la durée de chacun, puis **Copier le rapport** (texte à me coller).

## Diagnostic en direct (pastilles)

Supabase · permission notifications · abonnement push · clés VAPID (côté serveur, booléens seulement) · service worker · app installée · **planificateur** (vert < 90 s, orange < 5 min, rouge au-delà : date du dernier passage) · fuseau Europe/Paris + écart d'horloge téléphone ↔ serveur (vert < 5 s) · notifications en attente / envoyées / en échec. Actualisé toutes les 15 s.

## Journal d'anomalies

Écrit par le planificateur (échec d'envoi, abonnement expiré, planificateur en erreur), par les tests, et par **🔎 Chercher** (relance qui ne s'arrête pas, relance après une action, transmission sans statut ou non clôturée, notification bloquée) — sans doublon sur 1 h. **Copier** / **Effacer**. 30 jours de conservation.

## Mise en place (dans cet ordre)

1. Migrations des 27, 28 et **29/11** (`supabase/migrations/…`) dans le SQL Editor (si pas déjà faites).
2. La commande SQL ci-dessus pour ton rôle.
3. Déployer. Rien d'autre (VAPID et secrets existants servent).

## Pas à pas avec un 2ᵉ compte de test

1. Crée un 2ᵉ compte caissier (autre email, ex. sur un 2ᵉ téléphone ou onglet privé) et renseigne « Mon planning » (ex. **Jour** tous les jours) pour tester « toute l'équipe ».
2. Sur ton téléphone responsable : onglet **Test**. Vérifie les pastilles ; active les notifications (Réglages) si besoin.
3. **Compte de test** : saisis l'email du 2ᵉ compte → Désigner → confirme.
4. (Facultatif) **Simulateur d'horloge** : choisis une heure de fin de service (ex. 18h15) → Appliquer.
5. **Lancer tous les tests**, puis **Copier le rapport** et colle-le moi. Les KO donnent attendu vs obtenu.
6. Tests manuels : « Ouverture au clic » × 3 : touche la notification app fermée / en arrière-plan / ouverte → OK avec le délai.
7. Sur le 2ᵉ téléphone (si abonné aux notifications) : coche « envoyer aussi sur mon appareil » ou ouvre l'app : les tâches de test partagées / transmises y apparaissent avec 🧪 ; accepte / refuse comme un vrai collègue.
8. **🔎 Chercher** puis lis le journal ; **Copier** si besoin.
9. **Nettoyer les données de test**.

## Limites assumées

- Les tests accélèrent le temps en base ; ils ne prouvent pas que le cron Supabase passe (c'est la pastille « Planificateur »).
- « Agir comme le compte de test » prouve la logique (mêmes fonctions SQL), pas l'affichage sur son téléphone.
- Les statuts « non faite » se déduisent (fin d'équipe passée), ils ne sont pas stockés.
