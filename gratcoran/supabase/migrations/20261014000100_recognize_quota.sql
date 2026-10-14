-- Limite de requêtes par utilisateur pour /api/recognize (une ligne par utilisateur).
create table public.recognize_quota (
  user_id uuid primary key references auth.users (id) on delete cascade,
  minute_start timestamptz not null default now(),
  minute_count integer not null default 0,
  day_start date not null default current_date,
  day_count integer not null default 0
);
alter table public.recognize_quota enable row level security;
revoke all on public.recognize_quota from anon, authenticated;

-- Consomme une unité de quota pour l'utilisateur courant.
-- Retourne 'ok', 'minute' (limite par minute atteinte) ou 'day' (limite quotidienne).
create or replace function public.consume_recognize_quota(per_minute integer default 6, per_day integer default 150)
returns text
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  uid uuid := auth.uid();
  q public.recognize_quota;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  insert into public.recognize_quota (user_id) values (uid) on conflict (user_id) do nothing;
  select * into q from public.recognize_quota where user_id = uid for update;
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
  update public.recognize_quota
    set minute_start = q.minute_start, minute_count = q.minute_count + 1,
        day_start = q.day_start, day_count = q.day_count + 1
    where user_id = uid;
  return 'ok';
end;
$fn$;

revoke all on function public.consume_recognize_quota(integer, integer) from public, anon;
grant execute on function public.consume_recognize_quota(integer, integer) to authenticated;
