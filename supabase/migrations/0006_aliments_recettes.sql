-- =====================================================================
-- Phase 5 — Base d'aliments (Ciqual + aliments perso), catégories
-- d'exclusion, cibles par repas et exclusions des clientes, recettes
-- maîtres avec le rôle de chaque ingrédient, favoris.
-- =====================================================================

-- ---------- Catégories d'exclusion ----------
create table public.categories_aliment (
  id    uuid primary key default gen_random_uuid(),
  nom   text not null unique check (length(nom) between 1 and 40),
  ordre integer not null default 0
);
insert into public.categories_aliment (nom, ordre) values
  ('Viande', 1), ('Porc', 2), ('Volaille', 3), ('Poisson', 4), ('Fruits de mer', 5), ('Œuf', 6),
  ('Produits laitiers', 7), ('Gluten', 8), ('Fruits à coque', 9), ('Arachide', 10), ('Soja', 11), ('Sésame', 12);

-- ---------- Aliments ----------
create table public.aliments (
  id                     uuid primary key default gen_random_uuid(),
  source                 text not null default 'perso' check (source in ('ciqual', 'perso')),
  code_ciqual            text unique,
  nom                    text not null check (length(nom) between 1 and 200),
  nom_recherche          text not null default '',
  groupe                 text,
  sous_groupe            text,
  proteines_100          numeric(6, 2) not null default 0 check (proteines_100 between 0 and 100),
  glucides_100           numeric(6, 2) not null default 0 check (glucides_100 between 0 and 100),
  lipides_100            numeric(6, 2) not null default 0 check (lipides_100 between 0 and 100),
  kcal_100               numeric(6, 1) not null default 0 check (kcal_100 between 0 and 950),
  incomplet              boolean not null default false,
  nom_unite              text check (nom_unite is null or length(nom_unite) between 1 and 30),
  poids_unite_g          numeric(6, 1) check (poids_unite_g is null or poids_unite_g > 0),
  categories_verifiees   boolean not null default false,
  actif                  boolean not null default true,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  check ((nom_unite is null) = (poids_unite_g is null)),
  check (source <> 'ciqual' or code_ciqual is not null)
);
create index aliments_recherche_idx on public.aliments (nom_recherche);
create trigger aliments_maj before update on public.aliments
  for each row execute function public.maj_updated_at();

create table public.aliments_categories (
  aliment_id   uuid not null references public.aliments (id) on delete cascade,
  categorie_id uuid not null references public.categories_aliment (id) on delete cascade,
  primary key (aliment_id, categorie_id)
);
create index aliments_categories_categorie_idx on public.aliments_categories (categorie_id);

-- ---------- Cibles par repas (une ligne par repas de la cliente) ----------
create table public.repas_cibles (
  id          uuid primary key default gen_random_uuid(),
  cliente_id  uuid not null references public.clientes (id) on delete cascade,
  type_repas  text not null check (type_repas in ('petit_dejeuner', 'dejeuner', 'gouter', 'diner', 'collation')),
  libelle     text not null check (length(libelle) between 1 and 40),
  ordre       integer not null default 0,
  proteines_g numeric(5, 1) not null check (proteines_g between 0 and 300),
  glucides_g  numeric(5, 1) not null check (glucides_g between 0 and 500),
  lipides_g   numeric(5, 1) not null check (lipides_g between 0 and 200),
  kcal        numeric(6, 1) generated always as (4 * proteines_g + 4 * glucides_g + 9 * lipides_g) stored,
  created_at  timestamptz not null default now()
);
create index repas_cibles_cliente_idx on public.repas_cibles (cliente_id, ordre);

-- ---------- Exclusions (catégorie entière ou aliment précis) ----------
create table public.exclusions (
  id           uuid primary key default gen_random_uuid(),
  cliente_id   uuid not null references public.clientes (id) on delete cascade,
  categorie_id uuid references public.categories_aliment (id) on delete cascade,
  aliment_id   uuid references public.aliments (id) on delete cascade,
  created_at   timestamptz not null default now(),
  check ((categorie_id is null) <> (aliment_id is null))
);
create unique index exclusions_categorie_unique on public.exclusions (cliente_id, categorie_id) where categorie_id is not null;
create unique index exclusions_aliment_unique on public.exclusions (cliente_id, aliment_id) where aliment_id is not null;

