-- Tests de sécurité de la phase 3 : bilans, valeurs, photos, retours.
\set ON_ERROR_STOP on

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000c3', 'coach3@test.fr', '{}'),
  ('00000000-0000-0000-0000-0000000000a3', 'a3@test.fr', '{"prenom":"Agathe"}'),
  ('00000000-0000-0000-0000-0000000000b3', 'b3@test.fr', '{"prenom":"Bérénice"}'),
  ('00000000-0000-0000-0000-0000000000f3', 'f3@test.fr', '{"prenom":"Fanny"}');
select public.definir_coach('coach3@test.fr');
insert into public.clientes (id, statut) values
  ('00000000-0000-0000-0000-0000000000a3', 'active'),
  ('00000000-0000-0000-0000-0000000000b3', 'active'),
  ('00000000-0000-0000-0000-0000000000f3', 'fermee');

insert into public.bilans (id, cliente_id, echeance, commentaire, saisi_par) values
  ('00000000-0000-0000-0000-00000000b0b1', '00000000-0000-0000-0000-0000000000b3', '2026-11-01', 'Bilan de B', '00000000-0000-0000-0000-0000000000b3'),
  ('00000000-0000-0000-0000-00000000f0f1', '00000000-0000-0000-0000-0000000000f3', null, 'Bilan de F', '00000000-0000-0000-0000-0000000000f3');
insert into public.bilan_valeurs (bilan_id, champ_id, valeur_num)
  select '00000000-0000-0000-0000-00000000b0b1', id, 70 from public.champs_mesure where est_poids;
insert into public.photos_bilan (bilan_id, cliente_id, angle, fichier_path) values
  ('00000000-0000-0000-0000-00000000b0b1', '00000000-0000-0000-0000-0000000000b3', 'face', '00000000-0000-0000-0000-0000000000b3/x/face.jpg');
insert into public.retours_bilan (bilan_id, contenu) values ('00000000-0000-0000-0000-00000000b0b1', 'Bravo B');
insert into storage.objects (bucket_id, name) values
  ('photos', '00000000-0000-0000-0000-0000000000b3/x/face.jpg'),
  ('photos', '00000000-0000-0000-0000-0000000000f3/x/face.jpg');

select test.verifier((select count(*) from public.champs_mesure) = 12, 'les 12 champs de départ existent (6 mesures, 6 ressentis)');
select test.verifier((select public from storage.buckets where id = 'photos') = false, 'le bucket des photos est privé');

-- ===================== Cliente A =====================
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a3"}', false);

insert into public.bilans (id, cliente_id, echeance, commentaire)
values ('00000000-0000-0000-0000-00000000a0a1', '00000000-0000-0000-0000-0000000000a3', '2026-11-15', 'Super semaine');
select test.verifier((select saisi_par from public.bilans where id = '00000000-0000-0000-0000-00000000a0a1') = '00000000-0000-0000-0000-0000000000a3',
  'A peut envoyer son bilan (signé à son nom)');
insert into public.bilan_valeurs (bilan_id, champ_id, valeur_num)
  select '00000000-0000-0000-0000-00000000a0a1', id, 65.4 from public.champs_mesure where est_poids;
select test.verifier((select count(*) from public.bilan_valeurs) = 1, 'A peut saisir ses mesures et ne voit que les siennes');
insert into public.photos_bilan (bilan_id, cliente_id, angle, fichier_path)
values ('00000000-0000-0000-0000-00000000a0a1', '00000000-0000-0000-0000-0000000000a3', 'face', '00000000-0000-0000-0000-0000000000a3/a/face.jpg');
insert into storage.objects (bucket_id, name) values ('photos', '00000000-0000-0000-0000-0000000000a3/a/face.jpg');
select test.verifier(true, 'A peut ajouter ses photos');

select test.verifier((select count(*) from public.bilans) = 1, 'A ne voit pas les bilans des autres');
select test.verifier((select count(*) from public.photos_bilan) = 1, 'A ne voit pas les photos des autres');
select test.verifier((select count(*) from storage.objects where bucket_id = 'photos') = 1, 'A ne voit pas les fichiers photo des autres');
select test.verifier((select count(*) from public.retours_bilan) = 0, 'A ne voit pas le retour fait à B');

do $$ begin
  insert into public.bilans (cliente_id, commentaire) values ('00000000-0000-0000-0000-0000000000b3', 'usurpation');
  raise exception 'ÉCHEC : A a créé un bilan au nom de B';
exception when insufficient_privilege then perform test.verifier(true, 'A ne peut pas créer de bilan au nom de B'); end $$;
do $$ begin
  insert into public.bilans (cliente_id, saisi_par, commentaire) values ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000c3', 'faux');
  raise exception 'ÉCHEC : A a signé un bilan au nom de la coach';
exception when insufficient_privilege then perform test.verifier(true, 'A ne peut pas faire passer son bilan pour une saisie de la coach'); end $$;
do $$ begin
  insert into public.bilan_valeurs (bilan_id, champ_id, valeur_num)
    select '00000000-0000-0000-0000-00000000b0b1', id, 1 from public.champs_mesure where est_poids;
  raise exception 'ÉCHEC : A a écrit dans le bilan de B';
