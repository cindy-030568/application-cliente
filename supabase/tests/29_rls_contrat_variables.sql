-- Tests : contrat avec variables (rempli pour chaque cliente, adresse et date de naissance obligatoires si utilisées).
\set ON_ERROR_STOP on

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000c290', 'coach29@test.fr', '{}'),
  ('00000000-0000-0000-0000-00000000a290', 'a29@test.fr', '{"prenom":"Alice","nom":"Durand"}'),
  ('00000000-0000-0000-0000-00000000b290', 'b29@test.fr', '{"prenom":"Basma","nom":"Petit"}');
select public.definir_coach('coach29@test.fr');
insert into public.clientes (id, statut, date_debut) values
  ('00000000-0000-0000-0000-00000000a290', 'active', '2026-12-01'),
  ('00000000-0000-0000-0000-00000000b290', 'active', null);
insert into public.paiements_clientes (cliente_id, formule, montant_total, nb_fois) values ('00000000-0000-0000-0000-00000000a290', 'Nutrition + Sport – 3 mois', 750, 3);
insert into public.echeances_paiement (cliente_id, date_echeance, montant) values
  ('00000000-0000-0000-0000-00000000a290', '2026-12-05', 375), ('00000000-0000-0000-0000-00000000a290', '2027-01-05', 187.5);
insert into public.besoins_clientes (cliente_id, date_naissance) values ('00000000-0000-0000-0000-00000000a290', '1990-04-12');

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c290"}', false);
update public.reglages set
  contrat_texte = 'Cliente : {{prenom}} {{nom}} ({{email}}), née le {{date_naissance}}, {{adresse}}. Formule : {{formule}} – {{montant_total}} – {{paiement}} – le {{jour_echeance}} de chaque mois – début {{date_debut}}. Acceptée le {{date}}.',
  contrat_version = 'v-var', contrat_case_renonciation = 'Je renonce (test).', contrat_depuis = now() - interval '1 day'
where id = true;
select test.verifier(
  public.apercu_contrat('00000000-0000-0000-0000-00000000a290') like 'Cliente : Alice Durand (a29@test.fr), née le [ta date de naissance, à remplir ci-dessous], [ton adresse, à remplir ci-dessous]. Formule : Nutrition + Sport – 3 mois – 750 € – Échelonné (en 3 fois) – le 5 de chaque mois – début 01/12/2026.%',
  'la coach voit le contrat rempli avec la fiche, la formule et le paiement de la cliente');
select test.verifier(public.apercu_contrat('00000000-0000-0000-0000-00000000b290') like '%Formule : — – — – — – le — de chaque mois – début —.%', 'les informations manquantes s''affichent « — »');
reset role;

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a290"}', false);
select test.verifier((public.mon_contrat_infos()->>'demande_adresse')::boolean and (public.mon_contrat_infos()->>'date_naissance') = '1990-04-12',
  'la cliente voit ce qu''on lui demande, et sa date de naissance déjà connue');
do $$ begin
  perform public.accepter_contrat('v-var', true, true, '', '1990-04-12');
  raise exception 'ÉCHEC : contrat accepté sans adresse';
exception when check_violation then perform test.verifier(true, 'l''adresse est obligatoire si le contrat l''utilise'); end $$;
do $$ begin
  perform public.accepter_contrat('v-var', true, true, '12 rue des Lilas, 75000 Paris', null);
  raise exception 'ÉCHEC : contrat accepté sans date de naissance';
exception when check_violation then perform test.verifier(true, 'la date de naissance est obligatoire si le contrat l''utilise'); end $$;
select test.verifier(public.accepter_contrat('v-var', true, true, '12 rue des Lilas, 75000 Paris', '1990-04-12'), 'la cliente accepte le contrat rempli');
select test.verifier((select texte like 'Cliente : Alice Durand (a29@test.fr), née le 12/04/1990, 12 rue des Lilas, 75000 Paris. Formule : Nutrition + Sport – 3 mois – 750 € – Échelonné (en 3 fois) – le 5 de chaque mois – début 01/12/2026. Acceptée le %'
  and adresse = '12 rue des Lilas, 75000 Paris' from public.acceptations_contrat), 'la preuve garde le texte rempli, exactement tel qu''elle l''a lu');
do $$ begin
  perform public.rendre_contrat('{{email}}', '00000000-0000-0000-0000-00000000b290', null, null, now());
  raise exception 'ÉCHEC : une cliente a pu remplir le contrat d''une autre';
exception when insufficient_privilege then perform test.verifier(true, 'une cliente ne peut pas lire les informations d''une autre via le contrat'); end $$;
select test.verifier(public.apercu_contrat('00000000-0000-0000-0000-00000000b290') is null, 'l''aperçu coach est réservé à la coach');
reset role;

-- Accès fermé : plus d'aperçu.
update public.clientes set statut = 'fermee' where id = '00000000-0000-0000-0000-00000000b290';
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000b290"}', false);
select test.verifier(public.mon_contrat_apercu() is null and public.mon_contrat_infos() is null, 'accès fermé : plus de contrat visible');
reset role;
select set_config('request.jwt.claims', '', false);
update public.reglages set contrat_texte = null, contrat_version = null, contrat_case_renonciation = null, contrat_depuis = null where id = true;