-- ---------- Recettes maîtres ----------
create table public.tags (
  id    uuid primary key default gen_random_uuid(),
  nom   text not null unique check (length(nom) between 1 and 30),
  ordre integer not null default 0
);
insert into public.tags (nom, ordre) values
  ('Rapide', 1), ('Batch cooking', 2), ('Végétarien', 3), ('Sucré', 4), ('Salé', 5), ('Sans cuisson', 6);

create table public.recettes (
  id             uuid primary key default gen_random_uuid(),
  titre          text not null unique check (length(titre) between 1 and 120),
  description    text check (description is null or length(description) <= 400),
  photo_path     text,
  temps_prep_min integer check (temps_prep_min is null or temps_prep_min between 0 and 600),
  etapes         text[] not null default '{}',
  astuce         text check (astuce is null or length(astuce) <= 600),
  publiee        boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create trigger recettes_maj before update on public.recettes
  for each row execute function public.maj_updated_at();

-- « collation » couvre aussi le goûter.
create table public.recettes_repas (
  recette_id uuid not null references public.recettes (id) on delete cascade,
  type_repas text not null check (type_repas in ('petit_dejeuner', 'dejeuner', 'diner', 'collation')),
  primary key (recette_id, type_repas)
);

create table public.recettes_tags (
  recette_id uuid not null references public.recettes (id) on delete cascade,
  tag_id     uuid not null references public.tags (id) on delete cascade,
  primary key (recette_id, tag_id)
);

-- Rôle : proteine / glucide / lipide (ajustés), fruit (ajusté dans sa fourchette), fixe (ne bouge pas).
-- Quantités exprimées dans l'unité (grammes, ou nombre d'unités si unite = 'unite').
create table public.recette_ingredients (
  id         uuid primary key default gen_random_uuid(),
  recette_id uuid not null references public.recettes (id) on delete cascade,
  aliment_id uuid not null references public.aliments (id) on delete restrict,
  role       text not null check (role in ('proteine', 'glucide', 'lipide', 'fruit', 'fixe')),
  unite      text not null default 'g' check (unite in ('g', 'unite')),
  qte_base   numeric(7, 2) not null check (qte_base > 0),
  qte_min    numeric(7, 2) not null check (qte_min >= 0),
  qte_max    numeric(7, 2) not null,
  pas        numeric(6, 2) not null default 5 check (pas > 0),
  note       text check (note is null or length(note) <= 80),
  ordre      integer not null default 0,
  check (qte_min <= qte_base and qte_base <= qte_max),
  check (role <> 'fixe' or (qte_min = qte_base and qte_max = qte_base))
);
create index recette_ingredients_recette_idx on public.recette_ingredients (recette_id, ordre);
create index recette_ingredients_aliment_idx on public.recette_ingredients (aliment_id);

