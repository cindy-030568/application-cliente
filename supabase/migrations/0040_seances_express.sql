-- =====================================================================
-- Séances express (séances de secours à la carte) : une bibliothèque de
-- séances courtes créées par la coach, même structure que les séances des
-- programmes (blocs, exercices, séries, repos, AMRAP / EMOM / Tabata).
-- La cliente les fait en mode séance guidée ; elles sont enregistrées comme
-- « séances libres », à part des séances du programme.
-- Accès : clientes en cours de suivi ; clientes au suivi terminé seulement
-- jusqu'à la date choisie par la coach (abonnement, plus tard via Stripe).
-- =====================================================================

-- Listes modifiables dans Réglages.
alter table public.reglages
  add column express_materiel text[] not null
    default array['Aucun', 'Tapis', 'Élastique', 'Haltères', 'Kettlebell', 'Chaise ou banc', 'Corde à sauter']
    check (cardinality(express_materiel) <= 30),
  add column express_types text[] not null
    default array['Renfo', 'Cardio', 'Mobilité', 'Étirements', 'Marche à la maison', 'Gainage']
    check (cardinality(express_types) <= 30);

-- Accès après le suivi (statut « terminé ») : jusqu'à cette date incluse.
alter table public.clientes add column express_jusqu_au date;

create table public.seances_express (
  id            uuid primary key default gen_random_uuid(),
  titre         text not null check (length(trim(titre)) between 1 and 100),
  description   text check (description is null or length(description) <= 500),
  duree_minutes smallint not null check (duree_minutes in (5, 10, 15, 20, 30)),
  materiel      text[] not null default '{}' check (cardinality(materiel) <= 15),
  type          text not null check (length(trim(type)) between 1 and 40),
  niveau        text not null default 'tous' check (niveau in ('tous', 'debutante', 'intermediaire', 'confirmee')),
  -- Une séance au format des programmes (nom, échauffement, blocs, exercices…), validée par l'appli.
  contenu       jsonb not null check (jsonb_typeof(contenu) = 'object' and octet_length(contenu::text) < 60000),
  publiee       boolean not null default false,
  visibilite    text not null default 'toutes' check (visibilite in ('toutes', 'certaines')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger seances_express_maj before update on public.seances_express
  for each row execute function public.maj_updated_at();

create table public.seances_express_clientes (
  seance_id  uuid not null references public.seances_express (id) on delete cascade,
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  primary key (seance_id, cliente_id)
);
create index seances_express_clientes_cliente_idx on public.seances_express_clientes (cliente_id);

create table public.seances_express_favoris (
  cliente_id uuid not null default auth.uid() references public.clientes (id) on delete cascade,
  seance_id  uuid not null references public.seances_express (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (cliente_id, seance_id)
);

-- La cliente connectée a-t-elle accès aux séances express ? (la coach : toujours)
create or replace function public.acces_seances_express()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.est_coach() or exists (
    select 1 from public.clientes
     where id = (select auth.uid())
       and (statut = 'active'
            or (statut = 'terminee' and express_jusqu_au >= (now() at time zone 'Europe/Paris')::date))
  );
$$;
revoke execute on function public.acces_seances_express() from public, anon;
grant execute on function public.acces_seances_express() to authenticated;

alter table public.seances_express enable row level security;
alter table public.seances_express_clientes enable row level security;
alter table public.seances_express_favoris enable row level security;
revoke all on public.seances_express, public.seances_express_clientes, public.seances_express_favoris from anon;

create policy seances_express_coach on public.seances_express for all to authenticated
  using ((select public.est_coach())) with check ((select public.est_coach()));
create policy seances_express_lecture on public.seances_express for select to authenticated
  using (
    publiee
    and (select public.acces_seances_express())
    and (
      visibilite = 'toutes'
      or exists (select 1 from public.seances_express_clientes l where l.seance_id = seances_express.id and l.cliente_id = (select auth.uid()))
    )
  );

create policy seances_express_clientes_coach on public.seances_express_clientes for all to authenticated
  using ((select public.est_coach())) with check ((select public.est_coach()));
create policy seances_express_clientes_lecture on public.seances_express_clientes for select to authenticated
  using (cliente_id = (select auth.uid()));

create policy seances_express_favoris_coach on public.seances_express_favoris for select to authenticated
  using ((select public.est_coach()));
create policy seances_express_favoris_lecture on public.seances_express_favoris for select to authenticated
  using (cliente_id = (select auth.uid()) and (select public.acces_seances_express()));
create policy seances_express_favoris_ajout on public.seances_express_favoris for insert to authenticated
  with check (cliente_id = (select auth.uid()) and not (select public.est_coach()) and (select public.acces_seances_express()));
create policy seances_express_favoris_suppr on public.seances_express_favoris for delete to authenticated
  using (cliente_id = (select auth.uid()));

-- Une séance faite peut être une séance express (« séance libre ») : à part du programme.
alter table public.seances_faites
  add column seance_express_id uuid references public.seances_express (id) on delete set null;
