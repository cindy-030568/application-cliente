-- =====================================================================
-- Contrat accepté dans l'app avant le premier accès.
-- La coach colle son contrat dans Réglages, avec un numéro de version.
-- À sa première connexion (après le consentement), la cliente lit le contrat
-- et coche deux cases : l'acceptation, puis la renonciation au droit de
-- rétractation (début immédiat de la prestation). On garde la version, le
-- texte exact accepté, la date et l'heure.
-- Les clientes déjà en cours (premier consentement avant la mise en place du
-- contrat) ne sont pas bloquées ; une nouvelle version ne bloque personne qui
-- a déjà accepté une version précédente.
-- =====================================================================

alter table public.reglages
  add column if not exists contrat_texte   text check (length(contrat_texte) <= 100000),
  add column if not exists contrat_version text check (length(contrat_version) between 1 and 40),
  -- Phrase de la case « renonciation au droit de rétractation », écrite par la coach.
  add column if not exists contrat_case_renonciation text check (length(contrat_case_renonciation) <= 2000),
  -- Date de mise en place du premier contrat (ne change plus ensuite).
  add column if not exists contrat_depuis  timestamptz;

create table public.acceptations_contrat (
  id                         uuid primary key default gen_random_uuid(),
  cliente_id                 uuid not null references public.clientes (id) on delete cascade,
  version                    text not null check (length(version) between 1 and 40),
  -- Copie exacte du texte accepté (preuve), recopiée par le serveur depuis les réglages.
  texte                      text not null check (length(texte) <= 100000),
  accepte_le                 timestamptz not null default now(),
  renonciation_retractation  boolean not null,
  -- Phrase exacte de la case de renonciation cochée (preuve).
  texte_renonciation         text check (length(texte_renonciation) <= 2000),
  unique (cliente_id, version)
);
alter table public.acceptations_contrat enable row level security;
revoke all on public.acceptations_contrat from anon;

-- Lecture : la coach, et la cliente pour elle-même tant que son accès est ouvert.
create policy acceptations_lecture on public.acceptations_contrat for select to authenticated
  using ((select public.est_coach()) or (cliente_id = (select auth.uid()) and (select public.acces_ouvert())));
-- Aucune écriture directe : uniquement par la fonction accepter_contrat (preuve non modifiable).

-- Version du contrat que la cliente connectée doit accepter, ou null si rien à faire.
create or replace function public.contrat_a_accepter()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select r.contrat_version
    from public.reglages r
   where r.contrat_version is not null
     and coalesce(r.contrat_texte, '') <> ''
     and exists (select 1 from public.clientes c where c.id = (select auth.uid()) and c.statut <> 'fermee')
     and not exists (select 1 from public.acceptations_contrat a where a.cliente_id = (select auth.uid()))
     -- Déjà en cours avant la mise en place du contrat : pas bloquée.
     and not exists (
       select 1 from public.consentements co
        where co.cliente_id = (select auth.uid()) and co.accepte_le < r.contrat_depuis
     );
$$;

-- La cliente accepte la version en cours. Les deux cases sont obligatoires.
create or replace function public.accepter_contrat(p_version text, p_accepte boolean, p_renonciation boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reglages public.reglages;
begin
  if not coalesce(p_accepte, false) or not coalesce(p_renonciation, false) then
    raise exception 'les deux cases sont obligatoires' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.clientes where id = (select auth.uid()) and statut <> 'fermee') then
    raise exception 'réservé aux clientes' using errcode = 'insufficient_privilege';
  end if;
  select * into v_reglages from public.reglages;
  if v_reglages.contrat_version is distinct from p_version or coalesce(v_reglages.contrat_texte, '') = '' then
    return false; -- le contrat a changé entre-temps : la page se recharge avec la nouvelle version
  end if;
  insert into public.acceptations_contrat (cliente_id, version, texte, renonciation_retractation, texte_renonciation)
  values ((select auth.uid()), v_reglages.contrat_version, v_reglages.contrat_texte, true, v_reglages.contrat_case_renonciation)
  on conflict (cliente_id, version) do nothing;
  return true;
end;
$$;

revoke execute on function public.contrat_a_accepter() from public, anon;
revoke execute on function public.accepter_contrat(text, boolean, boolean) from public, anon;
grant execute on function public.contrat_a_accepter() to authenticated;
grant execute on function public.accepter_contrat(text, boolean, boolean) to authenticated;
