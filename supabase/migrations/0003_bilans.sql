-- =====================================================================
-- Phase 3 — Suivi et bilans : mesures configurables, ressentis, photos,
-- retour de la coach, mode sans chiffres, rendez-vous, dernière visite.
-- Données de santé : RLS stricte, photos dans un bucket privé.
-- =====================================================================

-- ---------- Réglages et fiche cliente ----------
alter table public.reglages
  add column fenetre_bilan_jours integer not null default 3
    check (fenetre_bilan_jours between 0 and 14);

alter table public.clientes
  add column mode_sans_chiffres boolean not null default false,
  add column prochain_rdv timestamptz,
  add column lien_rdv text check (lien_rdv is null or lien_rdv like 'https://%'),
  add column derniere_visite timestamptz;

-- ---------- Champs du bilan (configurables par la coach) ----------
create table public.champs_mesure (
  id         uuid primary key default gen_random_uuid(),
  groupe     text not null check (groupe in ('mesure', 'ressenti')),
  type       text not null check (type in ('nombre', 'echelle', 'choix')),
  libelle    text not null check (length(libelle) between 1 and 60),
  unite      text check (unite is null or length(unite) <= 10),
  aide       text check (aide is null or length(aide) <= 160),
  options    text[],
  ordre      integer not null default 0,
  actif      boolean not null default true,
  est_poids  boolean not null default false,
  created_at timestamptz not null default now(),
  check (type <> 'choix' or coalesce(array_length(options, 1), 0) >= 2)
);

insert into public.champs_mesure (groupe, type, libelle, unite, aide, ordre, est_poids) values
  ('mesure', 'nombre', 'Poids', 'kg', null, 1, true),
  ('mesure', 'nombre', 'Tour de taille', 'cm', 'Au niveau du nombril, sans serrer.', 2, false),
  ('mesure', 'nombre', 'Tour de hanches', 'cm', 'Au plus large des fesses.', 3, false),
  ('mesure', 'nombre', 'Tour de cuisse', 'cm', 'Au plus large, toujours la même jambe.', 4, false),
  ('mesure', 'nombre', 'Tour de bras', 'cm', 'Au milieu du bras, relâché.', 5, false),
  ('mesure', 'nombre', 'Tour de poitrine', 'cm', 'Au niveau de la pointe des seins.', 6, false);

insert into public.champs_mesure (groupe, type, libelle, aide, ordre) values
  ('ressenti', 'echelle', 'Sommeil', '1 = très mauvais · 10 = excellent', 10),
  ('ressenti', 'echelle', 'Énergie', '1 = épuisée · 10 = pleine d’énergie', 11),
  ('ressenti', 'echelle', 'Stress', '1 = très détendue · 10 = très stressée', 12),
  ('ressenti', 'echelle', 'Faim entre les repas', '1 = jamais · 10 = tout le temps', 13),
  ('ressenti', 'echelle', 'Confort digestif', '1 = très inconfortable · 10 = parfait', 14);

insert into public.champs_mesure (groupe, type, libelle, aide, options, ordre) values
  ('ressenti', 'choix', 'Cycle', 'Où en es-tu dans ton cycle ?',
   array['Règles', 'Après les règles', 'Ovulation', 'Avant les règles', 'Je ne sais pas', 'Non concernée'], 15);

-- ---------- Bilans ----------
create table public.bilans (
  id          uuid primary key default gen_random_uuid(),
  cliente_id  uuid not null references public.clientes (id) on delete cascade,
  date_mesure date not null default current_date,
  echeance    date,
  commentaire text check (commentaire is null or length(commentaire) <= 3000),
  saisi_par   uuid references public.profils (id) on delete set null default auth.uid(),
  envoye_le   timestamptz not null default now(),
  modifie_le  timestamptz
);
create index bilans_cliente_idx on public.bilans (cliente_id, date_mesure desc);
-- Un seul bilan par échéance (les saisies libres n'ont pas d'échéance).
create unique index bilans_une_echeance on public.bilans (cliente_id, echeance) where echeance is not null;

create or replace function public.bilan_modifie()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.modifie_le = now();
  new.envoye_le = old.envoye_le;
  new.cliente_id = old.cliente_id;
  new.saisi_par = old.saisi_par;
  return new;
end;
$$;
create trigger bilans_modifie before update on public.bilans
  for each row execute function public.bilan_modifie();

create table public.bilan_valeurs (
  bilan_id     uuid not null references public.bilans (id) on delete cascade,
  champ_id     uuid not null references public.champs_mesure (id) on delete restrict,
  valeur_num   numeric(7, 2),
  valeur_texte text check (valeur_texte is null or length(valeur_texte) <= 60),
  primary key (bilan_id, champ_id),
  check (valeur_num is not null or valeur_texte is not null)
);
create index bilan_valeurs_champ_idx on public.bilan_valeurs (champ_id);

create table public.photos_bilan (
  id           uuid primary key default gen_random_uuid(),
  bilan_id     uuid not null references public.bilans (id) on delete cascade,
  cliente_id   uuid not null references public.clientes (id) on delete cascade,
  angle        text not null check (angle in ('face', 'profil', 'dos')),
  fichier_path text not null,
  created_at   timestamptz not null default now(),
  unique (bilan_id, angle)
);
create index photos_bilan_cliente_idx on public.photos_bilan (cliente_id, created_at desc);

