# Page détail d'une tâche, bilan de fin de service, transmission

SQL : `supabase/schema.sql` (section « PAGE DÉTAIL, BILAN DE FIN DE SERVICE, TRANSMISSION… ») et migration prête à coller : `supabase/migrations/2026-11-28_detail-bilan-transmission.sql` (à passer APRÈS celle du partage).

## 1. Page détail (`/taches/<id>?j=<journée>`), ouverte depuis la notification

Affiche titre, note, heure, équipe, qui l'a créée / partagée / transmise, et le **statut** : À faire · Vue · Reportée · Faite · Refusée · Transmise · Abandonnée · Non faite. Trois gros boutons (64 px) :

- **✅ Fait** : marque faite, arrête rappels et relances.
- **⏰ Rappelle-moi plus tard** : 10 / 15 / 30 / 60 min ou durée libre (1 à 720). Le rappel repart à l'heure choisie ; **pendant ce délai, aucune relance de 5 min**.
- **🚫 Refuser** : confirmation + motif facultatif (une ligne). Tâche partagée, assignée ou transmise → la personne qui me l'a envoyée est notifiée (« Prénom a refusé : titre »). Ma propre tâche → annulée pour aujourd'hui, personne n'est notifié.

Ouvrir la page = signe de vie (la relance s'arrête) mais la tâche reste « vue » tant qu'aucune action n'est choisie ; une tâche « vue » n'est plus relancée. Le bloc « Historique » liste chaque changement (qui, quand). Pour une tâche partagée en mode « un seul », un bouton « Je m'en occupe » reste disponible.

## 2. Bilan de fin de service (`/bilan?j=<journée>&e=jour|soir`)

- **Notification** : « Il te reste X tâches non faites », envoyée X minutes avant la fin de **mon équipe** (Réglages → « Bilan de fin de service », 15 min par défaut). Fin d'équipe = relève (18h00 / 18h30) pour l'équipe Jour, 02h00 pour l'équipe Soir. **Aucune notification s'il ne reste rien.** Il faut avoir indiqué son équipe dans « Mon planning » (repos ou planning absent : pas de bilan).
- Si le bilan n'a pas été ouvert, **un seul** second rappel 10 minutes plus tard (« Dernier rappel »), jamais plus.
- Sont comptées : les tâches de mon équipe de la journée, plus les tâches partagées acceptées et transmises acceptées ; pas les faites, refusées, transmises, abandonnées, ni celles prises par un collègue.
- Par tâche : **Transmettre au prochain caissier** ou **Laisser tomber** (confirmation). En haut : **Tout transmettre à la prochaine équipe** et **Tout laisser tomber**.
- « Laisser tomber » n'efface rien : statut « abandonnée » dans l'historique (`/historique`, 14 jours). Sans action, la tâche reste « non faite ».

## 3. Transmission

- Prochaine équipe : Jour → équipe **Soir du même jour** ; Soir → équipe **Jour du lendemain à 11h**. Choix : un collègue précis (planning de cette équipe ce jour-là, prénoms seulement) ou **toute la prochaine équipe** (le premier qui accepte la prend), avec un message de 140 caractères.
- Le destinataire reçoit « Prénom t'a transmis : titre » et **accepte ou refuse**. À l'acceptation, un rappel part au début de son équipe (« 📥 À toi : titre »).
- Refus de tous, ou pas de réponse dans le délai (**60 min par défaut**) → la tâche revient à l'expéditeur, prévenu (« Prénom a refusé : titre » / « Pas de réponse : titre »).
- Le destinataire ne voit la tâche **que pour la journée transmise** (pas ses jours habituels) ; il ne peut ni la modifier ni la supprimer.

## Réglages (sans toucher au code)

```sql
update public.app_config set value = 90 where key = 'transfer_timeout_min';  -- délai de réponse à une transmission (min)
update public.app_config set value = 15 where key = 'bilan_reminder_min';    -- second rappel du bilan (min)
```
Avec `relance_delay_min` et `relance_max` (voir PARTAGE.md). Le bilan se règle par personne (Réglages).

## Mise en place

1. Supabase → SQL Editor : colle `supabase/migrations/2026-11-28_detail-bilan-transmission.sql` → Run (rejouable).
2. Déploie l'app.

## Tester avec 2 comptes (Léa = A, Tom = B, tous deux caissiers avec « Mon planning » rempli : A Soir, B Jour le lendemain)

1. **Notification** : crée une tâche ce soir à l'heure dans 2 min, appuie sur la notification → la page détail s'ouvre (app fermée / arrière-plan / ouverte). Hors connexion : connexion puis retour sur la tâche.
2. **Fait / Plus tard / Refuser** : teste chaque bouton (en base : statut, historique). Partage la tâche à B puis refuse côté B → A reçoit « Tom a refusé : … ».
3. **Non faite → bilan** : laisse 2 tâches non faites. 15 min avant 02h00 (ou la relève pour l'équipe Jour) A reçoit « Il te reste 2 tâches non faites » ; ne l'ouvre pas : un 2ᵉ rappel arrive 10 min après.
4. **Transmettre** : dans le bilan, « Transmettre au prochain caissier » → B. B reçoit « Léa t'a transmis : … », ouvre, **accepte** ; la tâche apparaît dans son planning de la journée de la transmission, avec un rappel au début de son équipe.
5. **Refus / sans réponse** : retransmets une autre tâche, B refuse (ou attends le délai) → A est prévenu et la tâche lui revient.
6. **Laisser tomber** : abandonne la troisième (ou « Tout laisser tomber ») → elle apparaît « Abandonnée » dans l'historique.
