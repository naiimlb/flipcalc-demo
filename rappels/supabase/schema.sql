-- =============================================================================
--  HB Rappels : schéma Supabase (tables + sécurité RLS)
--  À coller en entier dans Supabase → SQL Editor → New query → Run.
--  Peut être relancé sans risque (idempotent). Testé : npm test (tests/rls.test.ts).
--
--  Données stockées : prénom, email, tâches. Rien d'autre.
--  Règle d'or : chaque ligne appartient à un utilisateur (user_id) et la base
--  refuse (RLS) tout accès aux lignes des autres.
-- =============================================================================

-- ----------------------------------------------------------------- profils ---
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  prenom     text not null check (char_length(prenom) between 1 and 30),
  role       text not null default 'caissier' check (role in ('caissier', 'responsable')),
  created_at timestamptz not null default now()
);

-- Fonctions d'aide pour les policies (security definer : elles lisent profiles
-- sans repasser par les policies, ce qui évite les boucles infinies).
create or replace function public.is_manager() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'responsable');
$$;

create or replace function public.is_cashier(uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = uid and role = 'caissier');
$$;

revoke all on function public.is_manager() from public, anon;
revoke all on function public.is_cashier(uuid) from public, anon;
grant execute on function public.is_manager() to authenticated;
grant execute on function public.is_cashier(uuid) to authenticated;

-- À chaque nouveau compte : profil (rôle TOUJOURS « caissier ») + réglages.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, prenom)
  values (
    new.id,
    coalesce(new.email, ''),
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'prenom'), ''), 'Caissier'), 30)
  );
  insert into public.settings (user_id) values (new.id);
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- ---------------------------------------------------------------- réglages ---
create table if not exists public.settings (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  tva            numeric(4, 1) not null default 10 check (tva between 0 and 30),
  default_remind smallint not null default 5 check (default_remind in (0, 5, 15)),
  notify         boolean not null default true,
  handover_min   smallint not null default 1110 check (handover_min in (1080, 1110)),  -- relève : 18h00 ou 18h30
  schedule       text check (schedule ~ '^[JSR-]{7}$'),                                -- mon planning lun → dim : J, S, R ou -
  updated_at     timestamptz not null default now()
);
-- Mise à jour d'une base existante (sans effet sur une base neuve).
alter table public.settings add column if not exists handover_min smallint not null default 1110 check (handover_min in (1080, 1110));
alter table public.settings add column if not exists schedule text check (schedule ~ '^[JSR-]{7}$');

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------------ tâches ---
create table if not exists public.tasks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,   -- le caissier concerné
  assigned_by uuid references auth.users (id) on delete set null,          -- le responsable, si assignée
  title       text not null check (char_length(title) between 1 and 60),
  category    text not null check (category in ('Caisse', 'Salle', 'Stock', 'Hygiène', 'Autre')),
  at_time     text not null check (at_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  days        smallint[] not null default '{}' check (days <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]),
  once_date   date,                                                         -- tâche ponctuelle (service de ce jour)
  team        text not null default 'both' check (team in ('jour', 'soir', 'both')), -- pour quelle équipe
  remind      smallint not null default 5 check (remind between 0 and 240),        -- rappel X minutes avant
  repeat_every smallint check (repeat_every between 5 and 720),                       -- répéter toutes les X min (null = une seule fois)
  end_time    text check (end_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),               -- fin de la fenêtre de répétition
  until_done  boolean not null default true,                                           -- arrêter les rappels dès que la tâche est cochée
  paused      boolean not null default false,                                          -- tâche en pause : ni affichée ni rappelée
  share_mode  text check (share_mode in ('each', 'one')),                              -- partagée : chacun la fait / un seul s'en occupe
  note        text check (char_length(note) <= 200),
  created_at  timestamptz not null default now(),
  constraint tasks_repeat_needs_end check (repeat_every is null or end_time is not null)
);
-- Mise à jour d'une base existante (sans effet sur une base neuve) : les tâches déjà créées gardent leur comportement.
alter table public.tasks add column if not exists team text not null default 'both' check (team in ('jour', 'soir', 'both'));
alter table public.tasks add column if not exists repeat_every smallint check (repeat_every between 5 and 720);
alter table public.tasks add column if not exists end_time text check (end_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
alter table public.tasks add column if not exists until_done boolean not null default true;
alter table public.tasks add column if not exists paused boolean not null default false;
alter table public.tasks drop constraint if exists tasks_remind_check;
alter table public.tasks add constraint tasks_remind_check check (remind between 0 and 240);
alter table public.tasks drop constraint if exists tasks_repeat_needs_end;
alter table public.tasks add constraint tasks_repeat_needs_end check (repeat_every is null or end_time is not null);
create index if not exists tasks_user_idx on public.tasks (user_id);

-- Tâches faites : une ligne par tâche et par service.
create table if not exists public.task_done (
  task_id      uuid not null references public.tasks (id) on delete cascade,
  service_date date not null,
  user_id      uuid not null references auth.users (id) on delete cascade,
  done_at      timestamptz not null default now(),
  primary key (task_id, service_date, user_id)
);
create index if not exists task_done_user_idx on public.task_done (user_id, service_date);

-- ------------------------------------------------------------ notifications push ---
create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth_key   text not null,
  created_at timestamptz not null default now()
);

