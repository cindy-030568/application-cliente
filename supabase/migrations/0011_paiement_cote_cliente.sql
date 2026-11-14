-- =====================================================================
-- Paiement : 1er paiement personnalisé, échéancier visible par la cliente,
-- rappel le jour de chaque échéance.
-- =====================================================================

alter table public.paiements_clientes
  -- Montant du 1er paiement quand on paie en plusieurs fois (vide = 50 % du total).
  add column premier_montant numeric(10, 2) check (premier_montant >= 0 and premier_montant < 100000),
  -- Rappel (email + notification) le jour de chaque échéance.
  add column rappels boolean not null default true;

alter table public.echeances_paiement
  add column rappel_envoye_le timestamptz;

-- La cliente voit sa formule et son échéancier (jamais la note de la coach).
-- Lecture par une fonction : les tables restent réservées à la coach.
create or replace function public.mon_paiement()
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select case when c.id is null then null else json_build_object(
    'formule', p.formule,
    'montant_total', p.montant_total,
    'moyen', p.moyen,
    'nb_fois', p.nb_fois,
    'echeances', coalesce((
      select json_agg(json_build_object('date_echeance', e.date_echeance, 'montant', e.montant, 'payee', e.payee_le is not null)
                      order by e.date_echeance)
      from public.echeances_paiement e where e.cliente_id = c.id
    ), '[]'::json)
  ) end
  from public.clientes c
  join public.paiements_clientes p on p.cliente_id = c.id
  where c.id = (select auth.uid()) and c.statut <> 'fermee';
$$;
revoke execute on function public.mon_paiement() from public, anon;
grant execute on function public.mon_paiement() to authenticated;
