-- =====================================================================
-- 1. Annonces : un message de la coach à toutes ses clientes
--    (notification + bandeau sur l'accueil pendant 24 h).
-- 2. Rappel quotidien du journal, à l'heure choisie par chaque cliente.
-- =====================================================================

create table public.annonces (
  id         uuid primary key default gen_random_uuid(),
  texte      text not null check (length(trim(texte)) between 1 and 300),
  lien       text check (lien in ('/communaute', '/suivi/journal', '/recettes', '/ressources', '/suivi')),
  cree_le    timestamptz not null default now(),
  expire_le  timestamptz not null default now() + interval '24 hours'
);
alter table public.annonces enable row level security;
revoke all on public.annonces from anon;
create policy annonces_lecture on public.annonces for select to authenticated
  using ((select public.est_coach()) or ((select public.acces_ouvert()) and expire_le > now()));
create policy annonces_coach on public.annonces for all to authenticated
  using ((select public.est_coach())) with check ((select public.est_coach()));

-- Rappel du journal : heure choisie (vide = pas de rappel) et dernier jour où il est parti.
alter table public.clientes
  add column rappel_journal_heure time default '20:30',
  add column rappel_journal_envoye date;

-- La cliente règle elle-même l'heure de son rappel (elle ne peut rien modifier d'autre sur sa fiche).
create or replace function public.definir_rappel_journal(p_heure time)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.clientes set rappel_journal_heure = p_heure
  where id = (select auth.uid()) and statut <> 'fermee';
$$;
revoke execute on function public.definir_rappel_journal(time) from public, anon;
grant execute on function public.definir_rappel_journal(time) to authenticated;
