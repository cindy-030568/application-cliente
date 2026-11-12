-- =====================================================================
-- Phase 7 : liste de courses de chaque cliente.
-- Chaque ligne est un ingrédient (avec SA quantité, déjà calculée pour
-- ses cibles et ses portions) ou un article ajouté à la main.
-- Les lignes d'une même recette partagent un « lot » pour pouvoir la retirer d'un coup.
-- Liste strictement privée : ni la coach ni une autre cliente n'y ont accès.
-- =====================================================================

create table public.courses (
  id            uuid primary key default gen_random_uuid(),
  cliente_id    uuid not null default auth.uid() references public.clientes (id) on delete cascade,
  lot           uuid,
  recette_id    uuid references public.recettes (id) on delete set null,
  recette_titre text check (length(recette_titre) <= 120),
  portions      integer check (portions between 1 and 6),
  aliment_id    uuid references public.aliments (id) on delete set null,
  nom           text not null check (length(nom) between 1 and 120),
  rayon         text not null default 'Divers' check (length(rayon) between 1 and 40),
  quantite      numeric(8, 1) check (quantite > 0 and quantite <= 100000),
  unite         text check (unite in ('g', 'unite')),
  nom_unite     text check (length(nom_unite) <= 30),
  coche         boolean not null default false,
  created_at    timestamptz not null default now(),
  check ((quantite is null) = (unite is null))
);
create index courses_cliente_idx on public.courses (cliente_id, created_at);

alter table public.courses enable row level security;
revoke all on public.courses from anon;

create policy courses_lecture on public.courses for select to authenticated
  using (cliente_id = (select auth.uid()));
create policy courses_ajout on public.courses for insert to authenticated
  with check (cliente_id = (select auth.uid()) and (select public.acces_ouvert()) and not (select public.est_coach()));
create policy courses_modif on public.courses for update to authenticated
  using (cliente_id = (select auth.uid()))
  with check (cliente_id = (select auth.uid()) and (select public.acces_ouvert()));
create policy courses_suppr on public.courses for delete to authenticated
  using (cliente_id = (select auth.uid()));

-- Garde-fou : 300 lignes maximum par cliente.
create or replace function public.limiter_courses()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.courses where cliente_id = new.cliente_id) >= 300 then
    raise exception 'Liste de courses pleine' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke execute on function public.limiter_courses() from public, anon, authenticated;
create trigger courses_limite before insert on public.courses
  for each row execute function public.limiter_courses();
