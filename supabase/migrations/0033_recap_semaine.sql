-- =====================================================================
-- Récap de la semaine (le dimanche à 18 h, heure de Paris) :
-- séances faites, moyennes de sommeil, pas et hydratation, une phrase
-- encourageante. Visible dans l'appli ; notification si la cliente
-- a activé les notifications et n'a pas décoché le récap.
-- Pas de nouvelle table : le récap est calculé à partir du journal et des séances.
-- =====================================================================

alter table public.clientes
  add column recap_notif  boolean not null default true,
  -- Dimanche (AAAA-MM-JJ) du dernier récap envoyé : jamais deux fois la même semaine.
  add column recap_envoye date;

-- La cliente choisit elle-même de recevoir (ou non) la notification du récap.
create or replace function public.definir_recap_notif(p_actif boolean)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.clientes set recap_notif = p_actif
  where id = (select auth.uid()) and statut <> 'fermee';
$$;
revoke execute on function public.definir_recap_notif(boolean) from public, anon;
grant execute on function public.definir_recap_notif(boolean) to authenticated;