-- Retour écrit de la coach (table séparée : la cliente ne peut jamais l'écrire).
create table public.retours_bilan (
  bilan_id   uuid primary key references public.bilans (id) on delete cascade,
  contenu    text not null check (length(contenu) between 1 and 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  lu_le      timestamptz
);
create trigger retours_bilan_maj before update on public.retours_bilan
  for each row execute function public.maj_updated_at();

-- ---------- Fonctions ----------
-- Vrai si le bilan appartient à l'utilisatrice connectée (accès ouvert) ou si c'est la coach.
create or replace function public.peut_acceder_bilan(p_bilan uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.est_coach() or exists (
    select 1 from public.bilans b
    where b.id = p_bilan and b.cliente_id = (select auth.uid()) and public.acces_ouvert()
  );
$$;
revoke execute on function public.peut_acceder_bilan(uuid) from public, anon;
grant execute on function public.peut_acceder_bilan(uuid) to authenticated;

-- La cliente note sa visite (au plus une fois par heure) : sert aux alertes de décrochage.
create or replace function public.noter_visite()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.clientes set derniere_visite = now()
  where id = (select auth.uid())
    and (derniere_visite is null or derniere_visite < now() - interval '1 hour');
$$;
revoke execute on function public.noter_visite() from public, anon;
grant execute on function public.noter_visite() to authenticated;

-- La cliente signale qu'elle a lu le retour de la coach.
create or replace function public.marquer_retour_lu(p_bilan uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.retours_bilan r set lu_le = now()
  where r.bilan_id = p_bilan and r.lu_le is null
    and exists (select 1 from public.bilans b where b.id = p_bilan and b.cliente_id = (select auth.uid()));
$$;
revoke execute on function public.marquer_retour_lu(uuid) from public, anon;
grant execute on function public.marquer_retour_lu(uuid) to authenticated;

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table public.champs_mesure enable row level security;
alter table public.bilans        enable row level security;
alter table public.bilan_valeurs enable row level security;
alter table public.photos_bilan  enable row level security;
alter table public.retours_bilan enable row level security;

revoke all on public.champs_mesure, public.bilans, public.bilan_valeurs,
              public.photos_bilan, public.retours_bilan from anon;

create policy champs_mesure_lecture on public.champs_mesure
  for select to authenticated using ((select public.acces_ouvert()));
create policy champs_mesure_coach on public.champs_mesure
  for all to authenticated
  using ((select public.est_coach())) with check ((select public.est_coach()));

-- Bilans : la cliente gère les siens (accès ouvert) ; la coach gère tout.
create policy bilans_lecture on public.bilans
  for select to authenticated
  using ((select public.est_coach())
         or (cliente_id = (select auth.uid()) and (select public.acces_ouvert())));
create policy bilans_ajout on public.bilans
  for insert to authenticated
  with check ((select public.est_coach())
              or (cliente_id = (select auth.uid()) and saisi_par = (select auth.uid())
                  and (select public.acces_ouvert())));
create policy bilans_modif on public.bilans
  for update to authenticated
  using ((select public.est_coach())
         or (cliente_id = (select auth.uid()) and (select public.acces_ouvert())))
  with check ((select public.est_coach())
              or (cliente_id = (select auth.uid()) and (select public.acces_ouvert())));
create policy bilans_suppr on public.bilans
  for delete to authenticated
  using ((select public.est_coach())
         or (cliente_id = (select auth.uid()) and (select public.acces_ouvert())));

create policy bilan_valeurs_tout on public.bilan_valeurs
  for all to authenticated
  using (public.peut_acceder_bilan(bilan_id))
  with check (public.peut_acceder_bilan(bilan_id));

create policy photos_bilan_tout on public.photos_bilan
  for all to authenticated
  using (public.peut_acceder_bilan(bilan_id))
  with check (
    public.peut_acceder_bilan(bilan_id)
    and exists (select 1 from public.bilans b where b.id = bilan_id and b.cliente_id = photos_bilan.cliente_id)
  );

create policy retours_bilan_lecture on public.retours_bilan
  for select to authenticated using (public.peut_acceder_bilan(bilan_id));
create policy retours_bilan_coach on public.retours_bilan
  for all to authenticated
  using ((select public.est_coach())) with check ((select public.est_coach()));

-- =====================================================================
-- Stockage des photos : bucket privé « photos », 10 Mo, images uniquement.
-- Chemin : <id de la cliente>/<id du bilan>/<angle>-<id>.jpg
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy photos_fichiers_coach on storage.objects
  for all to authenticated
  using (bucket_id = 'photos' and (select public.est_coach()))
  with check (bucket_id = 'photos' and (select public.est_coach()));

create policy photos_fichiers_cliente_lecture on storage.objects
  for select to authenticated
  using (bucket_id = 'photos'
         and (storage.foldername(name))[1] = (select auth.uid())::text
         and (select public.acces_ouvert()));
create policy photos_fichiers_cliente_ajout on storage.objects
  for insert to authenticated
  with check (bucket_id = 'photos'
              and (storage.foldername(name))[1] = (select auth.uid())::text
              and (select public.acces_ouvert()));
create policy photos_fichiers_cliente_suppr on storage.objects
  for delete to authenticated
  using (bucket_id = 'photos'
         and (storage.foldername(name))[1] = (select auth.uid())::text
         and (select public.acces_ouvert()));
