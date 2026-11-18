-- Tests : revenus hors échéancier.
\set ON_ERROR_STOP on

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000c170', 'coach17@test.fr', '{}'),
  ('00000000-0000-0000-0000-00000000a170', 'a17@test.fr', '{"prenom":"Alba"}');
select public.definir_coach('coach17@test.fr');
insert into public.clientes (id, statut) values ('00000000-0000-0000-0000-00000000a170', 'active');

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c170"}', false);
insert into public.revenus_divers (date_revenu, libelle, montant, moyen) values (current_date, 'Atelier batch cooking', 45, 'carte');
do $$ begin
  insert into public.revenus_divers (date_revenu, libelle, montant) values (current_date, 'Gratuit', 0);
  raise exception 'ÉCHEC : montant nul';
exception when check_violation then perform test.verifier(true, 'un revenu a un montant positif'); end $$;
insert into public.echeances_paiement (cliente_id, date_echeance, montant, note)
  values ('00000000-0000-0000-0000-00000000a170', current_date, 120, 'virement attendu');
select test.verifier((select count(*) from public.revenus_divers) = 1, 'la coach enregistre un revenu');
select test.verifier((select note from public.echeances_paiement where cliente_id = '00000000-0000-0000-0000-00000000a170') = 'virement attendu', 'note sur une échéance');
reset role;

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a170"}', false);
select test.verifier((select count(*) from public.revenus_divers) = 0, 'une cliente ne voit pas les revenus');
do $$ begin
  insert into public.revenus_divers (date_revenu, libelle, montant) values (current_date, 'x', 10);
  raise exception 'ÉCHEC : une cliente écrit un revenu';
exception when insufficient_privilege then perform test.verifier(true, 'une cliente ne peut pas écrire de revenu'); end $$;
reset role;
