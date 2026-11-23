-- Tests : nouvelles cases de notifications de la coach (cochées par défaut, coach seule).
\set ON_ERROR_STOP on

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000c240', 'coach24@test.fr', '{}'),
  ('00000000-0000-0000-0000-00000000a240', 'a24@test.fr', '{"prenom":"Anaïs"}');
select public.definir_coach('coach24@test.fr');
insert into public.clientes (id, statut) values ('00000000-0000-0000-0000-00000000a240', 'active');

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c240"}', false);
select test.verifier(
  (select notif_coach_journal and notif_coach_seances and notif_coach_alertes and notif_coach_programmes and notif_coach_messages from public.reglages),
  'toutes les notifications de la coach sont cochées par défaut'
);
update public.reglages set notif_coach_journal = false where id = true;
select test.verifier((select not notif_coach_journal from public.reglages), 'la coach décoche une notification');
reset role;

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a240"}', false);
update public.reglages set notif_coach_journal = true where id = true;
reset role;
select set_config('request.jwt.claims', '', false);
select test.verifier((select not notif_coach_journal from public.reglages), 'une cliente ne peut pas changer les notifications de la coach');
