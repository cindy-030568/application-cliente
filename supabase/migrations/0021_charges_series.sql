-- =====================================================================
-- Poids utilisés en mode séance : la cliente note la charge de chaque
-- série ; la fois d'après, l'appli lui rappelle ce qu'elle a fait.
-- La coach voit l'historique (progression des charges).
-- =====================================================================

create table public.charges_series (
  id           uuid primary key default gen_random_uuid(),
  cliente_id   uuid not null default auth.uid() references public.clientes (id) on delete cascade,
  programme_id uuid references public.programmes_sportifs (id) on delete set null,
  -- Une séance faite (même identifiant pour toutes ses séries).
  seance_ref   uuid not null,
  -- Nom de l'exercice normalisé (minuscules, sans accents) : relie les séances entre elles.
  exercice_cle text not null check (length(exercice_cle) between 1 and 120),
  exercice_nom text not null check (length(trim(exercice_nom)) between 1 and 120),
  serie        smallint not null check (serie between 1 and 50),
  charge_kg    numeric(5, 1) not null check (charge_kg >= 0 and charge_kg <= 500),
  faite_le     timestamptz not null default now(),
  unique (cliente_id, seance_ref, exercice_cle, serie)
);
create index charges_series_exercice_idx on public.charges_series (cliente_id, exercice_cle, faite_le desc);
alter table public.charges_series enable row level security;
revoke all on public.charges_series from anon;

-- La coach lit tout ; la cliente lit les siennes tant que son accès est ouvert.
create policy charges_lecture on public.charges_series for select to authenticated
  using ((select public.est_coach()) or (cliente_id = (select auth.uid()) and (select public.acces_ouvert())));
-- Seule la cliente note (et corrige) ses propres charges.
create policy charges_ajout on public.charges_series for insert to authenticated
  with check (cliente_id = (select auth.uid()) and not (select public.est_coach()) and (select public.acces_ouvert()));
create policy charges_modif on public.charges_series for update to authenticated
  using (cliente_id = (select auth.uid()) and (select public.acces_ouvert()))
  with check (cliente_id = (select auth.uid()) and (select public.acces_ouvert()));
create policy charges_suppr on public.charges_series for delete to authenticated
  using ((select public.est_coach()) or (cliente_id = (select auth.uid()) and (select public.acces_ouvert())));
