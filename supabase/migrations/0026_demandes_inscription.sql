-- =====================================================================
-- Demandes d'inscription venues du formulaire Tally : une « fiche à valider ».
-- La coach vérifie, puis crée la fiche et invite la cliente elle-même :
-- rien n'est jamais envoyé automatiquement. Visible par la coach seule.
-- Écrites uniquement par le serveur (clé secrète), après vérification de la
-- signature Tally.
-- =====================================================================

create table public.demandes_inscription (
  id                 uuid primary key default gen_random_uuid(),
  recue_le           timestamptz not null default now(),
  source             text not null default 'tally' check (source in ('tally')),
  -- Identifiant de la réponse Tally : une même réponse renvoyée deux fois n'est enregistrée qu'une fois.
  reference          text unique check (length(reference) <= 100),
  prenom             text not null check (length(prenom) between 1 and 60),
  nom                text not null default '' check (length(nom) <= 80),
  email              text not null check (email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' and length(email) <= 200),
  objectif           text check (length(objectif) <= 500),
  objectif_code      text check (objectif_code in ('perte', 'maintien', 'prise', 'recompo')),
  exclusions_texte   text check (length(exclusions_texte) <= 1000),
  categories_exclues uuid[] not null default '{}',
  -- Les autres réponses du formulaire (question → réponse), pour que la coach les relise.
  reponses           jsonb not null default '[]' check (jsonb_typeof(reponses) = 'array' and length(reponses::text) <= 20000),
  statut             text not null default 'a_valider' check (statut in ('a_valider', 'invitee', 'ignoree')),
  -- Un compte existe déjà avec cet email (cliente actuelle ou ancienne).
  doublon_de         uuid references public.profils (id) on delete set null,
  cliente_id         uuid references public.clientes (id) on delete set null,
  traitee_le         timestamptz
);
-- Une seule demande « à valider » par email : un 2e envoi du formulaire met à jour la 1re.
create unique index demandes_inscription_email_a_valider on public.demandes_inscription (lower(email)) where statut = 'a_valider';

alter table public.demandes_inscription enable row level security;
revoke all on public.demandes_inscription from anon;

create policy demandes_coach_lecture on public.demandes_inscription for select to authenticated
  using ((select public.est_coach()));
create policy demandes_coach_modif on public.demandes_inscription for update to authenticated
  using ((select public.est_coach())) with check ((select public.est_coach()));
create policy demandes_coach_suppression on public.demandes_inscription for delete to authenticated
  using ((select public.est_coach()));
-- Pas de création par un compte connecté : seul le serveur (webhook Tally) en crée.

-- Notification à la coach quand une demande arrive (Réglages → Mes notifications), cochée par défaut.
alter table public.reglages add column if not exists notif_coach_inscriptions boolean not null default true;
