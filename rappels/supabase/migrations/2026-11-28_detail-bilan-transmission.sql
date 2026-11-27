-- =============================================================================
--  Migration : page détail (Fait / Plus tard / Refuser), bilan de fin de service, transmission de tâches,
--  statuts et historique.
--  À coller dans Supabase → SQL Editor → New query → Run. Peut être relancée sans risque.
--  Prérequis : la migration « partage et relances » (2026-11-27) doit déjà être passée.
--  Aucune donnée existante n'est supprimée. Déploie l'app juste après (l'ancienne version ignore ces nouveautés
--  mais continue de fonctionner).
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

-- Transmettre une tâche à la prochaine équipe : à un collègue précis (p_to) ou à toute l'équipe (p_to vide).
create or replace function public.transfer_send(p_task uuid, p_date date, p_to uuid[], p_target_date date, p_target_team text, p_message text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  v_group uuid := gen_random_uuid();
  v_msg text := nullif(left(btrim(coalesce(p_message, '')), 140), '');
  v_ids uuid[];
  v_whole boolean;
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
  v_whole := p_to is null or cardinality(p_to) = 0;
  if v_whole then
    select array_agg(id) into v_ids from public.next_team_members(p_target_date, p_target_team);
    if v_ids is null then raise exception 'personne dans la prochaine équipe' using errcode = 'P0001'; end if;
  else
    v_ids := array(select distinct x from unnest(p_to) x);
    if cardinality(v_ids) > 20 or exists (select 1 from unnest(v_ids) x where x = me or not public.is_cashier(x)) then
      raise exception 'collègue invalide' using errcode = '22023';
    end if;
  end if;
  select prenom into v_me_name from public.profiles where id = me;

  foreach r in array v_ids loop
    insert into public.task_transfers (group_id, task_id, service_date, target_date, target_team, from_user, to_user, whole_team, message, expires_at)
      values (v_group, p_task, p_date, p_target_date, p_target_team, me, r, v_whole, v_msg, now() + make_interval(mins => v_timeout));
    insert into public.push_outbox (user_id, kind, task_id, service_date, who, detail) values (r, 'transfer', p_task, p_target_date, v_me_name, v_msg);
  end loop;

  insert into public.task_outcomes (task_id, user_id, service_date, status) values (p_task, me, p_date, 'handed')
    on conflict (task_id, user_id, service_date) do update set status = 'handed', reason = null, updated_at = now();
  update public.task_occurrences set status = 'dropped', reason = 'handed', updated_at = now()
   where task_id = p_task and user_id = me and service_date = p_date and status in ('sent', 'seen', 'taken', 'postponed');
  perform public.log_event(p_task, me, p_date, 'handed', me, v_msg);
  return jsonb_build_object('ok', true, 'count', cardinality(v_ids), 'whole_team', v_whole);
end;
$$;

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
drop function if exists public.push_tick_data(text, date[]);
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
        join public.tasks t on not t.paused and (
          t.user_id = u.uid
          or exists (select 1 from public.task_shares s where s.task_id = t.id and s.recipient_id = u.uid and s.status = 'accepted')
        )
    ), '[]'::jsonb),
    'done', coalesce((select jsonb_agg(jsonb_build_object('task_id', task_id, 'service_date', service_date, 'user_id', user_id)) from public.task_done where user_id = any (uids) and service_date = any (p_dates)), '[]'::jsonb),
    'claims', coalesce((select jsonb_agg(jsonb_build_object('task_id', task_id, 'service_date', service_date, 'user_id', user_id)) from public.task_claims where service_date = any (p_dates)), '[]'::jsonb),
    'outcomes', coalesce((select jsonb_agg(jsonb_build_object('task_id', task_id, 'service_date', service_date, 'user_id', user_id, 'status', status)) from public.task_outcomes where user_id = any (uids) and service_date = any (p_dates)), '[]'::jsonb),
    'transfers_in', coalesce((
      select jsonb_agg((to_jsonb(t) - 'created_at') || jsonb_build_object('for_user', x.to_user, 'target_date', x.target_date))
        from public.task_transfers x join public.tasks t on t.id = x.task_id
       where x.status = 'accepted' and x.to_user = any (uids) and x.target_date = any (p_dates)
    ), '[]'::jsonb)
  );
end;
$$;

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

