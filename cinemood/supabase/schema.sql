-- =====================================================================
-- CinéMood — schéma Supabase
-- ---------------------------------------------------------------------
-- À exécuter une fois dans : Supabase → SQL Editor → New query → Run.
-- Le script est idempotent : on peut le relancer sans rien casser.
--
-- Principe de sécurité : Row Level Security activée PARTOUT, et une
-- seule règle — « chacun ne voit et ne modifie que ses propres lignes ».
-- La clé `anon` publiée dans le navigateur ne donne donc accès à rien
-- d'autre qu'aux données de la personne connectée.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Profil : le résultat du test de personnalité + les plateformes.
-- ---------------------------------------------------------------------
create table if not exists public.profils (
  id                 uuid primary key references auth.users (id) on delete cascade,
  pseudo             text        not null default '',
  annee_naissance    integer,
  -- Facultatif : la personne peut ne pas répondre. Jamais utilisé pour
  -- filtrer ou classer les recommandations.
  genre_personne     text,
  pays               text        not null default 'FR',
  -- Plateformes possédées. Tableau vide = « aucun abonnement », ce qui
  -- bascule les recommandations sur les seules offres gratuites.
  plateformes        text[]      not null default '{}',
  types_souhaites    text[]      not null default '{film,serie}',
  genres_adores      text[]      not null default '{}',
  genres_detestes    text[]      not null default '{}',
  tonalite_preferee  text        not null default 'intense',
  duree_max          integer,
  langue_preferee    text        not null default 'indifferent',
  epoque_preferee    text        not null default 'indifferent',
  animation_ok       boolean     not null default true,
  a_eviter           text[]      not null default '{}',
  interets           text[]      not null default '{}',
  -- Le vecteur de goûts, mis à jour à chaque interaction.
  gouts              jsonb       not null default '{}'::jsonb,
  plateformes_ok     boolean     not null default false,
  test_termine       boolean     not null default false,
  cree_le            timestamptz not null default now(),
  modifie_le         timestamptz not null default now()
);

comment on table  public.profils          is 'Profil de goûts d''un utilisateur CinéMood.';
comment on column public.profils.gouts    is 'Vecteur de poids par facette (genres, mots-clés, réalisateurs…).';
comment on column public.profils.plateformes is 'Filtre STRICT : aucune recommandation hors de ces services.';

-- ---------------------------------------------------------------------
-- 2. Ma liste : à voir / déjà vus.
-- ---------------------------------------------------------------------
create table if not exists public.liste (
  utilisateur_id uuid        not null references auth.users (id) on delete cascade,
  titre_id       text        not null,                 -- « film:550 »
  statut         text        not null default 'a_voir' -- a_voir | vu
                 check (statut in ('a_voir', 'vu')),
  appreciation   smallint    check (appreciation in (-1, 1)),
  -- Copie du titre au moment de l'ajout : la liste reste lisible même si
  -- TMDB est indisponible ou si le titre change de plateforme.
  titre_cache    jsonb       not null default '{}'::jsonb,
  cree_le        timestamptz not null default now(),
  primary key (utilisateur_id, titre_id)
);

create index if not exists liste_par_utilisateur on public.liste (utilisateur_id, statut, cree_le desc);

-- ---------------------------------------------------------------------
-- 3. Interactions : le journal qui nourrit l'apprentissage.
-- ---------------------------------------------------------------------
create table if not exists public.interactions (
  id             bigint generated always as identity primary key,
  utilisateur_id uuid        not null references auth.users (id) on delete cascade,
  titre_id       text        not null,
  signal         text        not null
                 check (signal in ('ajout_liste', 'retrait_liste', 'bande_annonce',
                                   'ouverture_fiche', 'deja_vu_aime', 'deja_vu_pas_aime',
                                   'pas_pour_moi', 'swipe_garde', 'swipe_passe')),
  cree_le        timestamptz not null default now()
);

create index if not exists interactions_par_utilisateur on public.interactions (utilisateur_id, cree_le desc);

-- ---------------------------------------------------------------------
-- 4. Expositions : combien de fois un titre a été proposé (rotation).
-- ---------------------------------------------------------------------
create table if not exists public.expositions (
  utilisateur_id uuid        not null references auth.users (id) on delete cascade,
  titre_id       text        not null,
  nb             integer     not null default 1,
  derniere       timestamptz not null default now(),
  primary key (utilisateur_id, titre_id)
);

-- ---------------------------------------------------------------------
-- 5. Refus : titres explicitement écartés (« pas pour moi », swipe passé).
--    Table dédiée plutôt qu'une relecture du journal `interactions` :
--    l'exclusion est définitive et doit se relire d'une seule requête,
--    aussi bien pour reconstruire l'historique à la connexion que pour
--    le moteur de recommandation.
-- ---------------------------------------------------------------------
create table if not exists public.refus (
  utilisateur_id uuid        not null references auth.users (id) on delete cascade,
  titre_id       text        not null,
  cree_le        timestamptz not null default now(),
  primary key (utilisateur_id, titre_id)
);

