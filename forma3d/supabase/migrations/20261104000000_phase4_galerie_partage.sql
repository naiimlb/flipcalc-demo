-- =====================================================================
-- Forma3D — phase 4 : thème et langue du compte, galerie publique (signalements, modération),
-- liens de partage en lecture seule et commentaires.
-- À exécuter une fois dans Supabase (SQL Editor). Rejouable sans danger.
-- Tant que ce script n'est pas appliqué, la galerie et le partage restent masqués dans le site.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Profil : thème (auto / clair / sombre) et arabe parmi les langues
-- ---------------------------------------------------------------------
alter table public.profiles add column if not exists theme text not null default 'auto';
alter table public.profiles drop constraint if exists profiles_theme_check;
alter table public.profiles add constraint profiles_theme_check check (theme in ('auto', 'light', 'dark'));
alter table public.profiles drop constraint if exists profiles_language_check;
alter table public.profiles add constraint profiles_language_check check (language in ('fr', 'en', 'ar'));
grant update (display_name, avatar_url, language, units, favorite_materials, theme, updated_at) on public.profiles to authenticated;

-- ---------------------------------------------------------------------
-- 2. Galerie publique : une copie figée de la conception, publiée par un choix explicite
-- ---------------------------------------------------------------------
create table if not exists public.gallery (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.design_requests (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  category text not null default '' check (char_length(category) <= 80),
  prompt text not null default '' check (char_length(prompt) <= 1500),
  design jsonb not null,
  author_name text check (author_name is null or char_length(author_name) <= 60),
  status text not null default 'published' check (status in ('published', 'hidden')),
  reports_count integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists gallery_status_created_idx on public.gallery (status, created_at desc);

create table if not exists public.gallery_reports (
  id bigint generated always as identity primary key,
  gallery_id uuid not null references public.gallery (id) on delete cascade,
  reporter_id uuid references auth.users (id) on delete set null,
  reason text not null check (char_length(reason) between 1 and 300),
  created_at timestamptz not null default now()
);
create index if not exists gallery_reports_item_idx on public.gallery_reports (gallery_id, created_at desc);

alter table public.gallery enable row level security;
alter table public.gallery_reports enable row level security;

-- Tout le monde voit les publications visibles ; l'auteur voit les siennes ; l'admin voit tout.
drop policy if exists "gallery_select" on public.gallery;
create policy "gallery_select" on public.gallery for select to anon, authenticated
  using (status = 'published' or user_id = (select auth.uid()) or (select public.is_admin()));
-- L'auteur retire sa publication ; l'admin modère (masquer / supprimer).
drop policy if exists "gallery_delete" on public.gallery;
create policy "gallery_delete" on public.gallery for delete to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists "gallery_update_admin" on public.gallery;
create policy "gallery_update_admin" on public.gallery for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists "gallery_reports_admin" on public.gallery_reports;
create policy "gallery_reports_admin" on public.gallery_reports for select to authenticated
  using ((select public.is_admin()));

grant select on public.gallery to anon, authenticated;
grant delete on public.gallery to authenticated;
grant update (status) on public.gallery to authenticated;
grant select on public.gallery_reports to authenticated;

-- Publication : uniquement sa propre conception terminée ; copie figée (la modifier ensuite ne change pas la galerie).
create or replace function public.publish_to_gallery(p_request_id uuid, p_show_author boolean)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_row public.design_requests;
  v_name text;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  select * into v_row from public.design_requests where id = p_request_id and user_id = v_uid;
  if v_row.id is null or v_row.status <> 'ready' or v_row.design is null then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  if p_show_author then
    select nullif(btrim(display_name), '') into v_name from public.profiles where id = v_uid;
  end if;
  insert into public.gallery (request_id, user_id, title, category, prompt, design, author_name)
  values (
    v_row.id, v_uid, left(coalesce(v_row.title, v_row.design ->> 'title', 'Conception'), 200),
    left(coalesce(v_row.design ->> 'category', ''), 80), v_row.prompt, v_row.design, left(v_name, 60)
  )
  on conflict (request_id) do update
    set title = excluded.title, category = excluded.category, prompt = excluded.prompt,
        design = excluded.design, author_name = excluded.author_name, created_at = now()
    where public.gallery.user_id = v_uid and public.gallery.status = 'published'
  returning id into v_id;
  if v_id is null then
    raise exception 'HIDDEN_BY_MODERATION' using errcode = '42501';
  end if;
  return v_id;
end;
$$;

-- Signalement (visiteur ou connecté), limité ; au 5e signalement la publication est masquée en attendant la modération.
create or replace function public.report_gallery_item(p_id uuid, p_reason text, p_ip_hash text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if char_length(btrim(coalesce(p_reason, ''))) not between 1 and 300 then
    raise exception 'INVALID_REASON' using errcode = '22023';
  end if;
  if not public.consume_rate_limit('report', p_ip_hash, 10, 86400, 2000) then
    return false;
  end if;
  insert into public.gallery_reports (gallery_id, reporter_id, reason)
  select g.id, (select auth.uid()), btrim(p_reason) from public.gallery g where g.id = p_id and g.status = 'published';
  if not found then
    return false;
  end if;
  update public.gallery set reports_count = reports_count + 1 where id = p_id returning reports_count into v_count;
  if v_count >= 5 then
    update public.gallery set status = 'hidden' where id = p_id;
  end if;
  return true;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Partage en lecture seule (lien désactivable) et commentaires avec pseudo
-- ---------------------------------------------------------------------
create table if not exists public.shares (
  id uuid primary key default gen_random_uuid(),
  token text not null unique check (token ~ '^[A-Za-z0-9_-]{20,64}$'),
  request_id uuid not null unique references public.design_requests (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  enabled boolean not null default true,
  allow_comments boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.share_comments (
  id bigint generated always as identity primary key,
  share_id uuid not null references public.shares (id) on delete cascade,
  pseudo text not null check (char_length(pseudo) between 1 and 40),
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists share_comments_share_idx on public.share_comments (share_id, created_at);

alter table public.shares enable row level security;
alter table public.share_comments enable row level security;

drop policy if exists "shares_owner" on public.shares;
create policy "shares_owner" on public.shares for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "shares_owner_update" on public.shares;
create policy "shares_owner_update" on public.shares for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "shares_owner_delete" on public.shares;
create policy "shares_owner_delete" on public.shares for delete to authenticated using (user_id = (select auth.uid()));
drop policy if exists "share_comments_owner_delete" on public.share_comments;
create policy "share_comments_owner_delete" on public.share_comments for delete to authenticated
  using (exists (select 1 from public.shares s where s.id = share_id and s.user_id = (select auth.uid())));
drop policy if exists "share_comments_owner_select" on public.share_comments;
create policy "share_comments_owner_select" on public.share_comments for select to authenticated
  using (exists (select 1 from public.shares s where s.id = share_id and s.user_id = (select auth.uid())));

grant select, delete on public.shares to authenticated;
grant update (enabled, allow_comments) on public.shares to authenticated;
grant select, delete on public.share_comments to authenticated;

-- Crée (ou renvoie) le lien de partage de sa propre demande ; « regenerate » change le jeton (l'ancien lien cesse de marcher).
create or replace function public.create_share(p_request_id uuid, p_regenerate boolean default false)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_token text := translate(encode(extensions.gen_random_bytes(18), 'base64'), '+/=', '-_');
  v_out text;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  if not exists (select 1 from public.design_requests where id = p_request_id and user_id = v_uid and status = 'ready') then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  insert into public.shares (token, request_id, user_id)
  values (v_token, p_request_id, v_uid)
  on conflict (request_id) do update
    set token = case when p_regenerate then excluded.token else public.shares.token end,
        enabled = true
    where public.shares.user_id = v_uid
  returning token into v_out;
  return v_out;
end;
$$;

-- Lecture publique d'un projet partagé (si le lien est actif) : uniquement le contenu, jamais l'identité de l'auteur.
create or replace function public.get_shared_project(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'title', r.title,
    'prompt', r.prompt,
    'design', r.design,
    'created_at', r.created_at,
    'allow_comments', s.allow_comments,
    'comments', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'pseudo', c.pseudo, 'body', c.body, 'created_at', c.created_at) order by c.created_at)
        from public.share_comments c where c.share_id = s.id
    ), '[]'::jsonb)
  )
    from public.shares s
    join public.design_requests r on r.id = s.request_id
   where p_token ~ '^[A-Za-z0-9_-]{20,64}$' and s.token = p_token and s.enabled and r.status = 'ready';
$$;

-- Commentaire avec pseudo (visiteur ou connecté), limité par adresse.
create or replace function public.add_share_comment(p_token text, p_pseudo text, p_body text, p_ip_hash text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_share uuid;
begin
  if char_length(btrim(coalesce(p_pseudo, ''))) not between 1 and 40 or char_length(btrim(coalesce(p_body, ''))) not between 1 and 1000 then
    raise exception 'INVALID_COMMENT' using errcode = '22023';
  end if;
  select id into v_share from public.shares where token = p_token and enabled and allow_comments;
  if v_share is null then
    return false;
  end if;
  if not public.consume_rate_limit('comment', p_ip_hash, 20, 3600, 5000) then
    return false;
  end if;
  insert into public.share_comments (share_id, pseudo, body) values (v_share, btrim(p_pseudo), btrim(p_body));
  return true;
end;
$$;

-- ---------------------------------------------------------------------
-- 4. Limite de débit : nouveaux usages (commentaires, signalements)
-- ---------------------------------------------------------------------
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
  if p_scope not in ('clarify', 'comment', 'report') then
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
-- 5. Droits d'exécution
-- ---------------------------------------------------------------------
revoke all on function public.publish_to_gallery(uuid, boolean) from public, anon;
revoke all on function public.report_gallery_item(uuid, text, text) from public;
revoke all on function public.create_share(uuid, boolean) from public, anon;
revoke all on function public.get_shared_project(text) from public;
revoke all on function public.add_share_comment(text, text, text, text) from public;
grant execute on function public.publish_to_gallery(uuid, boolean) to authenticated;
grant execute on function public.report_gallery_item(uuid, text, text) to anon, authenticated;
grant execute on function public.create_share(uuid, boolean) to authenticated;
grant execute on function public.get_shared_project(text) to anon, authenticated;
grant execute on function public.add_share_comment(text, text, text, text) to anon, authenticated;