drop function if exists public.push_followups(text);
create or replace function public.push_followups(p_secret text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_delay integer := coalesce((select value from public.app_config where key = 'relance_delay_min'), 5);
  v_max integer := coalesce((select value from public.app_config where key = 'relance_max'), 6);
  v_relances jsonb;
  v_postponed jsonb;
begin
  perform public.push_assert(p_secret);

  -- nettoyage : cochées, refusées / transmises / abandonnées, prises par un collègue, trop anciennes, plafond atteint
  update public.task_occurrences o set status = 'done', updated_at = now()
   where o.status in ('sent', 'seen', 'taken', 'postponed')
     and exists (select 1 from public.task_done d where d.task_id = o.task_id and d.user_id = o.user_id and d.service_date = o.service_date);
  update public.task_occurrences o set status = 'dropped', reason = 'outcome', updated_at = now()
   where o.status in ('sent', 'seen', 'taken', 'postponed')
     and exists (select 1 from public.task_outcomes x where x.task_id = o.task_id and x.user_id = o.user_id and x.service_date = o.service_date);
  update public.task_occurrences o set status = 'dropped', reason = 'taken_by_other', updated_at = now()
   where o.status in ('sent', 'seen', 'postponed')
     and exists (select 1 from public.task_claims c where c.task_id = o.task_id and c.service_date = o.service_date and c.user_id <> o.user_id);
  update public.task_occurrences set status = 'dropped', reason = 'expired', updated_at = now()
   where status = 'sent' and last_sent_at < now() - interval '3 hours';
  update public.task_occurrences set status = 'dropped', reason = 'max', updated_at = now()
   where status = 'sent' and reminders >= v_max and last_sent_at <= now() - make_interval(mins => v_delay);

  -- relances : seulement les rappels « envoyés » sans signe de vie. Une tâche « vue » ou « reportée » n'est JAMAIS relancée.
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

  -- tâches reportées arrivées à échéance (et tâches transmises dont l'équipe commence)
  with due as (
    select o.task_id, o.user_id, o.slot_at, o.reason as why from public.task_occurrences o
      join public.tasks t on t.id = o.task_id
      join public.settings st on st.user_id = o.user_id
     where o.status = 'postponed' and o.postponed_until <= now() and not t.paused and st.notify
       and exists (select 1 from public.push_subscriptions ps where ps.user_id = o.user_id)
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

-- Notifications à envoyer : partages, « Prénom s'en occupe », et la boîte d'envoi (refus, transmissions).
-- Les transmissions sans réponse sont d'abord clôturées. Chaque notification n'est renvoyée qu'une fois.
drop function if exists public.push_notices(text);
create or replace function public.push_notices(p_secret text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_shares jsonb; v_claims jsonb; v_outbox jsonb;
begin
  perform public.push_assert(p_secret);
  perform public.transfer_sweep();

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

  with upd as (
    update public.push_outbox b set sent_at = now() where b.sent_at is null returning b.id, b.user_id, b.kind, b.task_id, b.service_date, b.who, b.detail
  )
  select coalesce(jsonb_agg(jsonb_build_object('id', u.id, 'user_id', u.user_id, 'kind', u.kind, 'task_id', u.task_id, 'service_date', u.service_date, 'title', t.title, 'who', u.who, 'detail', u.detail,
           'subs', (select coalesce(jsonb_agg(jsonb_build_object('endpoint', ps.endpoint, 'p256dh', ps.p256dh, 'auth_key', ps.auth_key)), '[]'::jsonb) from public.push_subscriptions ps where ps.user_id = u.user_id)) order by u.id), '[]'::jsonb)
    into v_outbox from upd u join public.tasks t on t.id = u.task_id;

  return jsonb_build_object('shares', v_shares, 'claims', v_claims, 'outbox', v_outbox);
end;
$$;

drop function if exists public.push_purge(text);
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
  -- l'historique est gardé 30 jours
  delete from public.task_events where created_at < now() - interval '30 days';
  delete from public.task_outcomes where service_date < current_date - 30;
  delete from public.task_transfers where target_date < current_date - 30;
end;
$$;

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
revoke all on function public.transfer_send(uuid, date, uuid[], date, text, text) from public, anon;
revoke all on function public.transfer_respond(uuid, boolean) from public, anon;
revoke all on function public.transfers_overview(date) from public, anon;
revoke all on function public.bilan_open(date) from public, anon;
grant execute on function public.occ_act(uuid, date, text, integer, text) to authenticated;
grant execute on function public.my_status(uuid, date) to authenticated;
grant execute on function public.my_outcomes(date) to authenticated;
grant execute on function public.task_history(uuid, date) to authenticated;
grant execute on function public.next_team_members(date, text) to authenticated;
grant execute on function public.transfer_send(uuid, date, uuid[], date, text, text) to authenticated;
grant execute on function public.transfer_respond(uuid, boolean) to authenticated;
grant execute on function public.transfers_overview(date) to authenticated;
grant execute on function public.bilan_open(date) to authenticated;

revoke all on function public.push_tick_data(text, date[]) from public;
revoke all on function public.push_bilan_claim(text, uuid, date, text, integer) from public;
revoke all on function public.push_bilan_reminders(text) from public;
revoke all on function public.push_followups(text) from public;
revoke all on function public.push_notices(text) from public;
revoke all on function public.push_purge(text) from public;
grant execute on function public.push_tick_data(text, date[]) to anon, authenticated;
grant execute on function public.push_bilan_claim(text, uuid, date, text, integer) to anon, authenticated;
grant execute on function public.push_bilan_reminders(text) to anon, authenticated;
grant execute on function public.push_followups(text) to anon, authenticated;
grant execute on function public.push_notices(text) to anon, authenticated;
grant execute on function public.push_purge(text) to anon, authenticated;
