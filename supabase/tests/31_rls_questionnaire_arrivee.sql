-- Tests : questionnaire d'arrivée (réponses privées, exclusions et objectif pré-remplis, clientes en cours non concernées).
\set ON_ERROR_STOP on

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000c310', 'coach31@test.fr', '{}'),
  ('00000000-0000-0000-0000-00000000a310', 'a31@test.fr', '{"prenom":"Amandine"}'),
  ('00000000-0000-0000-0000-00000000b310', 'b31@test.fr', '{"prenom":"Bérangère"}'),
  ('00000000-0000-0000-0000-00000000d310', 'd31@test.fr', '{"prenom":"Delphine"}');
select public.definir_coach('coach31@test.fr');
insert into public.clientes (id, statut) values
  ('00000000-0000-0000-0000-00000000a310', 'active'),
  ('00000000-0000-0000-0000-00000000b310', 'active'),
  ('00000000-0000-0000-0000-00000000d310', 'active');
-- D était déjà en cours avant le questionnaire.
insert into public.consentements (cliente_id, version, accepte_le) values ('00000000-0000-0000-0000-00000000d310', 'v-ancienne', now() - interval '30 days');
insert into public.consentements (cliente_id, version) values ('00000000-0000-0000-0000-00000000a310', 'v31'), ('00000000-0000-0000-0000-00000000b310', 'v31');
insert into public.categories_aliment (id, nom) values ('00000000-0000-0000-0000-0000000ca310', 'Gluten test 31') on conflict do nothing;
select test.verifier((select count(*) from public.questions_arrivee where actif) >= 10, 'les questions de départ sont là');

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a310"}', false);
select test.verifier(public.questionnaire_a_remplir(), 'une nouvelle cliente doit remplir le questionnaire');
select test.verifier((select count(*) from public.questions_arrivee) >= 10, 'elle voit les questions');
do $$ begin
  insert into public.questions_arrivee (libelle, type) values ('Pirate', 'texte');
  raise exception 'ÉCHEC : une cliente a ajouté une question';
exception when insufficient_privilege then perform test.verifier(true, 'une cliente ne modifie pas les questions'); end $$;
do $$ begin
  insert into public.reponses_arrivee (cliente_id, reponses) values ('00000000-0000-0000-0000-00000000b310', '[]');
  raise exception 'ÉCHEC : réponses écrites pour une autre';
exception when insufficient_privilege then perform test.verifier(true, 'personne n''écrit les réponses d''une autre'); end $$;
select test.verifier(public.envoyer_questionnaire('[{"question":"Ton cycle","reponse":"Règles régulières"}]', array['00000000-0000-0000-0000-0000000ca310']::uuid[], 'recompo'), 'la cliente envoie ses réponses');
select test.verifier(not public.envoyer_questionnaire('[]', '{}', 'perte'), 'un 2e envoi ne remplace pas le premier');
select test.verifier(not public.questionnaire_a_remplir(), 'une fois envoyé, plus rien à faire');
select test.verifier((select count(*) from public.reponses_arrivee) = 1, 'elle voit ses réponses');
reset role;
select test.verifier((select count(*) from public.exclusions where cliente_id = '00000000-0000-0000-0000-00000000a310' and categorie_id = '00000000-0000-0000-0000-0000000ca310') = 1, 'ses exclusions de recettes sont pré-remplies');
select test.verifier((select objectif from public.besoins_clientes where cliente_id = '00000000-0000-0000-0000-00000000a310') = 'recompo', 'son objectif est pré-rempli');

-- L'objectif déjà choisi par la coach n'est pas écrasé.
insert into public.besoins_clientes (cliente_id, objectif) values ('00000000-0000-0000-0000-00000000b310', 'perte');
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000b310"}', false);
select test.verifier((select count(*) from public.reponses_arrivee) = 0, 'B ne voit pas les réponses de A');
select public.envoyer_questionnaire('[]', '{}', 'prise');
reset role;
select test.verifier((select objectif from public.besoins_clientes where cliente_id = '00000000-0000-0000-0000-00000000b310') = 'perte', 'l''objectif choisi par la coach n''est pas écrasé');

-- D, déjà en cours : pas concernée.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000d310"}', false);
select test.verifier(not public.questionnaire_a_remplir(), 'une cliente déjà en cours n''a pas le questionnaire');
-- La coach voit tout et modifie les questions.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c310"}', false);
select test.verifier((select count(*) from public.reponses_arrivee) = 2, 'la coach voit les réponses');
update public.questions_arrivee set actif = false where ordre = 130;
select test.verifier((select not actif from public.questions_arrivee where ordre = 130), 'la coach peut désactiver une question');
reset role;

-- Accès fermé : plus rien de visible.
update public.clientes set statut = 'fermee' where id = '00000000-0000-0000-0000-00000000a310';
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a310"}', false);
select test.verifier((select count(*) from public.reponses_arrivee) = 0 and (select count(*) from public.questions_arrivee) = 0, 'accès fermé : plus rien de visible');
reset role;
select set_config('request.jwt.claims', '', false);
update public.questions_arrivee set actif = true where ordre = 130;