-- ---------------------------------------------------------------------
-- 6. Humeurs choisies : historique des humeurs et compagnies utilisées
--    pour demander une sélection. Alimente l'algorithme et permettra,
--    en V2, d'affiner les suggestions selon les habitudes de la personne.
-- ---------------------------------------------------------------------
create table if not exists public.humeurs_choisies (
  id             bigint generated always as identity primary key,
  utilisateur_id uuid        not null references auth.users (id) on delete cascade,
  humeur         text        not null,
  compagnie      text        not null,
  cree_le        timestamptz not null default now()
);

create index if not exists humeurs_par_utilisateur on public.humeurs_choisies (utilisateur_id, cree_le desc);

-- ---------------------------------------------------------------------
-- 7. Row Level Security — la protection réelle des données.
-- ---------------------------------------------------------------------
alter table public.profils          enable row level security;
alter table public.liste            enable row level security;
alter table public.interactions     enable row level security;
alter table public.expositions      enable row level security;
alter table public.refus            enable row level security;
alter table public.humeurs_choisies enable row level security;

-- Profils : la ligne appartient à l'utilisateur dont l'id EST la clé.
drop policy if exists "profil lisible par son propriétaire"   on public.profils;
drop policy if exists "profil créable par son propriétaire"   on public.profils;
drop policy if exists "profil modifiable par son propriétaire" on public.profils;
drop policy if exists "profil supprimable par son propriétaire" on public.profils;

create policy "profil lisible par son propriétaire"
  on public.profils for select using (auth.uid() = id);
create policy "profil créable par son propriétaire"
  on public.profils for insert with check (auth.uid() = id);
create policy "profil modifiable par son propriétaire"
  on public.profils for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "profil supprimable par son propriétaire"
  on public.profils for delete using (auth.uid() = id);

-- Les autres tables suivent exactement la même règle.
do $$
declare
  nom_table text;
begin
  foreach nom_table in array array['liste', 'interactions', 'expositions', 'refus', 'humeurs_choisies'] loop
    execute format('drop policy if exists "lecture par le propriétaire" on public.%I', nom_table);
    execute format('drop policy if exists "écriture par le propriétaire" on public.%I', nom_table);
    execute format('drop policy if exists "mise à jour par le propriétaire" on public.%I', nom_table);
    execute format('drop policy if exists "suppression par le propriétaire" on public.%I', nom_table);

    execute format(
      'create policy "lecture par le propriétaire" on public.%I for select using (auth.uid() = utilisateur_id)',
      nom_table);
    execute format(
      'create policy "écriture par le propriétaire" on public.%I for insert with check (auth.uid() = utilisateur_id)',
      nom_table);
    execute format(
      'create policy "mise à jour par le propriétaire" on public.%I for update using (auth.uid() = utilisateur_id) with check (auth.uid() = utilisateur_id)',
      nom_table);
    execute format(
      'create policy "suppression par le propriétaire" on public.%I for delete using (auth.uid() = utilisateur_id)',
      nom_table);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 8. Création automatique du profil à l'inscription.
-- ---------------------------------------------------------------------
create or replace function public.creer_profil_a_l_inscription()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profils (id, pseudo)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'pseudo', ''))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists au_nouvel_utilisateur on auth.users;
create trigger au_nouvel_utilisateur
  after insert on auth.users
  for each row execute function public.creer_profil_a_l_inscription();

-- ---------------------------------------------------------------------
-- 9. Horodatage de modification.
-- ---------------------------------------------------------------------
create or replace function public.touche_modifie_le()
returns trigger language plpgsql as $$
begin
  new.modifie_le = now();
  return new;
end $$;

drop trigger if exists profils_modifie_le on public.profils;
create trigger profils_modifie_le
  before update on public.profils
  for each row execute function public.touche_modifie_le();

-- ---------------------------------------------------------------------
-- 10. Suppression du compte, déclenchée depuis l'écran Profil.
--    La cascade des clés étrangères efface tout le reste.
-- ---------------------------------------------------------------------
create or replace function public.supprimer_mon_compte()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Aucun utilisateur connecté';
  end if;
  delete from auth.users where id = auth.uid();
end $$;

revoke all on function public.supprimer_mon_compte() from public;
grant execute on function public.supprimer_mon_compte() to authenticated;

-- ---------------------------------------------------------------------
-- 11. Enregistrement atomique des expositions.
--     Incrémenter « nb » depuis le client demanderait de lire la ligne
--     avant de la réécrire : deux onglets ouverts en même temps se
--     marcheraient dessus. Cette fonction fait l'incrémentation dans la
--     même instruction SQL, donc sans course possible.
-- ---------------------------------------------------------------------
create or replace function public.enregistrer_expositions(p_titre_ids text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_utilisateur uuid := auth.uid();
  v_titre_id    text;
begin
  if v_utilisateur is null then
    raise exception 'Aucun utilisateur connecté';
  end if;

  foreach v_titre_id in array p_titre_ids loop
    insert into public.expositions (utilisateur_id, titre_id, nb, derniere)
    values (v_utilisateur, v_titre_id, 1, now())
    on conflict (utilisateur_id, titre_id)
    do update set nb = public.expositions.nb + 1, derniere = now();
  end loop;
end $$;

revoke all on function public.enregistrer_expositions(text[]) from public;
grant execute on function public.enregistrer_expositions(text[]) to authenticated;
