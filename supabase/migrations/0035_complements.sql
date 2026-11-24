-- =====================================================================
-- Compléments : la coach saisit, pour chaque cliente, quoi prendre, quand
-- et combien. La cliente voit sa liste, coche ce qu'elle a pris chaque jour,
-- et reçoit un rappel discret par jour, à l'heure qu'elle choisit, si elle l'active.
-- =====================================================================

create table public.complements (
  id         uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  nom        text not null check (length(trim(nom)) between 1 and 80),
  moment     text not null default 'matin'
             check (moment in ('matin', 'midi', 'soir', 'coucher', 'avant_sport', 'apres_sport', 'autre')),
  quantite   text not null check (length(trim(quantite)) between 1 and 80),
  note       text check (length(note) <= 300),
  ordre      integer not null default 0,
  actif      boolean not null default true,
  created_at timestamptz not null default now()
);
create index complements_cliente_idx on public.complements (cliente_id, ordre);
alter table public.complements enable row level security;
revoke all on public.complements from anon;

-- La coach gère tout ; la cliente lit les siens tant que son accès est ouvert.
create policy complements_coach on public.complements for all to authenticated
  using ((select public.est_coach())) with check ((select public.est_coach()));
create policy complements_lecture on public.complements for select to authenticated
  using (cliente_id = (select auth.uid()) and (select public.acces_ouvert()));

-- Ce que la cliente a coché, jour par jour.
create table public.complements_pris (
  complement_id uuid not null references public.complements (id) on delete cascade,
  cliente_id    uuid not null default auth.uid() references public.clientes (id) on delete cascade,
  jour          date not null,
  pris_le       timestamptz not null default now(),
  primary key (complement_id, jour)
);
create index complements_pris_cliente_idx on public.complements_pris (cliente_id, jour desc);
alter table public.complements_pris enable row level security;
revoke all on public.complements_pris from anon;

create policy complements_pris_lecture on public.complements_pris for select to authenticated
  using ((select public.est_coach()) or (cliente_id = (select auth.uid()) and (select public.acces_ouvert())));
-- Seule la cliente coche, pour elle-même, un de SES compléments, jamais dans le futur.
create policy complements_pris_ajout on public.complements_pris for insert to authenticated
  with check (
    cliente_id = (select auth.uid())
    and not (select public.est_coach())
    and (select public.acces_ouvert())
    and jour <= (now() at time zone 'Europe/Paris')::date
    and exists (select 1 from public.complements c where c.id = complement_id and c.cliente_id = (select auth.uid()))
  );
create policy complements_pris_suppr on public.complements_pris for delete to authenticated
  using (cliente_id = (select auth.uid()) and (select public.acces_ouvert()));

-- Rappel discret : une fois par jour, à l'heure choisie par la cliente (vide = pas de rappel).
alter table public.clientes
  add column rappel_complements_heure  time,
  add column rappel_complements_envoye date;

create or replace function public.definir_rappel_complements(p_heure time)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.clientes set rappel_complements_heure = p_heure
  where id = (select auth.uid()) and statut <> 'fermee';
$$;
revoke execute on function public.definir_rappel_complements(time) from public, anon;
grant execute on function public.definir_rappel_complements(time) to authenticated;
