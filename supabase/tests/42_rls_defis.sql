-- Tests : défis du mois — qui les voit, qui participe, progression calculée par la base,
-- pourcentage du groupe seulement à partir de 3 participantes, célébration avec accord.
\set ON_ERROR_STOP on

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000c420', 'coach42@test.fr', '{}'),
  ('00000000-0000-0000-0000-00000000a420', 'a42@test.fr', '{"prenom":"Aïcha"}'),
  ('00000000-0000-0000-0000-00000000b420', 'b42@test.fr', '{"prenom":"Bertille"}'),
  ('00000000-0000-0000-0000-00000000e420', 'e42@test.fr', '{"prenom":"Elsa"}'),
  ('00000000-0000-0000-0000-00000000d420', 'd42@test.fr', '{"prenom":"Diane"}');
select public.definir_coach('coach42@test.fr');
insert into public.clientes (id, statut) values
  ('00000000-0000-0000-0000-00000000a420', 'active'),
  ('00000000-0000-0000-0000-00000000b420', 'active'),
  ('00000000-0000-0000-0000-00000000e420', 'active'),
  ('00000000-0000-0000-0000-00000000d420', 'terminee');
update public.reglages set communaute_ouverte = true;
insert into public.membres_communaute (cliente_id) values ('00000000-0000-0000-0000-00000000d420');

-- La coach crée : un défi pas pour toutes (en cours), un défi communauté, un brouillon.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c420"}', false);
insert into public.defis (id, titre, type, seuil, objectif, debut, fin, audience, publie) values
  ('42000000-0000-4000-8000-000000000001', 'Défi pas', 'pas', 8000, 2, current_date - 5, current_date + 20, 'toutes', true),
  ('42000000-0000-4000-8000-000000000002', 'Défi communauté', 'journal', null, 3, current_date - 2, current_date + 10, 'communaute', true),
  ('42000000-0000-4000-8000-000000000003', 'Brouillon', 'sommeil', 7, 5, current_date, current_date + 20, 'toutes', false);
select test.verifier((select count(*) from public.defis) = 3, 'la coach voit tous ses défis');
do $$ begin
  insert into public.defis (titre, type, seuil, objectif, debut, fin) values ('Trop', 'pas', 8000, 40, current_date, current_date + 9);
  raise exception 'ÉCHEC : objectif plus long que le défi accepté';
exception when check_violation then perform test.verifier(true, 'l''objectif ne dépasse pas la durée du défi'); end $$;
do $$ begin
  insert into public.defis (titre, type, seuil, objectif, debut, fin) values ('Séances', 'seances', 3, 5, current_date, current_date + 27);
  raise exception 'ÉCHEC : 5 semaines dans un défi de 4 semaines';
exception when check_violation then perform test.verifier(true, 'séances : pas plus de semaines que le défi n''en compte'); end $$;
reset role;

-- A : voit le défi pour toutes, pas celui de la communauté ni le brouillon ; ne peut rien créer.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a420"}', false);
select test.verifier((select array_agg(titre) from public.defis) = array['Défi pas'], 'A ne voit que le défi publié pour toutes');
do $$ begin
  insert into public.defis (titre, type, seuil, objectif, debut, fin) values ('Pirate', 'pas', 8000, 1, current_date, current_date);
  raise exception 'ÉCHEC : une cliente a créé un défi';
exception when insufficient_privilege then perform test.verifier(true, 'seule la coach crée des défis'); end $$;
do $$ begin
  insert into public.defis_participations (defi_id) values ('42000000-0000-4000-8000-000000000003');
  raise exception 'ÉCHEC : participation à un brouillon';
exception when insufficient_privilege then perform test.verifier(true, 'pas de participation à un défi non publié'); end $$;
do $$ begin
  insert into public.defis_participations (defi_id, reussi_le) values ('42000000-0000-4000-8000-000000000001', now());
  raise exception 'ÉCHEC : réussite déclarée par la cliente';
