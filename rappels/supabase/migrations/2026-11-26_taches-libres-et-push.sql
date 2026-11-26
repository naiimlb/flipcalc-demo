-- =============================================================================
--  Migration : tâches libres, fréquence des rappels, pause, notifications push
--  À coller dans Supabase → SQL Editor → New query → Run. Sans risque : ajouts uniquement,
--  aucune donnée existante n'est modifiée ni supprimée. Peut être relancée.
-- =============================================================================

-- Tâches : fréquence des rappels et pause
alter table public.tasks add column if not exists repeat_every smallint check (repeat_every between 5 and 720);
alter table public.tasks add column if not exists end_time text check (end_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
alter table public.tasks add column if not exists until_done boolean not null default true;
alter table public.tasks add column if not exists paused boolean not null default false;
alter table public.tasks drop constraint if exists tasks_remind_check;
alter table public.tasks add constraint tasks_remind_check check (remind between 0 and 240);
alter table public.tasks drop constraint if exists tasks_repeat_needs_end;
alter table public.tasks add constraint tasks_repeat_needs_end check (repeat_every is null or end_time is not null);
grant update (title, category, at_time, days, once_date, team, remind, repeat_every, end_time, until_done, paused, note) on public.tasks to authenticated;

-- Abonnements push : un appareil peut renouveler sa clé
grant update (p256dh, auth_key) on public.push_subscriptions to authenticated;

-- Rappels déjà envoyés (anti-doublon) : aucun accès direct, seulement via les fonctions push_* plus bas
create table if not exists public.push_sent (
  user_id      uuid not null references auth.users (id) on delete cascade,
  task_id      uuid not null references public.tasks (id) on delete cascade,
  service_date date not null,
  slot_at      timestamptz not null,
  sent_at      timestamptz not null default now(),
  primary key (task_id, service_date, slot_at)
);
create index if not exists push_sent_sent_at_idx on public.push_sent (sent_at);
alter table public.push_sent enable row level security;
revoke all on public.push_sent from anon, authenticated;


-- Planificateur de rappels
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
--  ÉTAPE SUIVANTE (une seule fois, voir docs/NOTIFICATIONS.md) : le secret partagé et le planificateur.
--  Remplace XXXX par le même secret que CRON_SECRET sur Vercel, puis exécute :
--
--    select vault.create_secret('XXXX', 'hb_cron_secret');
-- =============================================================================
