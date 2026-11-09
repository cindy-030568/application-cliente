-- =====================================================================
-- Phase 1 — Socle : profils, rôles, clientes, notes privées,
-- consentements, réglages. Sécurité par Row Level Security (RLS).
-- =====================================================================

-- ---------- Types ----------
create type public.role_utilisateur as enum ('coach', 'cliente');
create type public.statut_cliente as enum ('active', 'terminee', 'fermee');

-- ---------- Utilitaire : date de mise à jour ----------
create or replace function public.maj_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------- Profils (1 ligne par compte) ----------
create table public.profils (
  id         uuid primary key references auth.users (id) on delete cascade,
  role       public.role_utilisateur not null default 'cliente',
  prenom     text not null default '',
  nom        text not null default '',
  email      text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profils_maj before update on public.profils
  for each row execute function public.maj_updated_at();

-- ---------- Clientes ----------
create table public.clientes (
  id                    uuid primary key references public.profils (id) on delete cascade,
  statut                public.statut_cliente not null default 'active',
  date_debut            date,
  date_fin              date,
  acces_formation       boolean not null default false,
  masquer_graph_poids   boolean not null default false,
  frequence_bilan_jours integer not null default 14
                        check (frequence_bilan_jours between 1 and 120),
  ferme_le              date,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  check (date_fin is null or date_debut is null or date_fin >= date_debut)
);
create trigger clientes_maj before update on public.clientes
  for each row execute function public.maj_updated_at();

-- ---------- Notes privées de la coach (table séparée : jamais lisible par la cliente) ----------
create table public.notes_coach (
  id         uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  contenu    text not null check (length(contenu) between 1 and 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index notes_coach_cliente_idx on public.notes_coach (cliente_id, created_at desc);
create trigger notes_coach_maj before update on public.notes_coach
  for each row execute function public.maj_updated_at();

-- ---------- Consentements RGPD ----------
create table public.consentements (
  id         uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.profils (id) on delete cascade,
  version    text not null,
  accepte_le timestamptz not null default now(),
  unique (cliente_id, version)
);

-- ---------- Réglages globaux (une seule ligne) ----------
create table public.reglages (
  id                   boolean primary key default true check (id),
  version_consentement text not null default '2026-11',
  lien_politique       text,
  lien_formation       text,
  message_formation    text not null default
    'Envie d''aller plus loin ? Découvre la Fitw_cindy Academy ✨',
  lien_contact         text,
  tolerance_pct        numeric(5, 2) not null default 10 check (tolerance_pct between 0 and 100),
  tolerance_g          numeric(5, 2) not null default 3 check (tolerance_g between 0 and 100),
  hors_tolerance       text not null default 'masquer' check (hors_tolerance in ('masquer', 'badge')),
  updated_at           timestamptz not null default now()
);
insert into public.reglages (id) values (true);
create trigger reglages_maj before update on public.reglages
  for each row execute function public.maj_updated_at();

-- =====================================================================
-- Fonctions de sécurité
-- =====================================================================

-- Vrai si l'utilisatrice connectée est la coach.
create or replace function public.est_coach()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profils
    where id = (select auth.uid()) and role = 'coach'
  );
$$;

-- Vrai si l'utilisatrice connectée a un accès ouvert (coach, ou cliente non fermée).
-- Servira à protéger tous les contenus des phases suivantes.
create or replace function public.acces_ouvert()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.est_coach() or exists (
    select 1 from public.clientes
    where id = (select auth.uid()) and statut <> 'fermee'
  );
$$;

-- Création automatique du profil à la création d'un compte.
create or replace function public.creer_profil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profils (id, email, prenom, nom)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'prenom', ''),
    coalesce(new.raw_user_meta_data ->> 'nom', '')
  );
  return new;
end;
$$;
create trigger auth_creer_profil
  after insert on auth.users
  for each row execute function public.creer_profil();

-- À exécuter une seule fois dans l'éditeur SQL de Supabase :
--   select public.definir_coach('ton-email@exemple.fr');
create or replace function public.definir_coach(email_coach text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid;
begin
  select id into uid from auth.users where lower(email) = lower(email_coach);
  if uid is null then
    raise exception 'Aucun compte avec l''email %. Crée d''abord l''utilisatrice dans Authentication > Users.', email_coach;
  end if;
  insert into public.profils (id, email, role)
  values (uid, email_coach, 'coach')
  on conflict (id) do update set role = 'coach';
  delete from public.clientes where id = uid;
  return 'OK : ' || email_coach || ' est maintenant la coach.';
end;
$$;

revoke execute on function public.definir_coach(text) from public, anon, authenticated;
revoke execute on function public.creer_profil() from public, anon, authenticated;
revoke execute on function public.est_coach() from public, anon;
revoke execute on function public.acces_ouvert() from public, anon;
grant execute on function public.est_coach() to authenticated;
grant execute on function public.acces_ouvert() to authenticated;

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table public.profils       enable row level security;
alter table public.clientes      enable row level security;
alter table public.notes_coach   enable row level security;
alter table public.consentements enable row level security;
alter table public.reglages      enable row level security;

-- Les visiteurs non connectés n'ont accès à rien.
revoke all on public.profils, public.clientes, public.notes_coach,
              public.consentements, public.reglages from anon;

-- Profils : chacune voit le sien ; la coach voit et modifie tout.
create policy profils_lecture on public.profils
  for select to authenticated
  using (id = (select auth.uid()) or (select public.est_coach()));
create policy profils_modif_coach on public.profils
  for update to authenticated
  using ((select public.est_coach()))
  with check ((select public.est_coach()));

-- Clientes : la cliente lit sa fiche ; seule la coach crée/modifie/supprime.
create policy clientes_lecture on public.clientes
  for select to authenticated
  using (id = (select auth.uid()) or (select public.est_coach()));
create policy clientes_ajout_coach on public.clientes
  for insert to authenticated
  with check ((select public.est_coach()));
create policy clientes_modif_coach on public.clientes
  for update to authenticated
  using ((select public.est_coach()))
  with check ((select public.est_coach()));
create policy clientes_suppr_coach on public.clientes
  for delete to authenticated
  using ((select public.est_coach()));

-- Notes privées : coach uniquement.
create policy notes_coach_tout on public.notes_coach
  for all to authenticated
  using ((select public.est_coach()))
  with check ((select public.est_coach()));

-- Consentements : la cliente lit et donne le sien ; la coach lit tout.
create policy consentements_lecture on public.consentements
  for select to authenticated
  using (cliente_id = (select auth.uid()) or (select public.est_coach()));
create policy consentements_ajout on public.consentements
  for insert to authenticated
  with check (cliente_id = (select auth.uid()));

-- Réglages : lisibles par toute personne connectée, modifiables par la coach.
create policy reglages_lecture on public.reglages
  for select to authenticated
  using (true);
create policy reglages_modif_coach on public.reglages
  for update to authenticated
  using ((select public.est_coach()))
  with check ((select public.est_coach()));
