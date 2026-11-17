-- Tests : programme sportif.
\set ON_ERROR_STOP on

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000c160', 'coach16@test.fr', '{}'),
  ('00000000-0000-0000-0000-00000000a160', 'a16@test.fr', '{"prenom":"Anaïs"}'),
  ('00000000-0000-0000-0000-00000000b160', 'b16@test.fr', '{"prenom":"Bleuenn"}'),
  ('00000000-0000-0000-0000-00000000f160', 'f16@test.fr', '{"prenom":"Flore"}');
select public.definir_coach('coach16@test.fr');
insert into public.clientes (id, statut) values
  ('00000000-0000-0000-0000-00000000a160', 'active'),
  ('00000000-0000-0000-0000-00000000b160', 'active'),
  ('00000000-0000-0000-0000-00000000f160', 'fermee');

-- La coach prépare deux programmes pour A, un pour B et pour F.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c160"}', false);
insert into public.programmes_sportifs (id, cliente_id, titre) values
  ('16000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000a160', 'Prog 1'),
  ('16000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000a160', 'Prog 2'),
  ('16000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-00000000b160', 'Prog B'),
  ('16000000-0000-0000-0000-00000000000f', '00000000-0000-0000-0000-00000000f160', 'Prog F');
select public.publier_programme_sportif('16000000-0000-0000-0000-00000000000a', true);
select public.publier_programme_sportif('16000000-0000-0000-0000-00000000000b', true);
select public.publier_programme_sportif('16000000-0000-0000-0000-00000000000f', true);
select test.verifier(
  (select count(*) from public.programmes_sportifs where cliente_id = '00000000-0000-0000-0000-00000000a160' and publie) = 1
  and (select publie from public.programmes_sportifs where id = '16000000-0000-0000-0000-00000000000b'),
  'publier un programme dépublie le précédent');
reset role;

-- A voit son programme publié seulement, pas le programme de B.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a160"}', false);
select test.verifier((select count(*) from public.programmes_sportifs) = 1, 'A ne voit que son programme publié');
select test.verifier((select titre from public.programmes_sportifs) = 'Prog 2', 'A voit le dernier programme publié');
update public.programmes_sportifs set titre = 'Piraté';
select test.verifier((select titre from public.programmes_sportifs) = 'Prog 2', 'A ne peut pas modifier son programme');
do $$ begin
  perform public.publier_programme_sportif('16000000-0000-0000-0000-00000000000c', true);
  raise exception 'ÉCHEC : A publie un programme';
exception when insufficient_privilege then perform test.verifier(true, 'A ne peut pas publier de programme'); end $$;
select public.programme_sportif_vu('16000000-0000-0000-0000-00000000000b');
select public.programme_sportif_vu('16000000-0000-0000-0000-00000000000c');
reset role;
select test.verifier((select vu_le is not null from public.programmes_sportifs where id = '16000000-0000-0000-0000-00000000000b'), 'A note qu’elle a vu son programme');
select test.verifier((select vu_le is null from public.programmes_sportifs where id = '16000000-0000-0000-0000-00000000000c'), 'A ne peut pas marquer le programme de B');

-- B : son programme n'est pas publié.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000b160"}', false);
select test.verifier((select count(*) from public.programmes_sportifs) = 0, 'B ne voit pas un programme en brouillon');
reset role;

-- F : accès fermé.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000f160"}', false);
select test.verifier((select count(*) from public.programmes_sportifs) = 0, 'accès fermé : plus de programme visible');
reset role;

-- La coach voit tout.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c160"}', false);
select test.verifier((select count(*) from public.programmes_sportifs) = 4, 'la coach voit tous les programmes');
reset role;
