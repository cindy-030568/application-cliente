-- Tests : contrat accepté dans l'app (preuve non modifiable, clientes en cours non bloquées).
\set ON_ERROR_STOP on

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000c270', 'coach27@test.fr', '{}'),
  ('00000000-0000-0000-0000-00000000a270', 'a27@test.fr', '{"prenom":"Anne"}'),
  ('00000000-0000-0000-0000-00000000b270', 'b27@test.fr', '{"prenom":"Bea"}'),
  ('00000000-0000-0000-0000-00000000d270', 'd27@test.fr', '{"prenom":"Dora"}');
select public.definir_coach('coach27@test.fr');
insert into public.clientes (id, statut) values
  ('00000000-0000-0000-0000-00000000a270', 'active'),
  ('00000000-0000-0000-0000-00000000b270', 'active'),
  ('00000000-0000-0000-0000-00000000d270', 'active');
-- D était déjà en cours avant le contrat (consentement il y a un mois).
insert into public.consentements (cliente_id, version, accepte_le) values ('00000000-0000-0000-0000-00000000d270', 'v-ancienne', now() - interval '30 days');

-- La coach met en place son contrat (version 1).
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c270"}', false);
update public.reglages set contrat_texte = 'Texte du contrat v1', contrat_version = '1', contrat_depuis = now() - interval '1 day' where id = true;
reset role;
insert into public.consentements (cliente_id, version) values ('00000000-0000-0000-0000-00000000a270', '2026-11'), ('00000000-0000-0000-0000-00000000b270', '2026-11');

set role authenticated;
-- A, nouvelle cliente : doit accepter.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a270"}', false);
select test.verifier(public.contrat_a_accepter() = '1', 'une nouvelle cliente doit accepter le contrat');
do $$ begin
  perform public.accepter_contrat('1', true, false);
  raise exception 'ÉCHEC : contrat accepté sans la renonciation';
exception when check_violation then perform test.verifier(true, 'la case de renonciation est obligatoire'); end $$;
do $$ begin
  perform public.accepter_contrat('1', false, true);
  raise exception 'ÉCHEC : renonciation sans acceptation';
exception when check_violation then perform test.verifier(true, 'la case d''acceptation est obligatoire'); end $$;
select test.verifier(not public.accepter_contrat('0', true, true), 'une ancienne version n''est pas acceptée');
select test.verifier(public.accepter_contrat('1', true, true), 'la cliente accepte la version en cours');
select test.verifier(public.contrat_a_accepter() is null, 'une fois accepté, plus rien à faire');
select test.verifier((select texte = 'Texte du contrat v1' and renonciation_retractation from public.acceptations_contrat), 'le texte exact et la renonciation sont gardés');
do $$ begin
  insert into public.acceptations_contrat (cliente_id, version, texte, renonciation_retractation)
  values ('00000000-0000-0000-0000-00000000b270', '1', 'faux texte', true);
  raise exception 'ÉCHEC : écriture directe dans les preuves';
exception when insufficient_privilege then perform test.verifier(true, 'personne n''écrit directement une preuve'); end $$;
update public.acceptations_contrat set texte = 'modifié';
delete from public.acceptations_contrat;

-- D, déjà en cours avant le contrat : pas bloquée.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000d270"}', false);
select test.verifier(public.contrat_a_accepter() is null, 'une cliente déjà en cours n''est pas bloquée');

-- B ne voit pas la preuve de A.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000b270"}', false);
select test.verifier((select count(*) from public.acceptations_contrat) = 0, 'une cliente ne voit pas le contrat accepté d''une autre');
reset role;
select set_config('request.jwt.claims', '', false);
select test.verifier((select texte from public.acceptations_contrat) = 'Texte du contrat v1', 'la preuve ne peut être ni modifiée ni supprimée');

-- Nouvelle version : A (déjà acceptée en v1) n'est pas bloquée, B (pas encore) doit accepter la v2.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c270"}', false);
update public.reglages set contrat_texte = 'Texte du contrat v2', contrat_version = '2' where id = true;
select test.verifier((select count(*) from public.acceptations_contrat) = 1, 'la coach voit les contrats acceptés');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a270"}', false);
select test.verifier(public.contrat_a_accepter() is null, 'nouvelle version : une cliente qui a accepté la précédente n''est pas bloquée');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000b270"}', false);
select test.verifier(public.contrat_a_accepter() = '2', 'nouvelle version : une nouvelle cliente accepte la nouvelle');
reset role;

-- Accès fermé : plus rien de visible.
update public.clientes set statut = 'fermee' where id = '00000000-0000-0000-0000-00000000a270';
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a270"}', false);
select test.verifier((select count(*) from public.acceptations_contrat) = 0, 'accès fermé : la cliente ne voit plus son contrat');
do $$ begin
  perform public.accepter_contrat('2', true, true);
  raise exception 'ÉCHEC : une cliente fermée a pu accepter';
exception when insufficient_privilege then perform test.verifier(true, 'accès fermé : plus d''acceptation possible'); end $$;
reset role;
select set_config('request.jwt.claims', '', false);
-- Remise à zéro des réglages pour les tests suivants.
update public.reglages set contrat_texte = null, contrat_version = null, contrat_depuis = null where id = true;
