-- Tests : séances express — publiées seulement, à qui elles sont destinées, accès selon le statut.
\set ON_ERROR_STOP on

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000c400', 'coach40@test.fr', '{}'),
  ('00000000-0000-0000-0000-00000000a400', 'a40@test.fr', '{"prenom":"Aïcha"}'),
  ('00000000-0000-0000-0000-00000000b400', 'b40@test.fr', '{"prenom":"Bertille"}'),
  ('00000000-0000-0000-0000-00000000d400', 'd40@test.fr', '{"prenom":"Diane"}');
select public.definir_coach('coach40@test.fr');
insert into public.clientes (id, statut) values
  ('00000000-0000-0000-0000-00000000a400', 'active'),
  ('00000000-0000-0000-0000-00000000b400', 'active'),
  ('00000000-0000-0000-0000-00000000d400', 'terminee');

-- La coach crée : une pour toutes, une réservée à B, un brouillon.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c400"}', false);
insert into public.seances_express (id, titre, duree_minutes, type, contenu, publiee, visibilite) values
  ('40000000-0000-4000-8000-000000000001', 'Express toutes', 10, 'Renfo', '{"nom":"x","blocs":[]}', true, 'toutes'),
  ('40000000-0000-4000-8000-000000000002', 'Express pour B', 15, 'Cardio', '{"nom":"x","blocs":[]}', true, 'certaines'),
  ('40000000-0000-4000-8000-000000000003', 'Brouillon', 5, 'Mobilité', '{"nom":"x","blocs":[]}', false, 'toutes');
insert into public.seances_express_clientes (seance_id, cliente_id) values ('40000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-00000000b400');
select test.verifier((select count(*) from public.seances_express) = 3, 'la coach voit toutes ses séances express, brouillons compris');
do $$ begin
  insert into public.seances_express (titre, duree_minutes, type, contenu) values ('Trop longue', 45, 'Renfo', '{}');
  raise exception 'ÉCHEC : durée hors liste acceptée';
exception when check_violation then perform test.verifier(true, 'la durée est 5, 10, 15, 20 ou 30 min'); end $$;
reset role;

-- A : seulement celle pour toutes ; pas le brouillon, pas celle de B ; ne peut rien créer.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a400"}', false);
select test.verifier((select array_agg(titre) from public.seances_express) = array['Express toutes'], 'A ne voit que la séance publiée pour toutes');
do $$ begin
  insert into public.seances_express (titre, duree_minutes, type, contenu) values ('Pirate', 5, 'Renfo', '{}');
  raise exception 'ÉCHEC : une cliente a créé une séance';
exception when insufficient_privilege then perform test.verifier(true, 'seule la coach crée des séances express'); end $$;
insert into public.seances_express_favoris (seance_id) values ('40000000-0000-4000-8000-000000000001');
select test.verifier((select count(*) from public.seances_express_favoris) = 1, 'A met une séance en favori');
-- Séance libre faite par A.
insert into public.seances_faites (seance_nom, seance_express_id) values ('Express toutes', '40000000-0000-4000-8000-000000000001');
select test.verifier((select count(*) from public.seances_faites where seance_express_id is not null) = 1, 'A enregistre une séance libre');
reset role;

-- B : les deux publiées ; ne voit pas les favoris de A.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000b400"}', false);
select test.verifier((select count(*) from public.seances_express) = 2, 'B voit aussi la séance qui lui est réservée');
select test.verifier((select count(*) from public.seances_express_favoris) = 0, 'B ne voit pas les favoris de A');
delete from public.seances_express_favoris;
reset role;
select test.verifier((select count(*) from public.seances_express_favoris) = 1, 'B ne peut pas effacer les favoris de A');

-- D (suivi terminé) : rien sans date d'accès, tout avec une date à venir, plus rien une fois la date passée.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000d400"}', false);
select test.verifier((select count(*) from public.seances_express) = 0, 'suivi terminé sans abonnement : aucune séance express');
reset role;
update public.clientes set express_jusqu_au = current_date + 30 where id = '00000000-0000-0000-0000-00000000d400';
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000d400"}', false);
select test.verifier((select count(*) from public.seances_express) = 1, 'suivi terminé avec accès jusqu''à une date : elle les voit');
update public.clientes set express_jusqu_au = current_date + 365 where id = '00000000-0000-0000-0000-00000000d400';
reset role;
select test.verifier((select express_jusqu_au from public.clientes where id = '00000000-0000-0000-0000-00000000d400') = current_date + 30, 'une cliente ne peut pas prolonger son accès elle-même');
update public.clientes set express_jusqu_au = current_date - 1 where id = '00000000-0000-0000-0000-00000000d400';
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000d400"}', false);
select test.verifier((select count(*) from public.seances_express) = 0, 'date d''accès passée : plus rien');
reset role;

-- Accès fermé : plus rien.
update public.clientes set statut = 'fermee' where id = '00000000-0000-0000-0000-00000000a400';
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a400"}', false);
select test.verifier((select count(*) from public.seances_express) = 0 and (select count(*) from public.seances_express_favoris) = 0, 'accès fermé : plus rien de visible');
reset role;
select set_config('request.jwt.claims', '', false);
