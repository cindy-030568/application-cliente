-- =====================================================================
-- Phase 4 — Bibliothèque de vidéos d'exercices (hébergées sur YouTube,
-- en « non répertoriée »), filtrables par groupe musculaire, matériel
-- et catégorie.
-- =====================================================================

create table public.filtres_video (
  id     uuid primary key default gen_random_uuid(),
  famille text not null check (famille in ('groupe', 'materiel', 'categorie')),
  nom    text not null check (length(nom) between 1 and 40),
  ordre  integer not null default 0,
  unique (famille, nom)
);

insert into public.filtres_video (famille, nom, ordre) values
  ('groupe', 'Fessiers', 1), ('groupe', 'Quadriceps', 2), ('groupe', 'Ischio-jambiers', 3),
  ('groupe', 'Adducteurs', 4), ('groupe', 'Mollets', 5), ('groupe', 'Abdominaux', 6),
  ('groupe', 'Dos', 7), ('groupe', 'Pectoraux', 8), ('groupe', 'Épaules', 9),
  ('groupe', 'Biceps', 10), ('groupe', 'Triceps', 11), ('groupe', 'Corps entier', 12),
  ('materiel', 'Poids du corps', 1), ('materiel', 'Haltères', 2), ('materiel', 'Barre', 3),
  ('materiel', 'Kettlebell', 4), ('materiel', 'Élastique', 5), ('materiel', 'Machine', 6),
  ('materiel', 'Poulie', 7), ('materiel', 'Banc', 8),
  ('categorie', 'Renforcement', 1), ('categorie', 'Haltérophilie', 2), ('categorie', 'Cardio', 3),
  ('categorie', 'Mobilité', 4), ('categorie', 'Gainage', 5), ('categorie', 'Échauffement', 6);

create table public.videos (
  id          uuid primary key default gen_random_uuid(),
  titre       text not null check (length(titre) between 1 and 120),
  youtube_id  text not null check (youtube_id ~ '^[A-Za-z0-9_-]{11}$'),
  description text check (description is null or length(description) <= 600),
  points_cles text[] not null default '{}',
  erreurs     text[] not null default '{}',
  publiee     boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger videos_maj before update on public.videos
  for each row execute function public.maj_updated_at();

create table public.videos_filtres (
  video_id  uuid not null references public.videos (id) on delete cascade,
  filtre_id uuid not null references public.filtres_video (id) on delete cascade,
  primary key (video_id, filtre_id)
);
create index videos_filtres_filtre_idx on public.videos_filtres (filtre_id);

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table public.filtres_video  enable row level security;
alter table public.videos         enable row level security;
alter table public.videos_filtres enable row level security;
revoke all on public.filtres_video, public.videos, public.videos_filtres from anon;

create policy filtres_video_lecture on public.filtres_video
  for select to authenticated using ((select public.acces_ouvert()));
create policy filtres_video_coach on public.filtres_video
  for all to authenticated
  using ((select public.est_coach())) with check ((select public.est_coach()));

-- Les clientes ne voient que les vidéos publiées.
create policy videos_lecture on public.videos
  for select to authenticated
  using ((select public.est_coach()) or (publiee and (select public.acces_ouvert())));
create policy videos_coach on public.videos
  for all to authenticated
  using ((select public.est_coach())) with check ((select public.est_coach()));

create policy videos_filtres_lecture on public.videos_filtres
  for select to authenticated using ((select public.acces_ouvert()));
create policy videos_filtres_coach on public.videos_filtres
  for all to authenticated
  using ((select public.est_coach())) with check ((select public.est_coach()));