exception when insufficient_privilege then perform test.verifier(true, 'A ne peut pas écrire dans le bilan de B'); end $$;
do $$ begin
  insert into public.photos_bilan (bilan_id, cliente_id, angle, fichier_path)
  values ('00000000-0000-0000-0000-00000000a0a1', '00000000-0000-0000-0000-0000000000b3', 'dos', 'x');
  raise exception 'ÉCHEC : A a rattaché une photo à B';
exception when insufficient_privilege then perform test.verifier(true, 'A ne peut pas rattacher une photo à une autre cliente'); end $$;
do $$ begin
  insert into storage.objects (bucket_id, name) values ('photos', '00000000-0000-0000-0000-0000000000b3/a/pirate.jpg');
  raise exception 'ÉCHEC : A a déposé une photo dans le dossier de B';
exception when insufficient_privilege then perform test.verifier(true, 'A ne peut pas déposer de photo dans le dossier de B'); end $$;
do $$ begin
  insert into public.retours_bilan (bilan_id, contenu) values ('00000000-0000-0000-0000-00000000a0a1', 'auto-félicitation');
  raise exception 'ÉCHEC : A a écrit un retour coach';
exception when insufficient_privilege then perform test.verifier(true, 'A ne peut pas écrire de retour coach'); end $$;
do $$ declare n int; begin
  update public.bilans set commentaire = 'piratage' where id = '00000000-0000-0000-0000-00000000b0b1';
  get diagnostics n = row_count;
  perform test.verifier(n = 0, 'A ne peut pas modifier le bilan de B');
  update public.champs_mesure set libelle = 'piratage';
  get diagnostics n = row_count;
  perform test.verifier(n = 0, 'A ne peut pas modifier les champs du bilan');
  update public.clientes set mode_sans_chiffres = true, prochain_rdv = now() where id = '00000000-0000-0000-0000-0000000000a3';
  get diagnostics n = row_count;
  perform test.verifier(n = 0, 'A ne peut pas modifier ses réglages de suivi');
end $$;

update public.bilans set commentaire = 'Super semaine, corrigé', cliente_id = '00000000-0000-0000-0000-0000000000b3'
  where id = '00000000-0000-0000-0000-00000000a0a1';
select test.verifier((select cliente_id from public.bilans where id = '00000000-0000-0000-0000-00000000a0a1') = '00000000-0000-0000-0000-0000000000a3'
  and (select modifie_le is not null from public.bilans where id = '00000000-0000-0000-0000-00000000a0a1'),
  'A peut corriger son bilan, sans pouvoir le transférer à une autre');

select public.noter_visite();
reset role;
select test.verifier((select derniere_visite is not null from public.clientes where id = '00000000-0000-0000-0000-0000000000a3'),
  'la visite de A est notée');
select test.verifier((select derniere_visite is null from public.clientes where id = '00000000-0000-0000-0000-0000000000b3'),
  'la visite de A ne touche pas la fiche de B');

-- ===================== Cliente B =====================
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b3"}', false);
select test.verifier((select contenu from public.retours_bilan) = 'Bravo B', 'B lit le retour de la coach');
select public.marquer_retour_lu('00000000-0000-0000-0000-00000000b0b1');
select public.marquer_retour_lu('00000000-0000-0000-0000-00000000a0a1');
reset role;
select test.verifier((select lu_le is not null from public.retours_bilan where bilan_id = '00000000-0000-0000-0000-00000000b0b1'),
  'B peut marquer le retour comme lu');

-- ===================== Cliente F (accès fermé) =====================
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f3"}', false);
select test.verifier((select count(*) from public.bilans) = 0, 'F (fermée) ne voit plus ses bilans');
select test.verifier((select count(*) from storage.objects where bucket_id = 'photos') = 0, 'F (fermée) ne voit plus ses photos');
do $$ begin
  insert into public.bilans (cliente_id, commentaire) values ('00000000-0000-0000-0000-0000000000f3', 'x');
  raise exception 'ÉCHEC : F fermée a envoyé un bilan';
exception when insufficient_privilege then perform test.verifier(true, 'F (fermée) ne peut plus envoyer de bilan'); end $$;
reset role;

-- ===================== Coach =====================
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c3"}', false);
select test.verifier((select count(*) from public.bilans) = 3, 'la coach voit tous les bilans');
insert into public.bilans (cliente_id, commentaire) values ('00000000-0000-0000-0000-0000000000a3', 'Saisi en visio');
select test.verifier((select count(*) from public.bilans where saisi_par = '00000000-0000-0000-0000-0000000000c3') = 1,
  'la coach peut saisir un bilan pour une cliente');
insert into public.retours_bilan (bilan_id, contenu) values ('00000000-0000-0000-0000-00000000a0a1', 'Très beau travail');
select test.verifier(true, 'la coach peut répondre à un bilan');
update public.clientes set mode_sans_chiffres = true where id = '00000000-0000-0000-0000-0000000000b3';
insert into public.champs_mesure (groupe, type, libelle, unite, ordre) values ('mesure', 'nombre', 'Tour de mollet', 'cm', 7);
select test.verifier(true, 'la coach peut régler le mode sans chiffres et ajouter un champ');
do $$ begin
  delete from public.champs_mesure where est_poids;
  raise exception 'ÉCHEC : un champ avec des valeurs a été supprimé';
exception when foreign_key_violation then perform test.verifier(true, 'un champ déjà utilisé ne peut pas être supprimé (seulement masqué)'); end $$;
reset role;
