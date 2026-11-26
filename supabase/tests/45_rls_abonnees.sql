-- Tests : espace abonnées (socle). Par défaut, une abonnée ne voit RIEN du coaching ;
-- la coach ne voit pas ses données ; l'abonnement ne se modifie que par Stripe (clé secrète).
\set ON_ERROR_STOP on

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000c450', 'coach45@test.fr', '{}'),
  ('00000000-0000-0000-0000-00000000a450', 'coachee45@test.fr', '{"prenom":"Alice"}'),
  ('00000000-0000-0000-0000-00000000e450', 'abonnee45@test.fr', '{"prenom":"Emma"}');
select public.definir_coach('coach45@test.fr');
insert into public.clientes (id, statut) values ('00000000-0000-0000-0000-00000000a450', 'active');
-- L'abonnée est créée par le serveur (webhook Stripe, clé secrète).
insert into public.clientes (id, statut, formule, stripe_customer_id, stripe_subscription_id, abonnement_statut, abonnement_formule, abonnement_fin_periode)
values ('00000000-0000-0000-0000-00000000e450', 'active', 'abonnement', 'cus_Test45', 'sub_Test45', 'active', 'mensuel', current_date + 30);
update public.reglages set communaute_ouverte = true;
insert into public.membres_communaute (cliente_id) values ('00000000-0000-0000-0000-00000000a450'), ('00000000-0000-0000-0000-00000000e450');
insert into public.messages_communaute (auteur_id, texte) values ('00000000-0000-0000-0000-00000000a450', 'Coucou les filles');

-- Du contenu du coaching : une ressource pour toutes, une séance express et un défi publiés.
insert into public.ressources (id, titre, contenu, publiee, visibilite) values ('45000000-0000-4000-8000-000000000001', 'Fiche coaching', 'Texte', true, 'toutes');
insert into public.seances_express (id, titre, duree_minutes, type, contenu, publiee, visibilite) values ('45000000-0000-4000-8000-000000000002', 'Express', 10, 'Cardio', '{"nom":"x","blocs":[]}', true, 'toutes');
insert into public.defis (id, titre, type, seuil, objectif, debut, fin, audience, publie) values ('45000000-0000-4000-8000-000000000003', 'Défi', 'pas', 8000, 1, current_date, current_date + 10, 'toutes', true);

select test.verifier((select formule from public.clientes where id = '00000000-0000-0000-0000-00000000a450') = 'coaching', 'une cliente existante est « coaching » par défaut');

-- L'abonnée : sa fiche oui ; rien du coaching.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000e450"}', false);
select test.verifier((select count(*) from public.clientes) = 1, 'l''abonnée voit sa propre fiche');
select test.verifier(not public.acces_ouvert(), 'l''abonnée n''a pas l''accès du coaching');
select test.verifier((select count(*) from public.ressources) = 0, 'l''abonnée ne voit pas les ressources du coaching');
-- (0046) Ce qui lui est ouvert est testé dans 46_rls_espace_abonnees.sql ; ici, ce qui reste au coaching.
select test.verifier((select count(*) from public.defis) = 0, 'l''abonnée ne voit pas les défis du coaching (non cochés « pour les abonnées »)');
-- Elle ne peut pas modifier son abonnement ni devenir « coaching ».
update public.clientes set formule = 'coaching', abonnement_fin_periode = current_date + 3650, statut = 'active';
reset role;
select test.verifier((select formule = 'abonnement' and abonnement_fin_periode = current_date + 30 from public.clientes where id = '00000000-0000-0000-0000-00000000e450'),
  'l''abonnée ne peut ni prolonger son abonnement ni passer au coaching elle-même');

-- La coach : ne voit pas l'abonnée dans ses clientes, seulement dans la liste dédiée.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c450"}', false);
select test.verifier(not exists (select 1 from public.clientes where id = '00000000-0000-0000-0000-00000000e450'), 'la coach ne voit pas l''abonnée parmi ses clientes');
select test.verifier((select count(*) from public.liste_abonnees() where email = 'abonnee45@test.fr' and abonnement_formule = 'mensuel') = 1, 'la coach voit l''abonnée dans la liste des abonnées');
update public.clientes set formule = 'coaching' where id = '00000000-0000-0000-0000-00000000e450';
do $$ begin
  insert into public.clientes (id, statut, formule) values ('00000000-0000-0000-0000-00000000c450', 'active', 'abonnement');
  raise exception 'ÉCHEC : la coach a créé une abonnée';
exception when insufficient_privilege then perform test.verifier(true, 'seul le serveur (Stripe) crée une abonnée'); end $$;
reset role;
select test.verifier((select formule from public.clientes where id = '00000000-0000-0000-0000-00000000e450') = 'abonnement', 'la coach ne change pas une abonnée en cliente coachée par erreur');

-- Une cliente : ne peut pas lire la liste des abonnées ; la coachée garde tout.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a450"}', false);
select test.verifier((select count(*) from public.liste_abonnees()) = 0, 'une cliente ne voit pas la liste des abonnées');
select test.verifier(public.acces_ouvert() and (select count(*) from public.ressources where id = '45000000-0000-4000-8000-000000000001') = 1
  and (select count(*) from public.seances_express where id = '45000000-0000-4000-8000-000000000002') = 1
  and (select count(*) from public.defis where id = '45000000-0000-4000-8000-000000000003') = 1
  and (select count(*) from public.messages_communaute) >= 1, 'la cliente coachée garde tout');
reset role;
update public.reglages set communaute_ouverte = false;
select set_config('request.jwt.claims', '', false);
