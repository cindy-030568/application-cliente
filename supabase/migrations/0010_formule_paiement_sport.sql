-- =====================================================================
-- Formule, paiement et suivi sportif de chaque cliente.
-- - clientes.suivi_sport : sans suivi sportif, la partie Sport est masquée ;
-- - paiements_clientes : formule, montant total, moyen, nombre de fois ;
-- - echeances_paiement : l'échéancier (date, montant, payée ou non).
-- Formule et paiement sont visibles par la coach seule.
-- =====================================================================

alter table public.clientes
  add column suivi_sport boolean not null default true;

create table public.paiements_clientes (
  cliente_id    uuid primary key references public.clientes (id) on delete cascade,
  formule       text check (length(formule) <= 120),
  montant_total numeric(10, 2) check (montant_total >= 0 and montant_total < 100000),
  moyen         text check (moyen in ('virement', 'carte', 'especes', 'paypal', 'cheque', 'autre')),
  nb_fois       integer not null default 1 check (nb_fois between 1 and 24),
  note          text check (length(note) <= 500),
  updated_at    timestamptz not null default now()
);
create trigger paiements_clientes_maj before update on public.paiements_clientes
  for each row execute function public.maj_updated_at();

create table public.echeances_paiement (
  id            uuid primary key default gen_random_uuid(),
  cliente_id    uuid not null references public.clientes (id) on delete cascade,
  date_echeance date not null,
  montant       numeric(10, 2) not null check (montant >= 0 and montant < 100000),
  payee_le      date,
  created_at    timestamptz not null default now()
);
create index echeances_paiement_cliente_idx on public.echeances_paiement (cliente_id, date_echeance);
create index echeances_paiement_a_venir_idx on public.echeances_paiement (date_echeance) where payee_le is null;

alter table public.paiements_clientes enable row level security;
alter table public.echeances_paiement enable row level security;
revoke all on public.paiements_clientes from anon;
revoke all on public.echeances_paiement from anon;

-- La coach seule : les clientes ne voient jamais ces informations.
create policy paiements_coach on public.paiements_clientes for all to authenticated
  using ((select public.est_coach())) with check ((select public.est_coach()));
create policy echeances_coach on public.echeances_paiement for all to authenticated
  using ((select public.est_coach())) with check ((select public.est_coach()));
