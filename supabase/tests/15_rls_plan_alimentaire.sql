-- Tests : plan alimentaire et besoins.
\set ON_ERROR_STOP on

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000c150', 'coach15@test.fr', '{}'),
  ('00000000-0000-0000-0000-00000000a150', 'a15@test.fr', '{"prenom":"Anaïs"}'),
  ('00000000-0000-0000-0000-00000000b150', 'b15@test.fr', '{"prenom":"Bleuenn"}'),
  ('00000000-0000-0000-0000-00000000f150', 'f15@test.fr', '{"prenom":"Flore"}');
select public.definir_coach('coach15@test.fr');
insert into public.clientes (id, statut) values
  ('00000000-0000-0000-0000-00000000a150', 'active'),
  ('00000000-0000-0000-0000-00000000b150', 'active'),
  ('00000000-0000-0000-0000-00000000f150', 'fermee');

-- La coach prépare deux plans pour A, un pour B et pour F.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c150"}', false);
insert into public.besoins_clientes (cliente_id, taille_cm, poids_kg, kcal_objectif)
  values ('00000000-0000-0000-0000-00000000a150', 168, 70.5, 1800);
do $$ begin
  insert into public.besoins_clientes (cliente_id, pct_lipides, pct_glucides, pct_proteines)
    values ('00000000-0000-0000-0000-00000000b150', 50, 40, 30);
  raise exception 'ÉCHEC : répartition à 120 %%';
exception when check_violation then perform test.verifier(true, 'la répartition des macros fait 100 %'); end $$;
insert into public.plans_alimentaires (id, cliente_id, titre) values
  ('15000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000a150', 'Plan 1'),
  ('15000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000a150', 'Plan 2'),
  ('15000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-00000000b150', 'Plan B'),
  ('15000000-0000-0000-0000-00000000000f', '00000000-0000-0000-0000-00000000f150', 'Plan F');
select public.publier_plan_alimentaire('15000000-0000-0000-0000-00000000000a', true);
select public.publier_plan_alimentaire('15000000-0000-0000-0000-00000000000b', true);
select public.publier_plan_alimentaire('15000000-0000-0000-0000-00000000000f', true);
select test.verifier(
  (select count(*) from public.plans_alimentaires where cliente_id = '00000000-0000-0000-0000-00000000a150' and publie) = 1
  and (select publie from public.plans_alimentaires where id = '15000000-0000-0000-0000-00000000000b'),
  'publier un plan dépublie le précédent');
reset role;

-- A voit son plan publié seulement, pas ses besoins ni le plan de B.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a150"}', false);
select test.verifier((select count(*) from public.plans_alimentaires) = 1, 'A ne voit que son plan publié');
select test.verifier((select titre from public.plans_alimentaires) = 'Plan 2', 'A voit le dernier plan publié');
select test.verifier((select count(*) from public.besoins_clientes) = 0, 'A ne voit pas le calcul de ses besoins');
update public.plans_alimentaires set titre = 'Piraté';
select test.verifier((select titre from public.plans_alimentaires) = 'Plan 2', 'A ne peut pas modifier son plan');
do $$ begin
  perform public.publier_plan_alimentaire('15000000-0000-0000-0000-00000000000c', true);
  raise exception 'ÉCHEC : A publie un plan';
exception when insufficient_privilege then perform test.verifier(true, 'A ne peut pas publier de plan'); end $$;
select public.plan_alimentaire_vu('15000000-0000-0000-0000-00000000000b');
select public.plan_alimentaire_vu('15000000-0000-0000-0000-00000000000c');
reset role;
select test.verifier((select vu_le is not null from public.plans_alimentaires where id = '15000000-0000-0000-0000-00000000000b'), 'A note qu’elle a vu son plan');
select test.verifier((select vu_le is null from public.plans_alimentaires where id = '15000000-0000-0000-0000-00000000000c'), 'A ne peut pas marquer le plan de B');

-- B : son plan n'est pas publié.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000b150"}', false);
select test.verifier((select count(*) from public.plans_alimentaires) = 0, 'B ne voit pas un plan en brouillon');
reset role;

-- F : accès fermé.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000f150"}', false);
select test.verifier((select count(*) from public.plans_alimentaires) = 0, 'accès fermé : plus de plan visible');
reset role;

-- La coach voit tout.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c150"}', false);
select test.verifier((select count(*) from public.plans_alimentaires) = 4, 'la coach voit tous les plans');
select test.verifier((select count(*) from public.besoins_clientes) = 1, 'la coach voit les besoins');
reset role;
