-- Tests : journal quotidien.
\set ON_ERROR_STOP on

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000cd', 'coach13@test.fr', '{}'),
  ('00000000-0000-0000-0000-0000000000ad', 'a13@test.fr', '{"prenom":"Aude"}'),
  ('00000000-0000-0000-0000-0000000000bd', 'b13@test.fr', '{"prenom":"Bérangère"}'),
  ('00000000-0000-0000-0000-0000000000fd', 'f13@test.fr', '{"prenom":"Fiona"}');
select public.definir_coach('coach13@test.fr');
insert into public.clientes (id, statut) values
  ('00000000-0000-0000-0000-0000000000ad', 'active'),
  ('00000000-0000-0000-0000-0000000000bd', 'active'),
  ('00000000-0000-0000-0000-0000000000fd', 'fermee');

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000ad"}', false);
insert into public.journal_quotidien (cliente_id, jour, poids, sommeil, stress, regles)
  values ('00000000-0000-0000-0000-0000000000ad', current_date - 1, 61.2, 7.5, 2, true);
update public.journal_quotidien set pas = 8500 where jour = current_date - 1;
select test.verifier((select pas from public.journal_quotidien) = 8500, 'A remplit et corrige son journal');
do $$ begin
  insert into public.journal_quotidien (cliente_id, jour) values ('00000000-0000-0000-0000-0000000000bd', current_date);
  raise exception 'ÉCHEC : A écrit dans le journal de B';
exception when insufficient_privilege then perform test.verifier(true, 'A ne peut pas écrire dans le journal de B'); end $$;
do $$ begin
  insert into public.journal_quotidien (cliente_id, jour) values ('00000000-0000-0000-0000-0000000000ad', current_date + 3);
  raise exception 'ÉCHEC : jour futur';
exception when insufficient_privilege then perform test.verifier(true, 'pas de saisie dans le futur'); end $$;
do $$ begin
  insert into public.journal_quotidien (cliente_id, jour, stress) values ('00000000-0000-0000-0000-0000000000ad', current_date - 2, 9);
  raise exception 'ÉCHEC : stress 9';
exception when check_violation then perform test.verifier(true, 'stress et digestion de 1 à 5'); end $$;
reset role;

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000bd"}', false);
select test.verifier((select count(*) from public.journal_quotidien) = 0, 'B ne voit pas le journal de A');
reset role;

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000fd"}', false);
do $$ begin
  insert into public.journal_quotidien (cliente_id, jour) values ('00000000-0000-0000-0000-0000000000fd', current_date);
  raise exception 'ÉCHEC : cliente fermée';
exception when insufficient_privilege then perform test.verifier(true, 'accès fermé : plus de saisie'); end $$;
reset role;

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000cd"}', false);
select test.verifier((select count(*) from public.journal_quotidien) = 1, 'la coach voit le journal de ses clientes');
select test.verifier((select journal_actif from public.clientes where id = '00000000-0000-0000-0000-0000000000ad'), 'journal activé par défaut');
reset role;
