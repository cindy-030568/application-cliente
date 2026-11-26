-- =====================================================================
-- Accès à vie des clientes coachées : après leur suivi (statut « terminée »),
-- elles gardent TOUT, sans date à remplir : séances express et défis du mois
-- « pour toutes » compris (ressources, audios et communauté : déjà le cas).
-- Seul un accès fermé par la coach coupe l'application.
--
-- La colonne clientes.express_jusqu_au (date d'accès après le suivi) n'est
-- plus utilisée : elle reste en place, sans effet.
-- =====================================================================

create or replace function public.acces_seances_express()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.est_coach() or exists (
    select 1 from public.clientes
     where id = (select auth.uid()) and statut in ('active', 'terminee')
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
    when 'toutes' then exists (select 1 from public.clientes where id = (select auth.uid()) and statut in ('active', 'terminee'))
    when 'communaute' then public.est_membre_communaute()
    else false
  end;
$$;

comment on column public.clientes.express_jusqu_au is 'Plus utilisée depuis 0044 : les clientes coachées ont accès à vie après leur suivi.';
