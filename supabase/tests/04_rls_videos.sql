-- Tests de sécurité de la phase 4 : vidéos.
\set ON_ERROR_STOP on

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000c4', 'coach4@test.fr', '{}'),
  ('00000000-0000-0000-0000-0000000000a4', 'a4@test.fr', '{"prenom":"Alix"}'),
  ('00000000-0000-0000-0000-0000000000f4', 'f4@test.fr', '{"prenom":"Flore"}');
select public.definir_coach('coach4@test.fr');
insert into public.clientes (id, statut) values
  ('00000000-0000-0000-0000-0000000000a4', 'active'),
  ('00000000-0000-0000-0000-0000000000f4', 'fermee');

insert into public.videos (id, titre, youtube_id, publiee) values
  ('00000000-0000-0000-0000-00000000e401', 'Hip thrust', 'dQw4w9WgXcQ', true),
  ('00000000-0000-0000-0000-00000000e402', 'Brouillon', 'aaaaaaaaaaa', false);
insert into public.videos_filtres (video_id, filtre_id)
  select '00000000-0000-0000-0000-00000000e401', id from public.filtres_video where nom = 'Fessiers';

select test.verifier((select count(*) from public.filtres_video) = 26, 'les 26 filtres de départ existent');
do $$ begin
  insert into public.videos (titre, youtube_id) values ('x', 'pas-un-id');
  raise exception 'ÉCHEC : identifiant YouTube invalide accepté';
exception when check_violation then perform test.verifier(true, 'un identifiant YouTube invalide est refusé'); end $$;

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a4"}', false);
select test.verifier((select count(*) from public.videos) = 1, 'A ne voit que les vidéos publiées');
select test.verifier((select count(*) from public.videos_filtres) = 1, 'A voit les filtres des vidéos');
do $$ declare n int; begin
  update public.videos set titre = 'piratage';
  get diagnostics n = row_count;
  perform test.verifier(n = 0, 'A ne peut pas modifier une vidéo');
end $$;
do $$ begin
  insert into public.videos (titre, youtube_id) values ('pirate', 'bbbbbbbbbbb');
  raise exception 'ÉCHEC : A a ajouté une vidéo';
exception when insufficient_privilege then perform test.verifier(true, 'A ne peut pas ajouter de vidéo'); end $$;
reset role;

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f4"}', false);
select test.verifier((select count(*) from public.videos) = 0, 'F (fermée) ne voit plus les vidéos');
reset role;

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c4"}', false);
select test.verifier((select count(*) from public.videos) = 2, 'la coach voit aussi les brouillons');
insert into public.filtres_video (famille, nom, ordre) values ('materiel', 'TRX', 9);
select test.verifier(true, 'la coach peut ajouter un filtre');
reset role;
