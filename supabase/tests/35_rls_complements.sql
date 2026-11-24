-- Tests : compléments — chaque cliente ne voit et ne coche que les siens.
\set ON_ERROR_STOP on

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000c350', 'coach35@test.fr', '{}'),
  ('00000000-0000-0000-0000-00000000a350', 'a35@test.fr', '{"prenom":"Amélie"}'),
  ('00000000-0000-0000-0000-00000000b350', 'b35@test.fr', '{"prenom":"Brune"}');
select public.definir_coach('coach35@test.fr');
insert into public.clientes (id, statut) values
  ('00000000-0000-0000-0000-00000000a350', 'active'),
  ('00000000-0000-0000-0000-00000000b350', 'active');

-- La coach saisit les compléments.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c350"}', false);
insert into public.complements (id, cliente_id, nom, moment, quantite) values
  ('35000000-0000-4000-8000-00000000000a', '00000000-0000-0000-0000-00000000a350', 'Magnésium', 'soir', '2 gélules'),
  ('35000000-0000-4000-8000-00000000000b', '00000000-0000-0000-0000-00000000b350', 'Vitamine D', 'matin', '1 goutte');
select test.verifier((select count(*) from public.complements) = 2, 'la coach saisit les compléments de ses clientes');
reset role;

-- A voit les siens, pas ceux de B, et ne peut pas en ajouter.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a350"}', false);
select test.verifier((select count(*) from public.complements) = 1 and (select nom from public.complements) = 'Magnésium', 'A ne voit que ses compléments');
do $$ begin
  insert into public.complements (cliente_id, nom, quantite) values ('00000000-0000-0000-0000-00000000a350', 'Auto-prescrit', '10');
  raise exception 'ÉCHEC : une cliente a ajouté un complément';
exception when insufficient_privilege then perform test.verifier(true, 'seule la coach ajoute des compléments'); end $$;
-- A coche le sien.
insert into public.complements_pris (complement_id, jour) values ('35000000-0000-4000-8000-00000000000a', current_date);
select test.verifier((select count(*) from public.complements_pris) = 1, 'A coche son complément du jour');
do $$ begin
  insert into public.complements_pris (complement_id, jour) values ('35000000-0000-4000-8000-00000000000b', current_date);
  raise exception 'ÉCHEC : A a coché le complément de B';
exception when insufficient_privilege then perform test.verifier(true, 'A ne peut pas cocher le complément de B'); end $$;
do $$ begin
  insert into public.complements_pris (complement_id, jour) values ('35000000-0000-4000-8000-00000000000a', current_date + 5);
  raise exception 'ÉCHEC : coché dans le futur';
exception when insufficient_privilege then perform test.verifier(true, 'pas de case cochée dans le futur'); end $$;
reset role;

-- B ne voit pas ce que A a coché.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000b350"}', false);
select test.verifier((select count(*) from public.complements_pris) = 0, 'B ne voit pas ce que A a pris');
delete from public.complements_pris;
reset role;
select test.verifier((select count(*) from public.complements_pris) = 1, 'B ne peut pas décocher pour A');

-- Rappel : chacune règle le sien.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a350"}', false);
select public.definir_rappel_complements('08:00');
reset role;
select test.verifier((select rappel_complements_heure from public.clientes where id = '00000000-0000-0000-0000-00000000a350') = '08:00', 'A active son rappel à 8 h');
select test.verifier((select rappel_complements_heure from public.clientes where id = '00000000-0000-0000-0000-00000000b350') is null, 'le rappel est coupé par défaut');

-- Accès fermé : plus rien de visible, plus rien à cocher.
update public.clientes set statut = 'fermee' where id = '00000000-0000-0000-0000-00000000a350';
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a350"}', false);
select test.verifier((select count(*) from public.complements) = 0 and (select count(*) from public.complements_pris) = 0, 'accès fermé : plus rien de visible');
do $$ begin
  insert into public.complements_pris (complement_id, jour) values ('35000000-0000-4000-8000-00000000000a', current_date - 1);
  raise exception 'ÉCHEC : une cliente fermée a coché';
exception when insufficient_privilege then perform test.verifier(true, 'accès fermé : plus rien à cocher'); end $$;
reset role;
select set_config('request.jwt.claims', '', false);
