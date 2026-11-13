-- Tests de sécurité de la phase 10 : la communauté.
\set ON_ERROR_STOP on

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000c9', 'coach9@test.fr', '{"prenom":"Cindy"}'),
  ('00000000-0000-0000-0000-0000000000a9', 'a9@test.fr', '{"prenom":"Alice"}'),
  ('00000000-0000-0000-0000-0000000000b9', 'b9@test.fr', '{"prenom":"Béa"}'),
  ('00000000-0000-0000-0000-0000000000d9', 'd9@test.fr', '{"prenom":"Diane"}'),
  ('00000000-0000-0000-0000-0000000000f9', 'f9@test.fr', '{"prenom":"Flore"}');
select public.definir_coach('coach9@test.fr');
insert into public.clientes (id, statut) values
  ('00000000-0000-0000-0000-0000000000a9', 'active'),
  ('00000000-0000-0000-0000-0000000000b9', 'active'),
  ('00000000-0000-0000-0000-0000000000d9', 'active'),
  ('00000000-0000-0000-0000-0000000000f9', 'fermee');

select test.verifier(not (select communaute_ouverte from public.reglages), 'la communauté est fermée par défaut');

-- ===================== Communauté fermée : personne ne rejoint =====================
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a9"}', false);
do $$ begin
  insert into public.membres_communaute (cliente_id) values ('00000000-0000-0000-0000-0000000000a9');
  raise exception 'ÉCHEC : adhésion communauté fermée';
exception when insufficient_privilege then perform test.verifier(true, 'impossible de rejoindre tant que la coach n''a pas ouvert'); end $$;
reset role;

-- ===================== La coach ouvre =====================
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c9"}', false);
update public.reglages set communaute_ouverte = true;
insert into public.messages_communaute (texte) values ('Bienvenue à toutes !');
select test.verifier((select auteur_coach and auteur_prenom = 'Cindy' from public.messages_communaute), 'le message de la coach est marqué « coach »');
reset role;

-- ===================== Cliente A rejoint et écrit =====================
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a9"}', false);
select test.verifier((select count(*) from public.messages_communaute) = 0, 'A ne voit rien avant d''avoir rejoint');
do $$ begin
  insert into public.membres_communaute (cliente_id) values ('00000000-0000-0000-0000-0000000000b9');
  raise exception 'ÉCHEC : A inscrit B';
exception when insufficient_privilege then perform test.verifier(true, 'A ne peut pas inscrire quelqu''un d''autre'); end $$;
insert into public.membres_communaute (cliente_id) values ('00000000-0000-0000-0000-0000000000a9');
select test.verifier((select count(*) from public.messages_communaute) = 1, 'A voit les messages une fois membre');
insert into public.messages_communaute (texte, auteur_prenom, auteur_coach) values ('Coucou !', 'Cindy', true);
select test.verifier((select auteur_prenom = 'Alice' and not auteur_coach from public.messages_communaute where texte = 'Coucou !'),
  'A ne peut pas se faire passer pour la coach (prénom imposé)');
do $$ begin
  insert into public.messages_communaute (auteur_id, texte) values ('00000000-0000-0000-0000-0000000000b9', 'faux');
  raise exception 'ÉCHEC : message au nom de B';
exception when insufficient_privilege then perform test.verifier(true, 'A ne peut pas écrire au nom de B'); end $$;
insert into public.reactions_communaute (message_id, emoji)
  select id, 'coeur' from public.messages_communaute where texte = 'Bienvenue à toutes !';
select test.verifier((select count(*) from public.reactions_communaute) = 1, 'A réagit avec un cœur');
do $$ begin
  insert into public.reactions_communaute (message_id, emoji)
    select id, 'caca' from public.messages_communaute limit 1;
  raise exception 'ÉCHEC : réaction libre';
exception when check_violation then perform test.verifier(true, 'seules les réactions prévues sont possibles'); end $$;
do $$ declare n int; begin
  update public.messages_communaute set epingle = true;
  get diagnostics n = row_count;
  perform test.verifier(n = 0, 'A ne peut pas épingler');
end $$;
do $$ declare n int; begin
  delete from public.messages_communaute where texte = 'Bienvenue à toutes !';
  get diagnostics n = row_count;
  perform test.verifier(n = 0, 'A ne peut pas supprimer le message de la coach');
