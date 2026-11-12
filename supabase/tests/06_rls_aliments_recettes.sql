-- Tests de sécurité de la phase 5 : aliments, recettes, cibles, exclusions, favoris.
\set ON_ERROR_STOP on

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000c6', 'coach6@test.fr', '{}'),
  ('00000000-0000-0000-0000-0000000000a6', 'a6@test.fr', '{"prenom":"Aude"}'),
  ('00000000-0000-0000-0000-0000000000b6', 'b6@test.fr', '{"prenom":"Bianca"}'),
  ('00000000-0000-0000-0000-0000000000f6', 'f6@test.fr', '{"prenom":"Fiona"}');
select public.definir_coach('coach6@test.fr');
insert into public.clientes (id, statut) values
  ('00000000-0000-0000-0000-0000000000a6', 'active'),
  ('00000000-0000-0000-0000-0000000000b6', 'active'),
  ('00000000-0000-0000-0000-0000000000f6', 'fermee');

insert into public.aliments (id, source, code_ciqual, nom, proteines_100, glucides_100, lipides_100, kcal_100) values
  ('00000000-0000-0000-0000-0000000a1101', 'ciqual', '36017', 'Poulet, filet, sans peau, cru', 23.4, 0, 1.5, 110),
  ('00000000-0000-0000-0000-0000000a1102', 'ciqual', '9100', 'Riz blanc, cru', 7.04, 78, 0.91, 352);
insert into public.recettes (id, titre, publiee) values
  ('00000000-0000-0000-0000-0000000ec001', 'Bowl poulet riz', true),
  ('00000000-0000-0000-0000-0000000ec002', 'Brouillon secret', false);
insert into public.recette_ingredients (recette_id, aliment_id, role, qte_base, qte_min, qte_max) values
  ('00000000-0000-0000-0000-0000000ec001', '00000000-0000-0000-0000-0000000a1101', 'proteine', 120, 60, 220),
  ('00000000-0000-0000-0000-0000000ec002', '00000000-0000-0000-0000-0000000a1102', 'glucide', 60, 30, 120);
insert into public.repas_cibles (cliente_id, type_repas, libelle, proteines_g, glucides_g, lipides_g) values
  ('00000000-0000-0000-0000-0000000000a6', 'diner', 'Dîner', 35, 50, 15),
  ('00000000-0000-0000-0000-0000000000b6', 'diner', 'Dîner', 30, 40, 12);
insert into public.exclusions (cliente_id, categorie_id)
  select '00000000-0000-0000-0000-0000000000b6', id from public.categories_aliment where nom = 'Porc';

select test.verifier((select kcal from public.repas_cibles where cliente_id = '00000000-0000-0000-0000-0000000000a6') = 475,
  'les kcal d''un repas sont calculées automatiquement (4P + 4G + 9L)');
do $$ begin
  insert into public.recette_ingredients (recette_id, aliment_id, role, qte_base, qte_min, qte_max)
  values ('00000000-0000-0000-0000-0000000ec001', '00000000-0000-0000-0000-0000000a1102', 'fixe', 50, 40, 60);
  raise exception 'ÉCHEC : ingrédient fixe avec une fourchette';
exception when check_violation then perform test.verifier(true, 'un ingrédient « fixe » ne peut pas avoir de fourchette'); end $$;
do $$ begin
  insert into public.recette_ingredients (recette_id, aliment_id, role, qte_base, qte_min, qte_max)
  values ('00000000-0000-0000-0000-0000000ec001', '00000000-0000-0000-0000-0000000a1102', 'glucide', 50, 60, 80);
  raise exception 'ÉCHEC : quantité de base hors fourchette';
exception when check_violation then perform test.verifier(true, 'la quantité de base doit être dans la fourchette'); end $$;

-- ===================== Cliente A =====================
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a6"}', false);
select test.verifier((select count(*) from public.aliments) = 2, 'A peut lire la base d''aliments');
select test.verifier((select count(*) from public.recettes) = 1, 'A ne voit que les recettes publiées');
select test.verifier((select count(*) from public.recette_ingredients) = 1, 'A ne voit pas les ingrédients d''une recette non publiée');
select test.verifier((select count(*) from public.repas_cibles) = 1, 'A ne voit que SES cibles');
select test.verifier((select count(*) from public.exclusions) = 0, 'A ne voit pas les exclusions de B');
do $$ declare n int; begin
  update public.repas_cibles set proteines_g = 200;
  get diagnostics n = row_count;
  perform test.verifier(n = 0, 'A ne peut pas modifier ses cibles');
  update public.aliments set proteines_100 = 99;
  get diagnostics n = row_count;
  perform test.verifier(n = 0, 'A ne peut pas modifier un aliment');
end $$;
do $$ begin
  insert into public.exclusions (cliente_id, aliment_id) values ('00000000-0000-0000-0000-0000000000a6', '00000000-0000-0000-0000-0000000a1101');
  raise exception 'ÉCHEC : A a modifié ses exclusions';
exception when insufficient_privilege then perform test.verifier(true, 'A ne peut pas modifier ses exclusions (c''est la coach)'); end $$;
insert into public.favoris (cliente_id, recette_id) values ('00000000-0000-0000-0000-0000000000a6', '00000000-0000-0000-0000-0000000ec001');
select test.verifier((select count(*) from public.favoris) = 1, 'A peut ajouter une recette à ses favoris');
do $$ begin
  insert into public.favoris (cliente_id, recette_id) values ('00000000-0000-0000-0000-0000000000b6', '00000000-0000-0000-0000-0000000ec001');
  raise exception 'ÉCHEC : A a ajouté un favori pour B';
exception when insufficient_privilege then perform test.verifier(true, 'A ne peut pas ajouter de favori pour B'); end $$;
do $$ begin
  insert into public.favoris (cliente_id, recette_id) values ('00000000-0000-0000-0000-0000000000a6', '00000000-0000-0000-0000-0000000ec002');
  raise exception 'ÉCHEC : favori sur une recette non publiée';
exception when insufficient_privilege then perform test.verifier(true, 'A ne peut pas mettre en favori une recette non publiée'); end $$;
reset role;

-- ===================== Cliente B =====================
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b6"}', false);
select test.verifier((select count(*) from public.exclusions) = 1, 'B voit ses exclusions');
select test.verifier((select count(*) from public.favoris) = 0, 'B ne voit pas les favoris de A');
reset role;

-- ===================== Cliente F (fermée) =====================
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f6"}', false);
select test.verifier((select count(*) from public.recettes) = 0 and (select count(*) from public.aliments) = 0,
  'F (fermée) ne voit plus ni recettes ni aliments');
reset role;

-- ===================== Coach =====================
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c6"}', false);
select test.verifier((select count(*) from public.recettes) = 2, 'la coach voit aussi les brouillons');
select test.verifier((select count(*) from public.repas_cibles) = 2, 'la coach voit toutes les cibles');
insert into public.exclusions (cliente_id, aliment_id) values ('00000000-0000-0000-0000-0000000000a6', '00000000-0000-0000-0000-0000000a1101');
select test.verifier(true, 'la coach peut ajouter une exclusion');
do $$ begin
  delete from public.aliments where id = '00000000-0000-0000-0000-0000000a1101';
  raise exception 'ÉCHEC : aliment utilisé supprimé';
exception when foreign_key_violation then perform test.verifier(true, 'un aliment utilisé dans une recette ne peut pas être supprimé'); end $$;
reset role;
