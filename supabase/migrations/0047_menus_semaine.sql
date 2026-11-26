-- =====================================================================
-- Espace abonnées, étape 4 (cuisine) : le menu de la semaine.
--
-- - La coach prépare un menu par semaine (lundi → dimanche, tous les repas)
--   à partir de ses recettes : l'appli le propose, elle le retouche, puis le publie.
-- - Le batch cooking du dimanche est lié au menu : des étapes (une par ligne)
--   pour préparer à l'avance, et la liste de courses du menu.
-- - Une abonnée ACTIVE lit les menus PUBLIÉS ; la coach fait tout.
-- - La liste de courses (0007) s'ouvre aux abonnées actives (toujours privée).
-- =====================================================================

create table if not exists public.menus_semaine (
  id          uuid primary key default gen_random_uuid(),
  lundi       date not null unique check (extract(isodow from lundi) = 1),
  mot         text check (length(mot) <= 1000),
  batch       text check (length(batch) <= 4000),
  publie      boolean not null default false,
  annonce_le  timestamptz,
  created_at  timestamptz not null default now(),
  maj_le      timestamptz not null default now()
);

create table if not exists public.menus_repas (
  menu_id    uuid not null references public.menus_semaine (id) on delete cascade,
  jour       smallint not null check (jour between 1 and 7),
  repas      text not null check (repas in ('petit_dejeuner', 'dejeuner', 'collation', 'diner')),
  recette_id uuid not null references public.recettes (id) on delete cascade,
  primary key (menu_id, jour, repas)
);
create index if not exists menus_repas_recette_idx on public.menus_repas (recette_id);

alter table public.menus_semaine enable row level security;
alter table public.menus_repas enable row level security;
revoke all on public.menus_semaine, public.menus_repas from anon;

create policy menus_lecture on public.menus_semaine for select to authenticated
  using ((select public.est_coach()) or (publie and (select public.est_abonnee_active())));
create policy menus_ajout on public.menus_semaine for insert to authenticated
  with check ((select public.est_coach()));
create policy menus_modif on public.menus_semaine for update to authenticated
  using ((select public.est_coach())) with check ((select public.est_coach()));
create policy menus_suppr on public.menus_semaine for delete to authenticated
  using ((select public.est_coach()));

create policy menus_repas_lecture on public.menus_repas for select to authenticated
  using (
    (select public.est_coach())
    or ((select public.est_abonnee_active()) and exists (select 1 from public.menus_semaine m where m.id = menu_id and m.publie))
  );
create policy menus_repas_ajout on public.menus_repas for insert to authenticated
  with check ((select public.est_coach()));
create policy menus_repas_modif on public.menus_repas for update to authenticated
  using ((select public.est_coach())) with check ((select public.est_coach()));
create policy menus_repas_suppr on public.menus_repas for delete to authenticated
  using ((select public.est_coach()));

-- ---------- Liste de courses : aussi pour les abonnées actives ----------
drop policy if exists courses_ajout on public.courses;
create policy courses_ajout on public.courses for insert to authenticated
  with check (cliente_id = (select auth.uid()) and (select public.acces_appli()) and not (select public.est_coach()));
drop policy if exists courses_modif on public.courses;
create policy courses_modif on public.courses for update to authenticated
  using (cliente_id = (select auth.uid()))
  with check (cliente_id = (select auth.uid()) and (select public.acces_appli()));