end $$;
select public.reglages_membre(true, true);
select test.verifier((select notifications from public.membres_communaute), 'A active ses notifications');
select test.verifier((select count(*) from public.bilans) = 0 and (select count(*) from public.clientes) = 1,
  'la communauté ne donne accès à aucune donnée de suivi');
reset role;

-- ===================== Cliente B : membre, lit A, signale =====================
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b9"}', false);
insert into public.membres_communaute (cliente_id) values ('00000000-0000-0000-0000-0000000000b9');
select test.verifier((select count(*) from public.messages_communaute) = 2, 'B voit les messages de la coach et de A');
select test.verifier((select count(*) from public.membres_communaute) = 1, 'B ne voit pas la liste des membres');
select test.verifier((select count(*) from public.clientes) = 1, 'B ne voit toujours que sa propre fiche');
insert into public.signalements_communaute (message_id, motif)
  select id, 'test' from public.messages_communaute where texte = 'Coucou !';
do $$ declare n int; begin
  delete from public.messages_communaute where texte = 'Coucou !';
  get diagnostics n = row_count;
  perform test.verifier(n = 0, 'B ne peut pas supprimer le message de A');
end $$;
do $$ declare n int; begin
  delete from public.reactions_communaute;
  get diagnostics n = row_count;
  perform test.verifier(n = 0, 'B ne peut pas retirer la réaction de A');
end $$;
do $$ declare n int; begin
  update public.membres_communaute set statut = 'exclue', notifications = true;
  get diagnostics n = row_count;
  perform test.verifier(n = 0, 'B ne modifie pas sa ligne de membre directement');
end $$;
reset role;

-- ===================== Cliente D : non membre =====================
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d9"}', false);
select test.verifier((select count(*) from public.messages_communaute) = 0, 'D (non membre) ne voit aucun message');
select test.verifier((select count(*) from public.reactions_communaute) = 0, 'D ne voit aucune réaction');
do $$ begin
  insert into public.messages_communaute (texte) values ('intrusion');
  raise exception 'ÉCHEC : non-membre écrit';
exception when insufficient_privilege then perform test.verifier(true, 'D ne peut pas écrire sans rejoindre'); end $$;
reset role;

-- ===================== Cliente F (fermée) =====================
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f9"}', false);
do $$ begin
  insert into public.membres_communaute (cliente_id) values ('00000000-0000-0000-0000-0000000000f9');
  raise exception 'ÉCHEC : cliente fermée membre';
exception when insufficient_privilege then perform test.verifier(true, 'F (accompagnement terminé) ne peut pas rejoindre'); end $$;
reset role;

-- ===================== Coach : modération =====================
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c9"}', false);
select test.verifier((select count(*) from public.signalements_communaute) = 1, 'la coach voit le signalement');
select test.verifier((select count(*) from public.membres_communaute) = 2, 'la coach voit les membres');
update public.messages_communaute set epingle = true where texte = 'Bienvenue à toutes !';
select test.verifier((select epingle from public.messages_communaute where texte = 'Bienvenue à toutes !'), 'la coach épingle');
update public.membres_communaute set statut = 'exclue' where cliente_id = '00000000-0000-0000-0000-0000000000a9';
reset role;

-- ===================== A retirée =====================
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a9"}', false);
select test.verifier((select count(*) from public.messages_communaute) = 0, 'A retirée ne voit plus rien');
do $$ declare n int; begin
  delete from public.membres_communaute;
  get diagnostics n = row_count;
  perform test.verifier(n = 0, 'A retirée ne peut pas « quitter » pour revenir');
end $$;
do $$ begin
  insert into public.membres_communaute (cliente_id) values ('00000000-0000-0000-0000-0000000000a9');
  raise exception 'ÉCHEC : A revient';
exception when unique_violation or insufficient_privilege then perform test.verifier(true, 'A retirée ne peut pas revenir seule'); end $$;
delete from public.messages_communaute where texte = 'Coucou !';
reset role;

-- ===================== B quitte ; coach ferme =====================
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b9"}', false);
delete from public.membres_communaute;
select test.verifier((select count(*) from public.messages_communaute) = 0, 'B a quitté : plus d''accès');
insert into public.membres_communaute (cliente_id) values ('00000000-0000-0000-0000-0000000000b9');
select test.verifier((select count(*) from public.messages_communaute) = 2, 'B peut revenir (elle était partie d''elle-même)');
reset role;
update public.reglages set communaute_ouverte = false;
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b9"}', false);
select test.verifier((select count(*) from public.messages_communaute) = 0, 'communauté fermée : B ne voit plus rien');
reset role;
