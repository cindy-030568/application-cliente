-- =====================================================================
-- Espace abonnées (étape 3) : ce qu'une abonnée ACTIVE peut utiliser.
--
-- - Recettes publiées, séances express, son journal (+ énergie), ses séances
--   faites, « Mon métabolisme ».
-- - Ressources et défis : seulement ceux que la coach coche « pour les abonnées ».
-- - Communauté : un espace COMMUN (abonnées + coachées) et un salon réservé
--   aux coachées. Les anciens messages vont dans le salon des coachées
--   (ils ont été écrits entre coachées).
-- - La coach ne voit JAMAIS le journal, les séances, les favoris ni le
--   métabolisme d'une abonnée (seulement ceux de ses clientes coachées).
-- =====================================================================

-- ---------- Qui est qui ----------
create or replace function public.est_abonnee_active()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.clientes where id = (select auth.uid()) and formule = 'abonnement' and statut = 'active');
$$;
-- Accès à l'application : cliente coachée non fermée, abonnée active, ou coach.
create or replace function public.acces_appli()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.acces_ouvert() or public.est_abonnee_active();
$$;
-- Cette fiche est-elle une cliente coachée ? (pour que la coach ne voie que ses coachées)
create or replace function public.est_coachee(p_cliente uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.clientes where id = p_cliente and formule = 'coaching');
$$;
-- L'utilisatrice connectée voit-elle le salon des coachées ? (coach, ou cliente coachée non fermée)
create or replace function public.voit_salon_coachees()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.est_coach() or exists (select 1 from public.clientes where id = (select auth.uid()) and formule = 'coaching' and statut <> 'fermee');
$$;
revoke execute on function public.est_abonnee_active(), public.acces_appli(), public.est_coachee(uuid), public.voit_salon_coachees() from public, anon;
grant execute on function public.est_abonnee_active(), public.acces_appli(), public.est_coachee(uuid), public.voit_salon_coachees() to authenticated;

-- ---------- Recettes : publiées, pour les coachées et les abonnées ----------
drop policy recettes_lecture on public.recettes;
create policy recettes_lecture on public.recettes for select to authenticated
  using ((select public.est_coach()) or (publiee and (select public.acces_appli())));
