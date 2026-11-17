-- =====================================================================
-- Plan alimentaire construit dans l'application (inspiré de Nutrium).
-- - besoins_clientes : calcul des besoins (coach seulement) ;
-- - plans_alimentaires : repas, aliments, alternatives « ou », notes,
--   recommandations. Le contenu est un instantané JSON (noms et valeurs
--   nutritionnelles copiés) : le plan publié ne bouge pas si un aliment
--   est modifié plus tard. La cliente ne voit que le plan publié.
-- - aliments.fibres_100 : fibres (g/100 g), remplies depuis Ciqual.
-- =====================================================================

alter table public.aliments
  add column if not exists fibres_100 numeric(5, 2) check (fibres_100 between 0 and 100);

-- ---------- Besoins (données de santé : coach seulement) ----------
create table public.besoins_clientes (
  cliente_id        uuid primary key references public.clientes (id) on delete cascade,
  sexe              text not null default 'femme' check (sexe in ('femme', 'homme')),
  date_naissance    date check (date_naissance > '1900-01-01'),
  taille_cm         numeric(4, 1) check (taille_cm between 100 and 230),
  poids_kg          numeric(5, 1) check (poids_kg between 25 and 350),
  poids_objectif_kg numeric(5, 1) check (poids_objectif_kg between 25 and 350),
  masse_grasse_pct  numeric(4, 1) check (masse_grasse_pct between 3 and 70),
  formule           text not null default 'black' check (formule in ('black', 'mifflin', 'harris')),
  nap_actuel        numeric(3, 2) not null default 1.4 check (nap_actuel between 1 and 2.5),
  nap_objectif      numeric(3, 2) not null default 1.6 check (nap_objectif between 1 and 2.5),
  kcal_objectif     integer check (kcal_objectif between 800 and 6000),
  pct_lipides       integer not null default 35 check (pct_lipides between 0 and 100),
  pct_glucides      integer not null default 40 check (pct_glucides between 0 and 100),
  pct_proteines     integer not null default 25 check (pct_proteines between 0 and 100),
  fibres_g          integer not null default 30 check (fibres_g between 0 and 100),
  updated_at        timestamptz not null default now(),
  check (pct_lipides + pct_glucides + pct_proteines = 100)
);
alter table public.besoins_clientes enable row level security;
revoke all on public.besoins_clientes from anon;
create policy besoins_coach on public.besoins_clientes for all to authenticated
  using ((select public.est_coach())) with check ((select public.est_coach()));

-- ---------- Plans alimentaires ----------
create table public.plans_alimentaires (
  id               uuid primary key default gen_random_uuid(),
  cliente_id       uuid not null references public.clientes (id) on delete cascade,
  titre            text not null default 'Plan alimentaire' check (length(trim(titre)) between 1 and 80),
  contenu          jsonb not null default '{"repas": []}'::jsonb
                   check (jsonb_typeof(contenu) = 'object' and octet_length(contenu::text) < 400000),
  recommandations  text not null default '' check (length(recommandations) <= 10000),
  publie           boolean not null default false,
  publie_le        timestamptz,
  vu_le            timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index plans_alimentaires_cliente_idx on public.plans_alimentaires (cliente_id, created_at desc);
-- Un seul plan publié à la fois par cliente.
create unique index plans_alimentaires_un_publie on public.plans_alimentaires (cliente_id) where publie;
alter table public.plans_alimentaires enable row level security;
revoke all on public.plans_alimentaires from anon;

create policy plans_alim_lecture on public.plans_alimentaires for select to authenticated
  using (
    (select public.est_coach())
    or (cliente_id = (select auth.uid()) and publie and (select public.acces_ouvert()))
  );
create policy plans_alim_coach_ajout on public.plans_alimentaires for insert to authenticated
  with check ((select public.est_coach()));
create policy plans_alim_coach_modif on public.plans_alimentaires for update to authenticated
  using ((select public.est_coach())) with check ((select public.est_coach()));
create policy plans_alim_coach_suppr on public.plans_alimentaires for delete to authenticated
  using ((select public.est_coach()));

-- La cliente note qu'elle a ouvert son plan (rien d'autre).
create or replace function public.plan_alimentaire_vu(p_plan uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.plans_alimentaires
     set vu_le = now()
   where id = p_plan and cliente_id = (select auth.uid()) and publie and vu_le is null
     and (select public.acces_ouvert());
$$;
revoke execute on function public.plan_alimentaire_vu(uuid) from public, anon;
grant execute on function public.plan_alimentaire_vu(uuid) to authenticated;

-- Publier : dépublie les autres plans de la cliente dans la même opération.
create or replace function public.publier_plan_alimentaire(p_plan uuid, p_publie boolean)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_cliente uuid;
begin
  if not public.est_coach() then
    raise exception 'Réservé à la coach' using errcode = 'insufficient_privilege';
  end if;
  select cliente_id into v_cliente from public.plans_alimentaires where id = p_plan;
  if v_cliente is null then
    raise exception 'Plan introuvable' using errcode = 'no_data_found';
  end if;
  if p_publie then
    update public.plans_alimentaires set publie = false where cliente_id = v_cliente and publie and id <> p_plan;
    update public.plans_alimentaires set publie = true, publie_le = now(), vu_le = null where id = p_plan;
  else
    update public.plans_alimentaires set publie = false where id = p_plan;
  end if;
end;
$$;
revoke execute on function public.publier_plan_alimentaire(uuid, boolean) from public, anon;
grant execute on function public.publier_plan_alimentaire(uuid, boolean) to authenticated;
