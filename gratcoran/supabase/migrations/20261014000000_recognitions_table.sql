-- Grat'Coran : historique des reconnaissances.
-- L'audio n'est jamais stocké : seules la sourate, la plage de versets et la confiance le sont.
create table public.recognitions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  surah smallint not null check (surah between 1 and 114),
  verse_start smallint check (verse_start >= 1),
  verse_end smallint check (verse_end >= verse_start),
  confidence text not null check (confidence in ('high', 'medium', 'low')),
  score real,
  created_at timestamptz not null default now()
);
create index recognitions_user_created_idx on public.recognitions (user_id, created_at desc);

-- RLS stricte : chaque utilisateur ne voit, n'ajoute et ne supprime que ses lignes.
alter table public.recognitions enable row level security;
create policy "recognitions_select_own" on public.recognitions for select to authenticated using ((select auth.uid()) = user_id);
create policy "recognitions_insert_own" on public.recognitions for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "recognitions_delete_own" on public.recognitions for delete to authenticated using ((select auth.uid()) = user_id);
revoke all on public.recognitions from anon;
revoke update, truncate, references, trigger on public.recognitions from authenticated;
grant select, insert, delete on public.recognitions to authenticated;
