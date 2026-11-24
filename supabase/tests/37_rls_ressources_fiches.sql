-- Tests : fiches et brouillons de ressources — un brouillon n'est jamais visible par une cliente.
\set ON_ERROR_STOP on

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000c370', 'coach37@test.fr', '{}'),
  ('00000000-0000-0000-0000-00000000a370', 'a37@test.fr', '{"prenom":"Adèle"}'),
  ('00000000-0000-0000-0000-00000000b370', 'b37@test.fr', '{"prenom":"Brigitte"}');
select public.definir_coach('coach37@test.fr');
insert into public.clientes (id, statut) values
  ('00000000-0000-0000-0000-00000000a370', 'active'),
  ('00000000-0000-0000-0000-00000000b370', 'active');

select test.verifier((select not publiee and contenu like '%Au restaurant%' from public.ressources where titre = 'Je mange dehors'), 'la fiche « Je mange dehors » est proposée en brouillon');

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c370"}', false);
insert into public.ressources (id, titre, contenu, publiee, visibilite) values
  ('37000000-0000-4000-8000-000000000001', 'Fiche pour A', 'Contenu pour A', true, 'certaines'),
  ('37000000-0000-4000-8000-000000000002', 'Brouillon', 'Pas prêt', false, 'toutes');
insert into public.ressources_clientes (ressource_id, cliente_id) values ('37000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-00000000a370');
do $$ begin
  insert into public.ressources (titre, visibilite) values ('Ni lien ni contenu', 'toutes');
  raise exception 'ÉCHEC : ressource vide acceptée';
exception when check_violation then perform test.verifier(true, 'une ressource a toujours un lien ou un contenu'); end $$;
select test.verifier((select count(*) from public.ressources where not publiee) = 2, 'la coach voit ses brouillons');
reset role;

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a370"}', false);
select test.verifier((select count(*) from public.ressources where id = '37000000-0000-4000-8000-000000000001') = 1, 'A voit la fiche publiée pour elle');
select test.verifier((select count(*) from public.ressources where not publiee) = 0, 'A ne voit aucun brouillon');
update public.ressources set publiee = true where titre = 'Brouillon';
reset role;
select test.verifier((select not publiee from public.ressources where titre = 'Brouillon'), 'une cliente ne peut pas publier un brouillon');

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000b370"}', false);
select test.verifier((select count(*) from public.ressources where id = '37000000-0000-4000-8000-000000000001') = 0, 'B ne voit pas la fiche réservée à A');
reset role;

update public.clientes set statut = 'fermee' where id = '00000000-0000-0000-0000-00000000a370';
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a370"}', false);
select test.verifier((select count(*) from public.ressources) = 0, 'accès fermé : plus aucune ressource visible');
reset role;
select set_config('request.jwt.claims', '', false);