exception when insufficient_privilege then perform test.verifier(true, 'une cliente ne peut pas se déclarer gagnante'); end $$;
-- Avant de participer : pas de progression personnelle, pas de pourcentage du groupe.
select test.verifier((select reussites is null and groupe is null and participantes = 0 from public.ma_progression_defi('42000000-0000-4000-8000-000000000001')), 'avant de participer : rien à montrer');
insert into public.defis_participations (defi_id, afficher_prenom) values ('42000000-0000-4000-8000-000000000001', true);
-- Son journal : un jour à 9 000 pas (compte), un jour à 5 000 (ne compte pas), un jour avant le défi (ne compte pas).
insert into public.journal_quotidien (cliente_id, jour, pas) values
  ('00000000-0000-0000-0000-00000000a420', current_date - 1, 9000),
  ('00000000-0000-0000-0000-00000000a420', current_date - 2, 5000),
  ('00000000-0000-0000-0000-00000000a420', current_date - 10, 12000);
select test.verifier((select reussites = 1 and objectif = 2 and not reussi from public.ma_progression_defi('42000000-0000-4000-8000-000000000001')), 'la progression vient de son journal (1 jour sur 2)');
select test.verifier((select groupe is null and participantes = 1 from public.ma_progression_defi('42000000-0000-4000-8000-000000000001')), 'moins de 3 participantes : pas de pourcentage du groupe');
do $$ begin
  perform public.reussites_defi('42000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-00000000b420');
  raise exception 'ÉCHEC : calcul direct accessible';
exception when insufficient_privilege then perform test.verifier(true, 'impossible de calculer la progression d''une autre'); end $$;
update public.defis_participations set reussi_le = now();
reset role;
select test.verifier((select reussi_le is null from public.defis_participations where cliente_id = '00000000-0000-0000-0000-00000000a420'), 'une cliente ne modifie pas sa participation directement');

-- B et E participent aussi : le groupe a maintenant 3 participantes.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000b420"}', false);
insert into public.defis_participations (defi_id) values ('42000000-0000-4000-8000-000000000001');
insert into public.journal_quotidien (cliente_id, jour, pas) values ('00000000-0000-0000-0000-00000000b420', current_date, 8000), ('00000000-0000-0000-0000-00000000b420', current_date - 1, 10000);
select test.verifier((select count(*) from public.defis_participations) = 1, 'B ne voit que sa participation');
select test.verifier((select count(*) from public.journal_quotidien) = 2, 'B ne voit pas le journal de A');
reset role;
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000e420"}', false);
insert into public.defis_participations (defi_id) values ('42000000-0000-4000-8000-000000000001');
-- E : 0 jour ; B : réussi (2/2) ; A : 1/2  →  groupe = (0 + 100 + 50) / 3 = 50 %.
select test.verifier((select groupe = 50 and participantes = 3 and reussites = 0 from public.ma_progression_defi('42000000-0000-4000-8000-000000000001')), 'à 3 participantes : pourcentage moyen du groupe');
delete from public.defis_participations;
select test.verifier((select count(*) from public.defis_participations) = 0, 'E peut abandonner le défi');
insert into public.defis_participations (defi_id) values ('42000000-0000-4000-8000-000000000001');
reset role;

-- B consulte : réussite marquée par la base, sans célébration (elle n'a pas choisi d'afficher son prénom).
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000b420"}', false);
select test.verifier((select reussi from public.ma_progression_defi('42000000-0000-4000-8000-000000000001')), 'B a réussi : la base le marque');
delete from public.defis_participations;
reset role;
select test.verifier((select reussi_le is not null and notifie_le is not null and celebre_le is null from public.defis_participations where cliente_id = '00000000-0000-0000-0000-00000000b420'),
  'réussite vue dans l''app (pas de notification en plus), pas de célébration sans accord, et plus d''abandon possible');
select test.verifier(not exists (select 1 from public.messages_communaute where texte like '%Bertille%'), 'aucun message avec le prénom de B');

