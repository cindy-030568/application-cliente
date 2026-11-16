-- =====================================================================
-- Journal quotidien : la cliente note chaque jour poids, tour de taille,
-- sommeil, hydratation, pas, trainings, stress, digestion, règles et
-- observations. Moyennes par semaine, écarts par mois et synthèse dans l'app.
-- =====================================================================

alter table public.clientes
  add column journal_actif boolean not null default true;

create table public.journal_quotidien (
  cliente_id   uuid not null references public.clientes (id) on delete cascade,
  jour         date not null,
  poids        numeric(5, 2) check (poids between 20 and 400),
  tour_taille  numeric(5, 1) check (tour_taille between 20 and 300),
  sommeil      numeric(4, 2) check (sommeil between 0 and 24),
  hydratation  numeric(4, 2) check (hydratation between 0 and 15),
  pas          integer check (pas between 0 and 150000),
  trainings    smallint check (trainings between 0 and 5),
  stress       smallint check (stress between 1 and 5),
  digestion    smallint check (digestion between 1 and 5),
  regles       boolean not null default false,
  observations text check (length(observations) <= 1000),
  updated_at   timestamptz not null default now(),
  primary key (cliente_id, jour)
);
create trigger journal_quotidien_maj before update on public.journal_quotidien
  for each row execute function public.maj_updated_at();
alter table public.journal_quotidien enable row level security;
revoke all on public.journal_quotidien from anon;

-- La cliente gère son propre journal (accès ouvert, pas de date dans le futur) ; la coach voit et corrige tout.
create policy journal_lecture on public.journal_quotidien for select to authenticated
  using (cliente_id = (select auth.uid()) or (select public.est_coach()));
create policy journal_ajout on public.journal_quotidien for insert to authenticated
  with check (
    (select public.est_coach())
    or (cliente_id = (select auth.uid()) and (select public.acces_ouvert()) and jour <= (now() at time zone 'Europe/Paris')::date)
  );
create policy journal_modif on public.journal_quotidien for update to authenticated
  using (cliente_id = (select auth.uid()) or (select public.est_coach()))
  with check (
    (select public.est_coach())
    or (cliente_id = (select auth.uid()) and (select public.acces_ouvert()) and jour <= (now() at time zone 'Europe/Paris')::date)
  );
create policy journal_suppr on public.journal_quotidien for delete to authenticated
  using (cliente_id = (select auth.uid()) or (select public.est_coach()));
