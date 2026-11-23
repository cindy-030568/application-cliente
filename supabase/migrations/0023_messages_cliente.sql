-- =====================================================================
-- Petits mots de la coach à une cliente (propositions de messages de
-- l'accueil coach) : envoyés dans l'appli, ou seulement copiés / ignorés
-- (pour ne pas reproposer la même chose la même semaine).
-- La cliente ne voit que les messages envoyés, tant que son accès est ouvert.
-- =====================================================================

create table public.messages_cliente (
  id          uuid primary key default gen_random_uuid(),
  cliente_id  uuid not null references public.clientes (id) on delete cascade,
  -- Proposition d'origine (ex. « pas_baisse:2026-W48 ») ; null pour un message écrit librement.
  proposition text check (length(proposition) <= 80),
  statut      text not null check (statut in ('envoye', 'copie', 'ignore')),
  texte       text check (length(texte) between 1 and 1000),
  cree_le     timestamptz not null default now(),
  lu_le       timestamptz,
  check (statut <> 'envoye' or texte is not null)
);
create index messages_cliente_idx on public.messages_cliente (cliente_id, cree_le desc);
alter table public.messages_cliente enable row level security;
revoke all on public.messages_cliente from anon;

create policy messages_coach on public.messages_cliente for all to authenticated
  using ((select public.est_coach())) with check ((select public.est_coach()));
create policy messages_lecture_cliente on public.messages_cliente for select to authenticated
  using (cliente_id = (select auth.uid()) and statut = 'envoye' and (select public.acces_ouvert()));

-- La cliente note qu'elle a vu un message (rien d'autre).
create or replace function public.message_cliente_lu(p_message uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.messages_cliente set lu_le = now()
   where id = p_message and cliente_id = (select auth.uid()) and statut = 'envoye' and lu_le is null
     and (select public.acces_ouvert());
$$;
revoke execute on function public.message_cliente_lu(uuid) from public, anon;
grant execute on function public.message_cliente_lu(uuid) to authenticated;
