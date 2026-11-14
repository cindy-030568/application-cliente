-- Tests : la cliente voit son échéancier (sans la note), et seulement le sien.
\set ON_ERROR_STOP on

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000cb', 'coach11@test.fr', '{}'),
  ('00000000-0000-0000-0000-0000000000ab', 'a11@test.fr', '{"prenom":"Alix"}'),
  ('00000000-0000-0000-0000-0000000000bb', 'b11@test.fr', '{"prenom":"Bianca"}');
select public.definir_coach('coach11@test.fr');
insert into public.clientes (id, statut) values
  ('00000000-0000-0000-0000-0000000000ab', 'active'),
  ('00000000-0000-0000-0000-0000000000bb', 'active');
insert into public.paiements_clientes (cliente_id, formule, montant_total, moyen, nb_fois, note, premier_montant) values
  ('00000000-0000-0000-0000-0000000000ab', 'Coaching 3 mois', 450, 'virement', 3, 'note privée', 225);
insert into public.echeances_paiement (cliente_id, date_echeance, montant, payee_le) values
  ('00000000-0000-0000-0000-0000000000ab', '2026-09-07', 225, '2026-09-07'),
  ('00000000-0000-0000-0000-0000000000ab', '2026-10-07', 112.5, null),
  ('00000000-0000-0000-0000-0000000000ab', '2026-11-07', 112.5, null);

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000ab"}', false);
select test.verifier((public.mon_paiement() ->> 'formule') = 'Coaching 3 mois', 'A voit sa formule');
select test.verifier(json_array_length(public.mon_paiement() -> 'echeances') = 3, 'A voit ses 3 échéances');
select test.verifier((public.mon_paiement() -> 'echeances' -> 0 ->> 'payee')::boolean, 'A voit que la 1re est payée');
select test.verifier(public.mon_paiement()::text not like '%note privée%', 'A ne voit pas la note de la coach');
select test.verifier((select count(*) from public.echeances_paiement) = 0, 'les tables restent fermées à A');
reset role;

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000bb"}', false);
select test.verifier(public.mon_paiement() is null, 'B ne voit pas le paiement de A');
reset role;

update public.clientes set statut = 'fermee' where id = '00000000-0000-0000-0000-0000000000ab';
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000ab"}', false);
select test.verifier(public.mon_paiement() is null, 'accès fermé : plus rien de visible');
reset role;
