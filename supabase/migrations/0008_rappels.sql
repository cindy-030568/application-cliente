-- =====================================================================
-- Phase 8 : rappels de bilan (notifications sur le téléphone + emails).
-- - réglages de la coach : rappels actifs, délai de relance, textes ;
-- - préférence email de chaque cliente ;
-- - appareils abonnés aux notifications ;
-- - journal des rappels envoyés (un seul rappel de chaque type par échéance).
-- Les rappels sont envoyés par une tâche quotidienne côté serveur (clé secrète).
-- =====================================================================

alter table public.reglages
  add column rappels_actifs boolean not null default true,
  add column relance_jours  integer not null default 2 check (relance_jours between 0 and 7),
  add column texte_rappel   text not null default
    'Coucou {prenom} ! Ton bilan est prêt : prends 5 minutes pour faire le point 💛'
    check (length(texte_rappel) between 1 and 300),
  add column texte_relance  text not null default
    '{prenom}, ton bilan t''attend toujours. Quelques minutes suffisent, même imparfait 💛'
    check (length(texte_relance) between 1 and 300);

alter table public.clientes
  add column rappels_email boolean not null default true;

-- La cliente règle elle-même ses emails de rappel (elle ne peut rien modifier d'autre sur sa fiche).
create or replace function public.definir_rappels_email(p_actif boolean)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.clientes set rappels_email = p_actif
  where id = (select auth.uid()) and statut <> 'fermee';
$$;
revoke execute on function public.definir_rappels_email(boolean) from public, anon;
grant execute on function public.definir_rappels_email(boolean) to authenticated;

-- ---------- Appareils abonnés aux notifications ----------
create table public.abonnements_push (
  id          uuid primary key default gen_random_uuid(),
  cliente_id  uuid not null references public.clientes (id) on delete cascade,
  endpoint    text not null unique check (endpoint like 'https://%' and length(endpoint) <= 1000),
  p256dh      text not null check (length(p256dh) <= 200),
  auth        text not null check (length(auth) <= 100),
  appareil    text check (length(appareil) <= 60),
  created_at  timestamptz not null default now()
);
create index abonnements_push_cliente_idx on public.abonnements_push (cliente_id);
alter table public.abonnements_push enable row level security;
revoke all on public.abonnements_push from anon;

create policy abonnements_lecture on public.abonnements_push for select to authenticated
  using (cliente_id = (select auth.uid()) or (select public.est_coach()));
create policy abonnements_suppr on public.abonnements_push for delete to authenticated
  using (cliente_id = (select auth.uid()));

-- Enregistre l'appareil de la cliente connectée. Un même téléphone utilisé
-- avant par une autre personne est rattaché à la nouvelle (l'ancien lien est supprimé).
create or replace function public.enregistrer_abonnement_push(
  p_endpoint text, p_p256dh text, p_auth text, p_appareil text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.clientes where id = (select auth.uid()) and statut <> 'fermee'
  ) then
    raise exception 'Réservé aux clientes' using errcode = 'insufficient_privilege';
  end if;
  if (select count(*) from public.abonnements_push where cliente_id = (select auth.uid())) >= 5 then
    delete from public.abonnements_push where id = (
      select id from public.abonnements_push where cliente_id = (select auth.uid()) order by created_at limit 1
    );
  end if;
  delete from public.abonnements_push where endpoint = p_endpoint;
  insert into public.abonnements_push (cliente_id, endpoint, p256dh, auth, appareil)
  values ((select auth.uid()), p_endpoint, p_p256dh, p_auth, left(p_appareil, 60));
end;
$$;
revoke execute on function public.enregistrer_abonnement_push(text, text, text, text) from public, anon;
grant execute on function public.enregistrer_abonnement_push(text, text, text, text) to authenticated;

-- ---------- Journal des rappels envoyés ----------
create table public.rappels_envoyes (
  id          uuid primary key default gen_random_uuid(),
  cliente_id  uuid not null references public.clientes (id) on delete cascade,
  echeance    date not null,
  type        text not null check (type in ('ouverture', 'relance')),
  canaux      text[] not null default '{}',
  envoye_le   timestamptz not null default now(),
  unique (cliente_id, echeance, type)
);
create index rappels_envoyes_cliente_idx on public.rappels_envoyes (cliente_id, envoye_le desc);
alter table public.rappels_envoyes enable row level security;
revoke all on public.rappels_envoyes from anon;

-- Lecture seule : la cliente voit les siens, la coach tous. L'écriture passe par la tâche serveur.
create policy rappels_lecture on public.rappels_envoyes for select to authenticated
  using (cliente_id = (select auth.uid()) or (select public.est_coach()));
