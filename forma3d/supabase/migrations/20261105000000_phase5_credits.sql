-- =====================================================================
-- Forma3D — phase 5 : crédits et quotas (SANS paiement en ligne)
-- Chaque action consomme un nombre de crédits réglable dans /admin ; chaque utilisateur reçoit des crédits
-- gratuits renouvelés chaque mois ; l'administrateur peut offrir ou retirer des crédits.
-- À exécuter une fois dans Supabase (SQL Editor). Rejouable sans danger.
-- Tant que ce script n'est pas appliqué, le site fonctionne sans crédits (aucune limite de ce type).
-- =====================================================================

-- Réglages (coûts et allocation mensuelle) : lisibles par tous (ils sont affichés), modifiables par l'admin.
alter policy "settings_select_public" on public.app_settings
  using (key in ('site', 'features', 'ai', 'credits') or (select public.is_admin()));

insert into public.app_settings (key, value)
values ('credits', '{"monthlyFree": 30, "costs": {"design": 1, "variant": 1, "model3d": 5}}'::jsonb)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- 1. Comptes de crédits et registre des mouvements
-- ---------------------------------------------------------------------
create table if not exists public.credit_accounts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- Crédits gratuits du mois (remis à l'allocation au début de chaque mois, non cumulables).
  free_balance integer not null default 0 check (free_balance >= 0),
  -- Crédits offerts par l'administrateur (ne expirent pas).
  bonus_balance integer not null default 0 check (bonus_balance >= 0),
  -- Allocation mensuelle propre à cet utilisateur (sinon celle des réglages).
  monthly_allowance integer check (monthly_allowance is null or monthly_allowance between 0 and 100000),
  period_start date not null default date_trunc('month', now())::date,
  updated_at timestamptz not null default now()
);

create table if not exists public.credit_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  delta integer not null,
  kind text not null check (kind in ('consume', 'refund', 'renew', 'grant', 'adjust')),
  action text,
  request_id uuid references public.design_requests (id) on delete set null,
  note text check (note is null or char_length(note) <= 200),
  refunded boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists credit_ledger_user_idx on public.credit_ledger (user_id, created_at desc);
create index if not exists credit_ledger_created_idx on public.credit_ledger (created_at desc);

alter table public.credit_accounts enable row level security;
alter table public.credit_ledger enable row level security;

-- Chacun lit son compte et ses mouvements ; l'admin lit tout. Aucune écriture directe : uniquement par fonctions.
drop policy if exists "credit_accounts_select" on public.credit_accounts;
create policy "credit_accounts_select" on public.credit_accounts for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists "credit_ledger_select" on public.credit_ledger;
create policy "credit_ledger_select" on public.credit_ledger for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
grant select on public.credit_accounts, public.credit_ledger to authenticated;

-- ---------------------------------------------------------------------
-- 2. Fonctions internes : réglages, ouverture du compte, renouvellement mensuel
-- ---------------------------------------------------------------------
create or replace function private.credit_settings()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select value from public.app_settings where key = 'credits'), '{"monthlyFree": 30, "costs": {"design": 1, "variant": 1, "model3d": 5}}'::jsonb);
$$;

-- Ouvre le compte si besoin et applique le renouvellement mensuel des crédits gratuits ; renvoie la ligne verrouillée.
create or replace function private.credit_account_for(p_user uuid)
returns public.credit_accounts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.credit_accounts;
  v_allowance integer;
  v_month date := date_trunc('month', now())::date;
begin
  select * into v_row from public.credit_accounts where user_id = p_user for update;
  if v_row.user_id is null then
    v_allowance := greatest(0, coalesce((private.credit_settings() ->> 'monthlyFree')::integer, 30));
    insert into public.credit_accounts (user_id, free_balance, period_start)
    values (p_user, v_allowance, v_month)
    on conflict (user_id) do nothing;
    insert into public.credit_ledger (user_id, delta, kind, note) values (p_user, v_allowance, 'renew', 'Crédits gratuits du mois');
    select * into v_row from public.credit_accounts where user_id = p_user for update;
  elsif v_row.period_start < v_month then
    v_allowance := coalesce(v_row.monthly_allowance, greatest(0, coalesce((private.credit_settings() ->> 'monthlyFree')::integer, 30)));
    update public.credit_accounts set free_balance = v_allowance, period_start = v_month, updated_at = now()
     where user_id = p_user returning * into v_row;
    insert into public.credit_ledger (user_id, delta, kind, note) values (p_user, v_allowance, 'renew', 'Crédits gratuits du mois');
  end if;
  return v_row;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Fonctions appelées avec la session de l'utilisateur
-- ---------------------------------------------------------------------
-- Solde (renouvellement mensuel appliqué au passage) et coûts des actions.
create or replace function public.my_credits()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_row public.credit_accounts;
  v_settings jsonb := private.credit_settings();
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  v_row := private.credit_account_for(v_uid);
  return jsonb_build_object(
    'free', v_row.free_balance,
    'bonus', v_row.bonus_balance,
    'total', v_row.free_balance + v_row.bonus_balance,
    'allowance', coalesce(v_row.monthly_allowance, (v_settings ->> 'monthlyFree')::integer),
    'renews_at', (v_row.period_start + interval '1 month')::date,
    'costs', v_settings -> 'costs',
    'unlimited', (select public.is_admin())
  );
