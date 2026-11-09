-- Tests de sécurité de la phase 2 : plans, fichiers PDF, ressources.
\set ON_ERROR_STOP on

-- Jeu de données : coach, A (active), C (active), D (fermée)
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000c0', 'coach2@test.fr', '{}'),
  ('00000000-0000-0000-0000-0000000000a2', 'a2@test.fr', '{"prenom":"Anne"}'),
  ('00000000-0000-0000-0000-0000000000c2', 'c2@test.fr', '{"prenom":"Chloé"}'),
  ('00000000-0000-0000-0000-0000000000d2', 'd2@test.fr', '{"prenom":"Diane"}');
select public.definir_coach('coach2@test.fr');
insert into public.clientes (id, statut) values
  ('00000000-0000-0000-0000-0000000000a2', 'active'),
  ('00000000-0000-0000-0000-0000000000c2', 'active'),
  ('00000000-0000-0000-0000-0000000000d2', 'fermee');

insert into public.plans (id, cliente_id, type, source, titre, fichier_path, actif, url) values
  ('00000000-0000-0000-0000-00000000aa01', '00000000-0000-0000-0000-0000000000a2', 'nutrition', 'pdf', 'Plan A v1', '00000000-0000-0000-0000-0000000000a2/nutrition/v1.pdf', false, null),
  ('00000000-0000-0000-0000-00000000aa02', '00000000-0000-0000-0000-0000000000a2', 'nutrition', 'pdf', 'Plan A v2', '00000000-0000-0000-0000-0000000000a2/nutrition/v2.pdf', true, null),
  ('00000000-0000-0000-0000-00000000cc01', '00000000-0000-0000-0000-0000000000c2', 'nutrition', 'nutrium', 'Plan C', null, true, 'https://app.nutrium.io/x'),
  ('00000000-0000-0000-0000-00000000dd01', '00000000-0000-0000-0000-0000000000d2', 'sport', 'pdf', 'Plan D', '00000000-0000-0000-0000-0000000000d2/sport/v1.pdf', true, null);

insert into storage.objects (bucket_id, name) values
  ('plans', '00000000-0000-0000-0000-0000000000a2/nutrition/v2.pdf'),
  ('plans', '00000000-0000-0000-0000-0000000000c2/sport/v1.pdf'),
  ('plans', '00000000-0000-0000-0000-0000000000d2/sport/v1.pdf');

insert into public.ressources (id, titre, url, visibilite) values
  ('00000000-0000-0000-0000-00000000ee01', 'Guide pour toutes', 'https://drive.google.com/a', 'toutes'),
  ('00000000-0000-0000-0000-00000000ee02', 'Ressource pour Chloé', 'https://drive.google.com/b', 'certaines');
insert into public.ressources_clientes values
  ('00000000-0000-0000-0000-00000000ee02', '00000000-0000-0000-0000-0000000000c2');

select test.verifier((select count(*) from public.categories_ressource) = 4, 'les 4 catégories de départ existent');
select test.verifier((select public from storage.buckets where id = 'plans') = false, 'le bucket des plans est privé');

do $$ begin
  insert into public.plans (cliente_id, type, source, titre, fichier_path, actif)
  values ('00000000-0000-0000-0000-0000000000a2', 'nutrition', 'pdf', 'doublon', 'x.pdf', true);
  raise exception 'ÉCHEC : deux plans actifs du même type';
exception when unique_violation then
  perform test.verifier(true, 'un seul plan actif par type et par cliente');
end $$;
do $$ begin
  insert into public.plans (cliente_id, type, source, titre, url)
  values ('00000000-0000-0000-0000-0000000000a2', 'sport', 'nutrium', 'x', 'https://nutrium.io');
  raise exception 'ÉCHEC : lien Nutrium accepté pour un plan sportif';
exception when check_violation then
  perform test.verifier(true, 'Nutrium réservé au plan alimentaire');
end $$;
do $$ begin
  insert into public.plans (cliente_id, type, source, titre, url)
  values ('00000000-0000-0000-0000-0000000000a2', 'sport', 'drive', 'x', 'javascript:alert(1)');
  raise exception 'ÉCHEC : lien non https accepté';
exception when check_violation then
  perform test.verifier(true, 'seuls les liens https sont acceptés');
end $$;

