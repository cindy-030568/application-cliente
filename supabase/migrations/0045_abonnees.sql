-- =====================================================================
-- Espace abonnées (socle) : des femmes qui ne suivent pas le coaching
-- s'abonnent seules (Stripe, au mois ou à l'année).
--
-- - Une abonnée a une fiche dans « clientes » (pour son journal, ses favoris…
--   plus tard), avec formule = 'abonnement'. Les clientes coachées gardent
--   formule = 'coaching'.
-- - PAR DÉFAUT, UNE ABONNÉE NE VOIT RIEN du coaching : ressources, communauté,
--   séances express, défis, journal, recettes… L'étape suivante ouvrira son
--   espace, élément par élément.
-- - La coach ne voit pas les abonnées dans ses clientes (ni leurs données
--   personnelles) : seulement une liste dédiée (prénom, email, abonnement).
-- - L'abonnement est tenu à jour par Stripe (webhook, clé secrète) : une
--   abonnée ne peut rien modifier elle-même.
-- =====================================================================

alter table public.clientes
  add column if not exists formule text not null default 'coaching' check (formule in ('coaching', 'abonnement')),
  add column if not exists stripe_customer_id text unique check (stripe_customer_id ~ '^cus_[A-Za-z0-9]+$'),
  add column if not exists stripe_subscription_id text unique check (stripe_subscription_id ~ '^sub_[A-Za-z0-9]+$'),
  add column if not exists abonnement_statut text check (abonnement_statut in ('active', 'trialing', 'past_due', 'unpaid', 'canceled', 'incomplete', 'incomplete_expired', 'paused')),
  add column if not exists abonnement_formule text check (abonnement_formule in ('mensuel', 'annuel')),
  add column if not exists abonnement_fin_periode date,
  add column if not exists abonnement_resilie boolean not null default false,
  add column if not exists cgv_acceptees_le timestamptz,
  add column if not exists renonciation_retractation boolean not null default false;

-- Réglages de l'offre (lus par la page publique côté serveur, modifiables par la coach).
alter table public.reglages
  add column if not exists abonnement_actif boolean not null default false,
  add column if not exists abonnement_prix_mensuel text check (abonnement_prix_mensuel ~ '^price_[A-Za-z0-9]+$'),
  add column if not exists abonnement_prix_annuel text check (abonnement_prix_annuel ~ '^price_[A-Za-z0-9]+$'),
  add column if not exists abonnement_titre text not null default 'Mon appli bien-être, sans coaching' check (length(abonnement_titre) between 1 and 120),
  add column if not exists abonnement_texte text not null default 'Mes recettes, mes séances express, les défis du mois et un thème chaque mois pour avancer à ton rythme, avec moi. Sans engagement : tu arrêtes quand tu veux.' check (length(abonnement_texte) <= 1500),
  add column if not exists lien_cgv text check (lien_cgv like 'https://%');

-- ---------- Accès : rien du coaching pour une abonnée ----------

-- Accès ouvert = coach, ou cliente COACHÉE non fermée. Toutes les protections existantes
-- (plans, ressources, journal, recettes, vidéos…) excluent donc les abonnées.
create or replace function public.acces_ouvert()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.est_coach() or exists (
    select 1 from public.clientes
    where id = (select auth.uid()) and statut <> 'fermee' and formule = 'coaching'
  );
$$;

create or replace function public.est_membre_communaute()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.est_coach() or (
    exists (select 1 from public.reglages where communaute_ouverte)
    and exists (
      select 1 from public.membres_communaute m
      join public.clientes c on c.id = m.cliente_id
      where m.cliente_id = (select auth.uid()) and m.statut = 'membre' and c.statut <> 'fermee' and c.formule = 'coaching'
    )
  );
$$;

create or replace function public.acces_seances_express()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.est_coach() or exists (
    select 1 from public.clientes
     where id = (select auth.uid()) and statut in ('active', 'terminee') and formule = 'coaching'
  );
$$;

create or replace function public.defi_pour_moi(p_audience text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not public.est_coach() and case p_audience
    when 'toutes' then exists (select 1 from public.clientes where id = (select auth.uid()) and statut in ('active', 'terminee') and formule = 'coaching')
    when 'communaute' then public.est_membre_communaute()
    else false
  end;
$$;

-- La coach voit ses clientes coachées ; une abonnée voit sa propre fiche.
drop policy clientes_lecture on public.clientes;
create policy clientes_lecture on public.clientes
  for select to authenticated
  using (id = (select auth.uid()) or ((select public.est_coach()) and formule = 'coaching'));
drop policy clientes_modif_coach on public.clientes;
create policy clientes_modif_coach on public.clientes
  for update to authenticated
  using ((select public.est_coach()) and formule = 'coaching')
  with check ((select public.est_coach()) and formule = 'coaching');
drop policy clientes_ajout_coach on public.clientes;
create policy clientes_ajout_coach on public.clientes
  for insert to authenticated
  with check ((select public.est_coach()) and formule = 'coaching');

-- Pour la coach : la liste de ses abonnées (sans aucune donnée personnelle de suivi).
create or replace function public.liste_abonnees()
returns table (
  id uuid, prenom text, nom text, email text, statut text, depuis date, ferme_le date,
  abonnement_statut text, abonnement_formule text, abonnement_fin_periode date, abonnement_resilie boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, p.prenom, p.nom, p.email, c.statut::text, c.date_debut, c.ferme_le,
         c.abonnement_statut, c.abonnement_formule, c.abonnement_fin_periode, c.abonnement_resilie
  from public.clientes c join public.profils p on p.id = c.id
  where c.formule = 'abonnement' and public.est_coach()
  order by c.statut::text = 'fermee', p.prenom, p.nom;
$$;
revoke execute on function public.liste_abonnees() from public, anon;
grant execute on function public.liste_abonnees() to authenticated;
