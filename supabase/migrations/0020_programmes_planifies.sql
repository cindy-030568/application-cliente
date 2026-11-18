-- =====================================================================
-- Programmes sportifs planifiés : la coach prépare à l'avance les
-- programmes d'une cliente (un toutes les 6 semaines à partir du début du
-- coaching). Chacun reste caché jusqu'à sa date, puis passe en ligne tout
-- seul. La cliente est prévenue 3 jours avant, puis le jour même.
-- =====================================================================

alter table public.programmes_sportifs
  -- Date à laquelle le programme passe en ligne tout seul (null = publication à la main).
  add column if not exists debut_le date,
  -- Jour où la cliente a été prévenue « ton nouveau programme arrive dans 3 jours ».
  add column if not exists annonce_le date;

create index if not exists programmes_sportifs_planifies_idx
  on public.programmes_sportifs (cliente_id, debut_le) where not publie and publie_le is null and debut_le is not null;

-- Met en ligne les programmes dont la date est arrivée. Renvoie les programmes mis en ligne.
-- La coach (ou la tâche du matin) : pour toutes les clientes ou une seule ;
-- une cliente : seulement les siens (appelé à l'ouverture de son onglet Sport).
create or replace function public.activer_programmes_planifies(p_cliente uuid default null)
returns setof uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_jour date := (now() at time zone 'Europe/Paris')::date;
  v_uid uuid := auth.uid();
  v_cliente uuid;
  v_actuel date;
  v_prog record;
  v_suivant date;
begin
  if v_uid is not null and not public.est_coach() then
    if not public.acces_ouvert() then return; end if;
    p_cliente := v_uid; -- une cliente ne déclenche que ses propres programmes
  end if;

  for v_cliente in
    select distinct p.cliente_id from public.programmes_sportifs p
     where not p.publie and p.publie_le is null and p.debut_le is not null and p.debut_le <= v_jour
       and (p_cliente is null or p.cliente_id = p_cliente)
  loop
    -- Début du programme en ligne (sa date prévue, sinon le jour où il a été publié).
    select coalesce(q.debut_le, (q.publie_le at time zone 'Europe/Paris')::date) into v_actuel
      from public.programmes_sportifs q where q.cliente_id = v_cliente and q.publie;

    -- Le plus récent des programmes arrivés à date, s'il est plus récent que celui en ligne.
    select p.id, p.debut_le into v_prog from public.programmes_sportifs p
     where p.cliente_id = v_cliente and not p.publie and p.publie_le is null
       and p.debut_le is not null and p.debut_le <= v_jour
       and (v_actuel is null or p.debut_le > v_actuel)
     order by p.debut_le desc, p.created_at desc
     limit 1;
    if v_prog.id is null then continue; end if;

    select min(p.debut_le) into v_suivant from public.programmes_sportifs p
     where p.cliente_id = v_cliente and not p.publie and p.publie_le is null and p.debut_le > v_prog.debut_le;

    update public.programmes_sportifs set publie = false where cliente_id = v_cliente and publie;
    update public.programmes_sportifs
       set publie = true, publie_le = now(), vu_le = null,
           renouveler_le = coalesce(v_suivant, v_prog.debut_le + 42), rappel_renouvellement_le = null
     where id = v_prog.id;
    return next v_prog.id;
  end loop;
end;
$$;
revoke execute on function public.activer_programmes_planifies(uuid) from public, anon;
grant execute on function public.activer_programmes_planifies(uuid) to authenticated, service_role;

-- Côté cliente : la date de son prochain programme planifié (rien d'autre n'est visible).
create or replace function public.ma_prochaine_bascule()
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select min(p.debut_le) from public.programmes_sportifs p
   where p.cliente_id = (select auth.uid()) and not p.publie and p.publie_le is null
     and p.debut_le > (now() at time zone 'Europe/Paris')::date
     and (select public.acces_ouvert());
$$;
revoke execute on function public.ma_prochaine_bascule() from public, anon;
grant execute on function public.ma_prochaine_bascule() to authenticated;
