-- Tests : séances faites.
\set ON_ERROR_STOP on

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000c190', 'coach19@test.fr', '{}'),
  ('00000000-0000-0000-0000-00000000a190', 'a19@test.fr', '{"prenom":"Alix"}'),
  ('00000000-0000-0000-0000-00000000b190', 'b19@test.fr', '{"prenom":"Bérénice"}'),
  ('00000000-0000-0000-0000-00000000f190', 'f19@test.fr', '{"prenom":"Fanny"}');
select public.definir_coach('coach19@test.fr');
insert into public.clientes (id, statut) values
  ('00000000-0000-0000-0000-00000000a190', 'active'),
  ('00000000-0000-0000-0000-00000000b190', 'active'),
  ('00000000-0000-0000-0000-00000000f190', 'fermee');

-- A valide une séance ; elle ne peut pas en enregistrer pour B.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a190"}', false);
insert into public.seances_faites (id, seance_nom, duree_minutes, ressenti, commentaire)
  values ('19000000-0000-0000-0000-00000000000a', 'Séance A', 52, 4, 'Dur mais top');
select test.verifier((select count(*) from public.seances_faites) = 1, 'A enregistre sa séance');
do $$ begin
  insert into public.seances_faites (cliente_id, seance_nom) values ('00000000-0000-0000-0000-00000000b190', 'Faux');
  raise exception 'ÉCHEC : A enregistre une séance pour B';
exception when insufficient_privilege then perform test.verifier(true, 'A ne peut pas enregistrer une séance pour B'); end $$;
update public.seances_faites set ressenti = 1;
reset role;
select test.verifier((select ressenti from public.seances_faites where id = '19000000-0000-0000-0000-00000000000a') = 4, 'A ne peut pas modifier une séance validée');

-- B ne voit pas la séance de A et ne peut pas l'effacer.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000b190"}', false);
select test.verifier((select count(*) from public.seances_faites) = 0, 'B ne voit pas les séances de A');
delete from public.seances_faites;
reset role;
select test.verifier((select count(*) from public.seances_faites) = 1, 'B ne peut pas effacer la séance de A');

-- La coach voit tout, mais n'enregistre rien à la place d'une cliente.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c190"}', false);
select test.verifier((select count(*) from public.seances_faites) = 1, 'la coach voit la séance de A');
do $$ begin
  insert into public.seances_faites (cliente_id, seance_nom) values ('00000000-0000-0000-0000-00000000a190', 'Faux');
  raise exception 'ÉCHEC : la coach enregistre une séance';
exception when insufficient_privilege then perform test.verifier(true, 'la coach ne peut pas enregistrer de séance'); end $$;
reset role;

-- F : accès fermé, plus d'enregistrement.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000f190"}', false);
do $$ begin
  insert into public.seances_faites (seance_nom) values ('Séance');
  raise exception 'ÉCHEC : accès fermé, séance enregistrée';
exception when insufficient_privilege then perform test.verifier(true, 'accès fermé : pas d’enregistrement'); end $$;
reset role;

-- A efface sa séance validée par erreur.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a190"}', false);
delete from public.seances_faites where id = '19000000-0000-0000-0000-00000000000a';
reset role;
select test.verifier((select count(*) from public.seances_faites) = 0, 'A efface sa séance');
