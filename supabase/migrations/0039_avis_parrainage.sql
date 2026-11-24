-- =====================================================================
-- Avis et parrainage.
-- 1. Avis : après une victoire ou à la fin du suivi, la cliente laisse un témoignage.
--    Une case SÉPARÉE dit si la coach a le droit de le publier, et sous quel nom
--    (prénom, initiale ou anonyme). La cliente peut changer d'avis ou le retirer.
-- 2. Parrainage : chaque cliente a un code personnel (et un lien vers le formulaire
--    d'inscription Tally). Une inscription avec ce code est rattachée à la marraine.
--    La récompense est gérée à la main par la coach : aucun paiement automatique.
-- =====================================================================

-- ---------- 1. Avis ----------
create table public.avis (
  id          uuid primary key default gen_random_uuid(),
  cliente_id  uuid not null default auth.uid() references public.clientes (id) on delete cascade,
  texte       text not null check (length(trim(texte)) between 10 and 2000),
  -- Consentement à la publication, distinct du témoignage lui-même.
  publiable   boolean not null default false,
  nom_affiche text check (nom_affiche in ('prenom', 'initiale', 'anonyme')),
  contexte    text not null default 'libre' check (contexte in ('victoire', 'fin', 'libre')),
  cree_le     timestamptz not null default now(),
  modifie_le  timestamptz not null default now(),
  check (not publiable or nom_affiche is not null)
);
create index avis_cliente_idx on public.avis (cliente_id, cree_le desc);
alter table public.avis enable row level security;
revoke all on public.avis from anon;

-- La coach lit et peut supprimer ; elle ne modifie jamais le texte ni le consentement.
create policy avis_coach_lecture on public.avis for select to authenticated using ((select public.est_coach()));
create policy avis_coach_suppr on public.avis for delete to authenticated using ((select public.est_coach()));
-- La cliente gère les siens tant que son accès est ouvert.
create policy avis_cliente_lecture on public.avis for select to authenticated
  using (cliente_id = (select auth.uid()) and (select public.acces_ouvert()));
create policy avis_cliente_ajout on public.avis for insert to authenticated
  with check (cliente_id = (select auth.uid()) and not (select public.est_coach()) and (select public.acces_ouvert()));
create policy avis_cliente_modif on public.avis for update to authenticated
  using (cliente_id = (select auth.uid()) and (select public.acces_ouvert()))
  with check (cliente_id = (select auth.uid()) and (select public.acces_ouvert()));
create policy avis_cliente_suppr on public.avis for delete to authenticated
  using (cliente_id = (select auth.uid()) and (select public.acces_ouvert()));
-- Garde-fou : 20 avis au plus par cliente.
create or replace function public.limiter_avis()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.avis where cliente_id = new.cliente_id) >= 20 then
    raise exception 'Trop d''avis' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger avis_limite before insert on public.avis for each row execute function public.limiter_avis();

-- ---------- 2. Parrainage ----------
-- Code de 6 caractères faciles à lire (sans 0/O, 1/I/L).
create or replace function public.nouveau_code_parrainage()
returns text
language sql
volatile
set search_path = ''
as $$
  select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random() * 31)::int, 1), '')
  from generate_series(1, 6);
$$;

alter table public.clientes
  add column code_parrainage text unique default public.nouveau_code_parrainage()
    check (code_parrainage ~ '^[A-Z0-9]{6}$');
update public.clientes set code_parrainage = public.nouveau_code_parrainage() where code_parrainage is null;

-- Lien du formulaire d'inscription (Tally), pour le lien de parrainage de chaque cliente.
alter table public.reglages
  add column lien_inscription text default 'https://tally.so/r/EkdN0A' check (lien_inscription is null or lien_inscription like 'https://%');

-- Demandes d'inscription : code saisi (ou venu du lien) et marraine reconnue.
alter table public.demandes_inscription
  add column code_parrainage text check (length(code_parrainage) <= 20),
  add column marraine_id uuid references public.clientes (id) on delete set null,
  add column recompense_donnee boolean not null default false;
