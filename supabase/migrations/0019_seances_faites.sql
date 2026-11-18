-- =====================================================================
-- Séances faites en mode guidé : la cliente valide sa séance (avec un
-- ressenti facultatif), la coach voit l'historique dans sa fiche.
-- =====================================================================

create table public.seances_faites (
  id            uuid primary key default gen_random_uuid(),
  cliente_id    uuid not null default auth.uid() references public.clientes (id) on delete cascade,
  programme_id  uuid references public.programmes_sportifs (id) on delete set null,
  seance_nom    text not null check (length(trim(seance_nom)) between 1 and 100),
  faite_le      timestamptz not null default now(),
  duree_minutes smallint check (duree_minutes between 0 and 600),
  -- 1 très facile … 5 très dur
  ressenti      smallint check (ressenti between 1 and 5),
  commentaire   text check (length(commentaire) <= 500)
);
create index seances_faites_cliente_idx on public.seances_faites (cliente_id, faite_le desc);
alter table public.seances_faites enable row level security;
revoke all on public.seances_faites from anon;

-- La coach lit tout ; la cliente lit les siennes tant que son accès est ouvert.
create policy seances_faites_lecture on public.seances_faites for select to authenticated
  using ((select public.est_coach()) or (cliente_id = (select auth.uid()) and (select public.acces_ouvert())));
-- Seule la cliente enregistre ses séances (jamais pour une autre).
create policy seances_faites_ajout on public.seances_faites for insert to authenticated
  with check (cliente_id = (select auth.uid()) and not (select public.est_coach()) and (select public.acces_ouvert()));
-- Effacer une séance validée par erreur : la cliente (les siennes) ou la coach.
create policy seances_faites_suppr on public.seances_faites for delete to authenticated
  using ((select public.est_coach()) or (cliente_id = (select auth.uid()) and (select public.acces_ouvert())));
