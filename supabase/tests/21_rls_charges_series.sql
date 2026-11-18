-- Tests : poids utilisés en mode séance.
\set ON_ERROR_STOP on

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000c210', 'coach21@test.fr', '{}'),
  ('00000000-0000-0000-0000-00000000a210', 'a21@test.fr', '{"prenom":"Adèle"}'),
  ('00000000-0000-0000-0000-00000000b210', 'b21@test.fr', '{"prenom":"Bettina"}');
select public.definir_coach('coach21@test.fr');
insert into public.clientes (id, statut) values
  ('00000000-0000-0000-0000-00000000a210', 'active'),
  ('00000000-0000-0000-0000-00000000b210', 'active');

-- A note ses charges, puis corrige la série 2 (même séance).
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a210"}', false);
insert into public.charges_series (seance_ref, exercice_cle, exercice_nom, serie, charge_kg) values
  ('21000000-0000-0000-0000-000000000001', 'squat goblet', 'Squat goblet', 1, 14),
  ('21000000-0000-0000-0000-000000000001', 'squat goblet', 'Squat goblet', 2, 14);
insert into public.charges_series (seance_ref, exercice_cle, exercice_nom, serie, charge_kg)
  values ('21000000-0000-0000-0000-000000000001', 'squat goblet', 'Squat goblet', 2, 16)
  on conflict (cliente_id, seance_ref, exercice_cle, serie) do update set charge_kg = excluded.charge_kg;
select test.verifier((select charge_kg from public.charges_series where serie = 2) = 16, 'A corrige le poids d’une série');
do $$ begin
  insert into public.charges_series (cliente_id, seance_ref, exercice_cle, exercice_nom, serie, charge_kg)
    values ('00000000-0000-0000-0000-00000000b210', '21000000-0000-0000-0000-000000000002', 'x', 'X', 1, 10);
  raise exception 'ÉCHEC : A note une charge pour B';
exception when insufficient_privilege then perform test.verifier(true, 'A ne peut pas noter pour B'); end $$;
do $$ begin
  insert into public.charges_series (seance_ref, exercice_cle, exercice_nom, serie, charge_kg)
    values ('21000000-0000-0000-0000-000000000001', 'squat goblet', 'Squat goblet', 3, 900);
  raise exception 'ÉCHEC : charge absurde acceptée';
exception when check_violation then perform test.verifier(true, 'un poids absurde est refusé'); end $$;
reset role;

-- B ne voit ni ne modifie les charges de A.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000b210"}', false);
select test.verifier((select count(*) from public.charges_series) = 0, 'B ne voit pas les charges de A');
update public.charges_series set charge_kg = 0;
delete from public.charges_series;
reset role;
select test.verifier((select count(*) from public.charges_series where charge_kg > 0) = 2, 'B ne peut ni modifier ni effacer les charges de A');

-- La coach voit les charges, mais n'en note pas.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c210"}', false);
select test.verifier((select count(*) from public.charges_series) = 2, 'la coach voit les charges de A');
do $$ begin
  insert into public.charges_series (cliente_id, seance_ref, exercice_cle, exercice_nom, serie, charge_kg)
    values ('00000000-0000-0000-0000-00000000a210', '21000000-0000-0000-0000-000000000003', 'x', 'X', 1, 10);
  raise exception 'ÉCHEC : la coach note une charge';
exception when insufficient_privilege then perform test.verifier(true, 'la coach ne note pas de charge'); end $$;
reset role;