-- Rappels déjà envoyés : une ligne par tâche, par journée de service et par créneau. La clé primaire empêche tout
-- doublon : le serveur « réserve » le créneau en insérant la ligne AVANT d'envoyer. Aucun accès pour les utilisateurs.
create table if not exists public.push_sent (
  user_id      uuid not null references auth.users (id) on delete cascade,
  task_id      uuid not null references public.tasks (id) on delete cascade,
  service_date date not null,
  slot_at      timestamptz not null,
  sent_at      timestamptz not null default now(),
  primary key (task_id, service_date, slot_at)
);
create index if not exists push_sent_sent_at_idx on public.push_sent (sent_at);

-- =============================================================================
--  SÉCURITÉ : RLS partout + droits minimum
-- =============================================================================
alter table public.profiles           enable row level security;
alter table public.settings           enable row level security;
alter table public.tasks              enable row level security;
alter table public.task_done          enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.push_sent          enable row level security;

-- On retire tout, puis on redonne seulement ce qui est nécessaire (anon = personne).
revoke all on public.profiles, public.settings, public.tasks, public.task_done,
              public.push_subscriptions, public.push_sent
  from anon, authenticated;
-- push_sent : aucune policy et aucun droit → seules les fonctions push_* ci-dessous (protégées par un secret) y touchent.

-- profiles : je me vois ; le responsable voit les caissiers. Je ne peux changer que mon prénom.
grant select on public.profiles to authenticated;
grant update (prenom) on public.profiles to authenticated;
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or (public.is_manager() and role = 'caissier'));
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- settings : les miens uniquement.
grant select, insert, update on public.settings to authenticated;
drop policy if exists settings_own on public.settings;
create policy settings_own on public.settings for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- tasks : je lis/modifie/supprime les miennes. Je ne peux pas changer user_id ni assigned_by.
grant select, insert, delete on public.tasks to authenticated;
grant update (title, category, at_time, days, once_date, team, remind, repeat_every, end_time, until_done, paused, note) on public.tasks to authenticated;
drop policy if exists tasks_insert_own on public.tasks;
create policy tasks_insert_own on public.tasks for insert to authenticated
  with check (user_id = auth.uid() and assigned_by is null);
-- Le responsable peut CRÉER une tâche pour un caissier (pas la lire, pas la modifier).
drop policy if exists tasks_insert_assigned on public.tasks;
create policy tasks_insert_assigned on public.tasks for insert to authenticated
  with check (
    public.is_manager() and assigned_by = auth.uid()
    and user_id <> auth.uid() and public.is_cashier(user_id)
  );
drop policy if exists tasks_update on public.tasks;
create policy tasks_update on public.tasks for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists tasks_delete on public.tasks;
create policy tasks_delete on public.tasks for delete to authenticated
  using (user_id = auth.uid());

-- task_done : voir la section « partage » plus bas (une ligne par personne).
grant select, insert, delete on public.task_done to authenticated;

