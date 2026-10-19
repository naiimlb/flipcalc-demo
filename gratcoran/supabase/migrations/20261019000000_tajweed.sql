-- Grat'Coran : correcteur de Tajweed. L'audio n'est jamais stocké.

-- Réglages par utilisateur (acceptation de l'avertissement Tajweed).
create table public.user_settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  tajweed_notice_accepted_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.user_settings enable row level security;
create policy "user_settings_select_own" on public.user_settings for select to authenticated using ((select auth.uid()) = user_id);
create policy "user_settings_insert_own" on public.user_settings for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "user_settings_update_own" on public.user_settings for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke all on public.user_settings from anon;
revoke truncate, references, trigger on public.user_settings from authenticated;
grant select, insert, update on public.user_settings to authenticated;

-- Essais du correcteur (passage, numéro d'essai, mots justes, erreurs détaillées).
create table public.tajweed_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  surah smallint not null check (surah between 1 and 114),
  verse_start smallint not null check (verse_start >= 1),
  verse_end smallint not null check (verse_end >= verse_start and verse_end - verse_start < 3),
  word_start smallint check (word_start >= 0),
  word_end smallint check (word_end >= word_start),
  attempt_number integer not null check (attempt_number >= 1),
  correct_words integer not null check (correct_words >= 0),
  total_words integer not null check (total_words > 0 and correct_words <= total_words),
  errors jsonb not null default '[]'::jsonb check (jsonb_typeof(errors) = 'array'),
  created_at timestamptz not null default now()
);
create index tajweed_sessions_user_created_idx on public.tajweed_sessions (user_id, created_at desc);
create index tajweed_sessions_user_passage_idx on public.tajweed_sessions (user_id, surah, verse_start, verse_end, created_at desc);
alter table public.tajweed_sessions enable row level security;
create policy "tajweed_sessions_select_own" on public.tajweed_sessions for select to authenticated using ((select auth.uid()) = user_id);
create policy "tajweed_sessions_insert_own" on public.tajweed_sessions for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "tajweed_sessions_delete_own" on public.tajweed_sessions for delete to authenticated using ((select auth.uid()) = user_id);
revoke all on public.tajweed_sessions from anon;
revoke update, truncate, references, trigger on public.tajweed_sessions from authenticated;
grant select, insert, delete on public.tajweed_sessions to authenticated;

-- Quota de /api/tajweed (une ligne par utilisateur, accessible uniquement via la fonction).
create table public.tajweed_quota (
  user_id uuid primary key references auth.users (id) on delete cascade,
  minute_start timestamptz not null default now(),
  minute_count integer not null default 0,
  day_start date not null default current_date,
  day_count integer not null default 0
);
alter table public.tajweed_quota enable row level security;
revoke all on public.tajweed_quota from anon, authenticated;

create or replace function public.consume_tajweed_quota(per_minute integer default 6, per_day integer default 120)
returns text
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  uid uuid := auth.uid();
  q public.tajweed_quota;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  insert into public.tajweed_quota (user_id) values (uid) on conflict (user_id) do nothing;
  select * into q from public.tajweed_quota where user_id = uid for update;
  if q.minute_start < now() - interval '1 minute' then
    q.minute_start := now();
    q.minute_count := 0;
  end if;
  if q.day_start < current_date then
    q.day_start := current_date;
    q.day_count := 0;
  end if;
  if q.minute_count >= per_minute then
    return 'minute';
  end if;
  if q.day_count >= per_day then
    return 'day';
  end if;
  update public.tajweed_quota
    set minute_start = q.minute_start, minute_count = q.minute_count + 1,
        day_start = q.day_start, day_count = q.day_count + 1
    where user_id = uid;
  return 'ok';
end;
$fn$;

revoke all on function public.consume_tajweed_quota(integer, integer) from public, anon;
grant execute on function public.consume_tajweed_quota(integer, integer) to authenticated;