-- A réussit en remplissant sa journée : la tâche planifiée le repère, la célébration part (elle l'a choisi).
insert into public.journal_quotidien (cliente_id, jour, pas) values ('00000000-0000-0000-0000-00000000a420', current_date, 8500);
select test.verifier((select count(*) from public.verifier_defis() where cliente_id = '00000000-0000-0000-0000-00000000a420') = 1, 'la tâche planifiée repère la réussite à annoncer');
select test.verifier((select celebre_le is not null and notifie_le is null from public.defis_participations where cliente_id = '00000000-0000-0000-0000-00000000a420'), 'A : réussite marquée, notification encore à envoyer');
select test.verifier((select count(*) from public.messages_communaute where texte like '%Bravo Aïcha%Défi pas%') = 1, 'son prénom est fêté dans la communauté, une seule fois');
select public.verifier_defis();
select test.verifier((select count(*) from public.messages_communaute where texte like '%Bravo Aïcha%') = 1, 'pas de deuxième célébration');

-- B change d'avis après coup : célébration à ce moment-là.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000b420"}', false);
select public.afficher_prenom_defi('42000000-0000-4000-8000-000000000001', true);
reset role;
select test.verifier((select count(*) from public.messages_communaute where texte like '%Bravo Bertille%') = 1, 'B choisit d''afficher son prénom : elle est fêtée');

-- Les fonctions réservées ne sont pas appelables par une cliente.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a420"}', false);
do $$ begin
  perform public.verifier_defis();
  raise exception 'ÉCHEC : tâche planifiée appelable';
exception when insufficient_privilege then perform test.verifier(true, 'la vérification de toutes les participations est réservée au serveur'); end $$;
select test.verifier((select count(*) from public.progressions_defi('42000000-0000-4000-8000-000000000001')) = 0, 'une cliente ne voit pas la progression des autres');
reset role;
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c420"}', false);
select test.verifier((select count(*) from public.progressions_defi('42000000-0000-4000-8000-000000000001')) = 3, 'la coach voit la progression de chaque participante');
reset role;

-- D (suivi terminé, membre de la communauté) : voit seulement le défi communauté ; séances comptées par semaine.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000d420"}', false);
select test.verifier((select array_agg(titre) from public.defis) = array['Défi communauté'], 'membre de la communauté : le défi communauté seulement');
reset role;
insert into public.defis (id, titre, type, seuil, objectif, debut, fin, audience, publie) values
  ('42000000-0000-4000-8000-000000000004', 'Défi séances', 'seances', 2, 1, current_date - 6, current_date + 7, 'toutes', true);
insert into public.defis_participations (defi_id, cliente_id) values ('42000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-00000000e420');
insert into public.seances_faites (cliente_id, seance_nom, faite_le) values
  ('00000000-0000-0000-0000-00000000e420', 'S1', now() - interval '3 days'),
  ('00000000-0000-0000-0000-00000000e420', 'S2', now() - interval '20 days');
select test.verifier((select count(*) from public.verifier_defis() where defi_id = '42000000-0000-4000-8000-000000000004') = 0, 'séances : 1 séance dans la semaine, objectif pas atteint');
insert into public.seances_faites (cliente_id, seance_nom, faite_le) values ('00000000-0000-0000-0000-00000000e420', 'S3', now() - interval '1 day');
select test.verifier((select count(*) from public.verifier_defis() where defi_id = '42000000-0000-4000-8000-000000000004') = 1, 'séances : 2 séances dans la semaine, objectif atteint');

-- Accès fermé : plus rien.
update public.clientes set statut = 'fermee' where id = '00000000-0000-0000-0000-00000000a420';
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a420"}', false);
select test.verifier((select count(*) from public.defis) = 0, 'accès fermé : plus aucun défi visible');
select test.verifier((select count(*) from public.ma_progression_defi('42000000-0000-4000-8000-000000000001')) = 0, 'accès fermé : plus de progression');
reset role;
update public.reglages set communaute_ouverte = false;
select set_config('request.jwt.claims', '', false);
