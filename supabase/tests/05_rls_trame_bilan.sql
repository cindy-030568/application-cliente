-- Tests de la trame de bilan : rubriques, réponses longues, précisions.
\set ON_ERROR_STOP on

select test.verifier(
  (select array_agg(distinct section order by section) from public.champs_mesure where actif)
  = array['Mes mesures', 'Nutrition & habitudes', 'Projection & engagement', 'Ressentis & énergie', 'Victoires & difficultés'],
  'les 4 rubriques de la trame + les mesures');
select test.verifier((select count(*) from public.champs_mesure where actif and type = 'texte') = 8, '8 questions en texte libre');
select test.verifier(not exists (select 1 from public.champs_mesure where actif and libelle ilike '%écart%'),
  'aucune question active ne parle d''« écart »');

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a5', 'a5@test.fr', '{"prenom":"Amandine"}');
insert into public.clientes (id, statut) values ('00000000-0000-0000-0000-0000000000a5', 'active');

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a5"}', false);
insert into public.bilans (id, cliente_id) values ('00000000-0000-0000-0000-00000000a501', '00000000-0000-0000-0000-0000000000a5');
insert into public.bilan_valeurs (bilan_id, champ_id, valeur_texte)
  select '00000000-0000-0000-0000-00000000a501', id, repeat('Une réponse détaillée. ', 50)
  from public.champs_mesure where libelle like '2 ou 3 victoires%';
insert into public.bilan_valeurs (bilan_id, champ_id, valeur_texte, precision)
  select '00000000-0000-0000-0000-00000000a501', id, 'Plutôt oui', 'Un peu juste le soir'
  from public.champs_mesure where libelle = 'Est-ce que ton plan te convient ?';
select test.verifier((select count(*) from public.bilan_valeurs where bilan_id = '00000000-0000-0000-0000-00000000a501') = 2,
  'une réponse longue et une précision sont enregistrées');
reset role;
