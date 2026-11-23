-- Tests : apport actuel et objectif (besoins, coach seule).
\set ON_ERROR_STOP on

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000c220', 'coach22@test.fr', '{}'),
  ('00000000-0000-0000-0000-00000000a220', 'a22@test.fr', '{"prenom":"Albane"}');
select public.definir_coach('coach22@test.fr');
insert into public.clientes (id, statut) values ('00000000-0000-0000-0000-00000000a220', 'active');

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c220"}', false);
insert into public.besoins_clientes (cliente_id, kcal_actuelles, objectif) values ('00000000-0000-0000-0000-00000000a220', 1150, 'perte');
select test.verifier((select kcal_actuelles = 1150 and objectif = 'perte' from public.besoins_clientes where cliente_id = '00000000-0000-0000-0000-00000000a220'), 'la coach note apport actuel et objectif');
do $$ begin
  update public.besoins_clientes set objectif = 'n importe quoi' where cliente_id = '00000000-0000-0000-0000-00000000a220';
  raise exception 'ÉCHEC : objectif inconnu accepté';
exception when check_violation then perform test.verifier(true, 'un objectif inconnu est refusé'); end $$;
reset role;

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a220"}', false);
select test.verifier((select count(*) from public.besoins_clientes) = 0, 'la cliente ne voit pas ses besoins');
reset role;
