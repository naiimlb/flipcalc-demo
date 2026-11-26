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
  primary key (task_id, service_date)
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
drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks for select to authenticated
  using (user_id = auth.uid());
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

-- task_done : les miennes, et seulement pour mes propres tâches.
grant select, insert, delete on public.task_done to authenticated;
drop policy if exists task_done_own on public.task_done;
create policy task_done_own on public.task_done for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.tasks t where t.id = task_id and t.user_id = auth.uid())
  );

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

-- Tout ce qu'il faut pour calculer les rappels dus : abonnements, réglages, tâches non en pause, tâches faites.
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
    'tasks', coalesce((select jsonb_agg(to_jsonb(t) - 'created_at') from public.tasks t where t.user_id = any (uids) and not t.paused), '[]'::jsonb),
    'done', coalesce((select jsonb_agg(jsonb_build_object('task_id', task_id, 'service_date', service_date, 'user_id', user_id)) from public.task_done where user_id = any (uids) and service_date = any (p_dates)), '[]'::jsonb)
  );
end;
$$;

-- Réserve un créneau de rappel : renvoie true si c'est la première fois (donc la seule qui enverra la notification).
create or replace function public.push_claim(p_secret text, p_user uuid, p_task uuid, p_date date, p_slot timestamptz) returns boolean
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  perform public.push_assert(p_secret);
  insert into public.push_sent (user_id, task_id, service_date, slot_at) values (p_user, p_task, p_date, p_slot)
    on conflict (task_id, service_date, slot_at) do nothing;
  get diagnostics n = row_count;
  return n > 0;
end;
$$;

create or replace function public.push_remove_sub(p_secret text, p_endpoint text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.push_assert(p_secret);
  delete from public.push_subscriptions where endpoint = p_endpoint;
end;
$$;

create or replace function public.push_purge(p_secret text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.push_assert(p_secret);
  delete from public.push_sent where sent_at < now() - interval '3 days';
end;
$$;

revoke all on function public.push_assert(text) from public, anon, authenticated;
revoke all on function public.push_tick_data(text, date[]) from public;
revoke all on function public.push_claim(text, uuid, uuid, date, timestamptz) from public;
revoke all on function public.push_remove_sub(text, text) from public;
revoke all on function public.push_purge(text) from public;
grant execute on function public.push_tick_data(text, date[]) to anon, authenticated;
grant execute on function public.push_claim(text, uuid, uuid, date, timestamptz) to anon, authenticated;
grant execute on function public.push_remove_sub(text, text) to anon, authenticated;
grant execute on function public.push_purge(text) to anon, authenticated;

-- =============================================================================
--  DÉSIGNER UN RESPONSABLE (à faire ici, jamais dans l'app) :
--
--    update public.profiles set role = 'responsable' where email = 'toi@exemple.fr';
--
--  Pour le repasser caissier : même requête avec role = 'caissier'.
-- =============================================================================
