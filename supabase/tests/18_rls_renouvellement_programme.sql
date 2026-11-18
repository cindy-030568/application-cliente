-- Tests : date de changement du programme sportif.
\set ON_ERROR_STOP on

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000c180', 'coach18@test.fr', '{}'),
  ('00000000-0000-0000-0000-00000000a180', 'a18@test.fr', '{"prenom":"Aude"}');
select public.definir_coach('coach18@test.fr');
insert into public.clientes (id, statut) values ('00000000-0000-0000-0000-00000000a180', 'active');

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c180"}', false);
insert into public.programmes_sportifs (id, cliente_id, titre) values
  ('18000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000a180', 'Prog A');
select public.publier_programme_sportif('18000000-0000-0000-0000-00000000000a', true);
update public.programmes_sportifs set renouveler_le = date '2030-01-15' where id = '18000000-0000-0000-0000-00000000000a';
select test.verifier(
  (select renouveler_le from public.programmes_sportifs where id = '18000000-0000-0000-0000-00000000000a') = date '2030-01-15',
  'la coach fixe la date de changement');
reset role;

-- La cliente voit la date mais ne peut pas la changer.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a180"}', false);
select test.verifier((select renouveler_le from public.programmes_sportifs) = date '2030-01-15', 'A voit la date de son prochain programme');
update public.programmes_sportifs set renouveler_le = date '2031-01-01', rappel_renouvellement_le = current_date;
reset role;
select test.verifier(
  (select renouveler_le = date '2030-01-15' and rappel_renouvellement_le is null
     from public.programmes_sportifs where id = '18000000-0000-0000-0000-00000000000a'),
  'A ne peut pas changer la date ni le rappel');
