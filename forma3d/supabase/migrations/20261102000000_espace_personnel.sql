-- =====================================================================
-- Forma3D v2 : espace personnel (profil, dossiers, favoris, modèles 3D
-- dans Storage), essai invité, export / suppression de compte.
-- Le serveur n'a plus besoin de la clé secrète pour le fonctionnement
-- courant : tout passe par la session de l'utilisateur + RLS + fonctions.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Schéma privé (non exposé par l'API) pour les données internes
-- ---------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- Empreinte SHA-256 (hex) du jeton d'installation (SETUP_TOKEN).
create table private.setup_secret (
  id boolean primary key default true check (id),
  token_hash text not null check (token_hash ~ '^[0-9a-f]{64}$')
);

-- Essais sans compte : empreinte salée de l'IP, jamais l'IP elle-même.
create table private.guest_usage (
  ip_hash text not null,
  created_at timestamptz not null default now()
);
create index guest_usage_hash_idx on private.guest_usage (ip_hash, created_at desc);

-- ---------------------------------------------------------------------
-- 1. Profil : photo, langue, unités, matières préférées
-- ---------------------------------------------------------------------
alter table public.profiles
  add column avatar_url text check (char_length(avatar_url) <= 500),
  add column language text not null default 'fr' check (language in ('fr', 'en')),
  add column units text not null default 'mm' check (units in ('mm', 'cm', 'in')),
  add column favorite_materials text[] not null default '{}' check (cardinality(favorite_materials) <= 50),
  add column updated_at timestamptz not null default now();

grant update (display_name, avatar_url, language, units, favorite_materials, updated_at) on public.profiles to authenticated;

-- Profil créé à l'inscription (email ou Google : nom et photo repris du fournisseur).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_signups_open boolean;
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  if exists (select 1 from public.profiles where role = 'admin') then
    select coalesce((value ->> 'signupsOpen')::boolean, true)
      into v_signups_open
      from public.app_settings where key = 'features';
    if coalesce(v_signups_open, true) = false then
      raise exception 'SIGNUPS_CLOSED' using errcode = 'P0001';
    end if;
  end if;

  insert into public.profiles (id, email, display_name, avatar_url, role)
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(left(coalesce(v_meta ->> 'display_name', v_meta ->> 'full_name', v_meta ->> 'name', ''), 80), ''),
    nullif(left(coalesce(v_meta ->> 'avatar_url', v_meta ->> 'picture', ''), 500), ''),
    'user'
  );
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 2. Dossiers (projets)
-- ---------------------------------------------------------------------
create table public.folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  created_at timestamptz not null default now()
);
create index folders_user_idx on public.folders (user_id, created_at);

alter table public.folders enable row level security;
revoke all on public.folders from anon, authenticated;
create policy "folders_select_own" on public.folders for select to authenticated
  using (user_id = (select auth.uid()));
create policy "folders_insert_own" on public.folders for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "folders_update_own" on public.folders for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "folders_delete_own" on public.folders for delete to authenticated
  using (user_id = (select auth.uid()));
grant select, insert, delete on public.folders to authenticated;
grant update (name) on public.folders to authenticated;
grant select, insert, update, delete on public.folders to service_role;

-- ---------------------------------------------------------------------
-- 3. Demandes : dossier, favori, fichier 3D, origine
-- ---------------------------------------------------------------------
alter table public.design_requests
  add column folder_id uuid references public.folders (id) on delete set null,
  add column is_favorite boolean not null default false,
  add column model_path text check (model_path is null or char_length(model_path) <= 300),
  add column source text not null default 'generated' check (source in ('generated', 'duplicate', 'import'));
create index design_requests_folder_idx on public.design_requests (folder_id);

-- Un dossier ou un fichier ne peut appartenir qu'au propriétaire de la demande.
create or replace function public.check_request_ownership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.folder_id is not null and not exists (
    select 1 from public.folders f where f.id = new.folder_id and f.user_id = new.user_id
  ) then
    raise exception 'FOLDER_FORBIDDEN' using errcode = '42501';
  end if;
  if new.model_path is not null and split_part(new.model_path, '/', 1) <> new.user_id::text then
    raise exception 'MODEL_PATH_FORBIDDEN' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger design_requests_ownership
  before insert or update of folder_id, model_path on public.design_requests
  for each row execute function public.check_request_ownership();

