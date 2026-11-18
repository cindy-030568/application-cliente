-- =====================================================================
-- Revenus : encaissements hors échéancier (séance ponctuelle, atelier,
-- vente en ligne…). Les échéances des clientes restent dans
-- echeances_paiement. Coach seulement.
-- =====================================================================

create table public.revenus_divers (
  id          uuid primary key default gen_random_uuid(),
  date_revenu date not null,
  libelle     text not null check (length(trim(libelle)) between 1 and 120),
  montant     numeric(10, 2) not null check (montant > 0 and montant < 100000),
  moyen       text check (moyen in ('virement', 'carte', 'especes', 'paypal', 'cheque', 'autre')),
  cliente_id  uuid references public.clientes (id) on delete set null,
  note        text check (length(note) <= 500),
  created_at  timestamptz not null default now()
);
create index revenus_divers_date_idx on public.revenus_divers (date_revenu desc);
alter table public.revenus_divers enable row level security;
revoke all on public.revenus_divers from anon;
create policy revenus_divers_coach on public.revenus_divers for all to authenticated
  using ((select public.est_coach())) with check ((select public.est_coach()));

-- Note libre sur une échéance (« virement reçu en 2 fois », « relancée le 12 »…).
alter table public.echeances_paiement
  add column if not exists note text check (length(note) <= 300);
