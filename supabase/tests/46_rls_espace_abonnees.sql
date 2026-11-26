-- Tests : espace abonnées (étape 3). Ce qui est ouvert à une abonnée active, ce qui reste au coaching,
-- deux salons dans la communauté, et la vie privée des abonnées vis-à-vis de la coach.
\set ON_ERROR_STOP on

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000c460', 'coach46@test.fr', '{}'),
  ('00000000-0000-0000-0000-00000000a460', 'coachee46@test.fr', '{"prenom":"Clara"}'),
  ('00000000-0000-0000-0000-00000000e460', 'abonnee46@test.fr', '{"prenom":"Eva"}'),
  ('00000000-0000-0000-0000-00000000f460', 'ancienne46@test.fr', '{"prenom":"Flore"}');
select public.definir_coach('coach46@test.fr');
insert into public.clientes (id, statut) values ('00000000-0000-0000-0000-00000000a460', 'active');
insert into public.clientes (id, statut, formule) values
  ('00000000-0000-0000-0000-00000000e460', 'active', 'abonnement'),
  ('00000000-0000-0000-0000-00000000f460', 'fermee', 'abonnement');
update public.reglages set communaute_ouverte = true;

-- Contenus de la coach.
insert into public.ressources (id, titre, contenu, publiee, visibilite, pour_abonnees) values
  ('46000000-0000-4000-8000-000000000001', 'Fiche coaching', 'Réservée', true, 'toutes', false),
  ('46000000-0000-4000-8000-000000000002', 'Fiche abonnées', 'Pour toutes', true, 'toutes', true);
insert into public.recettes (id, titre, publiee) values
  ('46000000-0000-4000-8000-000000000006', 'Bowl test 46', true),
  ('46000000-0000-4000-8000-000000000007', 'Brouillon test 46', false);
insert into public.seances_express (id, titre, duree_minutes, type, contenu, publiee, visibilite) values
  ('46000000-0000-4000-8000-000000000003', 'Express', 10, 'Cardio', '{"nom":"x","blocs":[]}', true, 'toutes');
insert into public.defis (id, titre, type, seuil, objectif, debut, fin, audience, publie, pour_abonnees) values
  ('46000000-0000-4000-8000-000000000004', 'Défi coachées', 'pas', 8000, 1, current_date, current_date + 10, 'toutes', true, false),
  ('46000000-0000-4000-8000-000000000005', 'Défi pour toutes', 'journal', null, 1, current_date, current_date + 10, 'toutes', true, true);

-- Les messages écrits avant l'espace commun restent entre coachées.
insert into public.membres_communaute (cliente_id) values ('00000000-0000-0000-0000-00000000a460');
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a460"}', false);
insert into public.messages_communaute (auteur_id, texte, salon) values ('00000000-0000-0000-0000-00000000a460', 'Entre nous, mon bilan…', 'coachees');
insert into public.messages_communaute (auteur_id, texte) values ('00000000-0000-0000-0000-00000000a460', 'Bienvenue à toutes !');
select test.verifier((select count(*) from public.messages_communaute where auteur_id = '00000000-0000-0000-0000-00000000a460') = 2, 'une coachée voit les deux salons');
insert into public.journal_quotidien (cliente_id, jour, pas, energie) values ('00000000-0000-0000-0000-00000000a460', current_date, 9000, 4);
reset role;

-- L'abonnée active.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000e460"}', false);
select test.verifier(public.acces_appli() and not public.acces_ouvert(), 'l''abonnée a accès à l''appli, pas au coaching');
select test.verifier((select array_agg(titre) from public.ressources) = array['Fiche abonnées'], 'l''abonnée voit seulement les ressources cochées « pour les abonnées »');
select test.verifier((select count(*) from public.seances_express where id = '46000000-0000-4000-8000-000000000003') = 1, 'l''abonnée voit les séances express publiées');
select test.verifier((select array_agg(titre) from public.defis) = array['Défi pour toutes'], 'l''abonnée voit seulement les défis cochés « pour les abonnées »');
insert into public.defis_participations (defi_id) values ('46000000-0000-4000-8000-000000000005');
do $$ begin
  insert into public.defis_participations (defi_id) values ('46000000-0000-4000-8000-000000000004');
  raise exception 'ÉCHEC : défi du coaching relevé par une abonnée';