create or replace function public.recette_visible(p_recette uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.est_coach() or (
    public.acces_appli() and exists (select 1 from public.recettes r where r.id = p_recette and r.publiee)
  );
$$;
drop policy tags_lecture on public.tags;
create policy tags_lecture on public.tags for select to authenticated using ((select public.acces_appli()));
drop policy aliments_lecture on public.aliments;
create policy aliments_lecture on public.aliments for select to authenticated using ((select public.acces_appli()));
drop policy favoris_lecture on public.favoris;
create policy favoris_lecture on public.favoris for select to authenticated
  using (((select public.est_coach()) and public.est_coachee(cliente_id)) or cliente_id = (select auth.uid()));
drop policy favoris_ajout on public.favoris;
create policy favoris_ajout on public.favoris for insert to authenticated
  with check (cliente_id = (select auth.uid()) and (select public.acces_appli()) and public.recette_visible(recette_id));

-- ---------- Séances express et séances faites ----------
create or replace function public.acces_seances_express()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.est_coach() or public.est_abonnee_active() or exists (
    select 1 from public.clientes
     where id = (select auth.uid()) and statut in ('active', 'terminee') and formule = 'coaching'
  );
$$;
drop policy seances_express_favoris_coach on public.seances_express_favoris;
create policy seances_express_favoris_coach on public.seances_express_favoris for select to authenticated
  using ((select public.est_coach()) and public.est_coachee(cliente_id));

drop policy seances_faites_lecture on public.seances_faites;
create policy seances_faites_lecture on public.seances_faites for select to authenticated
  using (((select public.est_coach()) and public.est_coachee(cliente_id)) or (cliente_id = (select auth.uid()) and (select public.acces_appli())));
drop policy seances_faites_ajout on public.seances_faites;
create policy seances_faites_ajout on public.seances_faites for insert to authenticated
  with check (cliente_id = (select auth.uid()) and not (select public.est_coach()) and (select public.acces_appli()));
drop policy seances_faites_suppr on public.seances_faites;
create policy seances_faites_suppr on public.seances_faites for delete to authenticated
  using (((select public.est_coach()) and public.est_coachee(cliente_id)) or (cliente_id = (select auth.uid()) and (select public.acces_appli())));

drop policy charges_lecture on public.charges_series;
create policy charges_lecture on public.charges_series for select to authenticated
  using (((select public.est_coach()) and public.est_coachee(cliente_id)) or (cliente_id = (select auth.uid()) and (select public.acces_appli())));
drop policy charges_ajout on public.charges_series;
create policy charges_ajout on public.charges_series for insert to authenticated
  with check (cliente_id = (select auth.uid()) and not (select public.est_coach()) and (select public.acces_appli()));
drop policy charges_modif on public.charges_series;
create policy charges_modif on public.charges_series for update to authenticated
  using (cliente_id = (select auth.uid()) and (select public.acces_appli()))
  with check (cliente_id = (select auth.uid()) and (select public.acces_appli()));
drop policy charges_suppr on public.charges_series;
create policy charges_suppr on public.charges_series for delete to authenticated
  using (((select public.est_coach()) and public.est_coachee(cliente_id)) or (cliente_id = (select auth.uid()) and (select public.acces_appli())));

-- ---------- Journal : le sien (+ énergie) ; la coach seulement pour ses coachées ----------
alter table public.journal_quotidien add column if not exists energie smallint check (energie between 1 and 5);
drop policy journal_lecture on public.journal_quotidien;
create policy journal_lecture on public.journal_quotidien for select to authenticated
  using (((select public.est_coach()) and public.est_coachee(cliente_id)) or (cliente_id = (select auth.uid()) and (select public.acces_appli())));
drop policy journal_ajout on public.journal_quotidien;
create policy journal_ajout on public.journal_quotidien for insert to authenticated
  with check (
    ((select public.est_coach()) and public.est_coachee(cliente_id))
    or (cliente_id = (select auth.uid()) and (select public.acces_appli()) and jour <= (now() at time zone 'Europe/Paris')::date)
  );
drop policy journal_modif on public.journal_quotidien;
create policy journal_modif on public.journal_quotidien for update to authenticated
  using (((select public.est_coach()) and public.est_coachee(cliente_id)) or (cliente_id = (select auth.uid()) and (select public.acces_appli())))
  with check (
    ((select public.est_coach()) and public.est_coachee(cliente_id))
    or (cliente_id = (select auth.uid()) and (select public.acces_appli()) and jour <= (now() at time zone 'Europe/Paris')::date)
  );
drop policy journal_suppr on public.journal_quotidien;
create policy journal_suppr on public.journal_quotidien for delete to authenticated
  using (((select public.est_coach()) and public.est_coachee(cliente_id)) or (cliente_id = (select auth.uid()) and (select public.acces_appli())));

-- ---------- Ressources : celles cochées « pour les abonnées » ----------
alter table public.ressources add column if not exists pour_abonnees boolean not null default false;
drop policy ressources_lecture on public.ressources;
create policy ressources_lecture on public.ressources for select to authenticated
  using (
    (select public.est_coach())
    or (
      publiee and (
        (
          (select public.acces_ouvert())
          and (visibilite = 'toutes' or exists (select 1 from public.ressources_clientes rc where rc.ressource_id = ressources.id and rc.cliente_id = (select auth.uid())))
        )
        or (pour_abonnees and (select public.est_abonnee_active()))
      )
    )
  );
drop policy categories_ressource_lecture on public.categories_ressource;
create policy categories_ressource_lecture on public.categories_ressource for select to authenticated using ((select public.acces_appli()));
drop policy ressources_favoris_lecture on public.ressources_favoris;
create policy ressources_favoris_lecture on public.ressources_favoris for select to authenticated
  using ((cliente_id = (select auth.uid()) and (select public.acces_appli())) or ((select public.est_coach()) and public.est_coachee(cliente_id)));
drop policy ressources_ecoutes_lecture on public.ressources_ecoutes;
create policy ressources_ecoutes_lecture on public.ressources_ecoutes for select to authenticated
  using ((cliente_id = (select auth.uid()) and (select public.acces_appli())) or ((select public.est_coach()) and public.est_coachee(cliente_id)));

-- ---------- Défis : ceux cochés « pour les abonnées » ----------
alter table public.defis add column if not exists pour_abonnees boolean not null default false;
-- Un défi « membres de la communauté » reste pour les coachées membres (la communauté est maintenant mixte).
create or replace function public.defi_pour_moi(p_audience text)
returns boolean language sql stable security definer set search_path = '' as $$
  select not public.est_coach() and case p_audience
    when 'toutes' then exists (select 1 from public.clientes where id = (select auth.uid()) and statut in ('active', 'terminee') and formule = 'coaching')
    when 'communaute' then public.est_membre_communaute() and exists (select 1 from public.clientes where id = (select auth.uid()) and formule = 'coaching')
    else false
  end;
$$;
create or replace function public.defi_visible(p_audience text, p_pour_abonnees boolean)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.defi_pour_moi(p_audience) or (p_pour_abonnees and public.est_abonnee_active());
$$;
revoke execute on function public.defi_visible(text, boolean) from public, anon;
grant execute on function public.defi_visible(text, boolean) to authenticated;

drop policy defis_lecture on public.defis;
create policy defis_lecture on public.defis for select to authenticated
  using (publie and public.defi_visible(audience, pour_abonnees));
drop policy participations_ajout on public.defis_participations;
create policy participations_ajout on public.defis_participations for insert to authenticated
  with check (
    cliente_id = (select auth.uid())
    and reussi_le is null and notifie_le is null and celebre_le is null
    and exists (
      select 1 from public.defis d
      where d.id = defi_id and d.publie and public.defi_visible(d.audience, d.pour_abonnees)
        and (now() at time zone 'Europe/Paris')::date between d.debut and d.fin
    )
  );

create or replace function public.ma_progression_defi(p_defi uuid)
returns table (reussites integer, objectif integer, reussi boolean, groupe integer, participantes integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.defis;
  moi uuid := (select auth.uid());
  v_nb integer;
  v_groupe integer;
begin
  select * into d from public.defis where id = p_defi and publie;
  if not found or not public.defi_visible(d.audience, d.pour_abonnees) then return; end if;
  select count(*) into v_nb from public.defis_participations where defi_id = p_defi;
  if v_nb >= 3 then
    select round(100 * avg(least(public.reussites_defi(p_defi, p.cliente_id)::numeric / d.objectif, 1)))::integer
      into v_groupe from public.defis_participations p where p.defi_id = p_defi;
  end if;
  if exists (select 1 from public.defis_participations where defi_id = p_defi and cliente_id = moi) then
    reussi := public.verifier_reussite_defi(p_defi, moi, true);
    reussites := least(public.reussites_defi(p_defi, moi), d.objectif);
  else
    reussi := false;
    reussites := null;
  end if;
  objectif := d.objectif;
  groupe := v_groupe;
  participantes := v_nb;
  return next;
end;
$$;

-- La coach voit la progression de ses coachées (pas celle des abonnées, tirée de leur journal).
create or replace function public.progressions_defi(p_defi uuid)
returns table (cliente_id uuid, reussites integer, reussi_le timestamptz, afficher_prenom boolean)
language sql stable security definer set search_path = '' as $$
  select p.cliente_id, public.reussites_defi(p_defi, p.cliente_id), p.reussi_le, p.afficher_prenom
  from public.defis_participations p
  where p.defi_id = p_defi and public.est_coach() and public.est_coachee(p.cliente_id);
$$;

-- ---------- Communauté : un espace commun et un salon réservé aux coachées ----------
alter table public.messages_communaute add column if not exists salon text not null default 'commun' check (salon in ('commun', 'coachees'));
-- Tout ce qui a été écrit avant : entre coachées, ça reste entre coachées.
update public.messages_communaute set salon = 'coachees';

-- Membre : cliente coachée non fermée, ou abonnée active (une abonnée terminée est « fermée »).
create or replace function public.est_membre_communaute()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.est_coach() or (
    exists (select 1 from public.reglages where communaute_ouverte)
    and exists (
      select 1 from public.membres_communaute m
      join public.clientes c on c.id = m.cliente_id
      where m.cliente_id = (select auth.uid()) and m.statut = 'membre' and c.statut <> 'fermee'
    )
  );
$$;
drop policy messages_lecture on public.messages_communaute;
create policy messages_lecture on public.messages_communaute for select to authenticated
  using ((select public.est_membre_communaute()) and (salon = 'commun' or (select public.voit_salon_coachees())));
drop policy messages_ajout on public.messages_communaute;
create policy messages_ajout on public.messages_communaute for insert to authenticated
  with check (auteur_id = (select auth.uid()) and (select public.est_membre_communaute()) and (salon = 'commun' or (select public.voit_salon_coachees())));
-- Réactions et photos : seulement sur les messages qu'elle voit.
drop policy reactions_lecture on public.reactions_communaute;
create policy reactions_lecture on public.reactions_communaute for select to authenticated
  using ((select public.est_membre_communaute()) and exists (select 1 from public.messages_communaute m where m.id = message_id));
drop policy reactions_ajout on public.reactions_communaute;
create policy reactions_ajout on public.reactions_communaute for insert to authenticated
  with check (auteur_id = (select auth.uid()) and (select public.est_membre_communaute()) and exists (select 1 from public.messages_communaute m where m.id = message_id));
drop policy communaute_fichiers_lecture on storage.objects;
create policy communaute_fichiers_lecture on storage.objects for select to authenticated
  using (
    bucket_id = 'communaute' and (select public.est_membre_communaute())
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (select 1 from public.messages_communaute m where m.photo_path = storage.objects.name)
    )
  );
drop policy membres_ajout on public.membres_communaute;
create policy membres_ajout on public.membres_communaute for insert to authenticated
  with check (
    cliente_id = (select auth.uid()) and statut = 'membre'
    and (select public.acces_appli()) and not (select public.est_coach())
    and exists (select 1 from public.reglages where communaute_ouverte)
  );

-- Célébration d'un défi : dans le salon des coachées pour une coachée, dans l'espace commun pour une abonnée.
create or replace function public.celebrer_defi(p_defi uuid, p_cliente uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_coach uuid;
  v_prenom text;
  v_titre text;
begin
  if not exists (
    select 1 from public.defis_participations
    where defi_id = p_defi and cliente_id = p_cliente and afficher_prenom and reussi_le is not null and celebre_le is null
  ) then return; end if;
  if not exists (select 1 from public.reglages where communaute_ouverte) then return; end if;
  select id into v_coach from public.profils where role = 'coach' order by created_at limit 1;
  select nullif(trim(prenom), '') into v_prenom from public.profils where id = p_cliente;
  select titre into v_titre from public.defis where id = p_defi;
  if v_coach is null or v_prenom is null then return; end if;
  update public.defis_participations set celebre_le = now() where defi_id = p_defi and cliente_id = p_cliente;
  insert into public.messages_communaute (auteur_id, texte, salon)
  values (v_coach, '🎉 Bravo ' || v_prenom || ' : défi « ' || v_titre || ' » relevé ! Je suis tellement fière de toi 💛',
          case when public.est_coachee(p_cliente) then 'coachees' else 'commun' end);
end;
$$;
revoke execute on function public.celebrer_defi(uuid, uuid) from public, anon, authenticated;

-- ---------- Mon métabolisme (abonnées) ----------
create table public.metabolisme (
  cliente_id      uuid primary key default auth.uid() references public.clientes (id) on delete cascade,
  annee_naissance smallint not null check (annee_naissance between 1920 and 2015),
  taille_cm       numeric(5, 1) not null check (taille_cm between 120 and 220),
  poids_kg        numeric(5, 1) not null check (poids_kg between 30 and 250),
  activite        text not null check (activite in ('sedentaire', 'legere', 'moderee', 'active', 'tres_active')),
  maj_le          timestamptz not null default now()
);
alter table public.metabolisme enable row level security;
revoke all on public.metabolisme from anon;
-- Privé : seulement elle (pas la coach).
create policy metabolisme_lecture on public.metabolisme for select to authenticated
  using (cliente_id = (select auth.uid()) and (select public.acces_appli()));
create policy metabolisme_ajout on public.metabolisme for insert to authenticated
  with check (cliente_id = (select auth.uid()) and (select public.acces_appli()) and not (select public.est_coach()));
create policy metabolisme_modif on public.metabolisme for update to authenticated
  using (cliente_id = (select auth.uid()) and (select public.acces_appli()))
  with check (cliente_id = (select auth.uid()) and (select public.acces_appli()));
create policy metabolisme_suppr on public.metabolisme for delete to authenticated
  using (cliente_id = (select auth.uid()));

-- ---------- Mode sans chiffres : une abonnée le choisit elle-même ----------
create or replace function public.definir_sans_chiffres_abonnee(p_actif boolean)
returns void language sql security definer set search_path = '' as $$
  update public.clientes set mode_sans_chiffres = p_actif
  where id = (select auth.uid()) and formule = 'abonnement' and statut = 'active';
$$;
revoke execute on function public.definir_sans_chiffres_abonnee(boolean) from public, anon;
grant execute on function public.definir_sans_chiffres_abonnee(boolean) to authenticated;
