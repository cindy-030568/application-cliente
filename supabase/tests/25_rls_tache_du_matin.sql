-- Tests : tâche du matin (un seul passage par jour, réservée au serveur, lisible par la coach seule).
\set ON_ERROR_STOP on
grant usage on schema test to service_role;
grant execute on function test.verifier(boolean, text) to service_role;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000c250', 'coach25@test.fr', '{}'),
  ('00000000-0000-0000-0000-00000000a250', 'a25@test.fr', '{"prenom":"Alix"}'),
  ('00000000-0000-0000-0000-00000000b250', 'b25@test.fr', '{"prenom":"Bérénice"}');
select public.definir_coach('coach25@test.fr');
insert into public.clientes (id, statut) values
  ('00000000-0000-0000-0000-00000000a250', 'active'),
  ('00000000-0000-0000-0000-00000000b250', 'fermee');

-- Le serveur (clé secrète) réserve la tâche : une seule fois par jour.
set role service_role;
select test.verifier(public.reserver_tache_du_matin('2026-11-23', 'supabase'), '1er passage du jour : la tâche est lancée');
select test.verifier(not public.reserver_tache_du_matin('2026-11-23', 'hebergeur'), '2e passage le même jour (Vercel/Netlify) : rien ne repart');
select public.terminer_tache_du_matin('2026-11-23', 'ok', '{"rappels": 2}');
select test.verifier(not public.reserver_tache_du_matin('2026-11-23', 'hebergeur'), 'tâche terminée : rien ne repart');
select test.verifier((select source = 'supabase' and statut = 'ok' and compteurs->>'rappels' = '2' from public.taches_du_matin where jour = '2026-11-23'), 'le passage est noté (source, statut, compteurs)');
-- Un passage en échec peut être relancé par le suivant.
select test.verifier(public.reserver_tache_du_matin('2026-11-24', 'supabase'), 'nouveau jour : la tâche est lancée');
select public.terminer_tache_du_matin('2026-11-24', 'echec', null);
select test.verifier(public.reserver_tache_du_matin('2026-11-24', 'hebergeur'), 'après un échec, le passage suivant relance la tâche');
-- Une tâche restée « en cours » plus de 30 minutes (plantage) peut être relancée.
update public.taches_du_matin set debut_le = now() - interval '31 minutes' where jour = '2026-11-24';
select test.verifier(public.reserver_tache_du_matin('2026-11-24', 'supabase'), 'tâche bloquée depuis 30 min : relancée');
reset role;

-- La coach lit l'historique, sans pouvoir l'écrire ni lancer la tâche.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c250"}', false);
select test.verifier((select count(*) from public.taches_du_matin) = 2, 'la coach voit les passages de la tâche');
do $$ begin
  perform public.reserver_tache_du_matin('2026-11-25', 'supabase');
  raise exception 'ÉCHEC : la coach a pu réserver la tâche';
exception when insufficient_privilege then perform test.verifier(true, 'seul le serveur peut lancer la tâche'); end $$;
do $$ begin
  insert into public.taches_du_matin (jour, source) values ('2026-11-26', 'supabase');
  raise exception 'ÉCHEC : la coach a écrit directement dans la table';
exception when insufficient_privilege then perform test.verifier(true, 'personne n''écrit dans la table sans passer par le serveur'); end $$;
reset role;
select set_config('request.jwt.claims', '', false);

-- Une cliente (active ou à l'accès fermé) ne voit rien.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a250"}', false);
select test.verifier((select count(*) from public.taches_du_matin) = 0, 'une cliente ne voit pas la tâche du matin');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000b250"}', false);
select test.verifier((select count(*) from public.taches_du_matin) = 0, 'une cliente à l''accès fermé ne voit rien');
do $$ begin
  perform public.terminer_tache_du_matin('2026-11-23', 'echec', null);
  raise exception 'ÉCHEC : une cliente a pu modifier la tâche';
exception when insufficient_privilege then perform test.verifier(true, 'une cliente ne peut pas modifier la tâche'); end $$;
reset role;
select set_config('request.jwt.claims', '', false);
