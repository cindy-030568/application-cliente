-- Tests de sécurité de la phase 7 : liste de courses (strictement privée).
\set ON_ERROR_STOP on

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000c7', 'coach7@test.fr', '{}'),
  ('00000000-0000-0000-0000-0000000000a7', 'a7@test.fr', '{"prenom":"Alba"}'),
  ('00000000-0000-0000-0000-0000000000b7', 'b7@test.fr', '{"prenom":"Berthe"}'),
  ('00000000-0000-0000-0000-0000000000f7', 'f7@test.fr', '{"prenom":"Flore"}');
select public.definir_coach('coach7@test.fr');
insert into public.clientes (id, statut) values
  ('00000000-0000-0000-0000-0000000000a7', 'active'),
  ('00000000-0000-0000-0000-0000000000b7', 'terminee'),
  ('00000000-0000-0000-0000-0000000000f7', 'fermee');
insert into public.courses (cliente_id, nom) values ('00000000-0000-0000-0000-0000000000f7', 'Pain');

-- ===================== Cliente A =====================
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a7"}', false);
insert into public.courses (nom, rayon, quantite, unite) values ('Poulet', 'Viandes', 240, 'g');
insert into public.courses (nom) values ('Éponges');
select test.verifier((select count(*) from public.courses) = 2, 'A ajoute des articles et ne voit que les siens');
select test.verifier((select cliente_id from public.courses limit 1) = '00000000-0000-0000-0000-0000000000a7',
  'un article est rattaché automatiquement à la cliente connectée');
update public.courses set coche = true where nom = 'Poulet';
select test.verifier((select coche from public.courses where nom = 'Poulet'), 'A peut cocher un article');
do $$ begin
  insert into public.courses (cliente_id, nom) values ('00000000-0000-0000-0000-0000000000b7', 'Intrus');
  raise exception 'ÉCHEC : A a écrit dans la liste de B';
exception when insufficient_privilege then perform test.verifier(true, 'A ne peut pas écrire dans la liste de B'); end $$;
do $$ begin
  insert into public.courses (nom, quantite) values ('Sans unité', 10);
  raise exception 'ÉCHEC : quantité sans unité';
exception when check_violation then perform test.verifier(true, 'une quantité doit avoir une unité'); end $$;
do $$ declare n int; begin
  update public.courses set cliente_id = '00000000-0000-0000-0000-0000000000b7';
  raise exception 'ÉCHEC : A a donné ses articles à B';
exception when insufficient_privilege then perform test.verifier(true, 'A ne peut pas transférer ses articles à B'); end $$;
reset role;

-- ===================== Cliente B (suivi terminé : accès ouvert) =====================
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b7"}', false);
select test.verifier((select count(*) from public.courses) = 0, 'B ne voit pas la liste de A');
do $$ declare n int; begin
  update public.courses set coche = false;
  get diagnostics n = row_count;
  perform test.verifier(n = 0, 'B ne peut pas modifier la liste de A');
  delete from public.courses;
  get diagnostics n = row_count;
  perform test.verifier(n = 0, 'B ne peut pas vider la liste de A');
end $$;
insert into public.courses (nom) values ('Tomates');
select test.verifier((select count(*) from public.courses) = 1, 'B (suivi terminé) garde sa liste de courses');
reset role;

-- ===================== Cliente F (fermée) =====================
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f7"}', false);
do $$ begin
  insert into public.courses (nom) values ('Lait');
  raise exception 'ÉCHEC : cliente fermée a ajouté un article';
exception when insufficient_privilege then perform test.verifier(true, 'F (fermée) ne peut plus rien ajouter'); end $$;
reset role;

-- ===================== Coach =====================
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c7"}', false);
select test.verifier((select count(*) from public.courses) = 0, 'la coach ne voit pas les listes de courses (vie privée)');
reset role;

-- ===================== Garde-fou =====================
do $$ begin
  insert into public.courses (cliente_id, nom)
    select '00000000-0000-0000-0000-0000000000a7', 'Article ' || g from generate_series(1, 400) g;
  raise exception 'ÉCHEC : plus de 300 articles';
exception when check_violation then perform test.verifier(true, 'une liste est limitée à 300 articles'); end $$;
