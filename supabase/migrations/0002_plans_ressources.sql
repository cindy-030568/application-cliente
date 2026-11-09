-- =====================================================================
-- Phase 2 — Plans (nutrition, sport) avec historique, ressources.
-- Fichiers PDF dans un bucket privé, lus uniquement via URLs signées.
-- =====================================================================

-- ---------- Plans ----------
create table public.plans (
  id           uuid primary key default gen_random_uuid(),
  cliente_id   uuid not null references public.clientes (id) on delete cascade,
  type         text not null check (type in ('nutrition', 'sport')),
  source       text not null check (source in ('pdf', 'drive', 'nutrium')),
  titre        text not null check (length(titre) between 1 and 120),
  fichier_path text,
  url          text,
  actif        boolean not null default true,
  vu_le        timestamptz,
  created_at   timestamptz not null default now(),
  check (source <> 'pdf' or fichier_path is not null),
  check (source = 'pdf' or (url is not null and url like 'https://%')),
  check (source <> 'nutrium' or type = 'nutrition')
);
-- Un seul plan actif par cliente et par type.
create unique index plans_un_actif on public.plans (cliente_id, type) where actif;
create index plans_cliente_idx on public.plans (cliente_id, type, created_at desc);

-- Publie une nouvelle version : l'ancienne passe dans l'historique (en une seule opération).
-- « security invoker » : la RLS s'applique, seule la coach peut l'utiliser.
create or replace function public.publier_plan(
  p_cliente uuid, p_type text, p_source text, p_titre text, p_fichier text, p_url text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  nouvel_id uuid;
begin
  if not public.est_coach() then
    raise exception 'Réservé à la coach' using errcode = '42501';
  end if;
  update public.plans set actif = false
  where cliente_id = p_cliente and type = p_type and actif;
  insert into public.plans (cliente_id, type, source, titre, fichier_path, url, actif)
  values (p_cliente, p_type, p_source, p_titre, p_fichier, p_url, true)
  returning id into nouvel_id;
  return nouvel_id;
end;
$$;
revoke execute on function public.publier_plan(uuid, text, text, text, text, text) from public, anon;
grant execute on function public.publier_plan(uuid, text, text, text, text, text) to authenticated;

-- La cliente signale qu'elle a ouvert son plan (pour le badge « Nouveau »).
create or replace function public.marquer_plan_vu(plan_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.plans
  set vu_le = now()
  where id = plan_id and cliente_id = (select auth.uid()) and vu_le is null;
$$;
revoke execute on function public.marquer_plan_vu(uuid) from public, anon;
grant execute on function public.marquer_plan_vu(uuid) to authenticated;

-- ---------- Ressources ----------
create table public.categories_ressource (
  id    uuid primary key default gen_random_uuid(),
  nom   text not null unique check (length(nom) between 1 and 60),
  ordre integer not null default 0
);
insert into public.categories_ressource (nom, ordre) values
  ('Guides', 1), ('Listes de courses', 2), ('Compléments', 3), ('Fiches pratiques', 4);

create table public.ressources (
  id           uuid primary key default gen_random_uuid(),
  titre        text not null check (length(titre) between 1 and 120),
  categorie_id uuid references public.categories_ressource (id) on delete set null,
  description  text check (description is null or length(description) <= 500),
  url          text not null check (url like 'https://%'),
  visibilite   text not null default 'toutes' check (visibilite in ('toutes', 'certaines')),
  created_at   timestamptz not null default now()
);

create table public.ressources_clientes (
  ressource_id uuid not null references public.ressources (id) on delete cascade,
  cliente_id   uuid not null references public.clientes (id) on delete cascade,
  primary key (ressource_id, cliente_id)
);
create index ressources_clientes_cliente_idx on public.ressources_clientes (cliente_id);

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table public.plans                enable row level security;
alter table public.categories_ressource enable row level security;
alter table public.ressources           enable row level security;
alter table public.ressources_clientes  enable row level security;

revoke all on public.plans, public.categories_ressource, public.ressources,
              public.ressources_clientes from anon;

-- Plans : la cliente (accès ouvert) lit les siens ; la coach gère tout.
create policy plans_lecture on public.plans
  for select to authenticated
  using (
    (select public.est_coach())
    or (cliente_id = (select auth.uid()) and (select public.acces_ouvert()))
  );
create policy plans_coach on public.plans
  for all to authenticated
  using ((select public.est_coach()))
  with check ((select public.est_coach()));

-- Catégories : lisibles par toute personne ayant un accès ouvert.
create policy categories_ressource_lecture on public.categories_ressource
  for select to authenticated
  using ((select public.acces_ouvert()));
create policy categories_ressource_coach on public.categories_ressource
  for all to authenticated
  using ((select public.est_coach()))
  with check ((select public.est_coach()));

-- Liens ressource ↔ cliente : la cliente voit les siens.
create policy ressources_clientes_lecture on public.ressources_clientes
  for select to authenticated
  using ((select public.est_coach()) or cliente_id = (select auth.uid()));
create policy ressources_clientes_coach on public.ressources_clientes
  for all to authenticated
  using ((select public.est_coach()))
  with check ((select public.est_coach()));

-- Ressources : visibles par toutes, ou seulement par les clientes choisies.
create policy ressources_lecture on public.ressources
  for select to authenticated
  using (
    (select public.est_coach())
    or (
      (select public.acces_ouvert())
      and (
        visibilite = 'toutes'
        or exists (
          select 1 from public.ressources_clientes rc
          where rc.ressource_id = ressources.id and rc.cliente_id = (select auth.uid())
        )
      )
    )
  );
create policy ressources_coach on public.ressources
  for all to authenticated
  using ((select public.est_coach()))
  with check ((select public.est_coach()));

-- =====================================================================
-- Stockage des PDF : bucket privé « plans », 25 Mo max, PDF uniquement.
-- Chemin des fichiers : <id de la cliente>/<nutrition|sport>/<id>.pdf
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('plans', 'plans', false, 26214400, array['application/pdf'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy plans_fichiers_coach on storage.objects
  for all to authenticated
  using (bucket_id = 'plans' and (select public.est_coach()))
  with check (bucket_id = 'plans' and (select public.est_coach()));

create policy plans_fichiers_cliente on storage.objects
  for select to authenticated
  using (
    bucket_id = 'plans'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select public.acces_ouvert())
  );
