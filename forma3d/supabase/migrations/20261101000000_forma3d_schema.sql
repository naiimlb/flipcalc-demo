-- =====================================================================
-- Forma3D : schéma complet (tables, RLS, fonctions, déclencheurs).
-- À exécuter une fois dans l'éditeur SQL de Supabase (ou `supabase db push`).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Profils (un par compte Supabase Auth) et rôles
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null default '',
  display_name text check (char_length(display_name) <= 80),
  role text not null default 'user' check (role in ('admin', 'user')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. Réglages du site (textes, couleurs, logo), fonctionnalités, IA
-- ---------------------------------------------------------------------
create table public.app_settings (
  key text primary key check (key in ('site', 'features', 'ai')),
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
insert into public.app_settings (key, value) values ('site', '{}'), ('features', '{}'), ('ai', '{}');

-- ---------------------------------------------------------------------
-- 3. Clés d'API saisies dans l'admin (chiffrées côté serveur, AES-256-GCM).
--    RLS active SANS politique : seule la clé secrète (service_role) y accède.
-- ---------------------------------------------------------------------
create table public.app_secrets (
  name text primary key check (name ~ '^[A-Z][A-Z0-9_]{2,63}$'),
  ciphertext text not null,
  hint text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

-- ---------------------------------------------------------------------
-- 4. Demandes de conception
-- ---------------------------------------------------------------------
create table public.design_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  prompt text not null check (char_length(prompt) between 3 and 1500),
  has_image boolean not null default false,
  status text not null default 'processing' check (status in ('processing', 'ready', 'error')),
  title text check (char_length(title) <= 200),
  design jsonb,
  error text,
  provider text,
  model text,
  model_asset jsonb,
  duration_ms integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index design_requests_user_created_idx on public.design_requests (user_id, created_at desc);
create index design_requests_created_idx on public.design_requests (created_at desc);

-- Réponse brute de l'IA (mode Dev) : visible des admins uniquement.
create table public.request_debug (
  request_id uuid primary key references public.design_requests (id) on delete cascade,
  raw_response text,
  stop_reason text,
  usage jsonb,
  validation_errors jsonb,
  created_at timestamptz not null default now()
);

-- Registre des générations (quotas) : non supprimable par les utilisateurs,
-- pour qu'effacer son historique ne remette pas le compteur à zéro.
create table public.usage_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  request_id uuid references public.design_requests (id) on delete set null,
  created_at timestamptz not null default now()
);
create index usage_events_user_created_idx on public.usage_events (user_id, created_at desc);

-- Journal d'erreurs et d'évènements (mode Dev).
create table public.app_logs (
  id bigint generated always as identity primary key,
  level text not null check (level in ('info', 'warn', 'error')),
  source text not null,
  message text not null,
  details jsonb,
  request_id uuid references public.design_requests (id) on delete set null,
  user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index app_logs_created_idx on public.app_logs (created_at desc);

-- ---------------------------------------------------------------------
-- 5. Fonctions d'aide
-- ---------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles where id = (select auth.uid()) and role = 'admin'
  );
$$;

-- Vrai tant qu'aucun administrateur n'existe : /setup est alors ouvert.
create or replace function public.setup_required()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (select 1 from public.profiles where role = 'admin');
$$;

-- Promotion du premier administrateur (appelée par /setup avec la clé secrète).
-- Le verrou consultatif sérialise deux installations simultanées : une seule gagne.
create or replace function public.promote_first_admin(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtext('forma3d:first-admin'));
  if exists (select 1 from public.profiles where role = 'admin') then
    return false;
  end if;
  update public.profiles set role = 'admin' where id = p_user_id;
  return found;
end;
$$;

-- Création du profil à l'inscription. Une fois l'installation faite,
-- les inscriptions peuvent être fermées depuis l'admin (features.signupsOpen).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_signups_open boolean;
begin
  if exists (select 1 from public.profiles where role = 'admin') then
    select coalesce((value ->> 'signupsOpen')::boolean, true)
      into v_signups_open
      from public.app_settings where key = 'features';
    if coalesce(v_signups_open, true) = false then
      raise exception 'SIGNUPS_CLOSED' using errcode = 'P0001';
    end if;
  end if;

  insert into public.profiles (id, email, display_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 80), ''),
    'user'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Création d'une demande : validation, pause globale, quotas (heure / jour),
-- générations simultanées, puis insertion. Les admins ne sont pas limités.
create or replace function public.create_design_request(p_prompt text, p_has_image boolean default false)
returns public.design_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_prompt text := btrim(coalesce(p_prompt, ''));
  v_features jsonb;
  v_is_admin boolean;
  v_hourly integer;
  v_daily integer;
  v_last_hour integer;
  v_last_day integer;
  v_running integer;
  v_row public.design_requests;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  if char_length(v_prompt) < 3 or char_length(v_prompt) > 1500 then
    raise exception 'INVALID_PROMPT' using errcode = '22023';
  end if;

  select value into v_features from public.app_settings where key = 'features';
  v_features := coalesce(v_features, '{}'::jsonb);
  select coalesce(role = 'admin', false) into v_is_admin from public.profiles where id = v_uid;
  v_is_admin := coalesce(v_is_admin, false);

  if not v_is_admin and coalesce((v_features ->> 'newRequests')::boolean, true) = false then
    raise exception 'REQUESTS_PAUSED' using errcode = 'P0001';
  end if;

  -- Un verrou par utilisateur : deux requêtes simultanées ne contournent pas le quota.
  perform pg_advisory_xact_lock(hashtext('forma3d:quota:' || v_uid::text));

  -- Générations bloquées (fonction serveur interrompue) : passées en erreur.
  update public.design_requests
     set status = 'error', error = 'Délai dépassé : la génération n''a pas abouti.', updated_at = now()
   where user_id = v_uid and status = 'processing' and created_at < now() - interval '6 minutes';

  if not v_is_admin then
    v_hourly := greatest(0, coalesce((v_features ->> 'hourlyLimit')::integer, 10));
    v_daily := greatest(0, coalesce((v_features ->> 'dailyLimit')::integer, 30));

    select count(*) filter (where created_at > now() - interval '1 hour'), count(*)
      into v_last_hour, v_last_day
      from public.usage_events
     where user_id = v_uid and created_at > now() - interval '1 day';

    if v_last_hour >= v_hourly then
      raise exception 'QUOTA_HOURLY' using errcode = 'P0001';
    end if;
    if v_last_day >= v_daily then
      raise exception 'QUOTA_DAILY' using errcode = 'P0001';
    end if;

    select count(*) into v_running
      from public.design_requests where user_id = v_uid and status = 'processing';
    if v_running >= 2 then
      raise exception 'ALREADY_RUNNING' using errcode = 'P0001';
    end if;
  end if;

  insert into public.design_requests (user_id, prompt, has_image)
  values (v_uid, v_prompt, coalesce(p_has_image, false))
  returning * into v_row;

  insert into public.usage_events (user_id, request_id) values (v_uid, v_row.id);
  return v_row;
end;
$$;

-- Statistiques de l'espace admin.
create or replace function public.admin_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'users', (select count(*) from public.profiles),
    'admins', (select count(*) from public.profiles where role = 'admin'),
    'requests', (select count(*) from public.design_requests),
    'ready', (select count(*) from public.design_requests where status = 'ready'),
    'errors', (select count(*) from public.design_requests where status = 'error'),
    'processing', (select count(*) from public.design_requests where status = 'processing'),
    'avgDurationMs', (
      select coalesce(round(avg(duration_ms)), 0) from public.design_requests
       where status = 'ready' and duration_ms is not null
    ),
    'generations24h', (select count(*) from public.usage_events where created_at > now() - interval '1 day'),
    'inputTokens', (select coalesce(sum((usage ->> 'input_tokens')::bigint), 0) from public.request_debug),
    'outputTokens', (select coalesce(sum((usage ->> 'output_tokens')::bigint), 0) from public.request_debug),
    'errors24h', (
      select count(*) from public.app_logs where level = 'error' and created_at > now() - interval '1 day'
    ),
    'perDay', (
      select coalesce(jsonb_agg(jsonb_build_object('day', to_char(d, 'YYYY-MM-DD'), 'count', c) order by d), '[]'::jsonb)
        from (
          select gs as d,
                 (select count(*) from public.usage_events u
                   where u.created_at >= gs and u.created_at < gs + interval '1 day') as c
            from generate_series(date_trunc('day', now()) - interval '13 days', date_trunc('day', now()), interval '1 day') gs
        ) days
    )
  );
