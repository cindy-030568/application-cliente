-- Tests : récap de la semaine — chaque cliente règle seulement SA notification.
\set ON_ERROR_STOP on

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000c330', 'coach33@test.fr', '{}'),
  ('00000000-0000-0000-0000-00000000a330', 'a33@test.fr', '{"prenom":"Aude"}'),
  ('00000000-0000-0000-0000-00000000b330', 'b33@test.fr', '{"prenom":"Berthe"}');
select public.definir_coach('coach33@test.fr');
insert into public.clientes (id, statut) values
  ('00000000-0000-0000-0000-00000000a330', 'active'),
  ('00000000-0000-0000-0000-00000000b330', 'active');

select test.verifier((select bool_and(recap_notif) from public.clientes where id in ('00000000-0000-0000-0000-00000000a330', '00000000-0000-0000-0000-00000000b330')), 'récap activé par défaut');

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a330"}', false);
select public.definir_recap_notif(false);
reset role;
select test.verifier((select not recap_notif from public.clientes where id = '00000000-0000-0000-0000-00000000a330'), 'A décoche la notification de son récap');
select test.verifier((select recap_notif from public.clientes where id = '00000000-0000-0000-0000-00000000b330'), 'le réglage de B n''a pas bougé');

-- A ne peut pas modifier B directement (pas de droit d'écriture sur la fiche).
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a330"}', false);
update public.clientes set recap_notif = false where id = '00000000-0000-0000-0000-00000000b330';
reset role;
select test.verifier((select recap_notif from public.clientes where id = '00000000-0000-0000-0000-00000000b330'), 'A ne peut pas changer le réglage de B');

-- Accès fermé : plus de réglage possible.
update public.clientes set statut = 'fermee' where id = '00000000-0000-0000-0000-00000000a330';
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a330"}', false);
select public.definir_recap_notif(true);
reset role;
select test.verifier((select not recap_notif from public.clientes where id = '00000000-0000-0000-0000-00000000a330'), 'accès fermé : le réglage ne change plus');
select set_config('request.jwt.claims', '', false);
