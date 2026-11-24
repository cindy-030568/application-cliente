-- =====================================================================
-- Bilan de fin de suivi : la cliente retrouve le récap de sa transformation
-- (7 jours avant sa date de fin, ou dès que son suivi est « terminé »), à garder
-- en PDF. Un bloc « Continuer avec moi » montre le texte et les offres de la coach
-- (modifiables dans Réglages, sans prix codé en dur). La coach est prévenue
-- quand une cliente clique sur une offre.
-- =====================================================================

alter table public.reglages
  add column fin_texte text not null default
    'Ton accompagnement touche à sa fin, et tu peux être tellement fière du chemin parcouru 💛 Si tu as envie de continuer à avancer avec moi, voici ce que je te propose :'
    check (length(fin_texte) between 1 and 1500),
  add column fin_offres jsonb not null default
    '[{"titre": "Continuer mon accompagnement", "description": "On continue ensemble, au même rythme ou plus en douceur : on en parle et on choisit ce qui te convient."}]'::jsonb
    check (jsonb_typeof(fin_offres) = 'array' and jsonb_array_length(fin_offres) <= 6);

-- Clics sur « Ça m'intéresse » : la coach les voit et les marque comme traités.
create table public.demandes_suite (
  id         uuid primary key default gen_random_uuid(),
  cliente_id uuid not null default auth.uid() references public.clientes (id) on delete cascade,
  offre      text not null check (length(trim(offre)) between 1 and 120),
  cree_le    timestamptz not null default now(),
  traitee    boolean not null default false
);
create index demandes_suite_cliente_idx on public.demandes_suite (cliente_id, cree_le desc);
alter table public.demandes_suite enable row level security;
revoke all on public.demandes_suite from anon;

create policy demandes_suite_coach on public.demandes_suite for all to authenticated
  using ((select public.est_coach())) with check ((select public.est_coach()));
create policy demandes_suite_lecture on public.demandes_suite for select to authenticated
  using (cliente_id = (select auth.uid()) and (select public.acces_ouvert()));
create policy demandes_suite_ajout on public.demandes_suite for insert to authenticated
  with check (cliente_id = (select auth.uid()) and not (select public.est_coach()) and (select public.acces_ouvert()) and not traitee);
