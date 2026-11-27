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

-- ------------------------------------------------------------------- droits ---
revoke all on function public.owns_task(uuid), public.is_shared_with_me(uuid), public.can_act_on_task(uuid) from public, anon;
grant execute on function public.owns_task(uuid), public.is_shared_with_me(uuid), public.can_act_on_task(uuid) to authenticated;

revoke all on function public.colleagues() from public, anon;
revoke all on function public.shared_with_me() from public, anon;
revoke all on function public.respond_share(uuid, boolean) from public, anon;
revoke all on function public.share_overview(uuid, date) from public, anon;
revoke all on function public.claims_overview(date[]) from public, anon;
grant execute on function public.colleagues() to authenticated;
grant execute on function public.shared_with_me() to authenticated;
grant execute on function public.respond_share(uuid, boolean) to authenticated;
grant execute on function public.share_overview(uuid, date) to authenticated;
grant execute on function public.claims_overview(date[]) to authenticated;


-- =============================================================================
--  PAGE DÉTAIL, BILAN DE FIN DE SERVICE, TRANSMISSION, STATUTS ET HISTORIQUE
--  (remplace can_act_on_task, la règle tasks_select, occ_act et les fonctions push_* ci-dessus)
-- =============================================================================
-- ------------------------------------------------------------------ réglages ---
-- Réglables sans toucher au code (voir docs/BILAN.md) :
--   update public.app_config set value = 90 where key = 'transfer_timeout_min';  -- délai de réponse à une transmission (minutes)
--   update public.app_config set value = 15 where key = 'bilan_reminder_min';    -- 2e rappel du bilan s'il n'a pas été ouvert (minutes)
insert into public.app_config (key, value) values ('transfer_timeout_min', 60), ('bilan_reminder_min', 10) on conflict (key) do nothing;

-- Réglage personnel : envoyer le bilan X minutes avant la fin de mon équipe.
alter table public.settings add column if not exists bilan_lead_min smallint not null default 15 check (bilan_lead_min between 0 and 120);

