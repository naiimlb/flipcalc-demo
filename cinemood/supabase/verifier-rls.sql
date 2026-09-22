-- =====================================================================
-- Vérification des règles de sécurité, sur un vrai PostgreSQL.
-- ---------------------------------------------------------------------
-- Déroule le parcours complet : inscription, enregistrement du profil,
-- ajout d'un film, déconnexion, reconnexion, puis tentative d'accès par
-- un second compte.
--
-- Chaque « connexion » consiste à prendre le rôle `authenticated` et à
-- poser le sub du jeton : c'est exactement ce que fait PostgREST quand
-- l'app parle à Supabase avec le jeton d'une personne connectée.
--
-- Les constats sont consignés dans `_verdicts` au fur et à mesure, pour
-- que le résultat soit vérifiable par une machine et pas seulement
-- lisible à l'œil.
-- =====================================================================
\set ON_ERROR_STOP on
\set LEA  '11111111-1111-4111-8111-111111111111'
\set TOM  '22222222-2222-4222-8222-222222222222'
\pset border 2

\echo ''
\echo '=== 1. INSCRIPTION DE DEUX COMPTES DE TEST ==========================='
-- C'est le service Auth de Supabase qui écrit dans auth.users. On le
-- simule ici ; le trigger du schéma doit créer le profil tout seul.
insert into auth.users (id, email) values
  (:'LEA', 'lea.test@cinemood.fr'),
  (:'TOM', 'tom.test@cinemood.fr');

select email, (select count(*) from public.profils p where p.id = u.id) as profil_cree_par_le_trigger
from auth.users u order by email;

insert into public._verdicts (intitule, attendu, obtenu)
select 'Profil créé automatiquement à l''inscription', '2', count(*)::text from public.profils;

\echo ''
\echo '=== 2. LÉA SE CONNECTE ET ENREGISTRE SON PROFIL ====================='
set role authenticated;
set request.jwt.claim.sub = :'LEA';
select auth.uid() as utilisateur_connecte;

update public.profils
   set pseudo = 'Léa', annee_naissance = 1994,
       plateformes = '{netflix,max,disneyplus}',
       genres_adores = '{Science-Fiction,Thriller}',
       gouts = '{"genres":{"Science-Fiction":0.42}}'::jsonb,
       plateformes_ok = true, test_termine = true
 where id = auth.uid();

\echo '--- Léa ajoute un film à sa liste ---'
insert into public.liste (utilisateur_id, titre_id, statut, titre_cache)
values (auth.uid(), 'film:27205', 'a_voir',
        '{"id":"film:27205","titre":"Inception","annee":2010}'::jsonb);

insert into public.interactions (utilisateur_id, titre_id, signal)
values (auth.uid(), 'film:27205', 'ajout_liste');

select count(*) as films_dans_la_liste_de_lea from public.liste;

\echo ''
\echo '=== 3. DÉCONNEXION ==================================================='
reset request.jwt.claim.sub;
select coalesce(auth.uid()::text, 'personne') as utilisateur_connecte;
select count(*) as lignes_visibles_sans_compte from public.liste;

insert into public._verdicts (intitule, attendu, obtenu)
select 'Déconnecté, plus aucune ligne n''est visible', '0', count(*)::text from public.liste;

\echo ''
\echo '=== 4. RECONNEXION DE LÉA — LE FILM EST-IL TOUJOURS LÀ ? ============='
set request.jwt.claim.sub = :'LEA';
select titre_id, statut, titre_cache ->> 'titre' as titre from public.liste;
select pseudo, plateformes, genres_adores, gouts, test_termine from public.profils;

insert into public._verdicts (intitule, attendu, obtenu)
select 'Après reconnexion, le film est retrouvé', 'Inception',
       coalesce(max(titre_cache ->> 'titre'), '(rien)') from public.liste;

insert into public._verdicts (intitule, attendu, obtenu)
select 'Après reconnexion, les plateformes sont retrouvées', 'netflix,max,disneyplus',
       coalesce(max(array_to_string(plateformes, ',')), '(rien)') from public.profils;

insert into public._verdicts (intitule, attendu, obtenu)
select 'Après reconnexion, le profil de goûts est retrouvé', '0.42',
       coalesce(max(gouts #>> '{genres,Science-Fiction}'), '(rien)') from public.profils;

\echo ''
\echo '=== 5. TOM SE CONNECTE — VOIT-IL LES DONNÉES DE LÉA ? ================'
set request.jwt.claim.sub = :'TOM';
select auth.uid() as utilisateur_connecte;
select count(*) as films_visibles_par_tom        from public.liste;
select count(*) as interactions_visibles_par_tom from public.interactions;
select count(*) as profils_visibles_par_tom      from public.profils;

insert into public._verdicts (intitule, attendu, obtenu)
select 'Un autre compte ne voit aucun film de Léa', '0', count(*)::text from public.liste;

insert into public._verdicts (intitule, attendu, obtenu)
select 'Un autre compte ne voit aucune interaction de Léa', '0', count(*)::text from public.interactions;

insert into public._verdicts (intitule, attendu, obtenu)
select 'Un autre compte ne voit que son propre profil', '1', count(*)::text from public.profils;

insert into public._verdicts (intitule, attendu, obtenu)
select 'Le pseudo de Léa reste invisible', '(vide)',
       coalesce(nullif(max(pseudo), ''), '(vide)') from public.profils;

\echo ''
\echo '=== 6. TOM PEUT-IL ÉCRIRE DANS LA LISTE DE LÉA ? ====================='
-- L'insertion DOIT être refusée par la politique. On consigne le
-- résultat dans les deux cas, pour qu'un refus absent soit visible.
do $$
begin
  insert into public.liste (utilisateur_id, titre_id, statut)
  values ('11111111-1111-4111-8111-111111111111', 'film:999', 'a_voir');
  insert into public._verdicts (intitule, attendu, obtenu)
  values ('Écriture dans la liste d''un autre compte', 'refusée', 'ACCEPTÉE');
exception when insufficient_privilege then
  insert into public._verdicts (intitule, attendu, obtenu)
  values ('Écriture dans la liste d''un autre compte', 'refusée', 'refusée');
end $$;

with efface as (delete from public.liste where titre_id = 'film:27205' returning 1)
insert into public._verdicts (intitule, attendu, obtenu)
select 'Suppression des données d''un autre compte', '0 ligne', count(*)::text || ' ligne' from efface;

\echo ''
\echo '=== 7. VÉRIFICATION FINALE — LÉA RETROUVE TOUT ======================='
set request.jwt.claim.sub = :'LEA';
select titre_cache ->> 'titre' as film_toujours_present, statut from public.liste;

insert into public._verdicts (intitule, attendu, obtenu)
select 'Le film de Léa a survécu aux tentatives de Tom', 'Inception',
       coalesce(max(titre_cache ->> 'titre'), '(perdu)') from public.liste;

\echo ''
\echo '=== VERDICTS ========================================================='
reset role;
select intitule, attendu, obtenu,
       case when attendu = obtenu then 'OK' else 'ÉCHEC' end as resultat
  from public._verdicts order by ordre;

\echo ''
select case when count(*) = 0 then 'RESULTAT_GLOBAL=OK'
            else 'RESULTAT_GLOBAL=ECHEC(' || count(*) || ')' end as bilan
  from public._verdicts where attendu <> obtenu;
