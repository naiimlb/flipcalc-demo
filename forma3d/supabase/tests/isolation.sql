-- Test d'isolation Forma3D : deux comptes, un visiteur. À coller dans l'éditeur SQL de Supabase.
-- Tout est annulé à la fin (l'erreur « RESULTATS » est voulue : elle fait revenir la base en arrière).
-- Lire le résultat : chaque ligne indique l'attendu ; « ÉCHEC » = faille à corriger.
do $$
declare
  u1 uuid := gen_random_uuid();
  u2 uuid := gen_random_uuid();
  r text[] := '{}';
  rid uuid; rid2 uuid; fid uuid; n int; b boolean; h text := repeat('a', 64);
begin
  insert into auth.users (id, email, aud, role) values
    (u1, 'iso1@test.invalid', 'authenticated', 'authenticated'),
    (u2, 'iso2@test.invalid', 'authenticated', 'authenticated');
  select count(*) into n from public.profiles where id in (u1, u2);
  r := r || (format('profils créés par le déclencheur : %s (attendu 2)', n))::text;

  -- ===== Utilisateur 1 =====
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', u1, 'role', 'authenticated')::text, true);
  select id into rid from public.create_design_request('Prompt de test numéro un', false);
  perform public.complete_design_request(rid, 'ready', 'Titre A', '{"title":"A"}'::jsonb, null, 'test', 'm', 10, null, 'raw', null, null, null);
  insert into public.folders (name) values ('Dossier A') returning id into fid;
  update public.design_requests set is_favorite = true where id = rid;
  update public.profiles set favorite_materials = array['PETG'], units = 'cm' where id = u1;
  select count(*) into n from public.design_requests;
  r := r || (format('U1 voit ses propres demandes : %s (attendu 1)', n))::text;

  -- ===== Utilisateur 2 (autre compte) =====
  perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated')::text, true);
  select count(*) into n from public.design_requests;           r := r || (format('U2 voit les demandes de U1 : %s (attendu 0)', n))::text;
  select count(*) into n from public.folders;                   r := r || (format('U2 voit les dossiers de U1 : %s (attendu 0)', n))::text;
  select count(*) into n from public.profiles where id = u1;    r := r || (format('U2 voit le profil de U1 : %s (attendu 0)', n))::text;
  select count(*) into n from public.request_debug;             r := r || (format('U2 voit les réponses brutes : %s (attendu 0)', n))::text;
  select count(*) into n from public.usage_events;              r := r || (format('U2 voit le registre d''usage : %s (attendu 0)', n))::text;
  select count(*) into n from public.app_logs;                  r := r || (format('U2 voit le journal : %s (attendu 0)', n))::text;

  update public.design_requests set title = 'piraté' where id = rid;
  get diagnostics n = row_count;                                r := r || (format('U2 modifie une demande de U1 : %s ligne(s) (attendu 0)', n))::text;
  delete from public.design_requests where id = rid;
  get diagnostics n = row_count;                                r := r || (format('U2 supprime une demande de U1 : %s ligne(s) (attendu 0)', n))::text;
  update public.folders set name = 'piraté' where id = fid;
  get diagnostics n = row_count;                                r := r || (format('U2 renomme un dossier de U1 : %s ligne(s) (attendu 0)', n))::text;

  begin perform public.duplicate_design_request(rid);           r := r || ('ÉCHEC : U2 a dupliqué une demande de U1')::text;
  exception when others then r := r || ('U2 duplique une demande de U1 : refusé (' || sqlerrm || ')')::text; end;
  begin perform public.complete_design_request(rid, 'ready', 'x', '{}'::jsonb, null, null, null, 1, null, null, null, null, null); r := r || ('ÉCHEC : U2 a écrit un résultat chez U1')::text;
  exception when others then r := r || ('U2 écrit un résultat chez U1 : refusé (' || sqlerrm || ')')::text; end;
  begin update public.profiles set role = 'admin' where id = u2; r := r || ('ÉCHEC : U2 s''est promu admin')::text;
  exception when others then r := r || ('U2 se promeut admin via l''API : refusé (' || sqlerrm || ')')::text; end;
  begin perform public.set_user_role(u2, 'admin');              r := r || ('ÉCHEC : set_user_role accepté')::text;
  exception when others then r := r || ('U2 appelle set_user_role : refusé (' || sqlerrm || ')')::text; end;
  begin perform public.admin_stats();                           r := r || ('ÉCHEC : admin_stats accepté')::text;
  exception when others then r := r || ('U2 appelle admin_stats : refusé (' || sqlerrm || ')')::text; end;
  begin perform public.claim_first_admin('mauvais-jeton');      r := r || ('ÉCHEC : claim_first_admin accepté')::text;
  exception when others then r := r || ('U2 devient admin avec un faux jeton : refusé (' || sqlerrm || ')')::text; end;
  begin select count(*) into n from public.app_secrets;         r := r || ('ÉCHEC : app_secrets lisible')::text;
  exception when others then r := r || ('U2 lit les clés d''API : refusé (' || sqlerrm || ')')::text; end;
  begin select count(*) into n from private.guest_usage;        r := r || ('ÉCHEC : schéma private lisible')::text;
  exception when others then r := r || ('U2 lit le schéma private : refusé (' || sqlerrm || ')')::text; end;

  select id into rid2 from public.create_design_request('Prompt de test numéro deux', false);
  begin update public.design_requests set folder_id = fid where id = rid2; r := r || ('ÉCHEC : U2 a rangé sa demande dans le dossier de U1')::text;
  exception when others then r := r || ('U2 range sa demande dans un dossier de U1 : refusé (' || sqlerrm || ')')::text; end;
  begin update public.design_requests set model_path = u1::text || '/vol.glb' where id = rid2; r := r || ('ÉCHEC : U2 a lié un fichier de U1')::text;
  exception when others then r := r || ('U2 lie le fichier 3D de U1 : refusé (' || sqlerrm || ')')::text; end;

  -- Storage
  begin insert into storage.objects (bucket_id, name) values ('models', u1::text || '/piege.glb'); r := r || ('ÉCHEC : U2 a écrit dans le dossier de U1')::text;
  exception when others then r := r || ('U2 écrit dans le dossier Storage de U1 : refusé (' || sqlerrm || ')')::text; end;
  begin insert into storage.objects (bucket_id, name) values ('models', u2::text || '/ok.glb'); r := r || ('U2 écrit dans son propre dossier Storage : accepté')::text;
  exception when others then r := r || ('ÉCHEC : U2 ne peut pas écrire chez lui (' || sqlerrm || ')')::text; end;
  select count(*) into n from storage.objects where bucket_id = 'models' and name like u1::text || '/%';
  r := r || (format('U2 voit les fichiers de U1 : %s (attendu 0)', n))::text;

  -- ===== Visiteur sans compte (anon) =====
  reset role;
  set local role anon;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  begin select count(*) into n from public.design_requests;     r := r || (format('Visiteur lit les demandes : %s ligne(s) (ÉCHEC si > 0)', n))::text;
  exception when others then r := r || ('Visiteur lit les demandes : refusé')::text; end;
  begin select count(*) into n from public.profiles;            r := r || (format('Visiteur lit les profils : %s ligne(s)', n))::text;
  exception when others then r := r || ('Visiteur lit les profils : refusé')::text; end;
  begin perform public.create_design_request('Prompt visiteur test', false); r := r || ('ÉCHEC : visiteur crée une demande')::text;
  exception when others then r := r || ('Visiteur crée une demande : refusé (' || sqlerrm || ')')::text; end;
  select count(*) into n from public.app_settings;
  r := r || (format('Visiteur lit les réglages publics : %s ligne(s) (site, features, ai)', n))::text;
  select public.consume_guest_quota(h) into b; r := r || (format('Essai invité n°1 : %s (attendu true)', b))::text;
  select public.consume_guest_quota(h) into b; r := r || (format('Essai invité n°2 : %s (attendu true)', b))::text;
  select public.consume_guest_quota(h) into b; r := r || (format('Essai invité n°3 : %s (attendu false : limite de 2 par jour)', b))::text;

  reset role;
  raise exception E'RESULTATS\n%', array_to_string(r, E'\n');
end $$;