-- ------------------------------------------------------------------- tables ---
-- Issue d'une tâche pour UNE personne et UNE journée de service, quand elle n'est pas faite :
-- refusée, transmise à la prochaine équipe, abandonnée. (« Non faite » se déduit : fin d'équipe passée sans rien.)
create table if not exists public.task_outcomes (
  task_id      uuid not null references public.tasks (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  service_date date not null,
  status       text not null check (status in ('declined', 'handed', 'abandoned')),
  reason       text check (char_length(reason) <= 200),
  updated_at   timestamptz not null default now(),
  primary key (task_id, user_id, service_date)
);

-- Historique de chaque changement : qui (actor_id), quand (created_at), quoi (action).
create table if not exists public.task_events (
  id           bigint generated always as identity primary key,
  task_id      uuid not null references public.tasks (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,   -- la personne concernée
  service_date date not null,
  action       text not null check (action in ('seen', 'taken', 'postponed', 'done', 'declined', 'handed', 'transfer_accepted', 'transfer_declined', 'transfer_expired', 'abandoned', 'reopened')),
  actor_id     uuid references auth.users (id) on delete set null,
  detail       text,
  created_at   timestamptz not null default now()
);
create index if not exists task_events_task_idx on public.task_events (task_id, service_date, created_at);

-- Transmission d'une tâche à la prochaine équipe. « Toute la prochaine équipe » = une ligne par membre, même group_id :
-- le premier qui accepte la prend, les autres sont fermés.
create table if not exists public.task_transfers (
  id           uuid primary key default gen_random_uuid(),
  group_id     uuid not null,
  task_id      uuid not null references public.tasks (id) on delete cascade,
  service_date date not null,                      -- journée de service d'où part la tâche
  target_date  date not null,                      -- journée de service de la prochaine équipe
  target_team  text not null check (target_team in ('jour', 'soir')),
  from_user    uuid not null references auth.users (id) on delete cascade,
  to_user      uuid not null references auth.users (id) on delete cascade,
  whole_team   boolean not null default false,
  message      text check (char_length(message) <= 140),
  status       text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'expired', 'closed')),
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null,
  responded_at timestamptz
);
create index if not exists task_transfers_to_idx on public.task_transfers (to_user, status);
create index if not exists task_transfers_group_idx on public.task_transfers (group_id);
create index if not exists task_transfers_task_idx on public.task_transfers (task_id);

-- Boîte d'envoi des notifications « événementielles » (refus, transmission…) : le planificateur les vide une fois.
create table if not exists public.push_outbox (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references auth.users (id) on delete cascade,   -- destinataire
  kind         text not null check (kind in ('declined', 'transfer', 'transfer_declined', 'transfer_expired')),
  task_id      uuid not null references public.tasks (id) on delete cascade,
  service_date date not null,
  who          text,                                -- prénom de l'autre personne
  detail       text,                                -- motif ou message
  created_at   timestamptz not null default now(),
  sent_at      timestamptz
);
create index if not exists push_outbox_pending_idx on public.push_outbox (id) where sent_at is null;

-- Bilan de fin de service : une ligne par personne, journée et équipe (verrou anti-doublon + « ouvert »).
create table if not exists public.service_reports (
  user_id      uuid not null references auth.users (id) on delete cascade,
  service_date date not null,
  team         text not null check (team in ('jour', 'soir')),
  remaining    smallint not null default 0,
  sent_at      timestamptz not null default now(),
  reminded_at  timestamptz,
  opened_at    timestamptz,
  primary key (user_id, service_date, team)
);

alter table public.task_outcomes   enable row level security;
alter table public.task_events     enable row level security;
alter table public.task_transfers  enable row level security;
alter table public.push_outbox     enable row level security;
alter table public.service_reports enable row level security;
revoke all on public.task_outcomes, public.task_events, public.task_transfers, public.push_outbox, public.service_reports from anon, authenticated;

-- Quand une tâche est cochée, on l'écrit dans l'historique.
create or replace function public.log_done() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.task_events (task_id, user_id, service_date, action, actor_id) values (new.task_id, new.user_id, new.service_date, 'done', new.user_id);
  return new;
end;
$$;
drop trigger if exists task_done_log on public.task_done;
create trigger task_done_log after insert on public.task_done for each row execute function public.log_done();

create or replace function public.log_event(p_task uuid, p_user uuid, p_date date, p_action text, p_actor uuid, p_detail text default null) returns void
language sql security definer set search_path = '' as $$
  insert into public.task_events (task_id, user_id, service_date, action, actor_id, detail) values (p_task, p_user, p_date, p_action, p_actor, p_detail);
$$;
revoke all on function public.log_event(uuid, uuid, date, text, uuid, text) from public, anon, authenticated;
revoke all on function public.log_done() from public, anon, authenticated;

-- ------------------------------------------------------------ visibilité ---
-- Une tâche qu'on m'a transmise (quel que soit l'état de la transmission) m'est visible.
create or replace function public.is_transferred_to_me(p_task uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.task_transfers where task_id = p_task and to_user = auth.uid());
$$;

-- Je peux agir (cocher…) : propriétaire, partage accepté, ou transmission acceptée.
create or replace function public.can_act_on_task(p_task uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.owns_task(p_task)
    or exists (select 1 from public.task_shares where task_id = p_task and recipient_id = auth.uid() and status = 'accepted')
    or exists (select 1 from public.task_transfers where task_id = p_task and to_user = auth.uid() and status = 'accepted');
$$;

drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks for select to authenticated
  using (user_id = auth.uid() or public.is_shared_with_me(id) or public.is_transferred_to_me(id));

-- ---------------------------------------------- actions sur une tâche (page détail) ---
-- Une réaction sur une tâche pour une journée de service :
--   seen (vu) · taken (je m'en occupe) · done (fait) · postpone (plus tard, p_minutes) ·
--   decline (je ne la ferai pas, motif facultatif) · abandon (laisser tomber) · reopen (reprendre)
-- Toutes sont un « signe de vie » : les relances s'arrêtent. Renvoie {ok:true} ou {ok:false, taken_by:'Prénom'}.
drop function if exists public.occ_act(uuid, date, text, integer);
create or replace function public.occ_act(p_task uuid, p_date date, p_action text, p_minutes integer default 10, p_reason text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  v_mode text;
  v_owner uuid;
  v_assigner uuid;
  v_holder uuid;
  v_name text;
  v_notify uuid;
  v_tr record;
  v_reason text := nullif(left(btrim(coalesce(p_reason, '')), 140), '');
  n integer;
begin
  if me is null or not public.can_act_on_task(p_task) then raise exception 'non autorisé' using errcode = '42501'; end if;
  if p_action not in ('seen', 'taken', 'done', 'postpone', 'decline', 'abandon', 'reopen') then raise exception 'action invalide' using errcode = '22023'; end if;
  select share_mode, user_id, assigned_by into v_mode, v_owner, v_assigner from public.tasks where id = p_task;

  if p_action in ('taken', 'done') and v_mode = 'one' then
    insert into public.task_claims (task_id, service_date, user_id) values (p_task, p_date, me) on conflict do nothing;
    select user_id into v_holder from public.task_claims where task_id = p_task and service_date = p_date;
    if v_holder <> me then
      select prenom into v_name from public.profiles where id = v_holder;
      return jsonb_build_object('ok', false, 'taken_by', v_name);
    end if;
    update public.task_occurrences set status = 'dropped', reason = 'taken_by_other', updated_at = now()
     where task_id = p_task and service_date = p_date and user_id <> me and status in ('sent', 'seen', 'postponed');
  end if;

  if p_action = 'seen' then
    insert into public.task_progress (task_id, user_id, service_date, status) values (p_task, me, p_date, 'seen')
      on conflict (task_id, user_id, service_date) do nothing;
    update public.task_occurrences set status = 'seen', updated_at = now()
     where task_id = p_task and user_id = me and service_date = p_date and status = 'sent';
    if not exists (select 1 from public.task_events where task_id = p_task and user_id = me and service_date = p_date and action = 'seen') then
      perform public.log_event(p_task, me, p_date, 'seen', me);
    end if;

  elsif p_action = 'taken' then
    insert into public.task_progress (task_id, user_id, service_date, status) values (p_task, me, p_date, 'taken')
      on conflict (task_id, user_id, service_date) do update set status = 'taken', updated_at = now();
    update public.task_occurrences set status = 'taken', updated_at = now()
     where task_id = p_task and user_id = me and service_date = p_date and status in ('sent', 'seen', 'postponed');
    perform public.log_event(p_task, me, p_date, 'taken', me);

  elsif p_action = 'done' then
    insert into public.task_done (task_id, service_date, user_id) values (p_task, p_date, me) on conflict do nothing;
    update public.task_occurrences set status = 'done', updated_at = now()
     where task_id = p_task and user_id = me and service_date = p_date and status in ('sent', 'seen', 'taken', 'postponed');
    -- elle est faite : plus rien à refuser / transmettre
    delete from public.task_outcomes where task_id = p_task and user_id = me and service_date = p_date;
    update public.task_transfers set status = 'closed', responded_at = now()
     where task_id = p_task and from_user = me and service_date = p_date and status = 'pending';

  elsif p_action = 'postpone' then
    p_minutes := greatest(1, least(coalesce(p_minutes, 10), 720));
    insert into public.task_progress (task_id, user_id, service_date, status) values (p_task, me, p_date, 'seen')
      on conflict (task_id, user_id, service_date) do nothing;
    update public.task_occurrences set status = 'postponed', postponed_until = now() + make_interval(mins => p_minutes), updated_at = now()
     where task_id = p_task and user_id = me and service_date = p_date and status in ('sent', 'seen', 'taken', 'postponed');
    get diagnostics n = row_count;
    if n = 0 then -- aucun rappel en cours (tâche ouverte depuis l'écran) : on en crée un pour le report
      insert into public.task_occurrences (task_id, user_id, slot_at, service_date, status, postponed_until)
        values (p_task, me, date_trunc('minute', now()), p_date, 'postponed', now() + make_interval(mins => p_minutes))
        on conflict (task_id, user_id, slot_at) do update set status = 'postponed', postponed_until = excluded.postponed_until, updated_at = now();
    end if;
    perform public.log_event(p_task, me, p_date, 'postponed', me, p_minutes || ' min');

  elsif p_action = 'decline' then
    insert into public.task_outcomes (task_id, user_id, service_date, status, reason) values (p_task, me, p_date, 'declined', v_reason)
      on conflict (task_id, user_id, service_date) do update set status = 'declined', reason = excluded.reason, updated_at = now();
    update public.task_occurrences set status = 'dropped', reason = 'declined', updated_at = now()
     where task_id = p_task and user_id = me and service_date = p_date and status in ('sent', 'seen', 'taken', 'postponed');
    delete from public.task_claims where task_id = p_task and service_date = p_date and user_id = me; -- je libère la tâche (mode « un seul »)
    perform public.log_event(p_task, me, p_date, 'declined', me, v_reason);
    select * into v_tr from public.task_transfers where task_id = p_task and to_user = me and target_date = p_date and status = 'accepted' limit 1;
    if found then
      -- une tâche qu'on m'avait transmise : elle retourne à celui qui me l'avait envoyée (qui est prévenu)
      update public.task_transfers set status = 'declined', responded_at = now() where id = v_tr.id;
      perform public.transfer_finalize(v_tr.group_id, 'declined');
    else
      -- partagée ou assignée : la personne qui me l'a envoyée est prévenue ; ma propre tâche : simplement annulée pour aujourd'hui
      if v_owner <> me then v_notify := v_owner;
      elsif v_assigner is not null and v_assigner <> me then v_notify := v_assigner;
      end if;
      if v_notify is not null then
        insert into public.push_outbox (user_id, kind, task_id, service_date, who, detail)
          values (v_notify, 'declined', p_task, p_date, (select prenom from public.profiles where id = me), v_reason);
      end if;
    end if;

  elsif p_action = 'abandon' then
    insert into public.task_outcomes (task_id, user_id, service_date, status, reason) values (p_task, me, p_date, 'abandoned', v_reason)
      on conflict (task_id, user_id, service_date) do update set status = 'abandoned', reason = excluded.reason, updated_at = now();
    update public.task_occurrences set status = 'dropped', reason = 'abandoned', updated_at = now()
     where task_id = p_task and user_id = me and service_date = p_date and status in ('sent', 'seen', 'taken', 'postponed');
    perform public.log_event(p_task, me, p_date, 'abandoned', me, v_reason);

  else -- reopen : je reprends une tâche refusée ou abandonnée
    delete from public.task_outcomes where task_id = p_task and user_id = me and service_date = p_date and status in ('declined', 'abandoned');
    perform public.log_event(p_task, me, p_date, 'reopened', me);
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

-- Mon état sur une tâche pour une journée : à faire / vue / reportée / faite / refusée / transmise / abandonnée.
-- (« non faite » se déduit côté app : fin d'équipe passée sans rien.)
create or replace function public.my_status(p_task uuid, p_date date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare me uuid := auth.uid(); v_out record; v_post timestamptz; v_status text := 'todo'; v_to text;
begin
  if me is null or not (public.owns_task(p_task) or public.is_shared_with_me(p_task) or public.is_transferred_to_me(p_task)) then
    raise exception 'non autorisé' using errcode = '42501';
  end if;
  select status, reason into v_out from public.task_outcomes where task_id = p_task and user_id = me and service_date = p_date;
  select max(postponed_until) into v_post from public.task_occurrences where task_id = p_task and user_id = me and service_date = p_date and status = 'postponed';
  if exists (select 1 from public.task_done where task_id = p_task and user_id = me and service_date = p_date) then v_status := 'done';
  elsif v_out.status is not null then v_status := v_out.status;
  elsif v_post is not null then v_status := 'postponed';
  elsif exists (select 1 from public.task_progress where task_id = p_task and user_id = me and service_date = p_date)
     or exists (select 1 from public.task_occurrences where task_id = p_task and user_id = me and service_date = p_date and status = 'seen') then v_status := 'seen';
  end if;
  if v_status = 'handed' then
    select case when t.whole_team then 'toute la prochaine équipe' else p.prenom end into v_to
      from public.task_transfers t join public.profiles p on p.id = t.to_user
     where t.task_id = p_task and t.from_user = me and t.service_date = p_date and t.status in ('pending', 'accepted')
     order by (t.status = 'accepted') desc limit 1;
  end if;
  return jsonb_build_object('status', v_status, 'postponed_until', v_post, 'reason', v_out.reason, 'handed_to', v_to);
end;
$$;

-- Mes issues (refusée / transmise / abandonnée) depuis une date.
create or replace function public.my_outcomes(p_since date) returns table (task_id uuid, service_date date, status text, reason text)
language sql stable security definer set search_path = '' as $$
  select o.task_id, o.service_date, o.status, o.reason from public.task_outcomes o
   where o.user_id = auth.uid() and o.service_date >= p_since;
$$;

-- Historique d'une tâche pour une journée (qui, quand, quoi). Visible par ceux qui voient la tâche.
create or replace function public.task_history(p_task uuid, p_date date) returns table (prenom text, action text, detail text, created_at timestamptz, concerned text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not (public.owns_task(p_task) or public.is_shared_with_me(p_task) or public.is_transferred_to_me(p_task)) then
    raise exception 'non autorisé' using errcode = '42501';
  end if;
  return query
    select pa.prenom, e.action, e.detail, e.created_at, pu.prenom
      from public.task_events e
      left join public.profiles pa on pa.id = e.actor_id
      left join public.profiles pu on pu.id = e.user_id
     where e.task_id = p_task and e.service_date = p_date
     order by e.created_at, e.id;
end;
$$;

-- ----------------------------------------------------------- transmission ---
-- Collègues de la prochaine équipe : ceux dont le planning indique cette équipe ce jour-là (prénom seulement).
create or replace function public.next_team_members(p_date date, p_team text) returns table (id uuid, prenom text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.prenom
    from public.profiles p join public.settings s on s.user_id = p.id
   where auth.uid() is not null and p.role = 'caissier' and p.id <> auth.uid()
     and s.schedule is not null
     and substr(s.schedule, extract(isodow from p_date)::int, 1) = case p_team when 'jour' then 'J' when 'soir' then 'S' else '?' end
   order by p.prenom;
$$;

-- Si plus personne ne peut prendre la tâche (tous ont refusé / pas de réponse), elle revient à l'expéditeur, qui est prévenu.
create or replace function public.transfer_finalize(p_group uuid, p_why text) returns void
language plpgsql security definer set search_path = '' as $$
declare g record; n integer; v_who text; v_kind text;
begin
  if exists (select 1 from public.task_transfers where group_id = p_group and status in ('pending', 'accepted')) then return; end if;
  select * into g from public.task_transfers where group_id = p_group limit 1;
  if not found then return; end if;
  delete from public.task_outcomes where task_id = g.task_id and user_id = g.from_user and service_date = g.service_date and status = 'handed';
  get diagnostics n = row_count;
  if n = 0 then return; end if;
  v_kind := case when p_why = 'expired' then 'transfer_expired' else 'transfer_declined' end;
  if not g.whole_team then select prenom into v_who from public.profiles where id = g.to_user; end if;
  insert into public.push_outbox (user_id, kind, task_id, service_date, who) values (g.from_user, v_kind, g.task_id, g.service_date, v_who);
  perform public.log_event(g.task_id, g.from_user, g.service_date, v_kind, null, v_who);
end;
$$;

create or replace function public.transfer_sweep() returns void
language plpgsql security definer set search_path = '' as $$
declare g uuid;
begin
  for g in
    with ex as (
      update public.task_transfers set status = 'expired', responded_at = now() where status = 'pending' and expires_at <= now() returning group_id
    ) select distinct group_id from ex
  loop
    perform public.transfer_finalize(g, 'expired');
  end loop;
end;
$$;
revoke all on function public.transfer_finalize(uuid, text), public.transfer_sweep() from public, anon, authenticated;

-- Accepter ou refuser une tâche transmise. Pour « toute l'équipe » : le premier qui accepte la prend.
create or replace function public.transfer_respond(p_id uuid, p_accept boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  t record;
  v_taker uuid;
  v_name text;
  v_start timestamptz;
  v_at timestamptz;
  v_handover integer;
begin
  select * into t from public.task_transfers where id = p_id and to_user = me for update;
  if not found then raise exception 'non autorisé' using errcode = '42501'; end if;
  if t.status <> 'pending' then
    if t.status = 'closed' then
      select p.prenom into v_name from public.task_transfers x join public.profiles p on p.id = x.to_user where x.group_id = t.group_id and x.status = 'accepted' limit 1;
      return jsonb_build_object('ok', false, 'taken_by', coalesce(v_name, 'Un collègue'));
    end if;
    return jsonb_build_object('ok', false, 'state', t.status);
  end if;

  if p_accept then
    perform 1 from public.task_transfers where group_id = t.group_id for update;
    select to_user into v_taker from public.task_transfers where group_id = t.group_id and status = 'accepted' limit 1;
    if v_taker is not null then
      update public.task_transfers set status = 'closed', responded_at = now() where id = t.id;
      select prenom into v_name from public.profiles where id = v_taker;
      return jsonb_build_object('ok', false, 'taken_by', v_name);
    end if;
    update public.task_transfers set status = 'accepted', responded_at = now() where id = t.id;
    update public.task_transfers set status = 'closed', responded_at = now() where group_id = t.group_id and id <> t.id and status = 'pending';
    perform public.log_event(t.task_id, me, t.target_date, 'transfer_accepted', me, (select prenom from public.profiles where id = t.from_user));
    -- un rappel part au début de son équipe (ou tout de suite si elle a déjà commencé)
    select coalesce(handover_min, 1110) into v_handover from public.settings where user_id = me;
    v_start := ((t.target_date::timestamp + make_interval(mins => case when t.target_team = 'jour' then 660 else coalesce(v_handover, 1110) end)) at time zone 'Europe/Paris');
    v_at := date_trunc('minute', greatest(now(), v_start));
    insert into public.task_occurrences (task_id, user_id, slot_at, service_date, status, postponed_until, reason)
      values (t.task_id, me, v_at, t.target_date, 'postponed', v_at, 'transfer')
      on conflict (task_id, user_id, slot_at) do update set status = 'postponed', postponed_until = excluded.postponed_until, reason = 'transfer', updated_at = now();
  else
    update public.task_transfers set status = 'declined', responded_at = now() where id = t.id;
    perform public.log_event(t.task_id, me, t.target_date, 'transfer_declined', me);
    perform public.transfer_finalize(t.group_id, 'declined');
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

-- Mes transmissions (envoyées et reçues) depuis une date. Rien d'autre que des prénoms.
create or replace function public.transfers_overview(p_since date)
returns table (id uuid, group_id uuid, task_id uuid, service_date date, target_date date, target_team text, from_user uuid, from_prenom text, to_user uuid, to_prenom text, whole_team boolean, message text, status text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select t.id, t.group_id, t.task_id, t.service_date, t.target_date, t.target_team, t.from_user, pf.prenom, t.to_user, pt.prenom, t.whole_team, t.message, t.status, t.created_at
    from public.task_transfers t
    join public.profiles pf on pf.id = t.from_user
    join public.profiles pt on pt.id = t.to_user
   where (t.from_user = auth.uid() or t.to_user = auth.uid()) and t.target_date >= p_since
   order by t.created_at;
$$;

-- Le bilan a été ouvert : pas de second rappel.
create or replace function public.bilan_open(p_date date) returns void
language sql security definer set search_path = '' as $$
  update public.service_reports set opened_at = now() where user_id = auth.uid() and service_date = p_date and opened_at is null;
$$;

-- ------------------------------------------- planificateur (protégé par un secret) ---
-- Réserve le bilan d'une personne pour une journée et une équipe : vrai la première fois (la seule qui enverra).
create or replace function public.push_bilan_claim(p_secret text, p_user uuid, p_date date, p_team text, p_remaining integer) returns boolean
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  perform public.push_assert(p_secret);
  insert into public.service_reports (user_id, service_date, team, remaining) values (p_user, p_date, p_team, least(p_remaining, 32000))
    on conflict (user_id, service_date, team) do nothing;
  get diagnostics n = row_count;
  return n > 0;
end;
$$;

-- Second (et dernier) rappel du bilan : 10 minutes après le premier, s'il n'a pas été ouvert. Une seule fois.
create or replace function public.push_bilan_reminders(p_secret text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_gap integer := coalesce((select value from public.app_config where key = 'bilan_reminder_min'), 10);
  v_out jsonb;
begin
  perform public.push_assert(p_secret);
  with due as (
    select r.user_id, r.service_date, r.team from public.service_reports r
     where r.reminded_at is null and r.opened_at is null and r.sent_at <= now() - make_interval(mins => v_gap)
       for update of r skip locked
  ), upd as (
    update public.service_reports r set reminded_at = now() from due
     where r.user_id = due.user_id and r.service_date = due.service_date and r.team = due.team
    returning r.user_id, r.service_date, r.team
  )
  select coalesce(jsonb_agg(jsonb_build_object('user_id', u.user_id, 'service_date', u.service_date, 'team', u.team,
           'subs', (select coalesce(jsonb_agg(jsonb_build_object('endpoint', ps.endpoint, 'p256dh', ps.p256dh, 'auth_key', ps.auth_key)), '[]'::jsonb) from public.push_subscriptions ps where ps.user_id = u.user_id))), '[]'::jsonb)
    into v_out from upd u;
  return v_out;
end;
$$;

-- Notifications à envoyer : partages, « Prénom s'en occupe », et la boîte d'envoi (refus, transmissions).
-- Les transmissions sans réponse sont d'abord clôturées. Chaque notification n'est renvoyée qu'une fois.
-- ------------------------------------------------------------------- droits ---
revoke all on function public.is_transferred_to_me(uuid) from public, anon;
grant execute on function public.is_transferred_to_me(uuid) to authenticated;
revoke all on function public.can_act_on_task(uuid) from public, anon;
grant execute on function public.can_act_on_task(uuid) to authenticated;

revoke all on function public.occ_act(uuid, date, text, integer, text) from public, anon;
revoke all on function public.my_status(uuid, date) from public, anon;
revoke all on function public.my_outcomes(date) from public, anon;
revoke all on function public.task_history(uuid, date) from public, anon;
revoke all on function public.next_team_members(date, text) from public, anon;
revoke all on function public.transfer_respond(uuid, boolean) from public, anon;
revoke all on function public.transfers_overview(date) from public, anon;
revoke all on function public.bilan_open(date) from public, anon;
grant execute on function public.occ_act(uuid, date, text, integer, text) to authenticated;
grant execute on function public.my_status(uuid, date) to authenticated;
grant execute on function public.my_outcomes(date) to authenticated;
grant execute on function public.task_history(uuid, date) to authenticated;
grant execute on function public.next_team_members(date, text) to authenticated;
grant execute on function public.transfer_respond(uuid, boolean) to authenticated;
grant execute on function public.transfers_overview(date) to authenticated;
grant execute on function public.bilan_open(date) to authenticated;

revoke all on function public.push_bilan_claim(text, uuid, date, text, integer) from public;
revoke all on function public.push_bilan_reminders(text) from public;
grant execute on function public.push_bilan_claim(text, uuid, date, text, integer) to anon, authenticated;
grant execute on function public.push_bilan_reminders(text) to anon, authenticated;

-- =============================================================================
--  MODE TEST (réservé au responsable) : données de test, diagnostic, anomalies
--  (remplace tasks_insert_own / tasks_select, share_task, transfer_send, push_tick_data, push_claim,
--   push_followups, push_notices, push_purge)
-- =============================================================================
-- ------------------------------------------------------------------ données de test ---
-- Toute tâche créée par un test est marquée is_test = true. Tout le reste (partages, historique, transmissions,
-- notifications en attente…) dépend d'une tâche : le nettoyage supprime la tâche, le reste part avec elle.
alter table public.tasks add column if not exists is_test boolean not null default false;
create index if not exists tasks_is_test_idx on public.tasks (user_id) where is_test;
alter table public.push_outbox add column if not exists is_test boolean not null default false;

-- Le compte de test désigné par le responsable (un seul) : c'est le SEUL autre compte qui peut voir ou recevoir une
-- tâche de test, et le seul autre compte vers lequel une notification de test peut partir.
create table if not exists public.test_config (
  id         boolean primary key default true check (id),
  test_user  uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.test_config (id) values (true) on conflict do nothing;

-- État du planificateur (une seule ligne), mis à jour à chaque passage de /api/push/tick.
create table if not exists public.planner_state (
  id           boolean primary key default true check (id),
  last_run_at  timestamptz,
  last_ok_at   timestamptz,
  last_error   text,
  last_result  jsonb,
  runs         bigint not null default 0,
  sent_total   bigint not null default 0,
  failed_total bigint not null default 0
);
insert into public.planner_state (id) values (true) on conflict do nothing;

-- Journal d'anomalies (échec d'envoi, abonnement expiré, incohérence…).
create table if not exists public.anomalies (
  id      bigint generated always as identity primary key,
  at      timestamptz not null default now(),
  user_id uuid references auth.users (id) on delete set null,
  kind    text not null,
  detail  text,
  is_test boolean not null default false
);
create index if not exists anomalies_at_idx on public.anomalies (at desc);

alter table public.test_config   enable row level security;
alter table public.planner_state enable row level security;
alter table public.anomalies     enable row level security;
revoke all on public.test_config, public.planner_state, public.anomalies from anon, authenticated;

create or replace function public.test_user_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select test_user from public.test_config where id;
$$;
create or replace function public.test_guard() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.is_manager() then raise exception 'réservé au responsable' using errcode = '42501'; end if;
end;
$$;
-- Suis-je le compte de test désigné ? (booléen sur MOI seulement : on ne révèle jamais l'identifiant du compte de test.)
create or replace function public.is_test_viewer() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.test_config where id and test_user = auth.uid());
$$;
revoke all on function public.test_user_id(), public.test_guard() from public, anon, authenticated;
revoke all on function public.is_test_viewer() from public, anon;
grant execute on function public.is_test_viewer() to authenticated;

-- ------------------------------------------------------------ règles d'accès (RLS) ---
-- Seul un responsable peut créer une tâche de test.
drop policy if exists tasks_insert_own on public.tasks;
create policy tasks_insert_own on public.tasks for insert to authenticated
  with check (user_id = auth.uid() and assigned_by is null and (not is_test or public.is_manager()));

-- Une tâche de test n'est lisible que par son propriétaire (le responsable) et le compte de test désigné.
drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks for select to authenticated
  using (
    (user_id = auth.uid() or public.is_shared_with_me(id) or public.is_transferred_to_me(id))
    and (not is_test or user_id = auth.uid() or public.is_test_viewer())
  );

-- ------------------------------------------------------------ garde-fous : jamais un vrai collègue ---
-- Partager une tâche de test : uniquement avec le compte de test.
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
  if (select is_test from public.tasks where id = p_task)
     and exists (select 1 from unnest(p_recipients) r where r is distinct from public.test_user_id()) then
    raise exception 'tâche de test : seulement le compte de test' using errcode = '42501';
  end if;
  delete from public.task_shares where task_id = p_task and recipient_id <> all (p_recipients);
  insert into public.task_shares (task_id, recipient_id)
    select p_task, r from (select distinct unnest(p_recipients) as r) x on conflict do nothing;
  update public.tasks set share_mode = case when cardinality(p_recipients) = 0 then null else p_mode end where id = p_task;
end;
$$;

-- Transmettre une tâche de test : uniquement au compte de test (« toute l'équipe » = lui seul, s'il est dans cette équipe).
create or replace function public.transfer_send(p_task uuid, p_date date, p_to uuid[], p_target_date date, p_target_team text, p_message text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  v_group uuid := gen_random_uuid();
  v_msg text := nullif(left(btrim(coalesce(p_message, '')), 140), '');
  v_ids uuid[];
  v_whole boolean;
  v_test boolean;
  v_timeout integer := coalesce((select value from public.app_config where key = 'transfer_timeout_min'), 60);
  v_me_name text;
  r uuid;
begin
  if me is null or not public.can_act_on_task(p_task) then raise exception 'non autorisé' using errcode = '42501'; end if;
  if p_target_team not in ('jour', 'soir') then raise exception 'équipe invalide' using errcode = '22023'; end if;
  if p_target_date < p_date or p_target_date > p_date + 1 then raise exception 'date invalide' using errcode = '22023'; end if;
  if exists (select 1 from public.task_done where task_id = p_task and user_id = me and service_date = p_date) then
    raise exception 'tâche déjà faite' using errcode = '22023';
  end if;
  if exists (select 1 from public.task_transfers where task_id = p_task and from_user = me and service_date = p_date and status in ('pending', 'accepted')) then
    raise exception 'déjà transmise' using errcode = '22023';
  end if;
  select is_test into v_test from public.tasks where id = p_task;
  v_whole := p_to is null or cardinality(p_to) = 0;
  if v_whole then
    select array_agg(id) into v_ids from public.next_team_members(p_target_date, p_target_team) m where not v_test or m.id = public.test_user_id();
    if v_ids is null then raise exception 'personne dans la prochaine équipe' using errcode = 'P0001'; end if;
  else
    v_ids := array(select distinct x from unnest(p_to) x);
    if cardinality(v_ids) > 20 or exists (select 1 from unnest(v_ids) x where x = me or not public.is_cashier(x)) then
      raise exception 'collègue invalide' using errcode = '22023';
    end if;
    if v_test and exists (select 1 from unnest(v_ids) x where x is distinct from public.test_user_id()) then
      raise exception 'tâche de test : seulement le compte de test' using errcode = '42501';
    end if;
  end if;
  select prenom into v_me_name from public.profiles where id = me;

  foreach r in array v_ids loop
    insert into public.task_transfers (group_id, task_id, service_date, target_date, target_team, from_user, to_user, whole_team, message, expires_at)
      values (v_group, p_task, p_date, p_target_date, p_target_team, me, r, v_whole, v_msg, now() + make_interval(mins => v_timeout));
    insert into public.push_outbox (user_id, kind, task_id, service_date, who, detail, is_test) values (r, 'transfer', p_task, p_target_date, v_me_name, v_msg, v_test);
  end loop;

  insert into public.task_outcomes (task_id, user_id, service_date, status) values (p_task, me, p_date, 'handed')
    on conflict (task_id, user_id, service_date) do update set status = 'handed', reason = null, updated_at = now();
  update public.task_occurrences set status = 'dropped', reason = 'handed', updated_at = now()
   where task_id = p_task and user_id = me and service_date = p_date and status in ('sent', 'seen', 'taken', 'postponed');
  perform public.log_event(p_task, me, p_date, 'handed', me, v_msg);
  return jsonb_build_object('ok', true, 'count', cardinality(v_ids), 'whole_team', v_whole);
end;
$$;

-- L'expéditeur / le responsable : les notifications de la boîte d'envoi gardent la marque « test ».
create or replace function public.mark_outbox_test() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.is_test := coalesce((select is_test from public.tasks where id = new.task_id), false);
  return new;
end;
$$;
drop trigger if exists push_outbox_mark_test on public.push_outbox;
create trigger push_outbox_mark_test before insert on public.push_outbox for each row execute function public.mark_outbox_test();
revoke all on function public.mark_outbox_test() from public, anon, authenticated;

-- ------------------------------------------------- planificateur : jamais de tâche de test ---
-- Le vrai planificateur ignore TOUTES les données de test : aucun risque de notifier un vrai collègue.
-- (Les tests utilisent leurs propres fonctions test_*, limitées aux tâches is_test.)
create or replace function public.push_tick_data(p_secret text, p_dates date[]) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uids uuid[];
begin
  perform public.push_assert(p_secret);
  select array_agg(distinct user_id) into uids from public.push_subscriptions;
  uids := coalesce(uids, '{}');
  return jsonb_build_object(
    'subs', coalesce((select jsonb_agg(jsonb_build_object('user_id', user_id, 'endpoint', endpoint, 'p256dh', p256dh, 'auth_key', auth_key)) from public.push_subscriptions), '[]'::jsonb),
    'settings', coalesce((select jsonb_agg(jsonb_build_object('user_id', user_id, 'notify', notify, 'schedule', schedule, 'handover_min', handover_min, 'bilan_lead_min', bilan_lead_min)) from public.settings where user_id = any (uids)), '[]'::jsonb),
    'tasks', coalesce((
      select jsonb_agg((to_jsonb(t) - 'created_at') || jsonb_build_object('for_user', u.uid, 'shared', t.user_id <> u.uid))
        from unnest(uids) as u(uid)
        join public.tasks t on not t.paused and not t.is_test and (
          t.user_id = u.uid
          or exists (select 1 from public.task_shares s where s.task_id = t.id and s.recipient_id = u.uid and s.status = 'accepted')
        )
    ), '[]'::jsonb),
    'done', coalesce((select jsonb_agg(jsonb_build_object('task_id', d.task_id, 'service_date', d.service_date, 'user_id', d.user_id)) from public.task_done d where d.user_id = any (uids) and d.service_date = any (p_dates)), '[]'::jsonb),
    'claims', coalesce((select jsonb_agg(jsonb_build_object('task_id', task_id, 'service_date', service_date, 'user_id', user_id)) from public.task_claims where service_date = any (p_dates)), '[]'::jsonb),
    'outcomes', coalesce((select jsonb_agg(jsonb_build_object('task_id', task_id, 'service_date', service_date, 'user_id', user_id, 'status', status)) from public.task_outcomes where user_id = any (uids) and service_date = any (p_dates)), '[]'::jsonb),
    'transfers_in', coalesce((
      select jsonb_agg((to_jsonb(t) - 'created_at') || jsonb_build_object('for_user', x.to_user, 'target_date', x.target_date))
        from public.task_transfers x join public.tasks t on t.id = x.task_id
       where x.status = 'accepted' and not t.is_test and x.to_user = any (uids) and x.target_date = any (p_dates)
    ), '[]'::jsonb)
  );
end;
$$;

-- Réserve un rappel pour une personne : vrai la première fois (la seule qui enverra), faux ensuite. Partagé avec les tests.
create or replace function public.claim_occurrence(p_user uuid, p_task uuid, p_date date, p_slot timestamptz) returns boolean
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  insert into public.task_occurrences (task_id, user_id, slot_at, service_date) values (p_task, p_user, p_slot, p_date)
    on conflict (task_id, user_id, slot_at) do nothing;
  get diagnostics n = row_count;
  return n > 0;
end;
$$;
revoke all on function public.claim_occurrence(uuid, uuid, date, timestamptz) from public, anon, authenticated;

create or replace function public.push_claim(p_secret text, p_user uuid, p_task uuid, p_date date, p_slot timestamptz) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  perform public.push_assert(p_secret);
  return public.claim_occurrence(p_user, p_task, p_date, p_slot);
end;
$$;

-- Relances et tâches reportées. Même code pour le vrai planificateur (p_test = false, délai de la config) et pour les
-- tests (p_test = true : seulement les tâches is_test, délai accéléré en secondes).
create or replace function public.followups_run(p_delay interval, p_max integer, p_test boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_relances jsonb;
  v_postponed jsonb;
begin
  -- nettoyage : cochées, refusées / transmises / abandonnées, prises par un collègue, trop anciennes, plafond atteint
  update public.task_occurrences o set status = 'done', updated_at = now()
   where o.status in ('sent', 'seen', 'taken', 'postponed')
     and (select t.is_test from public.tasks t where t.id = o.task_id) = p_test
     and exists (select 1 from public.task_done d where d.task_id = o.task_id and d.user_id = o.user_id and d.service_date = o.service_date);
  update public.task_occurrences o set status = 'dropped', reason = 'outcome', updated_at = now()
   where o.status in ('sent', 'seen', 'taken', 'postponed')
     and (select t.is_test from public.tasks t where t.id = o.task_id) = p_test
     and exists (select 1 from public.task_outcomes x where x.task_id = o.task_id and x.user_id = o.user_id and x.service_date = o.service_date);
  update public.task_occurrences o set status = 'dropped', reason = 'taken_by_other', updated_at = now()
   where o.status in ('sent', 'seen', 'postponed')
     and (select t.is_test from public.tasks t where t.id = o.task_id) = p_test
     and exists (select 1 from public.task_claims c where c.task_id = o.task_id and c.service_date = o.service_date and c.user_id <> o.user_id);
  update public.task_occurrences o set status = 'dropped', reason = 'expired', updated_at = now()
   where o.status = 'sent' and o.last_sent_at < now() - interval '3 hours'
     and (select t.is_test from public.tasks t where t.id = o.task_id) = p_test;
  update public.task_occurrences o set status = 'dropped', reason = 'max', updated_at = now()
   where o.status = 'sent' and o.reminders >= p_max and o.last_sent_at <= now() - p_delay
     and (select t.is_test from public.tasks t where t.id = o.task_id) = p_test;

  -- relances : seulement les rappels « envoyés » sans signe de vie. Une tâche « vue » ou « reportée » n'est JAMAIS relancée.
  with due as (
    select o.task_id, o.user_id, o.slot_at from public.task_occurrences o
      join public.tasks t on t.id = o.task_id
      join public.settings st on st.user_id = o.user_id
     where o.status = 'sent' and o.reminders < p_max and o.last_sent_at <= now() - p_delay
       and t.is_test = p_test and not t.paused and st.notify
       and (p_test or exists (select 1 from public.push_subscriptions ps where ps.user_id = o.user_id))
       for update of o skip locked
  ), upd as (
    update public.task_occurrences o set reminders = o.reminders + 1, last_sent_at = now(), updated_at = now()
      from due where o.task_id = due.task_id and o.user_id = due.user_id and o.slot_at = due.slot_at
    returning o.task_id, o.user_id, o.service_date, o.reminders
  )
  select coalesce(jsonb_agg(jsonb_build_object('user_id', u.user_id, 'task_id', u.task_id, 'service_date', u.service_date, 'n', u.reminders, 'title', t.title,
           'subs', (select coalesce(jsonb_agg(jsonb_build_object('endpoint', ps.endpoint, 'p256dh', ps.p256dh, 'auth_key', ps.auth_key)), '[]'::jsonb) from public.push_subscriptions ps where ps.user_id = u.user_id))), '[]'::jsonb)
    into v_relances from upd u join public.tasks t on t.id = u.task_id;

  -- tâches reportées arrivées à échéance (et tâches transmises dont l'équipe commence)
  with due as (
    select o.task_id, o.user_id, o.slot_at, o.reason as why from public.task_occurrences o
      join public.tasks t on t.id = o.task_id
      join public.settings st on st.user_id = o.user_id
     where o.status = 'postponed' and o.postponed_until <= now() and t.is_test = p_test and not t.paused and st.notify
       and (p_test or exists (select 1 from public.push_subscriptions ps where ps.user_id = o.user_id))
       for update of o skip locked
  ), upd as (
    update public.task_occurrences o set status = 'sent', reminders = 0, last_sent_at = now(), postponed_until = null, updated_at = now()
      from due where o.task_id = due.task_id and o.user_id = due.user_id and o.slot_at = due.slot_at
    returning o.task_id, o.user_id, o.service_date, due.why as why
  )
  select coalesce(jsonb_agg(jsonb_build_object('user_id', u.user_id, 'task_id', u.task_id, 'service_date', u.service_date, 'title', t.title, 'why', u.why,
           'who', (select p.prenom from public.task_transfers x join public.profiles p on p.id = x.from_user
                    where x.task_id = u.task_id and x.to_user = u.user_id and x.target_date = u.service_date and x.status = 'accepted' limit 1),
           'subs', (select coalesce(jsonb_agg(jsonb_build_object('endpoint', ps.endpoint, 'p256dh', ps.p256dh, 'auth_key', ps.auth_key)), '[]'::jsonb) from public.push_subscriptions ps where ps.user_id = u.user_id))), '[]'::jsonb)
    into v_postponed from upd u join public.tasks t on t.id = u.task_id;

  return jsonb_build_object('relances', v_relances, 'postponed', v_postponed);
end;
$$;
revoke all on function public.followups_run(interval, integer, boolean) from public, anon, authenticated;

create or replace function public.push_followups(p_secret text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform public.push_assert(p_secret);
  return public.followups_run(
    make_interval(mins => coalesce((select value from public.app_config where key = 'relance_delay_min'), 5)),
    coalesce((select value from public.app_config where key = 'relance_max'), 6),
    false);
end;
$$;

-- Notifications de partage, « s'en occupe », boîte d'envoi : même code pour le planificateur et pour les tests.
create or replace function public.notices_run(p_test boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_shares jsonb; v_claims jsonb; v_outbox jsonb;
begin
  perform public.transfer_sweep();

  with upd as (
    update public.task_shares s set notified_at = now()
     where s.notified_at is null and s.status = 'pending'
       and (select t.is_test from public.tasks t where t.id = s.task_id) = p_test
    returning s.task_id, s.recipient_id
  )
  select coalesce(jsonb_agg(jsonb_build_object('user_id', u.recipient_id, 'task_id', u.task_id, 'title', t.title, 'owner_prenom', p.prenom,
           'subs', (select coalesce(jsonb_agg(jsonb_build_object('endpoint', ps.endpoint, 'p256dh', ps.p256dh, 'auth_key', ps.auth_key)), '[]'::jsonb) from public.push_subscriptions ps where ps.user_id = u.recipient_id))), '[]'::jsonb)
    into v_shares from upd u join public.tasks t on t.id = u.task_id join public.profiles p on p.id = t.user_id;

  with upd as (
    update public.task_claims c set notified_at = now()
     where c.notified_at is null and (select t.is_test from public.tasks t where t.id = c.task_id) = p_test
    returning c.task_id, c.service_date, c.user_id
  ), parts as (
    select u.task_id, u.service_date, u.user_id as claimer, t.user_id as pid from upd u join public.tasks t on t.id = u.task_id
    union
    select u.task_id, u.service_date, u.user_id, s.recipient_id from upd u join public.task_shares s on s.task_id = u.task_id and s.status = 'accepted'
  )
  select coalesce(jsonb_agg(jsonb_build_object('user_id', x.pid, 'task_id', x.task_id, 'service_date', x.service_date, 'title', t.title, 'claimer_prenom', p.prenom,
           'subs', (select coalesce(jsonb_agg(jsonb_build_object('endpoint', ps.endpoint, 'p256dh', ps.p256dh, 'auth_key', ps.auth_key)), '[]'::jsonb) from public.push_subscriptions ps where ps.user_id = x.pid))), '[]'::jsonb)
    into v_claims from parts x join public.tasks t on t.id = x.task_id join public.profiles p on p.id = x.claimer where x.pid <> x.claimer;

  with upd as (
    update public.push_outbox b set sent_at = now() where b.sent_at is null and b.is_test = p_test returning b.id, b.user_id, b.kind, b.task_id, b.service_date, b.who, b.detail
  )
  select coalesce(jsonb_agg(jsonb_build_object('id', u.id, 'user_id', u.user_id, 'kind', u.kind, 'task_id', u.task_id, 'service_date', u.service_date, 'title', t.title, 'who', u.who, 'detail', u.detail,
           'subs', (select coalesce(jsonb_agg(jsonb_build_object('endpoint', ps.endpoint, 'p256dh', ps.p256dh, 'auth_key', ps.auth_key)), '[]'::jsonb) from public.push_subscriptions ps where ps.user_id = u.user_id)) order by u.id), '[]'::jsonb)
    into v_outbox from upd u join public.tasks t on t.id = u.task_id;

  return jsonb_build_object('shares', v_shares, 'claims', v_claims, 'outbox', v_outbox);
end;
$$;
revoke all on function public.notices_run(boolean) from public, anon, authenticated;

create or replace function public.push_notices(p_secret text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform public.push_assert(p_secret);
  return public.notices_run(false);
end;
$$;

-- Passage du planificateur : date, résultat, compteurs (utilisé par /api/push/tick, vu dans le mode test).
create or replace function public.push_heartbeat(p_secret text, p_result jsonb, p_error text, p_delivered integer, p_failed integer) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.push_assert(p_secret);
  update public.planner_state set
    last_run_at = now(),
    last_ok_at = case when p_error is null then now() else last_ok_at end,
    last_error = left(p_error, 300),
    last_result = p_result,
    runs = runs + 1,
    sent_total = sent_total + greatest(coalesce(p_delivered, 0), 0),
    failed_total = failed_total + greatest(coalesce(p_failed, 0), 0)
  where id;
end;
$$;

-- Anomalie détectée par le planificateur (échec d'envoi, abonnement expiré…).
create or replace function public.push_log_anomaly(p_secret text, p_kind text, p_user uuid, p_detail text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.push_assert(p_secret);
  insert into public.anomalies (kind, user_id, detail) values (left(p_kind, 60), p_user, left(p_detail, 300));
  delete from public.anomalies where id in (select id from public.anomalies order by id desc offset 500);
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
  delete from public.push_outbox where sent_at is not null and sent_at < now() - interval '3 days';
  delete from public.service_reports where service_date < current_date - 7;
  delete from public.task_events where created_at < now() - interval '30 days';
  delete from public.task_outcomes where service_date < current_date - 30;
  delete from public.task_transfers where target_date < current_date - 30;
  delete from public.anomalies where at < now() - interval '30 days';
end;
$$;

-- ========================================================== fonctions du MODE TEST (responsable seulement) ===
-- Chacune commence par test_guard() : un caissier reçoit « réservé au responsable » (42501).

-- État en direct : heure du serveur, planificateur, notifications en attente, compte de test.
create or replace function public.test_status() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_tu uuid; v_name text;
begin
  perform public.test_guard();
  v_tu := public.test_user_id();
  select prenom into v_name from public.profiles where id = v_tu;
  return jsonb_build_object(
    'server_now', now(),
    'planner', (select to_jsonb(p) - 'id' from public.planner_state p where id),
    'pending', jsonb_build_object(
      'outbox', (select count(*) from public.push_outbox where sent_at is null and not is_test),
      'postponed_due', (select count(*) from public.task_occurrences o join public.tasks t on t.id = o.task_id where o.status = 'postponed' and o.postponed_until <= now() and not t.is_test),
      'relances_due', (select count(*) from public.task_occurrences o join public.tasks t on t.id = o.task_id where o.status = 'sent' and not t.is_test and o.last_sent_at <= now() - interval '5 minutes'),
      'transfers', (select count(*) from public.task_transfers where status = 'pending')),
    'subs', jsonb_build_object('mine', (select count(*) from public.push_subscriptions where user_id = auth.uid()), 'test', (select count(*) from public.push_subscriptions where user_id = v_tu)),
    'test_user', case when v_tu is null then null else jsonb_build_object('id', v_tu, 'prenom', v_name) end,
    'test_tasks', (select count(*) from public.tasks where is_test),
    'anomalies', (select count(*) from public.anomalies)
  );
end;
$$;

-- Désigner (ou retirer, avec null) le compte de test, par son email. Doit être un caissier existant.
create or replace function public.test_set_account(p_email text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_name text;
begin
  perform public.test_guard();
  if p_email is null or btrim(p_email) = '' then
    update public.test_config set test_user = null, updated_at = now() where id;
    return jsonb_build_object('ok', true, 'test_user', null);
  end if;
  select id, prenom into v_id, v_name from public.profiles where lower(email) = lower(btrim(p_email)) and role = 'caissier' and id <> auth.uid();
  if v_id is null then raise exception 'aucun caissier avec cet email' using errcode = 'P0001'; end if;
  update public.test_config set test_user = v_id, updated_at = now() where id;
  return jsonb_build_object('ok', true, 'test_user', jsonb_build_object('id', v_id, 'prenom', v_name));
end;
$$;

-- Abonnements push vers lesquels une notification de TEST peut partir : les miens, ou ceux du compte de test. Jamais d'autres.
create or replace function public.test_target_subs(p_target text) returns table (endpoint text, p256dh text, auth_key text)
language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid;
begin
  perform public.test_guard();
  if p_target = 'self' then v_uid := auth.uid();
  elsif p_target = 'test' then
    v_uid := public.test_user_id();
    if v_uid is null then raise exception 'aucun compte de test désigné' using errcode = 'P0001'; end if;
  else raise exception 'cible invalide' using errcode = '22023';
  end if;
  return query select s.endpoint, s.p256dh, s.auth_key from public.push_subscriptions s where s.user_id = v_uid;
end;
$$;

-- Une occurrence « envoyée » pour une tâche de test (comme le ferait le planificateur), pour MOI ou le compte de test.
create or replace function public.test_sim_occurrence(p_task uuid, p_user uuid, p_date date, p_slot timestamptz default null) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  perform public.test_guard();
  if not exists (select 1 from public.tasks where id = p_task and is_test) then raise exception 'ce n''est pas une tâche de test' using errcode = '42501'; end if;
  if p_user is distinct from auth.uid() and p_user is distinct from public.test_user_id() then raise exception 'utilisateur non autorisé pour un test' using errcode = '42501'; end if;
  return public.claim_occurrence(p_user, p_task, p_date, coalesce(p_slot, date_trunc('second', now())));
end;
$$;

-- Fait « vieillir » les occurrences et transmissions d'une tâche de test (accélère le temps sans attendre).
create or replace function public.test_age(p_task uuid, p_seconds integer) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.test_guard();
  if not exists (select 1 from public.tasks where id = p_task and is_test) then raise exception 'ce n''est pas une tâche de test' using errcode = '42501'; end if;
  update public.task_occurrences set
    last_sent_at = last_sent_at - make_interval(secs => p_seconds),
    first_sent_at = first_sent_at - make_interval(secs => p_seconds),
    postponed_until = postponed_until - make_interval(secs => p_seconds)
  where task_id = p_task;
  update public.task_transfers set expires_at = expires_at - make_interval(secs => p_seconds) where task_id = p_task;
end;
$$;

-- Relances sur les tâches de TEST uniquement, avec un délai accéléré (en secondes).
create or replace function public.test_followups(p_delay_seconds integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform public.test_guard();
  return public.followups_run(make_interval(secs => greatest(p_delay_seconds, 1)), coalesce((select value from public.app_config where key = 'relance_max'), 6), true);
end;
$$;

-- Notifications de partage / « s'en occupe » / transmissions des tâches de TEST uniquement.
create or replace function public.test_notices() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform public.test_guard();
  return public.notices_run(true);
end;
$$;

-- Verrou anti-doublon : réserver deux fois le même créneau doit refuser la seconde fois.
create or replace function public.test_claim(p_task uuid, p_user uuid, p_date date, p_slot timestamptz) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  perform public.test_guard();
  return public.test_sim_occurrence(p_task, p_user, p_date, p_slot);
end;
$$;

-- Agir comme le COMPTE DE TEST (jamais comme un autre) sur une tâche de test : seules ces actions sont possibles.
create or replace function public.test_as(p_action text, p_args jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  tu uuid := public.test_user_id();
  v_task uuid := nullif(p_args ->> 'task', '')::uuid;
  v_out jsonb;
begin
  perform public.test_guard();
  if tu is null then raise exception 'aucun compte de test désigné' using errcode = 'P0001'; end if;
  if p_action not in ('tasks', 'shared_with_me', 'transfers', 'respond_share', 'occ_act', 'transfer_respond', 'status') then
    raise exception 'action de test inconnue' using errcode = '22023';
  end if;
  -- toute action visant une tâche doit viser une tâche de TEST
  if v_task is not null and not exists (select 1 from public.tasks where id = v_task and is_test) then
    raise exception 'ce n''est pas une tâche de test' using errcode = '42501';
  end if;
  perform set_config('request.jwt.claim.sub', tu::text, true);
  begin
    if p_action = 'tasks' then
      -- mêmes fonctions que la règle d'accès « tasks_select » (une fonction security definer ne passe pas par la RLS)
      v_out := (select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'title', t.title, 'user_id', t.user_id)), '[]'::jsonb)
                  from public.tasks t
                 where (t.user_id = tu or public.is_shared_with_me(t.id) or public.is_transferred_to_me(t.id))
                   and (not t.is_test or t.user_id = tu or tu = public.test_user_id()));
    elsif p_action = 'shared_with_me' then
      v_out := (select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb) from public.shared_with_me() s);
    elsif p_action = 'transfers' then
      v_out := (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from public.transfers_overview(current_date - 3) x);
    elsif p_action = 'respond_share' then
      perform public.respond_share(v_task, (p_args ->> 'accept')::boolean);
      v_out := jsonb_build_object('ok', true);
    elsif p_action = 'occ_act' then
      v_out := public.occ_act(v_task, (p_args ->> 'date')::date, p_args ->> 'action', coalesce((p_args ->> 'minutes')::int, 10), p_args ->> 'reason');
    elsif p_action = 'transfer_respond' then
      v_out := public.transfer_respond((p_args ->> 'id')::uuid, (p_args ->> 'accept')::boolean);
    else
      v_out := public.my_status(v_task, (p_args ->> 'date')::date);
    end if;
  exception when others then
    perform set_config('request.jwt.claim.sub', me::text, true);
    raise;
  end;
  perform set_config('request.jwt.claim.sub', me::text, true);
  return coalesce(v_out, 'null'::jsonb);
end;
$$;

-- Tout ce que la base sait d'une tâche de test (pour vérifier les changements de statut).
create or replace function public.test_inspect(p_task uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.test_guard();
  if not exists (select 1 from public.tasks where id = p_task and is_test) then raise exception 'ce n''est pas une tâche de test' using errcode = '42501'; end if;
  return jsonb_build_object(
    'occurrences', (select coalesce(jsonb_agg(jsonb_build_object('user_id', user_id, 'status', status, 'reminders', reminders, 'reason', reason, 'postponed_until', postponed_until, 'service_date', service_date) order by first_sent_at), '[]'::jsonb) from public.task_occurrences where task_id = p_task),
    'outcomes', (select coalesce(jsonb_agg(jsonb_build_object('user_id', user_id, 'status', status, 'reason', reason, 'service_date', service_date)), '[]'::jsonb) from public.task_outcomes where task_id = p_task),
    'done', (select coalesce(jsonb_agg(jsonb_build_object('user_id', user_id, 'service_date', service_date)), '[]'::jsonb) from public.task_done where task_id = p_task),
    'claims', (select coalesce(jsonb_agg(jsonb_build_object('user_id', user_id, 'service_date', service_date)), '[]'::jsonb) from public.task_claims where task_id = p_task),
    'shares', (select coalesce(jsonb_agg(jsonb_build_object('recipient_id', recipient_id, 'status', status)), '[]'::jsonb) from public.task_shares where task_id = p_task),
    'transfers', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'to_user', to_user, 'status', status, 'whole_team', whole_team) order by created_at), '[]'::jsonb) from public.task_transfers where task_id = p_task),
    'events', (select coalesce(jsonb_agg(jsonb_build_object('user_id', user_id, 'action', action, 'actor_id', actor_id, 'detail', detail, 'at', created_at) order by id), '[]'::jsonb) from public.task_events where task_id = p_task),
    'outbox', (select coalesce(jsonb_agg(jsonb_build_object('user_id', user_id, 'kind', kind, 'sent', sent_at is not null, 'is_test', is_test) order by id), '[]'::jsonb) from public.push_outbox where task_id = p_task)
  );
end;
$$;

-- « Nettoyer les données de test » : supprime les tâches de test (et tout ce qui en dépend) et les anomalies de test.
create or replace function public.test_cleanup() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare n_tasks integer; n_anom integer;
begin
  perform public.test_guard();
  delete from public.tasks where is_test;
  get diagnostics n_tasks = row_count;
  delete from public.anomalies where is_test;
  get diagnostics n_anom = row_count;
  return jsonb_build_object('tasks', n_tasks, 'anomalies', n_anom);
end;
$$;

-- Journal d'anomalies : écrire (tests), lire, effacer.
create or replace function public.test_log(p_kind text, p_detail text, p_user uuid default null, p_is_test boolean default true) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.test_guard();
  insert into public.anomalies (kind, user_id, detail, is_test) values (left(p_kind, 60), coalesce(p_user, auth.uid()), left(p_detail, 300), coalesce(p_is_test, true));
end;
$$;

create or replace function public.test_anomalies(p_limit integer default 100) returns table (id bigint, at timestamptz, prenom text, kind text, detail text, is_test boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.test_guard();
  return query select a.id, a.at, p.prenom, a.kind, a.detail, a.is_test from public.anomalies a left join public.profiles p on p.id = a.user_id order by a.id desc limit least(greatest(p_limit, 1), 300);
end;
$$;

create or replace function public.test_clear_anomalies() returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  perform public.test_guard();
  delete from public.anomalies;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Recherche d'incohérences dans les données réelles (relance qui ne s'arrête pas, statut incohérent, transmission oubliée…).
-- Les nouvelles trouvailles sont écrites dans le journal (sans doublon sur 1 heure).
create or replace function public.test_scan() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r record; v_found jsonb := '[]'::jsonb; v_max integer := coalesce((select value from public.app_config where key = 'relance_max'), 6);
begin
  perform public.test_guard();
  for r in
    select 'relance_sans_fin'::text as kind, o.user_id, format('« %s » : %s relances, toujours active', t.title, o.reminders) as detail
      from public.task_occurrences o join public.tasks t on t.id = o.task_id
     where o.status = 'sent' and o.reminders > v_max and not t.is_test
    union all
    select 'relance_apres_action', o.user_id, format('« %s » : tâche faite ou refusée mais rappel encore actif depuis %s min', t.title, (extract(epoch from now() - o.last_sent_at) / 60)::int)
      from public.task_occurrences o join public.tasks t on t.id = o.task_id
     where o.status = 'sent' and not t.is_test and o.last_sent_at < now() - interval '15 minutes'
       and (exists (select 1 from public.task_done d where d.task_id = o.task_id and d.user_id = o.user_id and d.service_date = o.service_date)
            or exists (select 1 from public.task_outcomes x where x.task_id = o.task_id and x.user_id = o.user_id and x.service_date = o.service_date))
    union all
    select 'transmission_sans_statut', x.user_id, format('« %s » : marquée transmise mais aucune transmission en cours', t.title)
      from public.task_outcomes x join public.tasks t on t.id = x.task_id
     where x.status = 'handed' and not t.is_test
       and not exists (select 1 from public.task_transfers tr where tr.task_id = x.task_id and tr.from_user = x.user_id and tr.service_date = x.service_date and tr.status in ('pending', 'accepted'))
    union all
    select 'transmission_non_cloturee', tr.from_user, format('« %s » : transmission sans réponse depuis plus de 10 min après le délai', t.title)
      from public.task_transfers tr join public.tasks t on t.id = tr.task_id
     where tr.status = 'pending' and not t.is_test and tr.expires_at < now() - interval '10 minutes'
    union all
    select 'notification_bloquee', b.user_id, format('« %s » : notification (%s) en attente depuis plus de 10 min', t.title, b.kind)
      from public.push_outbox b join public.tasks t on t.id = b.task_id
     where b.sent_at is null and not b.is_test and b.created_at < now() - interval '10 minutes'
  loop
    if not exists (select 1 from public.anomalies a where a.kind = r.kind and a.detail = r.detail and a.at > now() - interval '1 hour') then
      insert into public.anomalies (kind, user_id, detail) values (r.kind, r.user_id, r.detail);
    end if;
    v_found := v_found || jsonb_build_object('kind', r.kind, 'detail', r.detail);
  end loop;
  return v_found;
end;
$$;

-- ------------------------------------------------------------------- droits ---
revoke all on function public.share_task(uuid, uuid[], text) from public, anon;
revoke all on function public.transfer_send(uuid, date, uuid[], date, text, text) from public, anon;
grant execute on function public.share_task(uuid, uuid[], text) to authenticated;
grant execute on function public.transfer_send(uuid, date, uuid[], date, text, text) to authenticated;

revoke all on function public.test_status(), public.test_target_subs(text), public.test_cleanup(), public.test_clear_anomalies(), public.test_scan(),
  public.test_notices(), public.test_inspect(uuid), public.test_as(text, jsonb), public.test_followups(integer), public.test_age(uuid, integer),
  public.test_claim(uuid, uuid, date, timestamptz), public.test_sim_occurrence(uuid, uuid, date, timestamptz), public.test_set_account(text),
  public.test_log(text, text, uuid, boolean), public.test_anomalies(integer) from public, anon;
grant execute on function public.test_status(), public.test_target_subs(text), public.test_cleanup(), public.test_clear_anomalies(), public.test_scan(),
  public.test_notices(), public.test_inspect(uuid), public.test_as(text, jsonb), public.test_followups(integer), public.test_age(uuid, integer),
  public.test_claim(uuid, uuid, date, timestamptz), public.test_sim_occurrence(uuid, uuid, date, timestamptz), public.test_set_account(text),
  public.test_log(text, text, uuid, boolean), public.test_anomalies(integer) to authenticated;

revoke all on function public.push_tick_data(text, date[]) from public;
revoke all on function public.push_claim(text, uuid, uuid, date, timestamptz) from public;
revoke all on function public.push_followups(text) from public;
revoke all on function public.push_notices(text) from public;
revoke all on function public.push_purge(text) from public;
revoke all on function public.push_heartbeat(text, jsonb, text, integer, integer) from public;
revoke all on function public.push_log_anomaly(text, text, uuid, text) from public;
grant execute on function public.push_tick_data(text, date[]) to anon, authenticated;
grant execute on function public.push_claim(text, uuid, uuid, date, timestamptz) to anon, authenticated;
grant execute on function public.push_followups(text) to anon, authenticated;
grant execute on function public.push_notices(text) to anon, authenticated;
grant execute on function public.push_purge(text) to anon, authenticated;
grant execute on function public.push_heartbeat(text, jsonb, text, integer, integer) to anon, authenticated;
grant execute on function public.push_log_anomaly(text, text, uuid, text) to anon, authenticated;

-- =============================================================================
--  DÉSIGNER UN RESPONSABLE (à faire ici, jamais dans l'app) :
--
--    update public.profiles set role = 'responsable' where email = 'toi@exemple.fr';
--
--  Pour le repasser caissier : même requête avec role = 'caissier'.
-- =============================================================================