-- push_subscriptions : les miennes uniquement.
grant select, insert, delete on public.push_subscriptions to authenticated;
grant update (p256dh, auth_key) on public.push_subscriptions to authenticated;
drop policy if exists push_own on public.push_subscriptions;
create policy push_own on public.push_subscriptions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ------------------------------------------------------------ planificateur de rappels ---
-- Fonctions appelées UNIQUEMENT par la route /api/push/tick, avec un secret partagé (CRON_SECRET) stocké dans le
-- coffre-fort de Supabase (Vault, nom « hb_cron_secret »). Sans le bon secret, elles refusent tout. Cela évite de
-- confier la clé service_role à l'application.
create or replace function public.push_assert(p_secret text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_secret is null or p_secret = '' or not exists (
    select 1 from vault.decrypted_secrets where name = 'hb_cron_secret' and decrypted_secret = p_secret
  ) then
    raise exception 'non autorisé' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.push_remove_sub(p_secret text, p_endpoint text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.push_assert(p_secret);
  delete from public.push_subscriptions where endpoint = p_endpoint;
end;
$$;

revoke all on function public.push_assert(text) from public, anon, authenticated;
revoke all on function public.push_remove_sub(text, text) from public;
grant execute on function public.push_remove_sub(text, text) to anon, authenticated;

-- =============================================================================
--  PARTAGE ENTRE COLLÈGUES, LIEN PROFOND ET RELANCES (voir docs/PARTAGE.md)
-- =============================================================================
-- ------------------------------------------------------------------ réglages ---
-- Réglages des relances, modifiables sans toucher au code (voir docs/PARTAGE.md) :
--   update public.app_config set value = 10 where key = 'relance_delay_min';   -- délai avant relance (minutes)
--   update public.app_config set value = 3  where key = 'relance_max';         -- nombre maximum de relances
create table if not exists public.app_config (key text primary key, value integer not null check (value >= 0));
insert into public.app_config (key, value) values ('relance_delay_min', 5), ('relance_max', 6) on conflict (key) do nothing;
alter table public.app_config enable row level security;
revoke all on public.app_config from anon, authenticated;

-- ----------------------------------------------------------------- partage ---
alter table public.tasks add column if not exists share_mode text check (share_mode in ('each', 'one'));
grant update (title, category, at_time, days, once_date, team, remind, repeat_every, end_time, until_done, paused, share_mode, note) on public.tasks to authenticated;

create table if not exists public.task_shares (
  task_id      uuid not null references public.tasks (id) on delete cascade,
  recipient_id uuid not null references auth.users (id) on delete cascade,
  status       text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at   timestamptz not null default now(),
  notified_at  timestamptz,                       -- notification « t'a partagé une tâche » envoyée
  primary key (task_id, recipient_id)
);
create index if not exists task_shares_recipient_idx on public.task_shares (recipient_id);

-- Mode « un seul s'en occupe » : le premier qui prend la tâche (pour une journée de service) l'a.
create table if not exists public.task_claims (
  task_id      uuid not null references public.tasks (id) on delete cascade,
  service_date date not null,
  user_id      uuid not null references auth.users (id) on delete cascade,
  claimed_at   timestamptz not null default now(),
  notified_at  timestamptz,                       -- notification « Prénom s'en occupe » envoyée
  primary key (task_id, service_date)
);

-- Avancement d'une personne sur une tâche pour une journée : vue / en cours.
create table if not exists public.task_progress (
  task_id      uuid not null references public.tasks (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  service_date date not null,
  status       text not null check (status in ('seen', 'taken')),
  updated_at   timestamptz not null default now(),
  primary key (task_id, user_id, service_date)
);

-- Suivi de chaque occurrence (un rappel envoyé à une personne) : sert aux relances et à l'anti-doublon.
create table if not exists public.task_occurrences (
  task_id         uuid not null references public.tasks (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  slot_at         timestamptz not null,           -- instant prévu du rappel (identifie l'occurrence)
  service_date    date not null,
  status          text not null default 'sent' check (status in ('sent', 'seen', 'taken', 'done', 'postponed', 'dropped')),
  first_sent_at   timestamptz not null default now(),   -- envoyée à
  last_sent_at    timestamptz not null default now(),
  reminders       smallint not null default 0,          -- nombre de relances déjà envoyées
  postponed_until timestamptz,
  reason          text,                                  -- pourquoi « abandonnée » : max / taken_by_other / expired
  updated_at      timestamptz not null default now(),
  primary key (task_id, user_id, slot_at)
);
create index if not exists task_occurrences_open_idx on public.task_occurrences (status, last_sent_at);
create index if not exists task_occurrences_day_idx on public.task_occurrences (task_id, user_id, service_date);

-- « Tâche faite » : une ligne par PERSONNE (chacun coche de son côté).
alter table public.task_done drop constraint if exists task_done_pkey;
alter table public.task_done add primary key (task_id, service_date, user_id);

-- ------------------------------------------------------------ fonctions d'aide ---
create or replace function public.owns_task(p_task uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.tasks where id = p_task and user_id = auth.uid());
$$;

create or replace function public.is_shared_with_me(p_task uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.task_shares where task_id = p_task and recipient_id = auth.uid());
$$;

-- Propriétaire, ou collègue qui a ACCEPTÉ le partage.
create or replace function public.can_act_on_task(p_task uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.owns_task(p_task)
    or exists (select 1 from public.task_shares where task_id = p_task and recipient_id = auth.uid() and status = 'accepted');
$$;

-- ------------------------------------------------------------------ sécurité ---
alter table public.task_shares      enable row level security;
alter table public.task_claims      enable row level security;
alter table public.task_progress    enable row level security;
alter table public.task_occurrences enable row level security;
revoke all on public.task_claims, public.task_progress, public.task_occurrences from anon, authenticated;
revoke all on public.task_shares from anon, authenticated;

-- Je lis une tâche si c'est la mienne OU si elle m'a été partagée. Jamais les autres.
drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks for select to authenticated
  using (user_id = auth.uid() or public.is_shared_with_me(id));

-- Partages : je vois ceux que j'ai créés et ceux qu'on m'a envoyés. Seul le destinataire répond (statut), rien d'autre.
grant select on public.task_shares to authenticated;
grant update (status) on public.task_shares to authenticated;
drop policy if exists task_shares_select on public.task_shares;
create policy task_shares_select on public.task_shares for select to authenticated
  using (recipient_id = auth.uid() or public.owns_task(task_id));
drop policy if exists task_shares_respond on public.task_shares;
create policy task_shares_respond on public.task_shares for update to authenticated
  using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

-- Tâches faites : les miennes, pour une tâche sur laquelle j'ai le droit d'agir (la mienne, ou partagée et acceptée).
drop policy if exists task_done_own on public.task_done;
create policy task_done_own on public.task_done for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.can_act_on_task(task_id));

-- ---------------------------------------------------- fonctions pour l'application ---
-- Liste des collègues caissiers : PRÉNOM seulement (jamais l'email ni le reste).
create or replace function public.colleagues() returns table (id uuid, prenom text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.prenom from public.profiles p
   where auth.uid() is not null and p.role = 'caissier' and p.id <> auth.uid()
   order by p.prenom;
$$;

-- Les tâches qu'on m'a partagées (avec le prénom de leur créateur).
create or replace function public.shared_with_me() returns table (task_id uuid, owner_prenom text, status text, mode text)
language sql stable security definer set search_path = '' as $$
  select s.task_id, p.prenom, s.status, t.share_mode
    from public.task_shares s
    join public.tasks t on t.id = s.task_id
    join public.profiles p on p.id = t.user_id
   where s.recipient_id = auth.uid();
$$;

-- Partager (ou ne plus partager) MA tâche avec une liste de collègues caissiers.
create or replace function public.share_task(p_task uuid, p_recipients uuid[], p_mode text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.owns_task(p_task) then raise exception 'non autorisé' using errcode = '42501'; end if;
  if p_mode not in ('each', 'one') then raise exception 'mode invalide' using errcode = '22023'; end if;
  p_recipients := coalesce(p_recipients, '{}');
  if cardinality(p_recipients) > 20 then raise exception 'trop de collègues' using errcode = '22023'; end if;
  if exists (select 1 from unnest(p_recipients) r where r = auth.uid() or not public.is_cashier(r)) then
    raise exception 'collègue invalide' using errcode = '22023';
  end if;
  delete from public.task_shares where task_id = p_task and recipient_id <> all (p_recipients);
  insert into public.task_shares (task_id, recipient_id)
    select p_task, r from (select distinct unnest(p_recipients) as r) x on conflict do nothing;
  update public.tasks set share_mode = case when cardinality(p_recipients) = 0 then null else p_mode end where id = p_task;
end;
$$;

-- Accepter ou refuser (masquer) une tâche partagée avec moi.
create or replace function public.respond_share(p_task uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.task_shares set status = case when p_accept then 'accepted' else 'declined' end
   where task_id = p_task and recipient_id = auth.uid();
  if not found then raise exception 'non autorisé' using errcode = '42501'; end if;
end;
$$;

-- Qui est concerné par cette tâche et où il en est (envoyé / vu / en cours / fait), pour une journée de service.
create or replace function public.share_overview(p_task uuid, p_date date)
returns table (user_id uuid, prenom text, is_owner boolean, share_status text, progress text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.can_act_on_task(p_task) and not public.is_shared_with_me(p_task) then
    raise exception 'non autorisé' using errcode = '42501';
  end if;
  return query
    with people as (
      select t.user_id as uid, true as owner, 'accepted'::text as st from public.tasks t where t.id = p_task
      union all
      select s.recipient_id, false, s.status from public.task_shares s where s.task_id = p_task
    )
    select pe.uid, pr.prenom, pe.owner, pe.st,
           case
             when exists (select 1 from public.task_done d where d.task_id = p_task and d.user_id = pe.uid and d.service_date = p_date) then 'done'
             when exists (select 1 from public.task_claims c where c.task_id = p_task and c.user_id = pe.uid and c.service_date = p_date)
               or exists (select 1 from public.task_progress g where g.task_id = p_task and g.user_id = pe.uid and g.service_date = p_date and g.status = 'taken') then 'taken'
             when exists (select 1 from public.task_progress g where g.task_id = p_task and g.user_id = pe.uid and g.service_date = p_date and g.status = 'seen')
               or exists (select 1 from public.task_occurrences o where o.task_id = p_task and o.user_id = pe.uid and o.service_date = p_date and o.status = 'seen') then 'seen'
             else 'sent'
           end
      from people pe join public.profiles pr on pr.id = pe.uid
     order by pe.owner desc, pr.prenom;
end;
$$;

-- Qui s'occupe de quoi (mode « un seul s'en occupe ») pour des journées données.
create or replace function public.claims_overview(p_dates date[])
returns table (task_id uuid, service_date date, user_id uuid, prenom text)
language sql stable security definer set search_path = '' as $$
  select c.task_id, c.service_date, c.user_id, p.prenom
    from public.task_claims c join public.profiles p on p.id = c.user_id
   where c.service_date = any (p_dates) and public.can_act_on_task(c.task_id);
$$;

-- Une réaction de l'utilisateur sur une tâche : vu / je m'en occupe / fait / reporter. Chacune est un « signe de vie » :
-- elle arrête les relances. Renvoie {ok:true} ou {ok:false, taken_by:'Prénom'} si un collègue l'a déjà prise.
create or replace function public.occ_act(p_task uuid, p_date date, p_action text, p_minutes integer default 10) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  v_mode text;
  v_holder uuid;
  v_name text;
  n integer;
begin
  if me is null or not public.can_act_on_task(p_task) then raise exception 'non autorisé' using errcode = '42501'; end if;
  if p_action not in ('seen', 'taken', 'done', 'postpone') then raise exception 'action invalide' using errcode = '22023'; end if;
  select share_mode into v_mode from public.tasks where id = p_task;

  if p_action in ('taken', 'done') and v_mode = 'one' then
    insert into public.task_claims (task_id, service_date, user_id) values (p_task, p_date, me) on conflict do nothing;
    select user_id into v_holder from public.task_claims where task_id = p_task and service_date = p_date;
    if v_holder <> me then
      select prenom into v_name from public.profiles where id = v_holder;
      return jsonb_build_object('ok', false, 'taken_by', v_name);
    end if;
    -- les autres ne sont plus concernés : leurs relances s'arrêtent
    update public.task_occurrences set status = 'dropped', reason = 'taken_by_other', updated_at = now()
     where task_id = p_task and service_date = p_date and user_id <> me and status in ('sent', 'seen', 'postponed');
  end if;

  if p_action = 'seen' then
    insert into public.task_progress (task_id, user_id, service_date, status) values (p_task, me, p_date, 'seen')
      on conflict (task_id, user_id, service_date) do nothing;
    update public.task_occurrences set status = 'seen', updated_at = now()
     where task_id = p_task and user_id = me and service_date = p_date and status = 'sent';
  elsif p_action = 'taken' then
    insert into public.task_progress (task_id, user_id, service_date, status) values (p_task, me, p_date, 'taken')
      on conflict (task_id, user_id, service_date) do update set status = 'taken', updated_at = now();
    update public.task_occurrences set status = 'taken', updated_at = now()
     where task_id = p_task and user_id = me and service_date = p_date and status in ('sent', 'seen', 'postponed');
  elsif p_action = 'done' then
    insert into public.task_done (task_id, service_date, user_id) values (p_task, p_date, me) on conflict do nothing;
    update public.task_occurrences set status = 'done', updated_at = now()
     where task_id = p_task and user_id = me and service_date = p_date and status in ('sent', 'seen', 'taken', 'postponed');
  else -- postpone : on re-notifie dans X minutes
    p_minutes := greatest(1, least(coalesce(p_minutes, 10), 120));
    insert into public.task_progress (task_id, user_id, service_date, status) values (p_task, me, p_date, 'seen')
      on conflict (task_id, user_id, service_date) do nothing;
    update public.task_occurrences set status = 'postponed', postponed_until = now() + make_interval(mins => p_minutes), updated_at = now()
     where task_id = p_task and user_id = me and service_date = p_date and status in ('sent', 'seen');
    get diagnostics n = row_count;
    if n = 0 then -- aucun rappel en cours (tâche ouverte depuis l'écran) : on en crée un pour le report
      insert into public.task_occurrences (task_id, user_id, slot_at, service_date, status, postponed_until)
        values (p_task, me, date_trunc('minute', now()), p_date, 'postponed', now() + make_interval(mins => p_minutes))
        on conflict (task_id, user_id, slot_at) do update set status = 'postponed', postponed_until = excluded.postponed_until, updated_at = now();
    end if;
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

-- ------------------------------------------- planificateur (protégé par un secret) ---
-- Données du planificateur : abonnements, réglages, tâches (les miennes ET celles partagées et acceptées),
-- tâches faites et « qui s'en occupe ».
create or replace function public.push_tick_data(p_secret text, p_dates date[]) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uids uuid[];
begin
  perform public.push_assert(p_secret);
  select array_agg(distinct user_id) into uids from public.push_subscriptions;
  uids := coalesce(uids, '{}');
  return jsonb_build_object(
    'subs', coalesce((select jsonb_agg(jsonb_build_object('user_id', user_id, 'endpoint', endpoint, 'p256dh', p256dh, 'auth_key', auth_key)) from public.push_subscriptions), '[]'::jsonb),
    'settings', coalesce((select jsonb_agg(jsonb_build_object('user_id', user_id, 'notify', notify, 'schedule', schedule)) from public.settings where user_id = any (uids)), '[]'::jsonb),
    'tasks', coalesce((
      select jsonb_agg((to_jsonb(t) - 'created_at') || jsonb_build_object('for_user', u.uid, 'shared', t.user_id <> u.uid))
        from unnest(uids) as u(uid)
        join public.tasks t on not t.paused and (
          t.user_id = u.uid
          or exists (select 1 from public.task_shares s where s.task_id = t.id and s.recipient_id = u.uid and s.status = 'accepted')
        )
    ), '[]'::jsonb),
    'done', coalesce((select jsonb_agg(jsonb_build_object('task_id', task_id, 'service_date', service_date, 'user_id', user_id)) from public.task_done where user_id = any (uids) and service_date = any (p_dates)), '[]'::jsonb),
    'claims', coalesce((select jsonb_agg(jsonb_build_object('task_id', task_id, 'service_date', service_date, 'user_id', user_id)) from public.task_claims where service_date = any (p_dates)), '[]'::jsonb)
  );
end;
$$;

-- Réserve un rappel pour une personne : vrai la première fois (la seule qui enverra), faux ensuite.
create or replace function public.push_claim(p_secret text, p_user uuid, p_task uuid, p_date date, p_slot timestamptz) returns boolean
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  perform public.push_assert(p_secret);
  insert into public.task_occurrences (task_id, user_id, slot_at, service_date) values (p_task, p_user, p_slot, p_date)
    on conflict (task_id, user_id, slot_at) do nothing;
  get diagnostics n = row_count;
  return n > 0;
end;
$$;

-- Relances : rappels envoyés restés sans signe de vie depuis N minutes (réglable), et rappels reportés arrivés à échéance.
-- Chaque ligne est « verrouillée » par la mise à jour elle-même : deux appels simultanés ne renvoient jamais la même relance.
create or replace function public.push_followups(p_secret text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_delay integer := coalesce((select value from public.app_config where key = 'relance_delay_min'), 5);
  v_max integer := coalesce((select value from public.app_config where key = 'relance_max'), 6);
  v_relances jsonb;
  v_postponed jsonb;
begin
  perform public.push_assert(p_secret);

  -- nettoyage : cochées, prises par un collègue, trop anciennes, plafond de relances atteint
  update public.task_occurrences o set status = 'done', updated_at = now()
   where o.status in ('sent', 'seen', 'taken', 'postponed')
     and exists (select 1 from public.task_done d where d.task_id = o.task_id and d.user_id = o.user_id and d.service_date = o.service_date);
  update public.task_occurrences o set status = 'dropped', reason = 'taken_by_other', updated_at = now()
   where o.status in ('sent', 'seen', 'postponed')
     and exists (select 1 from public.task_claims c where c.task_id = o.task_id and c.service_date = o.service_date and c.user_id <> o.user_id);
  update public.task_occurrences set status = 'dropped', reason = 'expired', updated_at = now()
   where status = 'sent' and last_sent_at < now() - interval '3 hours';
  update public.task_occurrences set status = 'dropped', reason = 'max', updated_at = now()
   where status = 'sent' and reminders >= v_max and last_sent_at <= now() - make_interval(mins => v_delay);

  with due as (
    select o.task_id, o.user_id, o.slot_at from public.task_occurrences o
      join public.tasks t on t.id = o.task_id
      join public.settings st on st.user_id = o.user_id
     where o.status = 'sent' and o.reminders < v_max and o.last_sent_at <= now() - make_interval(mins => v_delay)
       and not t.paused and st.notify
       and exists (select 1 from public.push_subscriptions ps where ps.user_id = o.user_id)
       for update of o skip locked
  ), upd as (
    update public.task_occurrences o set reminders = o.reminders + 1, last_sent_at = now(), updated_at = now()
      from due where o.task_id = due.task_id and o.user_id = due.user_id and o.slot_at = due.slot_at
    returning o.task_id, o.user_id, o.service_date, o.reminders
  )
  select coalesce(jsonb_agg(jsonb_build_object('user_id', u.user_id, 'task_id', u.task_id, 'service_date', u.service_date, 'n', u.reminders, 'title', t.title,
           'subs', (select coalesce(jsonb_agg(jsonb_build_object('endpoint', ps.endpoint, 'p256dh', ps.p256dh, 'auth_key', ps.auth_key)), '[]'::jsonb) from public.push_subscriptions ps where ps.user_id = u.user_id))), '[]'::jsonb)
    into v_relances from upd u join public.tasks t on t.id = u.task_id;

  with due as (
    select o.task_id, o.user_id, o.slot_at from public.task_occurrences o
      join public.tasks t on t.id = o.task_id
      join public.settings st on st.user_id = o.user_id
     where o.status = 'postponed' and o.postponed_until <= now() and not t.paused and st.notify
       and exists (select 1 from public.push_subscriptions ps where ps.user_id = o.user_id)
       for update of o skip locked
  ), upd as (
    update public.task_occurrences o set status = 'sent', reminders = 0, last_sent_at = now(), postponed_until = null, updated_at = now()
      from due where o.task_id = due.task_id and o.user_id = due.user_id and o.slot_at = due.slot_at
    returning o.task_id, o.user_id, o.service_date
  )
  select coalesce(jsonb_agg(jsonb_build_object('user_id', u.user_id, 'task_id', u.task_id, 'service_date', u.service_date, 'title', t.title,
           'subs', (select coalesce(jsonb_agg(jsonb_build_object('endpoint', ps.endpoint, 'p256dh', ps.p256dh, 'auth_key', ps.auth_key)), '[]'::jsonb) from public.push_subscriptions ps where ps.user_id = u.user_id))), '[]'::jsonb)
    into v_postponed from upd u join public.tasks t on t.id = u.task_id;

  return jsonb_build_object('relances', v_relances, 'postponed', v_postponed);
end;
$$;

-- Notifications à envoyer : « Prénom t'a partagé une tâche » et « Prénom s'en occupe ». Marquées envoyées au passage (une seule fois).
create or replace function public.push_notices(p_secret text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_shares jsonb; v_claims jsonb;
begin
  perform public.push_assert(p_secret);

  with upd as (
    update public.task_shares s set notified_at = now() where s.notified_at is null and s.status = 'pending' returning s.task_id, s.recipient_id
  )
  select coalesce(jsonb_agg(jsonb_build_object('user_id', u.recipient_id, 'task_id', u.task_id, 'title', t.title, 'owner_prenom', p.prenom,
           'subs', (select coalesce(jsonb_agg(jsonb_build_object('endpoint', ps.endpoint, 'p256dh', ps.p256dh, 'auth_key', ps.auth_key)), '[]'::jsonb) from public.push_subscriptions ps where ps.user_id = u.recipient_id))), '[]'::jsonb)
    into v_shares from upd u join public.tasks t on t.id = u.task_id join public.profiles p on p.id = t.user_id;

  with upd as (
    update public.task_claims c set notified_at = now() where c.notified_at is null returning c.task_id, c.service_date, c.user_id
  ), parts as (
    select u.task_id, u.service_date, u.user_id as claimer, t.user_id as pid from upd u join public.tasks t on t.id = u.task_id
    union
    select u.task_id, u.service_date, u.user_id, s.recipient_id from upd u join public.task_shares s on s.task_id = u.task_id and s.status = 'accepted'
  )
  select coalesce(jsonb_agg(jsonb_build_object('user_id', x.pid, 'task_id', x.task_id, 'service_date', x.service_date, 'title', t.title, 'claimer_prenom', p.prenom,
           'subs', (select coalesce(jsonb_agg(jsonb_build_object('endpoint', ps.endpoint, 'p256dh', ps.p256dh, 'auth_key', ps.auth_key)), '[]'::jsonb) from public.push_subscriptions ps where ps.user_id = x.pid))), '[]'::jsonb)
    into v_claims from parts x join public.tasks t on t.id = x.task_id join public.profiles p on p.id = x.claimer where x.pid <> x.claimer;

  return jsonb_build_object('shares', v_shares, 'claims', v_claims);
end;
$$;

create or replace function public.push_purge(p_secret text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.push_assert(p_secret);
  delete from public.push_sent where sent_at < now() - interval '3 days';
  delete from public.task_occurrences where first_sent_at < now() - interval '3 days';
  delete from public.task_progress where service_date < current_date - 3;
  delete from public.task_claims where service_date < current_date - 3;
end;
$$;

-- ------------------------------------------------------------------- droits ---
revoke all on function public.owns_task(uuid), public.is_shared_with_me(uuid), public.can_act_on_task(uuid) from public, anon;
grant execute on function public.owns_task(uuid), public.is_shared_with_me(uuid), public.can_act_on_task(uuid) to authenticated;

revoke all on function public.colleagues() from public, anon;
revoke all on function public.shared_with_me() from public, anon;
revoke all on function public.share_task(uuid, uuid[], text) from public, anon;
revoke all on function public.respond_share(uuid, boolean) from public, anon;
revoke all on function public.share_overview(uuid, date) from public, anon;
revoke all on function public.claims_overview(date[]) from public, anon;
revoke all on function public.occ_act(uuid, date, text, integer) from public, anon;
grant execute on function public.colleagues() to authenticated;
grant execute on function public.shared_with_me() to authenticated;
grant execute on function public.share_task(uuid, uuid[], text) to authenticated;
grant execute on function public.respond_share(uuid, boolean) to authenticated;
grant execute on function public.share_overview(uuid, date) to authenticated;
grant execute on function public.claims_overview(date[]) to authenticated;
grant execute on function public.occ_act(uuid, date, text, integer) to authenticated;

revoke all on function public.push_tick_data(text, date[]) from public;
revoke all on function public.push_claim(text, uuid, uuid, date, timestamptz) from public;
revoke all on function public.push_followups(text) from public;
revoke all on function public.push_notices(text) from public;
revoke all on function public.push_purge(text) from public;
grant execute on function public.push_tick_data(text, date[]) to anon, authenticated;
grant execute on function public.push_claim(text, uuid, uuid, date, timestamptz) to anon, authenticated;
grant execute on function public.push_followups(text) to anon, authenticated;
grant execute on function public.push_notices(text) to anon, authenticated;
grant execute on function public.push_purge(text) to anon, authenticated;

-- =============================================================================
--  DÉSIGNER UN RESPONSABLE (à faire ici, jamais dans l'app) :
--
--    update public.profiles set role = 'responsable' where email = 'toi@exemple.fr';
--
--  Pour le repasser caissier : même requête avec role = 'caissier'.
-- =============================================================================
