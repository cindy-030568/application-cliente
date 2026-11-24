-- Tests : avis (consentement séparé) et parrainage (code personnel).
\set ON_ERROR_STOP on

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000c390', 'coach39@test.fr', '{}'),
  ('00000000-0000-0000-0000-00000000a390', 'a39@test.fr', '{"prenom":"Anouk"}'),
  ('00000000-0000-0000-0000-00000000b390', 'b39@test.fr', '{"prenom":"Bianca"}');
select public.definir_coach('coach39@test.fr');
insert into public.clientes (id, statut) values
  ('00000000-0000-0000-0000-00000000a390', 'active'),
  ('00000000-0000-0000-0000-00000000b390', 'active');

-- Chaque cliente a un code personnel, différent.
select test.verifier(
  (select count(distinct code_parrainage) = 2 and bool_and(code_parrainage ~ '^[A-Z2-9]{6}$') from public.clientes where id in ('00000000-0000-0000-0000-00000000a390', '00000000-0000-0000-0000-00000000b390')),
  'chaque cliente a son propre code de parrainage'
);

-- A laisse un avis, sans autoriser la publication, puis l'autorise sous son initiale.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a390"}', false);
insert into public.avis (id, texte, contexte) values ('39000000-0000-4000-8000-00000000000a', 'Un accompagnement qui a tout changé pour moi.', 'fin');
select test.verifier((select not publiable from public.avis), 'par défaut, un avis n''est pas publiable');
do $$ begin
  update public.avis set publiable = true;
  raise exception 'ÉCHEC : publiable sans nom choisi';
exception when check_violation then perform test.verifier(true, 'autoriser la publication demande de choisir le nom'); end $$;
update public.avis set publiable = true, nom_affiche = 'initiale';
select test.verifier((select publiable and nom_affiche = 'initiale' from public.avis), 'A autorise la publication sous son initiale');
do $$ begin
  insert into public.avis (cliente_id, texte) values ('00000000-0000-0000-0000-00000000b390', 'Faux avis au nom de B');
  raise exception 'ÉCHEC : avis au nom de B';
exception when insufficient_privilege then perform test.verifier(true, 'A ne peut pas écrire un avis au nom de B'); end $$;
-- A ne voit pas le code de B.
select test.verifier((select count(*) from public.clientes where id = '00000000-0000-0000-0000-00000000b390') = 0, 'A ne voit pas le code de B');
update public.clientes set code_parrainage = 'AAAAAA' where id = '00000000-0000-0000-0000-00000000a390';
reset role;
select test.verifier((select code_parrainage <> 'AAAAAA' from public.clientes where id = '00000000-0000-0000-0000-00000000a390'), 'une cliente ne peut pas changer son code');

-- B ne voit ni ne modifie l'avis de A.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000b390"}', false);
select test.verifier((select count(*) from public.avis) = 0, 'B ne voit pas l''avis de A');
update public.avis set texte = 'Modifié par B, très mauvais accompagnement';
delete from public.avis;
reset role;
select test.verifier((select texte from public.avis) = 'Un accompagnement qui a tout changé pour moi.', 'B ne peut ni modifier ni effacer l''avis de A');

-- La coach lit, mais ne change jamais le texte ni le consentement.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c390"}', false);
select test.verifier((select count(*) from public.avis) = 1, 'la coach voit les avis');
update public.avis set nom_affiche = 'prenom', texte = 'Texte réécrit par la coach';
reset role;
select test.verifier((select nom_affiche = 'initiale' and texte like 'Un accompagnement%' from public.avis), 'la coach ne modifie ni le texte ni le consentement');

-- Accès fermé : plus rien de visible, plus d'avis.
update public.clientes set statut = 'fermee' where id = '00000000-0000-0000-0000-00000000a390';
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a390"}', false);
select test.verifier((select count(*) from public.avis) = 0, 'accès fermé : plus rien de visible');
do $$ begin
  insert into public.avis (texte) values ('Après la fermeture de mon accès');
  raise exception 'ÉCHEC : avis après fermeture';
exception when insufficient_privilege then perform test.verifier(true, 'accès fermé : plus d''avis possible'); end $$;
reset role;
select set_config('request.jwt.claims', '', false);
