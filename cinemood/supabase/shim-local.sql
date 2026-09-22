-- =====================================================================
-- Reproduction locale du strict minimum que Supabase fournit d'office.
-- ---------------------------------------------------------------------
-- But : exécuter supabase/schema.sql SANS LE MODIFIER, et vérifier que
-- les politiques Row Level Security se comportent vraiment comme prévu
-- dans un PostgreSQL réel — ce qu'aucun test en mémoire ne peut prouver.
--
-- `auth.uid()` est ici définie comme Supabase la définit : elle lit le
-- « sub » du jeton JWT, transmis par PostgREST sous forme de paramètre
-- de session. Changer d'utilisateur revient donc à changer ce paramètre,
-- exactement comme une nouvelle connexion le ferait en production.
-- =====================================================================

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema if not exists auth;

create table auth.users (
  id                  uuid primary key default gen_random_uuid(),
  email               text unique not null,
  encrypted_password  text,
  raw_user_meta_data  jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now()
);

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

-- Supabase accorde par défaut l'accès aux rôles applicatifs ; c'est la
-- RLS, et elle seule, qui restreint ensuite ligne par ligne.
grant usage on schema public, auth to anon, authenticated;
alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated;

-- Table de résultats du script de vérification. Elle n'existe QUE dans
-- cette base jetable : elle ne fait pas partie du schéma de production,
-- et reste volontairement hors RLS pour pouvoir consigner ce que chaque
-- compte a pu — ou n'a pas pu — faire.
create table public._verdicts (
  ordre    serial primary key,
  intitule text not null,
  attendu  text not null,
  obtenu   text not null
);
grant select, insert on public._verdicts to anon, authenticated;
grant usage, select on sequence public._verdicts_ordre_seq to anon, authenticated;
