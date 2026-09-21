-- =====================================================================
-- Commande Express — schéma Postgres + Row Level Security
-- À exécuter dans Supabase : SQL Editor > New query > Run
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------

create table if not exists public.restaurants (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  kind        text not null default 'fast-food',   -- fast-food | snack | traiteur
  address     text,
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  created_at  timestamptz not null default now()
);

create table if not exists public.suppliers (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  phone       text,
  email       text,
  order_days  text[] not null default '{}',        -- lun, mar, mer, jeu, ven, sam, dim
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  created_at  timestamptz not null default now()
);

create table if not exists public.products (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  name          text not null,
  zone          text not null default 'Sec',       -- Frigo | Congélateur | Sec | Boissons | Emballages
  unit          text not null default 'unité',
  pack_size     numeric not null default 1,
  pack_label    text,                              -- ex. « carton de 10 »
  supplier_id   uuid references public.suppliers(id) on delete set null,
  target_stock  numeric not null default 0,
  current_stock numeric not null default 0,
  sort_index    integer not null default 0,
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,
  created_at    timestamptz not null default now()
);

create table if not exists public.orders (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  supplier_id   uuid references public.suppliers(id) on delete set null,
  supplier_name text,
  ordered_at    date not null default current_date,
  delivery_at   date,
  status        text not null default 'brouillon', -- brouillon | envoyee | recue
  channel       text,                              -- whatsapp | sms | email | copie
  message       text,
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,
  created_at    timestamptz not null default now()
);

create table if not exists public.order_lines (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  order_id     uuid not null references public.orders(id) on delete cascade,
  product_id   uuid references public.products(id) on delete set null,
  product_name text not null,
  pack_label   text,
  unit         text,
  qty          numeric not null default 0,
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Index (la synchro lit toujours par utilisateur + date de modification)
-- ---------------------------------------------------------------------

create index if not exists restaurants_sync_idx on public.restaurants (user_id, updated_at);
create index if not exists suppliers_sync_idx   on public.suppliers   (user_id, updated_at);
create index if not exists products_sync_idx    on public.products    (user_id, updated_at);
create index if not exists orders_sync_idx      on public.orders      (user_id, updated_at);
create index if not exists order_lines_sync_idx on public.order_lines (user_id, updated_at);
create index if not exists order_lines_order_idx on public.order_lines (order_id);

-- ---------------------------------------------------------------------
-- Row Level Security : chaque utilisateur ne voit que ses données
-- ---------------------------------------------------------------------

alter table public.restaurants enable row level security;
alter table public.suppliers   enable row level security;
alter table public.products    enable row level security;
alter table public.orders      enable row level security;
alter table public.order_lines enable row level security;

do $$
declare t text;
begin
  foreach t in array array['restaurants','suppliers','products','orders','order_lines'] loop
    execute format('drop policy if exists "%1$s_select_own" on public.%1$I', t);
    execute format('drop policy if exists "%1$s_insert_own" on public.%1$I', t);
    execute format('drop policy if exists "%1$s_update_own" on public.%1$I', t);
    execute format('drop policy if exists "%1$s_delete_own" on public.%1$I', t);

    execute format(
      'create policy "%1$s_select_own" on public.%1$I for select using (auth.uid() = user_id)', t);
    execute format(
      'create policy "%1$s_insert_own" on public.%1$I for insert with check (auth.uid() = user_id)', t);
    execute format(
      'create policy "%1$s_update_own" on public.%1$I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
    execute format(
      'create policy "%1$s_delete_own" on public.%1$I for delete using (auth.uid() = user_id)', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Suppression du compte + de toutes les données (RGPD)
-- Appelée depuis l'app : supabase.rpc('delete_my_account')
-- ---------------------------------------------------------------------

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  delete from public.order_lines where user_id = uid;
  delete from public.orders      where user_id = uid;
  delete from public.products    where user_id = uid;
  delete from public.suppliers   where user_id = uid;
  delete from public.restaurants where user_id = uid;
  delete from auth.users         where id = uid;
end $$;

revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;