exception when insufficient_privilege then perform test.verifier(true, 'pas de participation à un défi réservé aux coachées'); end $$;
-- Son journal (avec l'énergie) et ses séances libres.
insert into public.journal_quotidien (cliente_id, jour, pas, sommeil, hydratation, energie, stress, digestion, poids) values ('00000000-0000-0000-0000-00000000e460', current_date, 7000, 7.5, 1.5, 4, 2, 4, 64.2);
select test.verifier((select count(*) from public.journal_quotidien) = 1, 'l''abonnée tient son journal et ne voit que le sien');
insert into public.seances_faites (seance_nom, seance_express_id) values ('Express', '46000000-0000-4000-8000-000000000003');
select test.verifier((select count(*) from public.seances_faites) = 1, 'l''abonnée enregistre ses séances express');
-- Son métabolisme.
insert into public.metabolisme (annee_naissance, taille_cm, poids_kg, activite) values (1990, 165, 64, 'moderee');
select test.verifier((select count(*) from public.metabolisme) = 1, 'l''abonnée enregistre son métabolisme');
-- La communauté : l'espace commun, jamais le salon des coachées.
insert into public.membres_communaute (cliente_id) values ('00000000-0000-0000-0000-00000000e460');
select test.verifier((select array_agg(texte) from public.messages_communaute where auteur_id = '00000000-0000-0000-0000-00000000a460') = array['Bienvenue à toutes !']
  and not exists (select 1 from public.messages_communaute where salon = 'coachees'), 'l''abonnée voit l''espace commun, jamais le salon des coachées');
insert into public.messages_communaute (auteur_id, texte) values ('00000000-0000-0000-0000-00000000e460', 'Coucou, je suis Eva');
do $$ begin
  insert into public.messages_communaute (auteur_id, texte, salon) values ('00000000-0000-0000-0000-00000000e460', 'Je force la porte', 'coachees');
  raise exception 'ÉCHEC : abonnée dans le salon des coachées';
exception when insufficient_privilege then perform test.verifier(true, 'l''abonnée ne peut pas écrire dans le salon des coachées'); end $$;
-- Recettes : les publiées, jamais les brouillons ; favoris possibles.
select test.verifier((select count(*) from public.recettes where id = '46000000-0000-4000-8000-000000000006') = 1
  and (select count(*) from public.recettes where id = '46000000-0000-4000-8000-000000000007') = 0, 'l''abonnée voit les recettes publiées, pas les brouillons');
insert into public.favoris (cliente_id, recette_id) values ('00000000-0000-0000-0000-00000000e460', '46000000-0000-4000-8000-000000000006');
select test.verifier((select count(*) from public.favoris) = 1, 'l''abonnée met une recette en favori');
reset role;

-- La coach : rien de la vie privée de l'abonnée (journal, séances, métabolisme), mais ses coachées oui.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c460"}', false);
select test.verifier((select count(*) from public.journal_quotidien where cliente_id = '00000000-0000-0000-0000-00000000e460') = 0, 'la coach ne voit pas le journal d''une abonnée');
select test.verifier((select count(*) from public.journal_quotidien where cliente_id = '00000000-0000-0000-0000-00000000a460') = 1, 'la coach voit le journal de sa coachée');
select test.verifier((select count(*) from public.seances_faites where cliente_id = '00000000-0000-0000-0000-00000000e460') = 0, 'la coach ne voit pas les séances d''une abonnée');
select test.verifier((select count(*) from public.metabolisme) = 0, 'la coach ne voit pas le métabolisme d''une abonnée');
select test.verifier((select count(*) from public.favoris where cliente_id = '00000000-0000-0000-0000-00000000e460') = 0, 'la coach ne voit pas les favoris d''une abonnée');
select test.verifier((select count(*) from public.progressions_defi('46000000-0000-4000-8000-000000000005')) = 0, 'la coach ne voit pas la progression d''une abonnée');
select test.verifier((select count(*) from public.messages_communaute where texte = 'Coucou, je suis Eva') = 1, 'la coach modère l''espace commun');
reset role;

-- Une coachée voit le message de l'abonnée dans l'espace commun.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a460"}', false);
select test.verifier((select count(*) from public.messages_communaute where texte = 'Coucou, je suis Eva') = 1, 'les coachées voient l''espace commun');
select test.verifier((select count(*) from public.ressources where id = '46000000-0000-4000-8000-000000000001') = 1, 'la coachée garde les ressources du coaching');
reset role;

-- Une abonnée dont l'abonnement est terminé : plus rien.
insert into public.membres_communaute (cliente_id, statut) values ('00000000-0000-0000-0000-00000000f460', 'membre');
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000f460"}', false);
select test.verifier(not public.acces_appli(), 'abonnement terminé : plus d''accès');
select test.verifier((select count(*) from public.ressources) + (select count(*) from public.seances_express) + (select count(*) from public.defis) + (select count(*) from public.messages_communaute) = 0,
  'abonnement terminé : ni ressources, ni séances, ni défis, ni communauté');
do $$ begin
  insert into public.journal_quotidien (cliente_id, jour, pas) values ('00000000-0000-0000-0000-00000000f460', current_date, 5000);
  raise exception 'ÉCHEC : journal d''une abonnée terminée';
exception when insufficient_privilege then perform test.verifier(true, 'abonnement terminé : plus de journal'); end $$;
reset role;
update public.reglages set communaute_ouverte = false;
select set_config('request.jwt.claims', '', false);
