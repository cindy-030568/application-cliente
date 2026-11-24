-- =====================================================================
-- Cycle et périménopause dans le journal (facultatif, choisi par la cliente) :
-- - suivi du cycle : jour et phase calculés à partir des jours « règles »
--   déjà cochés dans le journal (durée habituelle réglable) ;
-- - ou suivi des symptômes de périménopause, cochés chaque jour.
-- Données de santé sensibles : visibles seulement par la cliente et la coach.
-- Jamais d'avis médical dans l'appli.
-- =====================================================================

alter table public.clientes
  add column suivi_cycle text not null default 'aucun' check (suivi_cycle in ('aucun', 'cycle', 'perimenopause')),
  add column cycle_duree smallint not null default 28 check (cycle_duree between 21 and 45);

-- La cliente choisit elle-même ce qu'elle suit (elle ne peut rien modifier d'autre sur sa fiche).
create or replace function public.definir_suivi_cycle(p_mode text, p_duree smallint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_mode not in ('aucun', 'cycle', 'perimenopause') or p_duree is null or p_duree not between 21 and 45 then
    raise exception 'Réglage du cycle invalide' using errcode = 'check_violation';
  end if;
  update public.clientes set suivi_cycle = p_mode, cycle_duree = p_duree
  where id = (select auth.uid()) and statut <> 'fermee';
end;
$$;
revoke execute on function public.definir_suivi_cycle(text, smallint) from public, anon;
grant execute on function public.definir_suivi_cycle(text, smallint) to authenticated;

-- Symptômes de périménopause du jour (liste fermée).
alter table public.journal_quotidien
  add column symptomes text[] not null default '{}'
    check (
      cardinality(symptomes) <= 12
      and symptomes <@ array['bouffees', 'sueurs', 'sommeil', 'humeur', 'fatigue', 'regles_irregulieres', 'articulations', 'ballonnements', 'maux_tete']::text[]
    );

-- Le journal contient maintenant des données de santé : une cliente dont l'accès est fermé ne le voit plus.
drop policy journal_lecture on public.journal_quotidien;
create policy journal_lecture on public.journal_quotidien for select to authenticated
  using ((select public.est_coach()) or (cliente_id = (select auth.uid()) and (select public.acces_ouvert())));
drop policy journal_suppr on public.journal_quotidien;
create policy journal_suppr on public.journal_quotidien for delete to authenticated
  using ((select public.est_coach()) or (cliente_id = (select auth.uid()) and (select public.acces_ouvert())));
drop policy journal_modif on public.journal_quotidien;
create policy journal_modif on public.journal_quotidien for update to authenticated
  using ((select public.est_coach()) or (cliente_id = (select auth.uid()) and (select public.acces_ouvert())))
  with check (
    (select public.est_coach())
    or (cliente_id = (select auth.uid()) and (select public.acces_ouvert()) and jour <= (now() at time zone 'Europe/Paris')::date)
  );