-- ===================== Cliente A =====================
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2"}', false);
select test.verifier((select count(*) from public.plans) = 2, 'A voit ses 2 versions de plan (historique)');
select test.verifier(not exists (select 1 from public.plans where cliente_id <> '00000000-0000-0000-0000-0000000000a2'),
  'A ne voit aucun plan d''une autre cliente');
select test.verifier((select count(*) from storage.objects where bucket_id = 'plans') = 1,
  'A ne voit que ses propres fichiers PDF');
do $$ declare n int; begin
  update public.plans set titre = 'piratage' where id = '00000000-0000-0000-0000-00000000aa02';
  get diagnostics n = row_count;
  perform test.verifier(n = 0, 'A ne peut pas modifier son plan');
  delete from public.plans where id = '00000000-0000-0000-0000-00000000aa02';
  get diagnostics n = row_count;
  perform test.verifier(n = 0, 'A ne peut pas supprimer son plan');
  delete from storage.objects where bucket_id = 'plans';
  get diagnostics n = row_count;
  perform test.verifier(n = 0, 'A ne peut pas supprimer de fichier');
end $$;
do $$ begin
  insert into storage.objects (bucket_id, name) values ('plans', '00000000-0000-0000-0000-0000000000a2/nutrition/pirate.pdf');
  raise exception 'ÉCHEC : A a pu déposer un fichier';
exception when insufficient_privilege then
  perform test.verifier(true, 'A ne peut pas déposer de fichier');
end $$;
do $$ begin
  perform public.publier_plan('00000000-0000-0000-0000-0000000000a2', 'sport', 'drive', 'x', null, 'https://drive.google.com/x');
  raise exception 'ÉCHEC : A a pu publier un plan';
exception when insufficient_privilege then
  perform test.verifier(true, 'A ne peut pas publier de plan');
end $$;
select public.marquer_plan_vu('00000000-0000-0000-0000-00000000aa02');
select public.marquer_plan_vu('00000000-0000-0000-0000-00000000cc01');
select test.verifier((select vu_le is not null from public.plans where id = '00000000-0000-0000-0000-00000000aa02'),
  'A peut marquer son plan comme vu');
select test.verifier((select count(*) from public.ressources) = 1, 'A ne voit que la ressource « pour toutes »');
select test.verifier((select count(*) from public.ressources_clientes) = 0, 'A ne voit pas les attributions des autres');
select test.verifier((select count(*) from public.categories_ressource) = 4, 'A voit les catégories');
reset role;
select test.verifier((select vu_le is null from public.plans where id = '00000000-0000-0000-0000-00000000cc01'),
  'A ne peut pas marquer le plan d''une autre cliente comme vu');

-- ===================== Cliente C =====================
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c2"}', false);
select test.verifier((select count(*) from public.ressources) = 2, 'C voit la ressource partagée + celle choisie pour elle');
reset role;

-- ===================== Cliente D (accès fermé) =====================
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d2"}', false);
select test.verifier((select count(*) from public.plans) = 0, 'D (fermée) ne voit plus ses plans');
select test.verifier((select count(*) from storage.objects) = 0, 'D (fermée) ne peut plus lire ses fichiers');
select test.verifier((select count(*) from public.ressources) = 0, 'D (fermée) ne voit plus les ressources');
reset role;

-- ===================== Coach =====================
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c0"}', false);
select test.verifier((select count(*) from public.plans) = 4, 'la coach voit tous les plans');
select public.publier_plan('00000000-0000-0000-0000-0000000000a2', 'nutrition', 'drive', 'Plan A v3', null, 'https://drive.google.com/v3');
select test.verifier((select titre from public.plans where cliente_id = '00000000-0000-0000-0000-0000000000a2' and type = 'nutrition' and actif) = 'Plan A v3'
  and (select count(*) from public.plans where cliente_id = '00000000-0000-0000-0000-0000000000a2' and type = 'nutrition') = 3,
  'publier une nouvelle version garde l''ancienne dans l''historique');
select test.verifier((select count(*) from storage.objects) = 3, 'la coach voit tous les fichiers');
insert into storage.objects (bucket_id, name) values ('plans', '00000000-0000-0000-0000-0000000000a2/sport/v1.pdf');
select test.verifier(true, 'la coach peut déposer un fichier');
select test.verifier((select count(*) from public.ressources) = 2, 'la coach voit toutes les ressources');
insert into public.categories_ressource (nom, ordre) values ('Recettes', 5);
select test.verifier(true, 'la coach peut ajouter une catégorie');
reset role;