end;
$$;

-- Consomme le coût d'une action (crédits gratuits d'abord, puis offerts). Les administrateurs ne consomment rien.
-- Renvoie l'identifiant du mouvement (pour un remboursement éventuel) ; erreur CREDITS_EXHAUSTED si le solde est insuffisant.
create or replace function public.consume_credits(p_action text, p_request_id uuid default null)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_row public.credit_accounts;
  v_cost integer;
  v_from_free integer;
  v_id bigint;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  if p_action !~ '^[a-z0-9_]{1,30}$' then
    raise exception 'INVALID_ACTION' using errcode = '22023';
  end if;
  if (select public.is_admin()) then
    return null;
  end if;
  v_cost := greatest(0, coalesce((private.credit_settings() -> 'costs' ->> p_action)::integer, 1));
  if v_cost = 0 then
    return null;
  end if;
  v_row := private.credit_account_for(v_uid);
  if v_row.free_balance + v_row.bonus_balance < v_cost then
    raise exception 'CREDITS_EXHAUSTED' using errcode = 'P0001';
  end if;
  v_from_free := least(v_row.free_balance, v_cost);
  update public.credit_accounts
     set free_balance = free_balance - v_from_free,
         bonus_balance = bonus_balance - (v_cost - v_from_free),
         updated_at = now()
   where user_id = v_uid;
  insert into public.credit_ledger (user_id, delta, kind, action, request_id)
  values (v_uid, -v_cost, 'consume', p_action, p_request_id)
  returning id into v_id;
  return v_id;
end;
$$;

-- Rembourse une consommation (génération échouée, résultat servi par le cache…) : une seule fois, sa propre consommation.
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
   returning * into v_row;
  if v_row.id is null then
    return;
  end if;
  perform private.credit_account_for(v_uid);
  -- Remis en crédits offerts : ils ne disparaissent pas au renouvellement mensuel.
  update public.credit_accounts set bonus_balance = bonus_balance + (-v_row.delta), updated_at = now() where user_id = v_uid;
  insert into public.credit_ledger (user_id, delta, kind, action, request_id, note)
  values (v_uid, -v_row.delta, 'refund', v_row.action, v_row.request_id, 'Remboursement automatique');
end;
$$;

-- ---------------------------------------------------------------------
-- 4. Fonctions d'administration
-- ---------------------------------------------------------------------
-- Offrir (delta > 0) ou retirer (delta < 0) des crédits ; le retrait ne descend jamais sous zéro.
create or replace function public.admin_adjust_credits(p_user_id uuid, p_delta integer, p_note text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.credit_accounts;
  v_take_bonus integer;
  v_take_free integer;
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_delta = 0 or abs(p_delta) > 100000 then
    raise exception 'INVALID_DELTA' using errcode = '22023';
  end if;
  v_row := private.credit_account_for(p_user_id);
  if p_delta > 0 then
    update public.credit_accounts set bonus_balance = bonus_balance + p_delta, updated_at = now() where user_id = p_user_id returning * into v_row;
  else
    v_take_bonus := least(v_row.bonus_balance, -p_delta);
    v_take_free := least(v_row.free_balance, -p_delta - v_take_bonus);
    update public.credit_accounts
       set bonus_balance = bonus_balance - v_take_bonus, free_balance = free_balance - v_take_free, updated_at = now()
     where user_id = p_user_id returning * into v_row;
  end if;
  insert into public.credit_ledger (user_id, delta, kind, note, created_by)
  values (p_user_id, p_delta, case when p_delta > 0 then 'grant' else 'adjust' end, left(nullif(btrim(p_note), ''), 200), (select auth.uid()));
  return jsonb_build_object('free', v_row.free_balance, 'bonus', v_row.bonus_balance);
end;
$$;

-- Allocation mensuelle propre à un utilisateur (null = valeur des réglages).
create or replace function public.admin_set_allowance(p_user_id uuid, p_allowance integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_allowance is not null and p_allowance not between 0 and 100000 then
    raise exception 'INVALID_ALLOWANCE' using errcode = '22023';
  end if;
  perform private.credit_account_for(p_user_id);
  update public.credit_accounts set monthly_allowance = p_allowance, updated_at = now() where user_id = p_user_id;
end;
$$;

-- ---------------------------------------------------------------------
-- 5. Droits d'exécution
-- ---------------------------------------------------------------------
revoke all on function private.credit_settings() from public, anon, authenticated;
revoke all on function private.credit_account_for(uuid) from public, anon, authenticated;
revoke all on function public.my_credits() from public, anon;
revoke all on function public.consume_credits(text, uuid) from public, anon;
revoke all on function public.refund_credits(bigint) from public, anon;
revoke all on function public.admin_adjust_credits(uuid, integer, text) from public, anon;
revoke all on function public.admin_set_allowance(uuid, integer) from public, anon;
grant execute on function public.my_credits() to authenticated;
grant execute on function public.consume_credits(text, uuid) to authenticated;
grant execute on function public.refund_credits(bigint) to authenticated;
grant execute on function public.admin_adjust_credits(uuid, integer, text) to authenticated;
grant execute on function public.admin_set_allowance(uuid, integer) to authenticated;
