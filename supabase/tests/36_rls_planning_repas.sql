-- Tests : planning des repas — chaque cliente ne voit et ne remplit que le sien.
\set ON_ERROR_STOP on

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000c360', 'coach36@test.fr', '{}'),
  ('00000000-0000-0000-0000-00000000a360', 'a36@test.fr', '{"prenom":"Ariane"}'),
  ('00000000-0000-0000-0000-00000000b360', 'b36@test.fr', '{"prenom":"Bérénice"}');
select public.definir_coach('coach36@test.fr');
insert into public.clientes (id, statut) values
  ('00000000-0000-0000-0000-00000000a360', 'active'),
  ('00000000-0000-0000-0000-00000000b360', 'active');
insert into public.repas_cibles (id, cliente_id, type_repas, libelle, proteines_g, glucides_g, lipides_g) values
  ('36000000-0000-4000-8000-00000000000a', '00000000-0000-0000-0000-00000000a360', 'dejeuner', 'Déjeuner', 30, 50, 15),
  ('36000000-0000-4000-8000-00000000000b', '00000000-0000-0000-0000-00000000b360', 'dejeuner', 'Déjeuner', 30, 50, 15);
insert into public.recettes (id, titre, publiee) values ('36000000-0000-4000-8000-0000000000cc', 'Bowl test 36', true);

-- A planifie son déjeuner.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a360"}', false);
insert into public.planning_repas (jour, repas_cible_id, recette_id) values (current_date, '36000000-0000-4000-8000-00000000000a', '36000000-0000-4000-8000-0000000000cc');
update public.planning_repas set portions = 2;
select test.verifier((select portions from public.planning_repas) = 2, 'A remplit et modifie son planning');
do $$ begin
  insert into public.planning_repas (jour, repas_cible_id, recette_id) values (current_date, '36000000-0000-4000-8000-00000000000b', '36000000-0000-4000-8000-0000000000cc');
  raise exception 'ÉCHEC : A a utilisé le repas de B';
exception when insufficient_privilege then perform test.verifier(true, 'A ne peut pas planifier sur un repas de B'); end $$;
do $$ begin
  insert into public.planning_repas (cliente_id, jour, repas_cible_id, recette_id) values ('00000000-0000-0000-0000-00000000b360', current_date, '36000000-0000-4000-8000-00000000000b', '36000000-0000-4000-8000-0000000000cc');
  raise exception 'ÉCHEC : A a écrit dans le planning de B';
exception when insufficient_privilege then perform test.verifier(true, 'A ne peut pas écrire dans le planning de B'); end $$;
reset role;

-- B ne voit ni ne modifie le planning de A.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000b360"}', false);
select test.verifier((select count(*) from public.planning_repas) = 0, 'B ne voit pas le planning de A');
delete from public.planning_repas;
update public.planning_repas set portions = 6;
reset role;
select test.verifier((select portions from public.planning_repas) = 2, 'B ne peut ni effacer ni modifier le planning de A');

-- La coach le consulte, sans le modifier.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c360"}', false);
select test.verifier((select count(*) from public.planning_repas) = 1, 'la coach voit le planning de sa cliente');
delete from public.planning_repas;
reset role;
select test.verifier((select count(*) from public.planning_repas) = 1, 'la coach ne modifie pas le planning');

-- Accès fermé : plus rien de visible, plus rien à planifier.
update public.clientes set statut = 'fermee' where id = '00000000-0000-0000-0000-00000000a360';
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a360"}', false);
select test.verifier((select count(*) from public.planning_repas) = 0, 'accès fermé : plus rien de visible');
do $$ begin
  insert into public.planning_repas (jour, repas_cible_id, recette_id) values (current_date + 1, '36000000-0000-4000-8000-00000000000a', '36000000-0000-4000-8000-0000000000cc');
  raise exception 'ÉCHEC : une cliente fermée a planifié';
exception when insufficient_privilege then perform test.verifier(true, 'accès fermé : plus rien à planifier'); end $$;
reset role;
select set_config('request.jwt.claims', '', false);
