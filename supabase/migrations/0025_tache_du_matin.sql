-- =====================================================================
-- Tâche du matin (rappels de bilan, de paiement, programmes planifiés…) :
-- un seul passage par jour, quel que soit celui qui la lance (Supabase,
-- Vercel ou Netlify). Le premier appel du jour la « réserve » ; les suivants
-- ne font rien. Si un passage échoue, le suivant peut la relancer.
-- La coach voit dans Réglages quand elle a tourné pour la dernière fois.
-- =====================================================================

create table public.taches_du_matin (
  jour       date primary key,
  source     text not null check (source in ('supabase', 'hebergeur')),
  statut     text not null default 'en_cours' check (statut in ('en_cours', 'ok', 'echec')),
  debut_le   timestamptz not null default now(),
  fin_le     timestamptz,
  -- Compteurs seulement (nombre de rappels envoyés…), jamais de donnée personnelle.
  compteurs  jsonb
);
alter table public.taches_du_matin enable row level security;
revoke all on public.taches_du_matin from anon;

-- Lecture : la coach seule. Écriture : uniquement par les fonctions ci-dessous (clé secrète du serveur).
create policy taches_du_matin_coach on public.taches_du_matin for select to authenticated
  using ((select public.est_coach()));

-- Réserve la tâche du jour. Renvoie true si l'appelant doit la lancer, false si elle est déjà faite
-- (ou en cours depuis moins de 30 minutes).
create or replace function public.reserver_tache_du_matin(p_jour date, p_source text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reserve boolean;
begin
  insert into public.taches_du_matin as t (jour, source)
  values (p_jour, p_source)
  on conflict (jour) do update
    set source = excluded.source, statut = 'en_cours', debut_le = now(), fin_le = null, compteurs = null
    where t.statut = 'echec' or (t.statut = 'en_cours' and t.debut_le < now() - interval '30 minutes')
  returning true into v_reserve;
  return coalesce(v_reserve, false);
end;
$$;

-- Note la fin de la tâche (ok ou échec) et ses compteurs.
create or replace function public.terminer_tache_du_matin(p_jour date, p_statut text, p_compteurs jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.taches_du_matin
     set statut = case when p_statut = 'ok' then 'ok' else 'echec' end, fin_le = now(), compteurs = p_compteurs
   where jour = p_jour;
$$;

revoke execute on function public.reserver_tache_du_matin(date, text) from public, anon, authenticated;
revoke execute on function public.terminer_tache_du_matin(date, text, jsonb) from public, anon, authenticated;
grant execute on function public.reserver_tache_du_matin(date, text) to service_role;
grant execute on function public.terminer_tache_du_matin(date, text, jsonb) to service_role;
