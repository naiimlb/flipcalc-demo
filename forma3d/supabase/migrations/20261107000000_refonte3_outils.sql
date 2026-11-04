-- =====================================================================
-- Forma3D — refonte, phase 3 : outils de création, « Modifie la pièce » (IA) et actions Meshy
-- À exécuter une fois dans Supabase › SQL Editor (sans risque si relancé).
-- Nécessite le script de la phase 5 (crédits) déjà appliqué.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Coûts en crédits des nouvelles actions (les valeurs déjà réglées dans /admin sont conservées).
--    Valeurs par défaut = coûts Meshy de la documentation officielle (crédits Meshy).
-- ---------------------------------------------------------------------
update public.app_settings
   set value = jsonb_set(
         value,
         '{costs}',
         '{"ai_edit": 1, "meshy_preview": 20, "meshy_refine": 10, "meshy_retexture": 10, "meshy_remesh": 5,
           "meshy_resize": 1, "meshy_repair": 10, "meshy_analyze": 0}'::jsonb || coalesce(value -> 'costs', '{}'::jsonb)
       ),
       updated_at = now()
 where key = 'credits';

-- ---------------------------------------------------------------------
-- 2. Lancements Meshy : solde vérifié avant le lancement, limite de fréquence par personne.
--    (Appelée par le serveur avec la session de l'utilisateur ; l'appeler soi-même ne fait qu'entamer son propre quota.)
-- ---------------------------------------------------------------------
create table if not exists private.meshy_starts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  action text not null,
  created_at timestamptz not null default now()
);
create index if not exists meshy_starts_user_idx on private.meshy_starts (user_id, created_at desc);

create or replace function public.meshy_start_check(p_action text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_cost integer;
  v_row public.credit_accounts;
  v_admin boolean := (select public.is_admin());
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  if p_action !~ '^meshy_[a-z]{1,20}$' then
    raise exception 'INVALID_ACTION' using errcode = '22023';
  end if;
  v_cost := greatest(0, coalesce((private.credit_settings() -> 'costs' ->> p_action)::integer, 10));
  if not v_admin then
    v_row := private.credit_account_for(v_uid);
    if v_row.free_balance + v_row.bonus_balance < v_cost then
      return jsonb_build_object('ok', false, 'reason', 'credits', 'cost', v_cost);
    end if;
    if (select count(*) from private.meshy_starts where user_id = v_uid and created_at > now() - interval '10 minutes') >= 4
       or (select count(*) from private.meshy_starts where user_id = v_uid and created_at > now() - interval '1 day') >= 40 then
      return jsonb_build_object('ok', false, 'reason', 'rate', 'cost', v_cost);
    end if;
  end if;
  delete from private.meshy_starts where created_at < now() - interval '2 days';
  insert into private.meshy_starts (user_id, action) values (v_uid, p_action);
  return jsonb_build_object('ok', true, 'cost', v_cost);
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Facturation d'une tâche Meshy RÉUSSIE (une seule fois par tâche, idempotent) :
--    rien n'est débité si Meshy échoue, donc aucun remboursement n'est nécessaire.
-- ---------------------------------------------------------------------
create or replace function public.charge_meshy_task(p_action text, p_request_id uuid, p_task_id text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_note text;
  v_cost integer;
  v_row public.credit_accounts;
  v_take integer;
  v_from_free integer;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  if p_action !~ '^meshy_[a-z]{1,20}$' or p_task_id !~ '^[A-Za-z0-9_-]{6,80}$' then
    raise exception 'INVALID_ARGUMENTS' using errcode = '22023';
  end if;
  v_note := 'meshy:' || p_task_id;
  perform pg_advisory_xact_lock(hashtext('forma3d:meshy:' || v_uid::text));
  if exists (select 1 from public.credit_ledger where user_id = v_uid and kind = 'consume' and note = v_note) then
    return 0;
  end if;
  if (select public.is_admin()) then
    return 0;
  end if;
  v_cost := greatest(0, coalesce((private.credit_settings() -> 'costs' ->> p_action)::integer, 10));
  if v_cost = 0 then
    return 0;
  end if;
  v_row := private.credit_account_for(v_uid);
  -- Le solde a été vérifié au lancement ; s'il a baissé entre-temps, on prend ce qui reste.
  v_take := least(v_cost, greatest(0, v_row.free_balance + v_row.bonus_balance));
  v_from_free := least(v_row.free_balance, v_take);
  update public.credit_accounts
     set free_balance = free_balance - v_from_free,
         bonus_balance = bonus_balance - (v_take - v_from_free),
         updated_at = now()
   where user_id = v_uid;
  insert into public.credit_ledger (user_id, delta, kind, action, request_id, note)
  values (v_uid, -v_take, 'consume', p_action, p_request_id, v_note);
  return v_take;
end;
$$;

-- ---------------------------------------------------------------------
-- 4. Remboursements : réservés aux consommations récentes (15 minutes) et jamais aux actions Meshy.
-- ---------------------------------------------------------------------
create or replace function public.refund_credits(p_ledger_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_row public.credit_ledger;
begin
  update public.credit_ledger set refunded = true
   where id = p_ledger_id and user_id = v_uid and kind = 'consume' and not refunded
     and created_at > now() - interval '15 minutes'
     and coalesce(action, '') not like 'meshy\_%'
   returning * into v_row;
  if v_row.id is null then
    return;
  end if;
  perform private.credit_account_for(v_uid);
  update public.credit_accounts set bonus_balance = bonus_balance + (-v_row.delta), updated_at = now() where user_id = v_uid;
  insert into public.credit_ledger (user_id, delta, kind, action, request_id, note)
  values (v_uid, -v_row.delta, 'refund', v_row.action, v_row.request_id, 'Remboursement automatique');
end;
$$;

revoke all on function public.meshy_start_check(text) from public, anon;
revoke all on function public.charge_meshy_task(text, uuid, text) from public, anon;
revoke all on function public.refund_credits(bigint) from public, anon;
grant execute on function public.meshy_start_check(text) to authenticated;
grant execute on function public.charge_meshy_task(text, uuid, text) to authenticated;
grant execute on function public.refund_credits(bigint) to authenticated;
