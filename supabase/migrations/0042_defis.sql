-- =====================================================================
-- Défis du mois : la coach lance un défi (pas, séances par semaine, eau,
-- sommeil, journal rempli) pour toutes ses clientes en cours de suivi ou
-- pour les membres de la communauté. Chaque cliente choisit de le relever.
--
-- - Réussite : un seuil par jour et un nombre de jours à atteindre
--   (séances : un nombre de séances par semaine et un nombre de semaines).
-- - La progression est calculée par la base, à partir du journal et des
--   séances faites (impossible à trafiquer depuis l'app).
-- - Une cliente ne voit que SA progression et un pourcentage moyen du
--   groupe, seulement à partir de 3 participantes (sinon on pourrait
--   deviner les chiffres d'une autre).
-- - Si elle l'a choisi, son prénom est fêté dans la communauté quand elle réussit.
-- =====================================================================

-- La cliente choisit de recevoir (ou non) les notifications des défis.
alter table public.clientes add column if not exists defis_notif boolean not null default true;

create or replace function public.definir_defis_notif(p_actif boolean)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.clientes set defis_notif = p_actif
  where id = (select auth.uid()) and statut <> 'fermee';
$$;
revoke execute on function public.definir_defis_notif(boolean) from public, anon;
grant execute on function public.definir_defis_notif(boolean) to authenticated;

-- ---------- Défis ----------
create table public.defis (
  id          uuid primary key default gen_random_uuid(),
  titre       text not null check (length(trim(titre)) between 1 and 100),
  description text check (length(description) <= 500),
  type        text not null check (type in ('pas', 'seances', 'hydratation', 'sommeil', 'journal')),
  -- pas par jour, séances par semaine, litres d'eau par jour, heures de sommeil par nuit ; rien pour le journal
  seuil       numeric(8, 2),
  -- nombre de jours (ou de semaines pour les séances) à réussir
  objectif    smallint not null check (objectif >= 1),
  debut       date not null,
  fin         date not null,
  audience    text not null default 'toutes' check (audience in ('toutes', 'communaute')),
  publie      boolean not null default false,
  -- notification de lancement déjà envoyée
  annonce_le  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (fin >= debut and fin - debut <= 92),
  check ((type = 'journal') = (seuil is null)),
  check (
    case type
      when 'pas' then seuil between 100 and 100000
      when 'seances' then seuil between 1 and 14 and seuil = round(seuil)
      when 'hydratation' then seuil between 0.25 and 6
      when 'sommeil' then seuil between 4 and 12
      else true
    end
  ),
  check (
    case when type = 'seances' then fin - debut + 1 >= 7 and objectif <= (fin - debut + 1) / 7
         else objectif <= fin - debut + 1 end
  )
);
create trigger defis_maj before update on public.defis
  for each row execute function public.maj_updated_at();
alter table public.defis enable row level security;
revoke all on public.defis from anon;

-- Le défi est-il pour l'utilisatrice connectée ? (cliente en cours de suivi, ou membre de la communauté)
create or replace function public.defi_pour_moi(p_audience text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not public.est_coach() and case p_audience
    when 'toutes' then exists (select 1 from public.clientes where id = (select auth.uid()) and statut = 'active')
    when 'communaute' then public.est_membre_communaute()
    else false
  end;
$$;
revoke execute on function public.defi_pour_moi(text) from public, anon;
grant execute on function public.defi_pour_moi(text) to authenticated;

create policy defis_coach on public.defis for all to authenticated
  using ((select public.est_coach())) with check ((select public.est_coach()));
create policy defis_lecture on public.defis for select to authenticated
  using (publie and public.defi_pour_moi(audience));

-- ---------- Participations ----------
create table public.defis_participations (
  defi_id         uuid not null references public.defis (id) on delete cascade,
  cliente_id      uuid not null default auth.uid() references public.clientes (id) on delete cascade,
  afficher_prenom boolean not null default false,
  inscrite_le     timestamptz not null default now(),
  reussi_le       timestamptz,
  -- notification de réussite envoyée (ou réussite vue dans l'app)
  notifie_le      timestamptz,
  -- prénom fêté dans la communauté
  celebre_le      timestamptz,
  primary key (defi_id, cliente_id)
);
create index defis_participations_cliente_idx on public.defis_participations (cliente_id);
alter table public.defis_participations enable row level security;
revoke all on public.defis_participations from anon;

create policy participations_lecture on public.defis_participations for select to authenticated
  using (cliente_id = (select auth.uid()) or (select public.est_coach()));
-- Relever le défi : pour soi, un défi publié qui lui est destiné et en cours.
create policy participations_ajout on public.defis_participations for insert to authenticated
  with check (
    cliente_id = (select auth.uid())
    and reussi_le is null and notifie_le is null and celebre_le is null
    and exists (
      select 1 from public.defis d
      where d.id = defi_id and d.publie and public.defi_pour_moi(d.audience)
        and (now() at time zone 'Europe/Paris')::date between d.debut and d.fin
    )
  );
-- Abandonner : tant que le défi n'est pas réussi. La coach peut tout retirer.
create policy participations_depart on public.defis_participations for delete to authenticated
  using ((cliente_id = (select auth.uid()) and reussi_le is null) or (select public.est_coach()));
-- Pas de modification directe : le prénom passe par afficher_prenom_defi, la réussite par la base.

-- ---------- Progression (calculée par la base) ----------

-- Nombre de jours (ou de semaines) réussis par une cliente, du début du défi à aujourd'hui.
-- Réservée aux fonctions ci-dessous (jamais appelable directement).
create or replace function public.reussites_defi(p_defi uuid, p_cliente uuid)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  d public.defis;
  jusqu_au date;
  n integer;
begin
  select * into d from public.defis where id = p_defi;
  if not found then return 0; end if;
  jusqu_au := least(d.fin, (now() at time zone 'Europe/Paris')::date);
  if d.type = 'seances' then
    -- Semaines de 7 jours à partir du premier jour du défi ; les jours après la dernière semaine complète ne comptent pas.
    select count(*) into n from (
      select ((s.faite_le at time zone 'Europe/Paris')::date - d.debut) / 7 as semaine
      from public.seances_faites s
      where s.cliente_id = p_cliente
        and (s.faite_le at time zone 'Europe/Paris')::date between d.debut and jusqu_au
      group by 1
      having count(*) >= d.seuil
    ) x
    where x.semaine < (d.fin - d.debut + 1) / 7;
  else
    select count(*) into n
    from public.journal_quotidien j
    where j.cliente_id = p_cliente and j.jour between d.debut and jusqu_au
      and case d.type
        when 'pas' then coalesce(j.pas >= d.seuil, false)
        when 'hydratation' then coalesce(j.hydratation >= d.seuil, false)
        when 'sommeil' then coalesce(j.sommeil >= d.seuil, false)
        else true
      end;
  end if;
  return n;
end;
$$;
revoke execute on function public.reussites_defi(uuid, uuid) from public, anon, authenticated;

-- Fête le prénom dans la communauté (si elle l'a choisi, une seule fois, communauté ouverte).
create or replace function public.celebrer_defi(p_defi uuid, p_cliente uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
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
  insert into public.messages_communaute (auteur_id, texte)
  values (v_coach, '🎉 Bravo ' || v_prenom || ' : défi « ' || v_titre || ' » relevé ! Je suis tellement fière de toi 💛');
end;
$$;
revoke execute on function public.celebrer_defi(uuid, uuid) from public, anon, authenticated;

-- Marque la réussite si l'objectif est atteint (une seule fois). Renvoie vrai si c'est réussi.
create or replace function public.verifier_reussite_defi(p_defi uuid, p_cliente uuid, p_vue boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reussi boolean;
begin
  select reussi_le is not null into v_reussi from public.defis_participations where defi_id = p_defi and cliente_id = p_cliente;
  if v_reussi is null then return false; end if;
  if v_reussi then return true; end if;
  if public.reussites_defi(p_defi, p_cliente) >= (select objectif from public.defis where id = p_defi) then
    update public.defis_participations
       set reussi_le = now(), notifie_le = case when p_vue then now() else notifie_le end
     where defi_id = p_defi and cliente_id = p_cliente and reussi_le is null;
    perform public.celebrer_defi(p_defi, p_cliente);
    return true;
  end if;
  return false;
end;
$$;
revoke execute on function public.verifier_reussite_defi(uuid, uuid, boolean) from public, anon, authenticated;

-- Pour la cliente : sa progression, et la progression moyenne du groupe (à partir de 3 participantes).
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
  if not found or not public.defi_pour_moi(d.audience) then return; end if;
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
revoke execute on function public.ma_progression_defi(uuid) from public, anon;
grant execute on function public.ma_progression_defi(uuid) to authenticated;

-- Pour la coach : la progression de chaque participante.
create or replace function public.progressions_defi(p_defi uuid)
returns table (cliente_id uuid, reussites integer, reussi_le timestamptz, afficher_prenom boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select p.cliente_id, public.reussites_defi(p_defi, p.cliente_id), p.reussi_le, p.afficher_prenom
  from public.defis_participations p
  where p.defi_id = p_defi and public.est_coach();
$$;
revoke execute on function public.progressions_defi(uuid) from public, anon;
grant execute on function public.progressions_defi(uuid) to authenticated;

-- La cliente choisit d'afficher (ou non) son prénom quand elle réussit.
create or replace function public.afficher_prenom_defi(p_defi uuid, p_afficher boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.defis_participations set afficher_prenom = p_afficher
   where defi_id = p_defi and cliente_id = (select auth.uid());
  if p_afficher then perform public.celebrer_defi(p_defi, (select auth.uid())); end if;
end;
$$;
revoke execute on function public.afficher_prenom_defi(uuid, boolean) from public, anon;
grant execute on function public.afficher_prenom_defi(uuid, boolean) to authenticated;

-- Pour la tâche planifiée (clé secrète seulement) : vérifie toutes les participations des défis en cours
-- ou terminés depuis moins de 3 jours. Renvoie les réussites à annoncer par notification.
create or replace function public.verifier_defis()
returns table (defi_id uuid, cliente_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  for r in
    select p.defi_id, p.cliente_id from public.defis_participations p
    join public.defis d on d.id = p.defi_id
    where d.publie and p.reussi_le is null
      and (now() at time zone 'Europe/Paris')::date between d.debut and d.fin + 3
  loop
    perform public.verifier_reussite_defi(r.defi_id, r.cliente_id, false);
  end loop;
  return query
    select p.defi_id, p.cliente_id from public.defis_participations p
    where p.reussi_le is not null and p.notifie_le is null;
end;
$$;
revoke execute on function public.verifier_defis() from public, anon, authenticated;
