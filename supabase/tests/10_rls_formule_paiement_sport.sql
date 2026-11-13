-- Tests de sécurité : formule et paiement (coach seule), suivi sportif.
\set ON_ERROR_STOP on

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000ca', 'coach10@test.fr', '{}'),
  ('00000000-0000-0000-0000-0000000000aa', 'a10@test.fr', '{"prenom":"Amélie"}');
select public.definir_coach('coach10@test.fr');
insert into public.clientes (id, statut) values ('00000000-0000-0000-0000-0000000000aa', 'active');

-- ===================== Coach =====================
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000ca"}', false);
insert into public.paiements_clientes (cliente_id, formule, montant_total, moyen, nb_fois)
  values ('00000000-0000-0000-0000-0000000000aa', 'Coaching 3 mois', 450, 'virement', 3);
insert into public.echeances_paiement (cliente_id, date_echeance, montant) values
  ('00000000-0000-0000-0000-0000000000aa', '2026-09-07', 150),
  ('00000000-0000-0000-0000-0000000000aa', '2026-10-07', 150),
  ('00000000-0000-0000-0000-0000000000aa', '2026-11-07', 150);
update public.echeances_paiement set payee_le = '2026-09-07' where date_echeance = '2026-09-07';
select test.verifier((select count(*) from public.echeances_paiement where payee_le is null) = 2, 'la coach note un paiement reçu');
do $$ begin
  insert into public.paiements_clientes (cliente_id, moyen) values ('00000000-0000-0000-0000-0000000000aa', 'bitcoin');
  raise exception 'ÉCHEC : moyen libre';
exception when check_violation or unique_violation then perform test.verifier(true, 'seuls les moyens de paiement prévus sont acceptés'); end $$;
reset role;

-- ===================== Cliente : ne voit rien, ne modifie rien =====================
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000aa"}', false);
select test.verifier((select count(*) from public.paiements_clientes) = 0, 'la cliente ne voit pas sa formule ni son paiement');
select test.verifier((select suivi_sport from public.clientes), 'suivi sportif inclus par défaut, lisible par la cliente');
do $$ declare n int; begin
  update public.clientes set suivi_sport = false;
  get diagnostics n = row_count;
  perform test.verifier(n = 0, 'la cliente ne peut pas changer son suivi sportif');
end $$;
select test.verifier((select count(*) from public.echeances_paiement) = 0, 'la cliente ne voit pas son échéancier');
do $$ declare n int; begin
  update public.echeances_paiement set payee_le = current_date;
  get diagnostics n = row_count;
  perform test.verifier(n = 0, 'la cliente ne peut pas marquer une échéance payée');
end $$;
do $$ begin
  insert into public.echeances_paiement (cliente_id, date_echeance, montant) values ('00000000-0000-0000-0000-0000000000aa', '2026-12-01', 0);
  raise exception 'ÉCHEC : cliente ajoute une échéance';
exception when insufficient_privilege then perform test.verifier(true, 'la cliente ne peut pas ajouter d''échéance'); end $$;
reset role;

-- ===================== Anonyme =====================
set role anon;
do $$ begin
  perform count(*) from public.paiements_clientes;
  raise exception 'ÉCHEC : anonyme lit les paiements';
exception when insufficient_privilege then perform test.verifier(true, 'aucun accès sans connexion'); end $$;
reset role;

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000ca"}', false);
update public.clientes set suivi_sport = false where id = '00000000-0000-0000-0000-0000000000aa';
select test.verifier(not (select suivi_sport from public.clientes where id = '00000000-0000-0000-0000-0000000000aa'), 'la coach retire le suivi sportif');
reset role;

-- ===================== Suppression de la cliente =====================
delete from public.clientes where id = '00000000-0000-0000-0000-0000000000aa';
select test.verifier((select count(*) from public.echeances_paiement) = 0 and (select count(*) from public.paiements_clientes) = 0,
  'tout part avec la cliente');
