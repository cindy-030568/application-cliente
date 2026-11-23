-- Tests : petits mots de la coach.
\set ON_ERROR_STOP on

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000c230', 'coach23@test.fr', '{}'),
  ('00000000-0000-0000-0000-00000000a230', 'a23@test.fr', '{"prenom":"Aurore"}'),
  ('00000000-0000-0000-0000-00000000b230', 'b23@test.fr', '{"prenom":"Brune"}');
select public.definir_coach('coach23@test.fr');
insert into public.clientes (id, statut) values
  ('00000000-0000-0000-0000-00000000a230', 'active'),
  ('00000000-0000-0000-0000-00000000b230', 'active');

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c230"}', false);
insert into public.messages_cliente (id, cliente_id, proposition, statut, texte) values
  ('23000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000a230', 'pas_baisse:2026-W48', 'envoye', 'Coucou Aurore !'),
  ('23000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000a230', 'sommeil_baisse:2026-W48', 'ignore', null),
  ('23000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-00000000b230', 'pas_hausse:2026-W48', 'envoye', 'Bravo Brune !');
select test.verifier((select count(*) from public.messages_cliente) = 3, 'la coach voit tous les messages');
do $$ begin
  insert into public.messages_cliente (cliente_id, statut) values ('00000000-0000-0000-0000-00000000a230', 'envoye');
  raise exception 'ÉCHEC : message envoyé sans texte';
exception when check_violation then perform test.verifier(true, 'un message envoyé a forcément un texte'); end $$;
reset role;

-- A : seulement ses messages envoyés ; elle ne peut ni écrire ni modifier, seulement noter « lu ».
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a230"}', false);
select test.verifier((select count(*) from public.messages_cliente) = 1, 'A ne voit que son message envoyé');
update public.messages_cliente set texte = 'Piraté';
do $$ begin
  insert into public.messages_cliente (cliente_id, statut, texte) values ('00000000-0000-0000-0000-00000000a230', 'envoye', 'faux');
  raise exception 'ÉCHEC : A écrit un message';
exception when insufficient_privilege then perform test.verifier(true, 'A ne peut pas écrire de message'); end $$;
select public.message_cliente_lu('23000000-0000-0000-0000-00000000000a');
select public.message_cliente_lu('23000000-0000-0000-0000-00000000000c');
reset role;
select test.verifier((select texte from public.messages_cliente where id = '23000000-0000-0000-0000-00000000000a') = 'Coucou Aurore !', 'A ne peut pas modifier le message');
select test.verifier((select lu_le is not null from public.messages_cliente where id = '23000000-0000-0000-0000-00000000000a'), 'A note qu’elle a lu');
select test.verifier((select lu_le is null from public.messages_cliente where id = '23000000-0000-0000-0000-00000000000c'), 'A ne peut pas marquer le message de B');
