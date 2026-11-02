-- =====================================================================
-- Forma3D — phase 1 : cache des conceptions identiques + limite de débit des questions de précision
-- À exécuter une fois dans Supabase (SQL Editor). Sans danger si rejoué (« if not exists » / « or replace »).
-- L'application fonctionne aussi SANS cette migration : le cache est simplement désactivé et la limite
-- de débit retombe sur un compteur en mémoire.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Cache : une demande identique (même texte, mêmes réponses, même langue, mêmes réglages d'IA)
--    est servie sans rappeler l'IA.
--
--    « cache_key » est un HMAC calculé par le serveur avec un secret : personne ne peut le deviner ni le
--    calculer pour la demande d'un autre. La conception ne sort de la base que si l'on fournit exactement
--    la bonne clé, et seul son contenu (jamais l'identité de l'auteur) est renvoyé.
-- ---------------------------------------------------------------------
alter table public.design_requests
  add column if not exists cache_key text check (cache_key is null or cache_key ~ '^[0-9a-f]{64}$');

create index if not exists design_requests_cache_key_idx
  on public.design_requests (cache_key, created_at desc)
  where cache_key is not null;

-- La clé est posée par le serveur, avec la session de l'utilisateur, sur SA demande terminée par l'IA.
create or replace function public.set_request_cache_key(p_id uuid, p_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  if p_key is null or p_key !~ '^[0-9a-f]{64}$' then
    raise exception 'INVALID_KEY' using errcode = '22023';
  end if;
  update public.design_requests
     set cache_key = p_key
   where id = p_id
     and user_id = (select auth.uid())
     and status = 'ready'
     and provider = 'claude'
     and has_image = false;
end;
$$;

-- Lecture du cache : visiteurs et connectés, à condition de connaître la clé exacte.
create or replace function public.cache_lookup(p_key text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('design', r.design, 'model', r.model)
    from public.design_requests r
   where p_key ~ '^[0-9a-f]{64}$'
     and r.cache_key = p_key
     and r.status = 'ready'
     and r.provider = 'claude'
     and r.has_image = false
     and r.design is not null
   order by r.created_at desc
   limit 1;
$$;

-- ---------------------------------------------------------------------
-- 2. Limite de débit des appels peu coûteux (questions de précision) :
--    par utilisateur connecté ou par adresse (empreinte), plus un plafond global par jour.
-- ---------------------------------------------------------------------
create table if not exists private.rate_hits (
  id bigint generated always as identity primary key,
  scope text not null,
  bucket text not null,
  created_at timestamptz not null default now()
);
create index if not exists rate_hits_bucket_idx on private.rate_hits (scope, bucket, created_at desc);

create or replace function public.consume_rate_limit(
  p_scope text,
  p_ip_hash text,
  p_max integer,
  p_window_seconds integer,
  p_global_max integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_bucket text;
begin
  if p_scope not in ('clarify') then
    raise exception 'INVALID_SCOPE' using errcode = '22023';
  end if;
  if p_max not between 1 and 1000 or p_window_seconds not between 1 and 86400 or p_global_max not between 1 and 1000000 then
    raise exception 'INVALID_LIMITS' using errcode = '22023';
  end if;
  if v_uid is not null then
    v_bucket := 'u:' || v_uid::text;
  elsif p_ip_hash ~ '^[0-9a-f]{64}$' then
    v_bucket := 'ip:' || p_ip_hash;
  else
    raise exception 'INVALID_HASH' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('forma3d:rate:' || p_scope));
  delete from private.rate_hits where created_at < now() - interval '2 days';

  if (select count(*) from private.rate_hits where scope = p_scope and created_at > now() - interval '1 day') >= p_global_max then
    return false;
  end if;
  if (select count(*) from private.rate_hits
       where scope = p_scope and bucket = v_bucket
         and created_at > now() - make_interval(secs => p_window_seconds)) >= p_max then
    return false;
  end if;
  insert into private.rate_hits (scope, bucket) values (p_scope, v_bucket);
  return true;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Droits d'exécution
-- ---------------------------------------------------------------------
revoke all on function public.set_request_cache_key(uuid, text) from public, anon;
revoke all on function public.cache_lookup(text) from public;
revoke all on function public.consume_rate_limit(text, text, integer, integer, integer) from public;
grant execute on function public.set_request_cache_key(uuid, text) to authenticated;
grant execute on function public.cache_lookup(text) to anon, authenticated;
grant execute on function public.consume_rate_limit(text, text, integer, integer, integer) to anon, authenticated;