create table public.favoris (
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  recette_id uuid not null references public.recettes (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (cliente_id, recette_id)
);

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table public.categories_aliment  enable row level security;
alter table public.aliments            enable row level security;
alter table public.aliments_categories enable row level security;
alter table public.repas_cibles        enable row level security;
alter table public.exclusions          enable row level security;
alter table public.tags                enable row level security;
alter table public.recettes            enable row level security;
alter table public.recettes_repas      enable row level security;
alter table public.recettes_tags       enable row level security;
alter table public.recette_ingredients enable row level security;
alter table public.favoris             enable row level security;

revoke all on public.categories_aliment, public.aliments, public.aliments_categories, public.repas_cibles,
              public.exclusions, public.tags, public.recettes, public.recettes_repas, public.recettes_tags,
              public.recette_ingredients, public.favoris from anon;

-- Référentiels : lisibles par toute personne ayant un accès ouvert, modifiables par la coach.
create policy categories_aliment_lecture on public.categories_aliment for select to authenticated using ((select public.acces_ouvert()));
create policy categories_aliment_coach on public.categories_aliment for all to authenticated
  using ((select public.est_coach())) with check ((select public.est_coach()));
create policy aliments_lecture on public.aliments for select to authenticated using ((select public.acces_ouvert()));
create policy aliments_coach on public.aliments for all to authenticated
  using ((select public.est_coach())) with check ((select public.est_coach()));
create policy aliments_categories_lecture on public.aliments_categories for select to authenticated using ((select public.acces_ouvert()));
create policy aliments_categories_coach on public.aliments_categories for all to authenticated
  using ((select public.est_coach())) with check ((select public.est_coach()));
create policy tags_lecture on public.tags for select to authenticated using ((select public.acces_ouvert()));
create policy tags_coach on public.tags for all to authenticated
  using ((select public.est_coach())) with check ((select public.est_coach()));

-- Recettes : les clientes ne voient que les recettes publiées (et leurs ingrédients).
create policy recettes_lecture on public.recettes for select to authenticated
  using ((select public.est_coach()) or (publiee and (select public.acces_ouvert())));
create policy recettes_coach on public.recettes for all to authenticated
  using ((select public.est_coach())) with check ((select public.est_coach()));

create or replace function public.recette_visible(p_recette uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.est_coach() or (
    public.acces_ouvert() and exists (select 1 from public.recettes r where r.id = p_recette and r.publiee)
  );
$$;
revoke execute on function public.recette_visible(uuid) from public, anon;
grant execute on function public.recette_visible(uuid) to authenticated;

create policy recettes_repas_lecture on public.recettes_repas for select to authenticated using (public.recette_visible(recette_id));
create policy recettes_repas_coach on public.recettes_repas for all to authenticated
  using ((select public.est_coach())) with check ((select public.est_coach()));
create policy recettes_tags_lecture on public.recettes_tags for select to authenticated using (public.recette_visible(recette_id));
create policy recettes_tags_coach on public.recettes_tags for all to authenticated
  using ((select public.est_coach())) with check ((select public.est_coach()));
create policy recette_ingredients_lecture on public.recette_ingredients for select to authenticated using (public.recette_visible(recette_id));
create policy recette_ingredients_coach on public.recette_ingredients for all to authenticated
  using ((select public.est_coach())) with check ((select public.est_coach()));

-- Données de la cliente : lecture de SES cibles et exclusions ; écriture par la coach.
create policy repas_cibles_lecture on public.repas_cibles for select to authenticated
  using ((select public.est_coach()) or (cliente_id = (select auth.uid()) and (select public.acces_ouvert())));
create policy repas_cibles_coach on public.repas_cibles for all to authenticated
  using ((select public.est_coach())) with check ((select public.est_coach()));
create policy exclusions_lecture on public.exclusions for select to authenticated
  using ((select public.est_coach()) or (cliente_id = (select auth.uid()) and (select public.acces_ouvert())));
create policy exclusions_coach on public.exclusions for all to authenticated
  using ((select public.est_coach())) with check ((select public.est_coach()));

-- Favoris : chaque cliente gère les siens.
create policy favoris_lecture on public.favoris for select to authenticated
  using ((select public.est_coach()) or cliente_id = (select auth.uid()));
create policy favoris_ajout on public.favoris for insert to authenticated
  with check (cliente_id = (select auth.uid()) and (select public.acces_ouvert()) and public.recette_visible(recette_id));
create policy favoris_suppr on public.favoris for delete to authenticated
  using (cliente_id = (select auth.uid()));

-- =====================================================================
-- Photos des recettes : bucket public (aucune donnée personnelle), 5 Mo.
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('recettes', 'recettes', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy recettes_photos_coach on storage.objects for all to authenticated
  using (bucket_id = 'recettes' and (select public.est_coach()))
  with check (bucket_id = 'recettes' and (select public.est_coach()));
