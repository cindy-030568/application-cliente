-- Tests : programmes planifiés (mise en ligne automatique).
\set ON_ERROR_STOP on

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000c200', 'coach20@test.fr', '{}'),
  ('00000000-0000-0000-0000-00000000a200', 'a20@test.fr', '{"prenom":"Agathe"}'),
  ('00000000-0000-0000-0000-00000000b200', 'b20@test.fr', '{"prenom":"Blanche"}');
select public.definir_coach('coach20@test.fr');
insert into public.clientes (id, statut) values
  ('00000000-0000-0000-0000-00000000a200', 'active'),
  ('00000000-0000-0000-0000-00000000b200', 'active');

-- La coach prépare 3 programmes pour A (en cours, à venir dans 2 jours, dans 6 semaines) et un pour B (arrivé à date).
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c200"}', false);
insert into public.programmes_sportifs (id, cliente_id, titre, debut_le) values
  ('20000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000a200', 'P1', (now() at time zone 'Europe/Paris')::date - 40),
  ('20000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000a200', 'P2', (now() at time zone 'Europe/Paris')::date + 2),
  ('20000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-00000000a200', 'P3', (now() at time zone 'Europe/Paris')::date + 44),
  ('20000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-00000000b200', 'PB', (now() at time zone 'Europe/Paris')::date);
reset role;

-- B : rien n'est visible avant la mise en ligne, puis B déclenche elle-même la sienne (pas celle de A).
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000b200"}', false);
select test.verifier((select count(*) from public.programmes_sportifs) = 0, 'B ne voit pas un programme pas encore en ligne');
select test.verifier((select count(*) from public.activer_programmes_planifies('00000000-0000-0000-0000-00000000a200')) = 1, 'B ne déclenche que le sien, même en visant A');
select test.verifier((select titre from public.programmes_sportifs) = 'PB', 'B voit son programme arrivé à date');
reset role;
select test.verifier(not (select publie from public.programmes_sportifs where id = '20000000-0000-0000-0000-00000000000a'), 'le programme de A n’a pas été touché par B');

-- Tâche du matin (clé de service : pas d'utilisatrice) : P1 passe en ligne (arrivé à date), pas P2 ni P3.
select set_config('request.jwt.claims', '', false);
select test.verifier((select count(*) from public.activer_programmes_planifies()) = 1, 'la tâche du matin met en ligne P1');
select test.verifier(
  (select publie and renouveler_le = (now() at time zone 'Europe/Paris')::date + 2 from public.programmes_sportifs where id = '20000000-0000-0000-0000-00000000000a'),
  'P1 en ligne, changement prévu à la date de P2');
select test.verifier((select count(*) from public.activer_programmes_planifies()) = 0, 'rien de plus tant que P2 n’est pas à date');

-- A voit P1 seulement, et la date de son prochain programme (pas son contenu).
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a200"}', false);
select test.verifier((select count(*) from public.programmes_sportifs) = 1, 'A ne voit que le programme en ligne');
select test.verifier(public.ma_prochaine_bascule() = (now() at time zone 'Europe/Paris')::date + 2, 'A connaît la date de son prochain programme');
update public.programmes_sportifs set debut_le = (now() at time zone 'Europe/Paris')::date where id = '20000000-0000-0000-0000-00000000000b';
reset role;
select test.verifier((select debut_le from public.programmes_sportifs where id = '20000000-0000-0000-0000-00000000000b') = (now() at time zone 'Europe/Paris')::date + 2, 'A ne peut pas avancer la date de son programme');
select set_config('request.jwt.claims', '', false);

-- P2 arrive à date (tâche du matin) : il remplace P1 ; un programme plus ancien jamais publié ne repasse pas devant.
update public.programmes_sportifs set debut_le = (now() at time zone 'Europe/Paris')::date where id = '20000000-0000-0000-0000-00000000000b';
insert into public.programmes_sportifs (id, cliente_id, titre, debut_le) values
  ('20000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-00000000a200', 'Ancien', (now() at time zone 'Europe/Paris')::date - 10);
select public.activer_programmes_planifies();
select test.verifier((select titre from public.programmes_sportifs where cliente_id = '00000000-0000-0000-0000-00000000a200' and publie) = 'P2', 'P2 remplace P1');
select public.activer_programmes_planifies();
select test.verifier((select titre from public.programmes_sportifs where cliente_id = '00000000-0000-0000-0000-00000000a200' and publie) = 'P2', 'un programme plus ancien ne repasse pas devant');
