-- Tests : cycle et périménopause — données de santé visibles seulement par la cliente et la coach.
\set ON_ERROR_STOP on

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000c340', 'coach34@test.fr', '{}'),
  ('00000000-0000-0000-0000-00000000a340', 'a34@test.fr', '{"prenom":"Alix"}'),
  ('00000000-0000-0000-0000-00000000b340', 'b34@test.fr', '{"prenom":"Bettina"}');
select public.definir_coach('coach34@test.fr');
insert into public.clientes (id, statut) values
  ('00000000-0000-0000-0000-00000000a340', 'active'),
  ('00000000-0000-0000-0000-00000000b340', 'active');

-- Choix de la cliente : seulement pour elle-même, et seulement des valeurs prévues.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a340"}', false);
select public.definir_suivi_cycle('perimenopause', 28::smallint);
do $$ begin
  perform public.definir_suivi_cycle('n_importe_quoi', 28::smallint);
  raise exception 'ÉCHEC : mode inconnu accepté';
exception when check_violation then perform test.verifier(true, 'un mode de suivi inconnu est refusé'); end $$;
reset role;
select test.verifier((select suivi_cycle from public.clientes where id = '00000000-0000-0000-0000-00000000a340') = 'perimenopause', 'A choisit le suivi de la périménopause');
select test.verifier((select suivi_cycle from public.clientes where id = '00000000-0000-0000-0000-00000000b340') = 'aucun', 'B n''est pas touchée (rien par défaut)');

-- Symptômes du jour : A note les siens.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a340"}', false);
insert into public.journal_quotidien (cliente_id, jour, symptomes) values ('00000000-0000-0000-0000-00000000a340', current_date - 1, array['bouffees', 'sueurs']);
select test.verifier((select symptomes from public.journal_quotidien) = array['bouffees', 'sueurs'], 'A note ses symptômes');
do $$ begin
  insert into public.journal_quotidien (cliente_id, jour, symptomes) values ('00000000-0000-0000-0000-00000000a340', current_date - 2, array['inconnu']);
  raise exception 'ÉCHEC : symptôme inconnu accepté';
exception when check_violation then perform test.verifier(true, 'un symptôme hors de la liste est refusé'); end $$;
reset role;

-- B ne voit pas les symptômes de A.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000b340"}', false);
select test.verifier((select count(*) from public.journal_quotidien) = 0, 'B ne voit jamais le journal ni les symptômes de A');
update public.journal_quotidien set symptomes = '{}' where cliente_id = '00000000-0000-0000-0000-00000000a340';
reset role;
select test.verifier((select symptomes from public.journal_quotidien where cliente_id = '00000000-0000-0000-0000-00000000a340') = array['bouffees', 'sueurs'], 'B ne peut pas modifier les symptômes de A');

-- La coach voit tout.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c340"}', false);
select test.verifier((select count(*) from public.journal_quotidien where cliente_id = '00000000-0000-0000-0000-00000000a340') = 1, 'la coach voit les symptômes de sa cliente');
reset role;

-- Accès fermé : plus rien de visible, plus de réglage possible.
update public.clientes set statut = 'fermee' where id = '00000000-0000-0000-0000-00000000a340';
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a340"}', false);
select test.verifier((select count(*) from public.journal_quotidien) = 0, 'accès fermé : son journal (et ses symptômes) ne sont plus visibles');
select public.definir_suivi_cycle('cycle', 30::smallint);
delete from public.journal_quotidien;
reset role;
select test.verifier((select suivi_cycle from public.clientes where id = '00000000-0000-0000-0000-00000000a340') = 'perimenopause', 'accès fermé : le réglage ne change plus');
select test.verifier((select count(*) from public.journal_quotidien where cliente_id = '00000000-0000-0000-0000-00000000a340') = 1, 'accès fermé : elle ne peut plus rien effacer');
select set_config('request.jwt.claims', '', false);
