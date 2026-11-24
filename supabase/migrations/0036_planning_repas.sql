-- =====================================================================
-- Planning des repas de la semaine : la cliente choisit, pour chaque jour
-- et chaque repas, une de ses recettes adaptées (même moteur, mêmes
-- exclusions). Un bouton remplit ensuite sa liste de courses existante.
-- La cliente gère son planning ; la coach peut le consulter.
-- =====================================================================

create table public.planning_repas (
  cliente_id     uuid not null default auth.uid() references public.clientes (id) on delete cascade,
  jour           date not null,
  repas_cible_id uuid not null references public.repas_cibles (id) on delete cascade,
  recette_id     uuid not null references public.recettes (id) on delete cascade,
  portions       smallint not null default 1 check (portions between 1 and 6),
  created_at     timestamptz not null default now(),
  primary key (cliente_id, jour, repas_cible_id)
);
create index planning_repas_jour_idx on public.planning_repas (cliente_id, jour);
alter table public.planning_repas enable row level security;
revoke all on public.planning_repas from anon;

create policy planning_lecture on public.planning_repas for select to authenticated
  using ((select public.est_coach()) or (cliente_id = (select auth.uid()) and (select public.acces_ouvert())));
-- Seule la cliente remplit son planning, avec SES repas, tant que son accès est ouvert.
create policy planning_ajout on public.planning_repas for insert to authenticated
  with check (
    cliente_id = (select auth.uid())
    and not (select public.est_coach())
    and (select public.acces_ouvert())
    and exists (select 1 from public.repas_cibles r where r.id = repas_cible_id and r.cliente_id = (select auth.uid()))
  );
create policy planning_modif on public.planning_repas for update to authenticated
  using (cliente_id = (select auth.uid()) and (select public.acces_ouvert()))
  with check (
    cliente_id = (select auth.uid())
    and (select public.acces_ouvert())
    and exists (select 1 from public.repas_cibles r where r.id = repas_cible_id and r.cliente_id = (select auth.uid()))
  );
create policy planning_suppr on public.planning_repas for delete to authenticated
  using (cliente_id = (select auth.uid()) and (select public.acces_ouvert()));

-- Garde-fou : 3 mois de planning au plus par cliente (environ 500 cases).
create or replace function public.limiter_planning()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.planning_repas where cliente_id = new.cliente_id) >= 600 then
    raise exception 'Planning plein' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger planning_limite before insert on public.planning_repas
  for each row execute function public.limiter_planning();
