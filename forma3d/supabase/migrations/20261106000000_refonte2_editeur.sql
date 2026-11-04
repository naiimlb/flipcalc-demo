-- =====================================================================
-- Forma3D — refonte, phase 2 : éditeur (sauvegarde automatique des modifications)
-- À exécuter une fois dans Supabase › SQL Editor (sans risque si relancé).
-- =====================================================================

-- Compteur de sauvegardes (quota par projet et par personne, fenêtre d'une heure).
alter table public.design_requests add column if not exists edited_at timestamptz;
alter table public.design_requests add column if not exists edit_count integer not null default 0;
alter table public.design_requests add column if not exists edit_window_start timestamptz;

-- Enregistre la conception modifiée dans l'éditeur (déplacer, renommer, dupliquer, supprimer une pièce…).
-- Appelée par le serveur (/api/requests/<id>/design) après validation complète de la conception.
-- Uniquement sa propre demande terminée ; le fichier 3D enregistré est invalidé pour être régénéré.
create or replace function public.save_design_edit(p_id uuid, p_design jsonb)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_now timestamptz := now();
  v_row public.design_requests;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  if p_design is null or jsonb_typeof(p_design) <> 'object'
     or jsonb_typeof(p_design -> 'model' -> 'parts') <> 'array'
     or jsonb_array_length(p_design -> 'model' -> 'parts') not between 1 and 60
     or pg_column_size(p_design) > 600000 then
    raise exception 'INVALID_DESIGN' using errcode = '22023';
  end if;

  select * into v_row from public.design_requests
   where id = p_id and user_id = v_uid and status = 'ready'
   for update;
  if v_row.id is null then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  -- Quotas : 600 sauvegardes par heure et par projet, 2 000 par heure et par personne.
  if v_row.edit_window_start is null or v_row.edit_window_start < v_now - interval '1 hour' then
    v_row.edit_window_start := v_now;
    v_row.edit_count := 0;
  end if;
  if v_row.edit_count >= 600 then
    raise exception 'EDIT_QUOTA' using errcode = 'P0001';
  end if;
  if (select coalesce(sum(edit_count), 0) from public.design_requests
       where user_id = v_uid and edit_window_start > v_now - interval '1 hour') >= 2000 then
    raise exception 'EDIT_QUOTA' using errcode = 'P0001';
  end if;

  update public.design_requests
     set design = p_design,
         title = left(coalesce(nullif(btrim(p_design ->> 'title'), ''), title), 200),
         model_path = null,
         edited_at = v_now,
         edit_count = v_row.edit_count + 1,
         edit_window_start = v_row.edit_window_start,
         updated_at = v_now
   where id = p_id;
  return v_now;
end;
$$;

revoke all on function public.save_design_edit(uuid, jsonb) from public, anon;
grant execute on function public.save_design_edit(uuid, jsonb) to authenticated;
