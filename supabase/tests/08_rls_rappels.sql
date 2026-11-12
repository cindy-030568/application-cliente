-- Tests de sécurité de la phase 8 : rappels, appareils abonnés, préférence email.
\set ON_ERROR_STOP on

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000c8', 'coach8@test.fr', '{}'),
  ('00000000-0000-0000-0000-0000000000a8', 'a8@test.fr', '{"prenom":"Anaïs"}'),
  ('00000000-0000-0000-0000-0000000000b8', 'b8@test.fr', '{"prenom":"Bérénice"}'),
  ('00000000-0000-0000-0000-0000000000f8', 'f8@test.fr', '{"prenom":"Fanny"}');
select public.definir_coach('coach8@test.fr');
insert into public.clientes (id, statut) values
  ('00000000-0000-0000-0000-0000000000a8', 'active'),
  ('00000000-0000-0000-0000-0000000000b8', 'active'),
  ('00000000-0000-0000-0000-0000000000f8', 'fermee');
insert into public.rappels_envoyes (cliente_id, echeance, type, canaux) values
  ('00000000-0000-0000-0000-0000000000a8', '2026-11-10', 'ouverture', '{email,push}'),
  ('00000000-0000-0000-0000-0000000000b8', '2026-11-10', 'ouverture', '{email}');

select test.verifier((select relance_jours from public.reglages) = 2, 'relance 2 jours après par défaut');
do $$ begin
  insert into public.rappels_envoyes (cliente_id, echeance, type) values ('00000000-0000-0000-0000-0000000000a8', '2026-11-10', 'ouverture');
  raise exception 'ÉCHEC : rappel en double';
exception when unique_violation then perform test.verifier(true, 'un même rappel ne peut pas être envoyé deux fois'); end $$;

-- ===================== Cliente A =====================
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a8"}', false);
select public.enregistrer_abonnement_push('https://push.exemple/abc', 'cle', 'auth', 'iPhone');
select test.verifier((select count(*) from public.abonnements_push) = 1, 'A enregistre son téléphone');
select public.definir_rappels_email(false);
select test.verifier(not (select rappels_email from public.clientes), 'A peut couper ses emails de rappel');
select test.verifier((select count(*) from public.rappels_envoyes) = 1, 'A ne voit que SES rappels');
do $$ begin
  insert into public.abonnements_push (cliente_id, endpoint, p256dh, auth) values ('00000000-0000-0000-0000-0000000000b8', 'https://push.exemple/x', 'k', 'a');
  raise exception 'ÉCHEC : insertion directe';
exception when insufficient_privilege then perform test.verifier(true, 'A ne peut pas ajouter un appareil à quelqu''un d''autre'); end $$;
do $$ begin
  insert into public.rappels_envoyes (cliente_id, echeance, type) values ('00000000-0000-0000-0000-0000000000a8', '2026-12-01', 'relance');
  raise exception 'ÉCHEC : A écrit dans le journal';
exception when insufficient_privilege then perform test.verifier(true, 'A ne peut pas écrire dans le journal des rappels'); end $$;
do $$ declare n int; begin
  update public.clientes set frequence_bilan_jours = 99;
  get diagnostics n = row_count;
  perform test.verifier(n = 0, 'A ne peut toujours pas modifier sa fiche');
end $$;
reset role;

-- ===================== Cliente B : même téléphone =====================
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b8"}', false);
select test.verifier((select count(*) from public.abonnements_push) = 0, 'B ne voit pas les appareils de A');
select public.enregistrer_abonnement_push('https://push.exemple/abc', 'cle2', 'auth2', 'iPhone');
select test.verifier((select count(*) from public.abonnements_push) = 1, 'le téléphone partagé passe à B');
select test.verifier((select rappels_email from public.clientes), 'la préférence de A n''a pas touché B');
reset role;
select test.verifier((select cliente_id from public.abonnements_push where endpoint = 'https://push.exemple/abc') = '00000000-0000-0000-0000-0000000000b8',
  'A ne reçoit plus les notifications de ce téléphone');

-- ===================== Cliente F (fermée) =====================
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f8"}', false);
do $$ begin
  perform public.enregistrer_abonnement_push('https://push.exemple/f', 'k', 'a', 'Android');
  raise exception 'ÉCHEC : cliente fermée abonnée';
exception when insufficient_privilege then perform test.verifier(true, 'F (fermée) ne peut pas s''abonner'); end $$;
reset role;

-- ===================== Coach =====================
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c8"}', false);
select test.verifier((select count(*) from public.rappels_envoyes) = 2, 'la coach voit tous les rappels envoyés');
select test.verifier((select count(*) from public.abonnements_push) = 1, 'la coach voit qui a activé les notifications');
do $$ begin
  perform public.enregistrer_abonnement_push('https://push.exemple/c', 'k', 'a', 'Mac');
  raise exception 'ÉCHEC : coach abonnée';
exception when insufficient_privilege then perform test.verifier(true, 'la coach n''a pas d''abonnement de cliente'); end $$;
update public.reglages set relance_jours = 3;
select test.verifier((select relance_jours from public.reglages) = 3, 'la coach règle le délai de relance');
reset role;
