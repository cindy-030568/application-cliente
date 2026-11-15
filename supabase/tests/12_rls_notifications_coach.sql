-- Tests : appareils de la coach (réservés à la coach).
\set ON_ERROR_STOP on

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000cc', 'coach12@test.fr', '{}'),
  ('00000000-0000-0000-0000-0000000000ac', 'a12@test.fr', '{"prenom":"Agathe"}');
select public.definir_coach('coach12@test.fr');
insert into public.clientes (id, statut) values ('00000000-0000-0000-0000-0000000000ac', 'active');

select test.verifier((select notif_coach_bilans and notif_coach_email and not notif_coach_messages from public.reglages),
  'par défaut : bilans par email et notification, pas les messages');

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000cc"}', false);
insert into public.abonnements_coach (endpoint, p256dh, auth, appareil) values ('https://push.exemple/coach', 'k', 'a', 'iPhone');
select test.verifier((select count(*) from public.abonnements_coach) = 1, 'la coach enregistre son téléphone');
update public.reglages set notif_coach_messages = true;
select test.verifier((select notif_coach_messages from public.reglages), 'la coach règle ses notifications');
reset role;

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000ac"}', false);
select test.verifier((select count(*) from public.abonnements_coach) = 0, 'une cliente ne voit pas les appareils de la coach');
do $$ begin
  insert into public.abonnements_coach (endpoint, p256dh, auth) values ('https://push.exemple/espion', 'k', 'a');
  raise exception 'ÉCHEC : cliente abonnée comme coach';
exception when insufficient_privilege then perform test.verifier(true, 'une cliente ne peut pas recevoir les notifications de la coach'); end $$;
do $$ declare n int; begin
  update public.reglages set notif_coach_bilans = false;
  get diagnostics n = row_count;
  perform test.verifier(n = 0, 'une cliente ne peut pas couper les notifications de la coach');
end $$;
reset role;
