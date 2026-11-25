-- Tests : audios des ressources (stockage privé), favoris et reprise de l'écoute.
\set ON_ERROR_STOP on

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000c430', 'coach43@test.fr', '{}'),
  ('00000000-0000-0000-0000-00000000a430', 'a43@test.fr', '{"prenom":"Anaïs"}'),
  ('00000000-0000-0000-0000-00000000b430', 'b43@test.fr', '{"prenom":"Blandine"}');
select public.definir_coach('coach43@test.fr');
insert into public.clientes (id, statut) values
  ('00000000-0000-0000-0000-00000000a430', 'active'),
  ('00000000-0000-0000-0000-00000000b430', 'active');

select test.verifier((select file_size_limit = 52428800 and not public from storage.buckets where id = 'audios'), 'les audios sont dans un stockage privé, 50 Mo par fichier');

-- La coach crée : un audio seul pour toutes, une fiche avec audio réservée à A, un audio en brouillon.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c430"}', false);
insert into public.ressources (id, titre, audio_path, audio_duree, publiee, visibilite) values
  ('43000000-0000-4000-8000-000000000001', 'Relaxation du soir', '43000000-0000-4000-8000-0000000000a1.m4a', 600, true, 'toutes'),
  ('43000000-0000-4000-8000-000000000003', 'Audio pas prêt', '43000000-0000-4000-8000-0000000000a3.mp3', 120, false, 'toutes');
insert into public.ressources (id, titre, contenu, audio_path, publiee, visibilite) values
  ('43000000-0000-4000-8000-000000000002', 'Fiche pour A', 'Le texte de la fiche', '43000000-0000-4000-8000-0000000000a2.m4a', true, 'certaines');
insert into public.ressources_clientes (ressource_id, cliente_id) values ('43000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-00000000a430');
insert into storage.objects (bucket_id, name) values
  ('audios', '43000000-0000-4000-8000-0000000000a1.m4a'),
  ('audios', '43000000-0000-4000-8000-0000000000a2.m4a'),
  ('audios', '43000000-0000-4000-8000-0000000000a3.mp3');
select test.verifier((select count(*) from storage.objects where bucket_id = 'audios') = 3, 'la coach dépose et voit tous les audios');
do $$ begin
  insert into public.ressources (titre, audio_path, visibilite) values ('Mauvais fichier', 'script.exe', 'toutes');
  raise exception 'ÉCHEC : fichier non audio accepté';
exception when check_violation then perform test.verifier(true, 'seuls des fichiers audio (m4a, mp3…) sont acceptés'); end $$;
do $$ begin
  insert into public.ressources (titre, visibilite) values ('Vide', 'toutes');
  raise exception 'ÉCHEC : ressource vide acceptée';
exception when check_violation then perform test.verifier(true, 'une ressource a un lien, un contenu ou un audio'); end $$;
reset role;

-- A : lit l'audio pour toutes et celui de sa fiche ; pas le brouillon. Ne peut rien déposer.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a430"}', false);
select test.verifier((select array_agg(name order by name) from storage.objects where bucket_id = 'audios')
  = array['43000000-0000-4000-8000-0000000000a1.m4a', '43000000-0000-4000-8000-0000000000a2.m4a'], 'A lit seulement les audios des ressources qu''elle voit');
do $$ begin
  insert into storage.objects (bucket_id, name) values ('audios', '43000000-0000-4000-8000-0000000000ff.m4a');
  raise exception 'ÉCHEC : une cliente a déposé un audio';
exception when insufficient_privilege then perform test.verifier(true, 'seule la coach dépose des audios'); end $$;
-- Favoris.
insert into public.ressources_favoris (ressource_id) values ('43000000-0000-4000-8000-000000000001'), ('43000000-0000-4000-8000-000000000002');
select test.verifier((select count(*) from public.ressources_favoris) = 2, 'A met deux ressources en favori');
do $$ begin
  insert into public.ressources_favoris (ressource_id) values ('43000000-0000-4000-8000-000000000003');
  raise exception 'ÉCHEC : favori sur un brouillon';
exception when insufficient_privilege then perform test.verifier(true, 'pas de favori sur une ressource qu''elle ne voit pas'); end $$;
-- Reprise de l'écoute.
insert into public.ressources_ecoutes (ressource_id, position_s) values ('43000000-0000-4000-8000-000000000001', 125);
update public.ressources_ecoutes set position_s = 300 where ressource_id = '43000000-0000-4000-8000-000000000001';
select test.verifier((select position_s from public.ressources_ecoutes) = 300, 'A garde sa position d''écoute sur son compte');
do $$ begin
  insert into public.ressources_ecoutes (ressource_id, position_s) values ('43000000-0000-4000-8000-000000000003', 10);
  raise exception 'ÉCHEC : écoute d''un brouillon';
exception when insufficient_privilege then perform test.verifier(true, 'pas d''écoute enregistrée sur une ressource qu''elle ne voit pas'); end $$;
reset role;

-- B : ne voit ni l'audio de la fiche de A, ni les favoris et écoutes de A.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000b430"}', false);
select test.verifier((select array_agg(name) from storage.objects where bucket_id = 'audios') = array['43000000-0000-4000-8000-0000000000a1.m4a'], 'B ne lit pas l''audio réservé à A');
select test.verifier((select count(*) from public.ressources_favoris) = 0 and (select count(*) from public.ressources_ecoutes) = 0, 'B ne voit pas les favoris ni les écoutes de A');
do $$ begin
  insert into public.ressources_favoris (cliente_id, ressource_id) values ('00000000-0000-0000-0000-00000000a430', '43000000-0000-4000-8000-000000000001');
  raise exception 'ÉCHEC : favori au nom d''une autre';
exception when insufficient_privilege or unique_violation then perform test.verifier(true, 'B ne peut pas agir au nom de A'); end $$;
update public.ressources_ecoutes set position_s = 0;
delete from public.ressources_favoris;
reset role;
select test.verifier((select position_s from public.ressources_ecoutes where cliente_id = '00000000-0000-0000-0000-00000000a430') = 300
  and (select count(*) from public.ressources_favoris where cliente_id = '00000000-0000-0000-0000-00000000a430') = 2, 'B ne modifie rien chez A');

-- La coach voit les écoutes (pour savoir ce qui a été écouté).
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c430"}', false);
select test.verifier((select count(*) from public.ressources_ecoutes) >= 1, 'la coach voit ce qui a été écouté');
reset role;

-- Accès fermé : plus rien.
update public.clientes set statut = 'fermee' where id = '00000000-0000-0000-0000-00000000a430';
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a430"}', false);
select test.verifier((select count(*) from storage.objects where bucket_id = 'audios') = 0, 'accès fermé : plus aucun audio');
select test.verifier((select count(*) from public.ressources_favoris) = 0 and (select count(*) from public.ressources_ecoutes) = 0, 'accès fermé : plus de favoris ni d''écoutes visibles');
reset role;
select set_config('request.jwt.claims', '', false);