end;
$$;

-- Droits d'exécution
revoke all on function public.is_admin() from public;
revoke all on function public.setup_required() from public;
revoke all on function public.promote_first_admin(uuid) from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.create_design_request(text, boolean) from public, anon;
revoke all on function public.admin_stats() from public, anon;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.setup_required() to anon, authenticated;
grant execute on function public.promote_first_admin(uuid) to service_role;
grant execute on function public.create_design_request(text, boolean) to authenticated;
grant execute on function public.admin_stats() to authenticated;

-- ---------------------------------------------------------------------
-- 6. Row Level Security
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.app_settings enable row level security;
alter table public.app_secrets enable row level security;
alter table public.design_requests enable row level security;
alter table public.request_debug enable row level security;
alter table public.usage_events enable row level security;
alter table public.app_logs enable row level security;

-- Supabase accorde par défaut tous les droits à anon/authenticated : on repart de zéro.
revoke all on public.profiles, public.app_settings, public.app_secrets, public.design_requests,
  public.request_debug, public.usage_events, public.app_logs from anon, authenticated;

-- Profils : chacun voit le sien, les admins voient tout.
-- Seul display_name est modifiable par l'utilisateur (le rôle ne l'est jamais via l'API).
create policy "profiles_select_own_or_admin" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));
create policy "profiles_update_own" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;

-- Réglages : site et fonctionnalités publics en lecture ; IA réservée aux admins.
create policy "settings_select_public" on public.app_settings for select to anon, authenticated
  using (key in ('site', 'features') or (select public.is_admin()));
create policy "settings_insert_admin" on public.app_settings for insert to authenticated
  with check ((select public.is_admin()));
create policy "settings_update_admin" on public.app_settings for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
grant select on public.app_settings to anon, authenticated;
grant insert, update on public.app_settings to authenticated;

-- Secrets : aucune politique, aucun droit (service_role uniquement).

-- Demandes : lecture et suppression des siennes (admins : toutes).
-- Création via create_design_request(), mise à jour par le serveur (service_role).
create policy "requests_select_own_or_admin" on public.design_requests for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "requests_delete_own_or_admin" on public.design_requests for delete to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
grant select, delete on public.design_requests to authenticated;

-- Débogage, registre et journal : admins uniquement.
create policy "debug_select_admin" on public.request_debug for select to authenticated
  using ((select public.is_admin()));
grant select on public.request_debug to authenticated;

create policy "usage_select_admin" on public.usage_events for select to authenticated
  using ((select public.is_admin()));
grant select on public.usage_events to authenticated;

create policy "logs_select_admin" on public.app_logs for select to authenticated
  using ((select public.is_admin()));
create policy "logs_delete_admin" on public.app_logs for delete to authenticated
  using ((select public.is_admin()));
grant select, delete on public.app_logs to authenticated;
