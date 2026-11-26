-- Tests : menus de la semaine (étape 4). La coach prépare, l'abonnée active lit le menu publié,
-- personne d'autre ; la liste de courses s'ouvre aux abonnées actives et reste privée.
\set ON_ERROR_STOP on

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000c470', 'coach47@test.fr', '{}'),
  ('00000000-0000-0000-0000-00000000a470', 'coachee47@test.fr', '{"prenom":"Clara"}'),
  ('00000000-0000-0000-0000-00000000e470', 'abonnee47@test.fr', '{"prenom":"Eva"}'),
  ('00000000-0000-0000-0000-00000000f470', 'ancienne47@test.fr', '{"prenom":"Flore"}');
select public.definir_coach('coach47@test.fr');
insert into public.clientes (id, statut) values ('00000000-0000-0000-0000-00000000a470', 'active');
insert into public.clientes (id, statut, formule) values
  ('00000000-0000-0000-0000-00000000e470', 'active', 'abonnement'),
  ('00000000-0000-0000-0000-00000000f470', 'fermee', 'abonnement');
insert into public.recettes (id, titre, publiee) values ('47000000-0000-4000-8000-000000000001', 'Bowl test 47', true);

-- La coach prépare deux menus : un publié, un brouillon.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c470"}', false);
insert into public.menus_semaine (id, lundi, mot, batch, publie) values
  ('47000000-0000-4000-8000-0000000000a1', date '2030-01-07', 'Une semaine pleine de couleurs', 'Cuire le riz', true),
  ('47000000-0000-4000-8000-0000000000a2', date '2030-01-14', null, null, false);
insert into public.menus_repas (menu_id, jour, repas, recette_id) values
  ('47000000-0000-4000-8000-0000000000a1', 1, 'dejeuner', '47000000-0000-4000-8000-000000000001'),
  ('47000000-0000-4000-8000-0000000000a2', 1, 'diner', '47000000-0000-4000-8000-000000000001');
select test.verifier((select count(*) from public.menus_semaine where lundi >= '2030-01-01') = 2, 'la coach voit tous ses menus');
do $$ begin
  insert into public.menus_semaine (lundi) values (date '2030-01-08');
  raise exception 'ÉCHEC : un menu qui ne commence pas un lundi';
exception when check_violation then perform test.verifier(true, 'un menu commence toujours un lundi'); end $$;
reset role;

-- L'abonnée active : le menu publié seulement, sans rien pouvoir modifier.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000e470"}', false);
select test.verifier((select array_agg(lundi) from public.menus_semaine where lundi >= '2030-01-01') = array[date '2030-01-07'], 'l''abonnée voit le menu publié, pas le brouillon');
select test.verifier((select count(*) from public.menus_repas where menu_id in ('47000000-0000-4000-8000-0000000000a1', '47000000-0000-4000-8000-0000000000a2')) = 1, 'l''abonnée voit les repas du menu publié seulement');
update public.menus_semaine set mot = 'piraté' where id = '47000000-0000-4000-8000-0000000000a1';
do $$ begin
  insert into public.menus_repas (menu_id, jour, repas, recette_id) values ('47000000-0000-4000-8000-0000000000a1', 2, 'diner', '47000000-0000-4000-8000-000000000001');
  raise exception 'ÉCHEC : une abonnée a modifié le menu';
exception when insufficient_privilege then perform test.verifier(true, 'l''abonnée ne modifie pas le menu'); end $$;
insert into public.courses (cliente_id, nom, rayon, quantite, unite) values ('00000000-0000-0000-0000-00000000e470', 'Riz', 'Féculents & pain', 300, 'g');
select test.verifier((select count(*) from public.courses) = 1, 'l''abonnée a sa liste de courses');
reset role;
select test.verifier((select mot from public.menus_semaine where id = '47000000-0000-4000-8000-0000000000a1') = 'Une semaine pleine de couleurs', 'le mot de la coach n''a pas bougé');

-- La coachée : pas de menu (elle a son plan) ; elle ne voit pas la liste de l'abonnée.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a470"}', false);
select test.verifier((select count(*) from public.menus_semaine where lundi >= '2030-01-01') + (select count(*) from public.menus_repas) = 0, 'la coachée ne voit pas les menus des abonnées');
select test.verifier((select count(*) from public.courses where cliente_id = '00000000-0000-0000-0000-00000000e470') = 0, 'la liste de courses de l''abonnée reste privée');
reset role;

-- La coach ne voit pas la liste de courses de l'abonnée.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c470"}', false);
select test.verifier((select count(*) from public.courses where cliente_id = '00000000-0000-0000-0000-00000000e470') = 0, 'la coach ne voit pas la liste de courses d''une abonnée');
reset role;

-- Une abonnée dont l'abonnement est terminé : plus de menu, plus d'ajout aux courses.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000f470"}', false);
select test.verifier((select count(*) from public.menus_semaine) + (select count(*) from public.menus_repas) = 0, 'abonnement terminé : plus de menu');
do $$ begin
  insert into public.courses (cliente_id, nom) values ('00000000-0000-0000-0000-00000000f470', 'Pâtes');
  raise exception 'ÉCHEC : courses d''une abonnée terminée';
exception when insufficient_privilege then perform test.verifier(true, 'abonnement terminé : plus d''ajout aux courses'); end $$;
reset role;
select set_config('request.jwt.claims', '', false);
