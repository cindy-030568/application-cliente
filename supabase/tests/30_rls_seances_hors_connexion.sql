-- Tests : séances envoyées après coup (hors connexion) — jamais en double, jamais pour une autre cliente.
\set ON_ERROR_STOP on

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000c300', 'coach30@test.fr', '{}'),
  ('00000000-0000-0000-0000-00000000a300', 'a30@test.fr', '{"prenom":"Agnès"}'),
  ('00000000-0000-0000-0000-00000000b300', 'b30@test.fr', '{"prenom":"Blanche"}');
select public.definir_coach('coach30@test.fr');
insert into public.clientes (id, statut) values
  ('00000000-0000-0000-0000-00000000a300', 'active'),
  ('00000000-0000-0000-0000-00000000b300', 'active');

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a300"}', false);
-- Envoyée une première fois (au retour du réseau), avec l'heure réelle de la séance.
insert into public.seances_faites (seance_nom, ref_locale, faite_le) values ('Haut du corps', '11111111-1111-4111-8111-111111111111', now() - interval '3 hours');
-- Renvoyée (réseau coupé pendant la réponse) : rien en plus.
insert into public.seances_faites (seance_nom, ref_locale) values ('Haut du corps', '11111111-1111-4111-8111-111111111111') on conflict (cliente_id, ref_locale) do nothing;
select test.verifier((select count(*) from public.seances_faites) = 1, 'une séance renvoyée deux fois n''est enregistrée qu''une fois');
select test.verifier((select faite_le < now() - interval '2 hours' from public.seances_faites), 'la séance garde l''heure où elle a été faite');
do $$ begin
  insert into public.seances_faites (cliente_id, seance_nom, ref_locale) values ('00000000-0000-0000-0000-00000000b300', 'Pirate', '22222222-2222-4222-8222-222222222222');
  raise exception 'ÉCHEC : séance enregistrée pour une autre cliente';
exception when insufficient_privilege then perform test.verifier(true, 'impossible d''envoyer une séance pour une autre cliente'); end $$;
reset role;

-- B peut utiliser le même identifiant sans gêner A (identifiants par cliente).
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000b300"}', false);
insert into public.seances_faites (seance_nom, ref_locale) values ('Bas du corps', '11111111-1111-4111-8111-111111111111');
select test.verifier((select count(*) from public.seances_faites) = 1, 'B ne voit que sa séance');
reset role;

-- Accès fermé : plus d'envoi possible, plus rien de visible.
update public.clientes set statut = 'fermee' where id = '00000000-0000-0000-0000-00000000a300';
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a300"}', false);
select test.verifier((select count(*) from public.seances_faites) = 0, 'accès fermé : plus rien de visible');
do $$ begin
  insert into public.seances_faites (seance_nom, ref_locale) values ('En retard', '33333333-3333-4333-8333-333333333333');
  raise exception 'ÉCHEC : une cliente fermée a envoyé une séance';
exception when insufficient_privilege then perform test.verifier(true, 'accès fermé : les séances en attente ne passent plus'); end $$;
reset role;
select set_config('request.jwt.claims', '', false);
