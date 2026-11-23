-- Tests : demandes d'inscription Tally (coach seule, écrites par le serveur, un email « à valider » à la fois).
\set ON_ERROR_STOP on

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000c260', 'coach26@test.fr', '{}'),
  ('00000000-0000-0000-0000-00000000a260', 'a26@test.fr', '{"prenom":"Aude"}'),
  ('00000000-0000-0000-0000-00000000b260', 'b26@test.fr', '{"prenom":"Bianca"}');
select public.definir_coach('coach26@test.fr');
insert into public.clientes (id, statut) values
  ('00000000-0000-0000-0000-00000000a260', 'active'),
  ('00000000-0000-0000-0000-00000000b260', 'fermee');

-- Le serveur (webhook Tally) enregistre une demande.
set role service_role;
insert into public.demandes_inscription (reference, prenom, nom, email, objectif, reponses)
values ('rep-1', 'Léa', 'Test', 'lea@exemple.fr', 'Perdre du poids', '[{"question":"Prénom","reponse":"Léa"}]');
do $$ begin
  insert into public.demandes_inscription (reference, prenom, email) values ('rep-1', 'Léa', 'lea@exemple.fr');
  raise exception 'ÉCHEC : la même réponse Tally a été enregistrée deux fois';
exception when unique_violation then perform test.verifier(true, 'une même réponse Tally n''est enregistrée qu''une fois'); end $$;
do $$ begin
  insert into public.demandes_inscription (reference, prenom, email) values ('rep-2', 'Léa', 'LEA@exemple.fr');
  raise exception 'ÉCHEC : deux demandes à valider pour le même email';
exception when unique_violation then perform test.verifier(true, 'une seule demande à valider par email (majuscules comprises)'); end $$;
do $$ begin
  insert into public.demandes_inscription (reference, prenom, email) values ('rep-3', 'X', 'pas-un-email');
  raise exception 'ÉCHEC : email invalide accepté';
exception when check_violation then perform test.verifier(true, 'un email invalide est refusé'); end $$;
reset role;

-- La coach voit, traite et supprime les demandes ; elle n'en crée pas elle-même.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c260"}', false);
select test.verifier((select count(*) from public.demandes_inscription) = 1, 'la coach voit la demande');
update public.demandes_inscription set statut = 'ignoree', traitee_le = now() where reference = 'rep-1';
select test.verifier((select statut = 'ignoree' from public.demandes_inscription where reference = 'rep-1'), 'la coach peut ignorer une demande');
do $$ begin
  insert into public.demandes_inscription (prenom, email) values ('Faux', 'faux@exemple.fr');
  raise exception 'ÉCHEC : une demande a été créée sans passer par le serveur';
exception when insufficient_privilege then perform test.verifier(true, 'seul le serveur crée des demandes'); end $$;
reset role;

-- Une fois ignorée, le même email peut revenir « à valider ».
set role service_role;
insert into public.demandes_inscription (reference, prenom, email) values ('rep-4', 'Léa', 'lea@exemple.fr');
reset role;

-- Les clientes (accès ouvert ou fermé) ne voient rien et ne modifient rien.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a260"}', false);
select test.verifier((select count(*) from public.demandes_inscription) = 0, 'une cliente ne voit pas les demandes d''inscription');
update public.demandes_inscription set prenom = 'Pirate';
delete from public.demandes_inscription;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000b260"}', false);
select test.verifier((select count(*) from public.demandes_inscription) = 0, 'une cliente à l''accès fermé ne voit rien');
reset role;
select set_config('request.jwt.claims', '', false);
select test.verifier((select count(*) from public.demandes_inscription where prenom = 'Pirate') = 0
  and (select count(*) from public.demandes_inscription) = 2, 'une cliente ne peut ni modifier ni supprimer une demande');
