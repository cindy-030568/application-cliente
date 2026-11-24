-- Tests : questionnaire pré-coaching (taille, poids, date de naissance pré-remplis s'ils sont vides).
\set ON_ERROR_STOP on

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000a320', 'a32@test.fr', '{"prenom":"Aurore"}'),
  ('00000000-0000-0000-0000-00000000b320', 'b32@test.fr', '{"prenom":"Bettina"}');
insert into public.clientes (id, statut) values
  ('00000000-0000-0000-0000-00000000a320', 'active'),
  ('00000000-0000-0000-0000-00000000b320', 'active');
-- B : la coach avait déjà saisi sa taille.
insert into public.besoins_clientes (cliente_id, taille_cm) values ('00000000-0000-0000-0000-00000000b320', 170);

select test.verifier((select count(*) from public.questions_arrivee where type = 'aliments') = 11, 'les 11 familles d''aliments du plan sont là');
select test.verifier((select count(*) from public.questions_arrivee where libelle = 'Ton cycle') = 0, 'les questions de départ sont remplacées');
select test.verifier((select count(*) from public.questions_arrivee where condition = 'sport') = 2, 'les questions du suivi sportif sont marquées');
select test.verifier((select questionnaire_intro like 'Félicitations ma Queen%' from public.reglages), 'le texte d''accueil de Cindy est en place');

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a320"}', false);
select public.envoyer_questionnaire('[]', '{}', 'perte', '{"taille_cm": "165", "poids_kg": "68.5", "date_naissance": "1990-04-12"}');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000b320"}', false);
select public.envoyer_questionnaire('[]', '{}', null, '{"taille_cm": 999, "poids_kg": 70, "date_naissance": "pas une date"}');
reset role;
select set_config('request.jwt.claims', '', false);
select test.verifier((select taille_cm = 165 and poids_kg = 68.5 and date_naissance = '1990-04-12' and objectif = 'perte' from public.besoins_clientes where cliente_id = '00000000-0000-0000-0000-00000000a320'),
  'taille, poids, date de naissance et objectif pré-remplis');
select test.verifier((select taille_cm = 170 and poids_kg = 70 and date_naissance is null from public.besoins_clientes where cliente_id = '00000000-0000-0000-0000-00000000b320'),
  'ce que la coach a saisi n''est pas écrasé, et une valeur fausse est ignorée');