-- L'utilisateur peut renommer, classer, mettre en favori et lier son fichier 3D.
create policy "requests_update_own" on public.design_requests for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant update (title, folder_id, is_favorite, model_path, model_asset, updated_at) on public.design_requests to authenticated;

-- ---------------------------------------------------------------------
-- 4. Fonctions appelées avec la session de l'utilisateur
-- ---------------------------------------------------------------------

-- Enregistre le résultat d'une génération (uniquement sa propre demande « en cours »).
create or replace function public.complete_design_request(
  p_id uuid,
  p_status text,
  p_title text,
  p_design jsonb,
  p_error text,
  p_provider text,
  p_model text,
  p_duration_ms integer,
  p_model_asset jsonb,
  p_raw text,
  p_stop_reason text,
  p_usage jsonb,
  p_validation_errors jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  if p_status not in ('ready', 'error') then
    raise exception 'INVALID_STATUS' using errcode = '22023';
  end if;
  if p_design is not null and pg_column_size(p_design) > 600000 then
    raise exception 'DESIGN_TOO_LARGE' using errcode = '22023';
  end if;

  update public.design_requests
     set status = p_status,
         title = left(p_title, 200),
         design = p_design,
         error = left(p_error, 1000),
         provider = left(p_provider, 40),
         model = left(p_model, 80),
         duration_ms = p_duration_ms,
         model_asset = p_model_asset,
         updated_at = now()
   where id = p_id and user_id = (select auth.uid()) and status = 'processing';
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  insert into public.request_debug (request_id, raw_response, stop_reason, usage, validation_errors)
  values (p_id, left(p_raw, 500000), left(p_stop_reason, 40), p_usage, p_validation_errors)
  on conflict (request_id) do update
    set raw_response = excluded.raw_response,
        stop_reason = excluded.stop_reason,
        usage = excluded.usage,
        validation_errors = excluded.validation_errors;
end;
$$;

-- Duplique une de ses demandes (sans consommer de quota : aucune IA n'est appelée).
create or replace function public.duplicate_design_request(p_id uuid)
returns public.design_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.design_requests;
begin
  insert into public.design_requests (user_id, prompt, has_image, status, title, design, provider, model, folder_id, source)
  select user_id, prompt, has_image, 'ready', left(coalesce(title, 'Conception') || ' (copie)', 200), design, provider, model, folder_id, 'duplicate'
    from public.design_requests
   where id = p_id and user_id = (select auth.uid()) and status = 'ready'
  returning * into v_row;
  if v_row.id is null then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  return v_row;
end;
$$;

-- Importe le résultat obtenu en essai invité, après création du compte (5 par jour max).
create or replace function public.import_design(p_prompt text, p_design jsonb, p_provider text, p_model text)
returns public.design_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_row public.design_requests;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  if p_design is null or pg_column_size(p_design) > 600000 then
    raise exception 'INVALID_DESIGN' using errcode = '22023';
  end if;
  if (select count(*) from public.design_requests
       where user_id = v_uid and source = 'import' and created_at > now() - interval '1 day') >= 5 then
    raise exception 'QUOTA_DAILY' using errcode = 'P0001';
  end if;
  insert into public.design_requests (user_id, prompt, status, title, design, provider, model, source)
  values (v_uid, left(btrim(p_prompt), 1500), 'ready', left(p_design ->> 'title', 200), p_design,
          left(p_provider, 40), left(p_model, 80), 'import')
  returning * into v_row;
  insert into public.usage_events (user_id, request_id) values (v_uid, v_row.id);
  return v_row;
end;
$$;

-- Suppression du compte : supprime l'utilisateur Auth, tout le reste suit (ON DELETE CASCADE).
-- Les fichiers Storage sont supprimés juste avant par le serveur (API Storage).
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  delete from auth.users where id = v_uid;
end;
$$;

-- Premier administrateur : jeton d'installation vérifié en base (empreinte SHA-256).
create or replace function public.claim_first_admin(p_token text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_hash text;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  perform pg_advisory_xact_lock(hashtext('forma3d:first-admin'));
  if exists (select 1 from public.profiles where role = 'admin') then
    return false;
  end if;
  select token_hash into v_hash from private.setup_secret where id;
  if v_hash is null or encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex') <> v_hash then
    raise exception 'BAD_TOKEN' using errcode = '42501';
  end if;
  update public.profiles set role = 'admin' where id = v_uid;
  return found;
end;
$$;

-- Rôles gérés depuis /admin (sans clé secrète).
create or replace function public.set_user_role(p_user_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_role not in ('admin', 'user') then
    raise exception 'INVALID_ROLE' using errcode = '22023';
  end if;
  if p_user_id = (select auth.uid()) and p_role <> 'admin' then
    raise exception 'SELF_DEMOTION' using errcode = '42501';
  end if;
  update public.profiles set role = p_role where id = p_user_id;
end;
$$;

-- Quota des essais sans compte : par empreinte d'IP et global, sur 24 h.
create or replace function public.consume_guest_quota(p_ip_hash text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_features jsonb;
  v_limit integer;
  v_global integer;
begin
  if p_ip_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'INVALID_HASH' using errcode = '22023';
  end if;
  select coalesce(value, '{}'::jsonb) into v_features from public.app_settings where key = 'features';
  if coalesce((v_features ->> 'guestTrial')::boolean, true) = false then
    return false;
  end if;
  v_limit := greatest(0, coalesce((v_features ->> 'guestDailyLimit')::integer, 2));
  v_global := greatest(0, coalesce((v_features ->> 'guestGlobalDailyLimit')::integer, 200));

  perform pg_advisory_xact_lock(hashtext('forma3d:guest'));
  delete from private.guest_usage where created_at < now() - interval '2 days';
  if (select count(*) from private.guest_usage where created_at > now() - interval '1 day') >= v_global then
    return false;
  end if;
  if (select count(*) from private.guest_usage
       where ip_hash = p_ip_hash and created_at > now() - interval '1 day') >= v_limit then
    return false;
  end if;
  insert into private.guest_usage (ip_hash) values (p_ip_hash);
  return true;
end;
$$;

-- Journal (mode Dev) écrit avec la session de l'utilisateur.
create or replace function public.log_event(p_level text, p_source text, p_message text, p_details jsonb, p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or p_level not in ('info', 'warn', 'error') then
    return;
  end if;
  insert into public.app_logs (level, source, message, details, request_id, user_id)
  values (
    p_level,
    left(p_source, 80),
    left(p_message, 2000),
    case when pg_column_size(p_details) > 20000 then jsonb_build_object('tronque', true) else p_details end,
    p_request_id,
    (select auth.uid())
  );
end;
$$;

revoke all on function public.complete_design_request(uuid, text, text, jsonb, text, text, text, integer, jsonb, text, text, jsonb, jsonb) from public, anon;
revoke all on function public.duplicate_design_request(uuid) from public, anon;
revoke all on function public.import_design(text, jsonb, text, text) from public, anon;
revoke all on function public.delete_my_account() from public, anon;
revoke all on function public.claim_first_admin(text) from public, anon;
revoke all on function public.set_user_role(uuid, text) from public, anon;
revoke all on function public.consume_guest_quota(text) from public;
revoke all on function public.log_event(text, text, text, jsonb, uuid) from public, anon;
revoke all on function public.check_request_ownership() from public, anon, authenticated;
grant execute on function public.complete_design_request(uuid, text, text, jsonb, text, text, text, integer, jsonb, text, text, jsonb, jsonb) to authenticated;
grant execute on function public.duplicate_design_request(uuid) to authenticated;
grant execute on function public.import_design(text, jsonb, text, text) to authenticated;
grant execute on function public.delete_my_account() to authenticated;
grant execute on function public.claim_first_admin(text) to authenticated;
grant execute on function public.set_user_role(uuid, text) to authenticated;
grant execute on function public.consume_guest_quota(text) to anon, authenticated;
grant execute on function public.log_event(text, text, text, jsonb, uuid) to authenticated;

-- Le prompt système doit être lisible par le serveur avec la session de l'utilisateur (ou d'un invité).
alter policy "settings_select_public" on public.app_settings
  using (key in ('site', 'features', 'ai') or (select public.is_admin()));

-- ---------------------------------------------------------------------
-- 5. Storage : modèles 3D (privés) et photos de profil (publiques)
--    Chemin imposé : <id utilisateur>/<fichier>
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('models', 'models', false, 20971520, array['model/gltf-binary', 'application/octet-stream']),
  ('avatars', 'avatars', true, 1048576, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy "models_select_own" on storage.objects for select to authenticated
  using (bucket_id = 'models' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "models_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'models' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "models_update_own" on storage.objects for update to authenticated
  using (bucket_id = 'models' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'models' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "models_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'models' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "avatars_select_own" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatars_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatars_update_own" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatars_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
