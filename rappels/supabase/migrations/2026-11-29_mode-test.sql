-- =============================================================================
--  Migration : MODE TEST réservé au responsable (diagnostic, tests, journal d'anomalies, nettoyage)
--  À coller dans Supabase → SQL Editor → New query → Run. Peut être relancée sans risque.
--  Prérequis : migrations « partage » (2026-11-27) et « détail / bilan / transmission » (2026-11-28).
--  Aucune donnée existante n'est modifiée ni supprimée.
--
--  Pour te donner le rôle « responsable » (une seule fois, à faire ici, jamais dans l'app) :
--
--    update public.profiles set role = 'responsable' where email = 'toi@exemple.fr';
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
