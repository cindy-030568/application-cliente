-- Tests : annonces et rappel du journal.
\set ON_ERROR_STOP on

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000ce', 'coach14@test.fr', '{}'),
  ('00000000-0000-0000-0000-0000000000ae', 'a14@test.fr', '{"prenom":"Anne"}'),
  ('00000000-0000-0000-0000-0000000000fe', 'f14@test.fr', '{"prenom":"Fanny"}');
select public.definir_coach('coach14@test.fr');
insert into public.clientes (id, statut) values
  ('00000000-0000-0000-0000-0000000000ae', 'active'),
  ('00000000-0000-0000-0000-0000000000fe', 'fermee');

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000ce"}', false);
insert into public.annonces (texte, lien) values ('Venez échanger dans la communauté 💬', '/communaute');
insert into public.annonces (texte, expire_le) values ('Vieille annonce', now() - interval '1 hour');
select test.verifier((select count(*) from public.annonces) = 2, 'la coach voit toutes ses annonces');
reset role;

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000ae"}', false);
select test.verifier((select count(*) from public.annonces) = 1, 'la cliente ne voit que l''annonce en cours (24 h)');
do $$ begin
  insert into public.annonces (texte) values ('Fausse annonce');
  raise exception 'ÉCHEC : cliente publie une annonce';
exception when insufficient_privilege then perform test.verifier(true, 'une cliente ne peut pas publier d''annonce'); end $$;
select test.verifier((select rappel_journal_heure from public.clientes) = '20:30', 'rappel du journal à 20 h 30 par défaut');
select public.definir_rappel_journal('07:15');
select test.verifier((select rappel_journal_heure from public.clientes) = '07:15', 'la cliente choisit l''heure de son rappel');
select public.definir_rappel_journal(null);
select test.verifier((select rappel_journal_heure from public.clientes) is null, 'la cliente peut couper son rappel');
reset role;

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000fe"}', false);
select test.verifier((select count(*) from public.annonces) = 0, 'accès fermé : pas d''annonce');
reset role;
