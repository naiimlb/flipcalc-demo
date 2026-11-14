-- Données de l'app Hifz (mémorisation du Coran), une ligne par élément et par utilisateur.
-- Tables préfixées hifz_ : peuvent cohabiter avec d'autres apps dans un même projet Supabase.
-- Appliquée sur le projet « forma3d » le 2026-11-07 (migration « hifz_user_data »).

create or replace function public.hifz_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- clock_timestamp() : horodatage strictement croissant, sert de curseur de synchronisation.
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

create table public.hifz_programs (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id uuid not null,
  data jsonb not null check (pg_column_size(data) < 2048),
  deleted boolean not null default false,
  updated_at timestamptz not null default clock_timestamp(),
  primary key (user_id, id)
);

create table public.hifz_cards (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  key text not null check (key ~ '^[0-9]{1,3}:[0-9]{1,3}$'),
  data jsonb not null check (pg_column_size(data) < 2048),
  deleted boolean not null default false,
  updated_at timestamptz not null default clock_timestamp(),
  primary key (user_id, key)
);

create table public.hifz_reviews (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id uuid not null,
  key text not null check (key ~ '^[0-9]{1,3}:[0-9]{1,3}$'),
  day date not null,
  grade text not null check (grade in ('good', 'hard', 'again')),
  at timestamptz not null,
  updated_at timestamptz not null default clock_timestamp(),
  primary key (user_id, id)
);

create table public.hifz_settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null check (pg_column_size(data) < 4096),
  updated_at timestamptz not null default clock_timestamp()
);

create index hifz_programs_sync_idx on public.hifz_programs (user_id, updated_at);
create index hifz_cards_sync_idx on public.hifz_cards (user_id, updated_at);
create index hifz_reviews_sync_idx on public.hifz_reviews (user_id, updated_at);

create trigger hifz_programs_touch before insert or update on public.hifz_programs
  for each row execute function public.hifz_touch_updated_at();
create trigger hifz_cards_touch before insert or update on public.hifz_cards
  for each row execute function public.hifz_touch_updated_at();
create trigger hifz_reviews_touch before insert or update on public.hifz_reviews
  for each row execute function public.hifz_touch_updated_at();
create trigger hifz_settings_touch before insert or update on public.hifz_settings
  for each row execute function public.hifz_touch_updated_at();

alter table public.hifz_programs enable row level security;
alter table public.hifz_cards enable row level security;
alter table public.hifz_reviews enable row level security;
alter table public.hifz_settings enable row level security;

-- Chaque utilisateur ne voit et ne modifie que ses propres lignes.
create policy hifz_programs_own on public.hifz_programs for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy hifz_cards_own on public.hifz_cards for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy hifz_reviews_own on public.hifz_reviews for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy hifz_settings_own on public.hifz_settings for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

revoke all on public.hifz_programs, public.hifz_cards, public.hifz_reviews, public.hifz_settings from anon, public;
grant select, insert, update, delete on public.hifz_programs, public.hifz_cards, public.hifz_reviews, public.hifz_settings to authenticated;
revoke all on function public.hifz_touch_updated_at() from public, anon, authenticated;
