-- Tests : bilan de fin de suivi — demandes « continuer avec moi ».
\set ON_ERROR_STOP on

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000c380', 'coach38@test.fr', '{}'),
  ('00000000-0000-0000-0000-00000000a380', 'a38@test.fr', '{"prenom":"Aline"}'),
  ('00000000-0000-0000-0000-00000000b380', 'b38@test.fr', '{"prenom":"Blandine"}');
select public.definir_coach('coach38@test.fr');
insert into public.clientes (id, statut) values
  ('00000000-0000-0000-0000-00000000a380', 'terminee'),
  ('00000000-0000-0000-0000-00000000b380', 'active');

select test.verifier((select jsonb_array_length(fin_offres) = 1 and fin_texte <> '' and fin_offres::text !~ '€' from public.reglages), 'un texte et une offre par défaut, sans prix');

-- A (suivi terminé, accès encore ouvert) clique sur une offre.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a380"}', false);
insert into public.demandes_suite (offre) values ('Continuer mon accompagnement');
select test.verifier((select count(*) from public.demandes_suite) = 1, 'A voit sa demande');
do $$ begin
  insert into public.demandes_suite (cliente_id, offre) values ('00000000-0000-0000-0000-00000000b380', 'Au nom de B');
  raise exception 'ÉCHEC : A a fait une demande au nom de B';
exception when insufficient_privilege then perform test.verifier(true, 'A ne peut pas faire de demande au nom de B'); end $$;
update public.reglages set fin_texte = 'Piraté' where id = true;
reset role;
select test.verifier((select fin_texte <> 'Piraté' from public.reglages), 'une cliente ne peut pas changer le texte de fin');

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000b380"}', false);
select test.verifier((select count(*) from public.demandes_suite) = 0, 'B ne voit pas la demande de A');
reset role;

-- La coach voit et traite.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c380"}', false);
update public.demandes_suite set traitee = true;
select test.verifier((select bool_and(traitee) from public.demandes_suite), 'la coach marque la demande comme traitée');
update public.reglages set fin_offres = '[{"titre": "Programme 3 mois", "description": "On continue"}]' where id = true;
select test.verifier((select fin_offres->0->>'titre' from public.reglages) = 'Programme 3 mois', 'la coach modifie ses offres');
reset role;

-- Accès fermé : plus rien.
update public.clientes set statut = 'fermee' where id = '00000000-0000-0000-0000-00000000a380';
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a380"}', false);
select test.verifier((select count(*) from public.demandes_suite) = 0, 'accès fermé : plus rien de visible');
do $$ begin
  insert into public.demandes_suite (offre) values ('Trop tard');
  raise exception 'ÉCHEC : demande après fermeture';
exception when insufficient_privilege then perform test.verifier(true, 'accès fermé : plus de demande possible'); end $$;
reset role;
select set_config('request.jwt.claims', '', false);
