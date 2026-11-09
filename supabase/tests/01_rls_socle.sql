-- Tests de sécurité (RLS) de la phase 1.
-- Chaque test lève une erreur s'il échoue.
\set ON_ERROR_STOP on

create schema if not exists test;
grant usage on schema test to anon, authenticated;
create or replace function test.verifier(condition boolean, message text) returns void
language plpgsql as $$
begin
  if not coalesce(condition, false) then raise exception 'ÉCHEC : %', message; end if;
  raise notice 'OK : %', message;
end $$;
grant execute on function test.verifier(boolean, text) to anon, authenticated;

-- Jeu de données : 1 coach, 2 clientes (A active, B fermée)
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000c0ac', 'coach@test.fr', '{}'),
  ('00000000-0000-0000-0000-00000000000a', 'a@test.fr', '{"prenom":"Alice","nom":"A"}'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.fr', '{"prenom":"Béa","nom":"B"}');
select public.definir_coach('coach@test.fr');
insert into public.clientes (id, statut) values
  ('00000000-0000-0000-0000-00000000000a', 'active'),
  ('00000000-0000-0000-0000-00000000000b', 'fermee');
insert into public.notes_coach (cliente_id, contenu) values
  ('00000000-0000-0000-0000-00000000000a', 'Note privée sur A');

select test.verifier((select prenom from public.profils where id = '00000000-0000-0000-0000-00000000000a') = 'Alice',
  'le profil est créé automatiquement avec le prénom');
select test.verifier((select role from public.profils where id = '00000000-0000-0000-0000-00000000c0ac') = 'coach',
  'definir_coach donne le rôle coach');

-- ===================== Cliente A =====================
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a"}', false);

select test.verifier((select count(*) from public.profils) = 1, 'A ne voit que son propre profil');
select test.verifier((select count(*) from public.clientes) = 1, 'A ne voit que sa propre fiche cliente');
select test.verifier(not exists (select 1 from public.clientes where id = '00000000-0000-0000-0000-00000000000b'),
  'A ne voit pas la fiche de B');
select test.verifier((select count(*) from public.notes_coach) = 0, 'A ne voit pas les notes privées');
select test.verifier(public.est_coach() = false, 'A n''est pas coach');
select test.verifier(public.acces_ouvert() = true, 'A (active) a un accès ouvert');

do $$ declare n int; begin
  update public.profils set role = 'coach' where id = '00000000-0000-0000-0000-00000000000a';
  get diagnostics n = row_count;
  perform test.verifier(n = 0, 'A ne peut pas se donner le rôle coach');
  update public.clientes set statut = 'active', acces_formation = true where id = '00000000-0000-0000-0000-00000000000a';
  get diagnostics n = row_count;
  perform test.verifier(n = 0, 'A ne peut pas modifier sa fiche (accès formation, statut)');
  delete from public.clientes where id = '00000000-0000-0000-0000-00000000000a';
  get diagnostics n = row_count;
  perform test.verifier(n = 0, 'A ne peut pas supprimer sa fiche');
end $$;

do $$ begin
  insert into public.notes_coach (cliente_id, contenu) values ('00000000-0000-0000-0000-00000000000a', 'piratage');
  raise exception 'ÉCHEC : A a pu écrire une note coach';
exception when insufficient_privilege then
  perform test.verifier(true, 'A ne peut pas écrire de note coach');
end $$;

do $$ begin
  insert into public.consentements (cliente_id, version) values ('00000000-0000-0000-0000-00000000000b', 'v1');
  raise exception 'ÉCHEC : A a pu consentir à la place de B';
exception when insufficient_privilege then
  perform test.verifier(true, 'A ne peut pas consentir à la place de B');
end $$;

insert into public.consentements (cliente_id, version) values ('00000000-0000-0000-0000-00000000000a', 'v1');
select test.verifier((select count(*) from public.consentements) = 1, 'A peut enregistrer son propre consentement');

do $$ declare n int; begin
  update public.reglages set lien_formation = 'https://pirate.example';
  get diagnostics n = row_count;
  perform test.verifier(n = 0, 'A ne peut pas modifier les réglages');
end $$;
select test.verifier((select count(*) from public.reglages) = 1, 'A peut lire les réglages');

do $$ begin
  perform public.definir_coach('a@test.fr');
  raise exception 'ÉCHEC : A a pu appeler definir_coach';
exception when insufficient_privilege then
  perform test.verifier(true, 'A ne peut pas appeler definir_coach');
end $$;

reset role;

-- ===================== Cliente B (accès fermé) =====================
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b"}', false);
select test.verifier(public.acces_ouvert() = false, 'B (fermée) n''a plus d''accès ouvert');
select test.verifier((select count(*) from public.consentements) = 0, 'B ne voit pas le consentement de A');
reset role;

-- ===================== Coach =====================
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c0ac"}', false);
select test.verifier(public.est_coach(), 'la coach est reconnue');
select test.verifier((select count(*) from public.clientes) = 2, 'la coach voit toutes les clientes');
select test.verifier((select count(*) from public.notes_coach) = 1, 'la coach voit ses notes');
select test.verifier((select count(*) from public.consentements) = 1, 'la coach voit les consentements');
do $$ declare n int; begin
  update public.clientes set acces_formation = true where id = '00000000-0000-0000-0000-00000000000a';
  get diagnostics n = row_count;
  perform test.verifier(n = 1, 'la coach peut modifier une fiche cliente');
  update public.reglages set lien_formation = 'https://notion.so/academy';
  get diagnostics n = row_count;
  perform test.verifier(n = 1, 'la coach peut modifier les réglages');
end $$;
reset role;

-- ===================== Visiteur non connecté =====================
set role anon;
select set_config('request.jwt.claims', '', false);
do $$ begin
  perform 1 from public.profils;
  raise exception 'ÉCHEC : un visiteur a pu lire les profils';
exception when insufficient_privilege then
  perform test.verifier(true, 'un visiteur non connecté ne peut rien lire');
end $$;
reset role;

-- Suppression d'un compte => tout disparaît en cascade
delete from auth.users where id = '00000000-0000-0000-0000-00000000000a';
select test.verifier(not exists (select 1 from public.clientes where id = '00000000-0000-0000-0000-00000000000a')
  and not exists (select 1 from public.notes_coach where cliente_id = '00000000-0000-0000-0000-00000000000a')
  and not exists (select 1 from public.consentements where cliente_id = '00000000-0000-0000-0000-00000000000a'),
  'supprimer un compte efface sa fiche, ses notes et ses consentements');
