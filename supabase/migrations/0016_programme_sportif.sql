-- =====================================================================
-- Programme sportif construit avec Claude puis collé dans l'application.
-- Le contenu (séances, blocs, exercices) est un JSON validé par l'app.
-- La cliente ne voit que le programme publié, et seulement si son accès est ouvert.
-- =====================================================================

create table public.programmes_sportifs (
  id          uuid primary key default gen_random_uuid(),
  cliente_id  uuid not null references public.clientes (id) on delete cascade,
  titre       text not null default 'Programme sportif' check (length(trim(titre)) between 1 and 100),
  contenu     jsonb not null default '{"seances": []}'::jsonb
              check (jsonb_typeof(contenu) = 'object' and octet_length(contenu::text) < 300000),
  publie      boolean not null default false,
  publie_le   timestamptz,
  vu_le       timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index programmes_sportifs_cliente_idx on public.programmes_sportifs (cliente_id, created_at desc);
create unique index programmes_sportifs_un_publie on public.programmes_sportifs (cliente_id) where publie;
alter table public.programmes_sportifs enable row level security;
revoke all on public.programmes_sportifs from anon;

create policy programmes_lecture on public.programmes_sportifs for select to authenticated
  using (
    (select public.est_coach())
    or (cliente_id = (select auth.uid()) and publie and (select public.acces_ouvert()))
  );
create policy programmes_coach_ajout on public.programmes_sportifs for insert to authenticated
  with check ((select public.est_coach()));
create policy programmes_coach_modif on public.programmes_sportifs for update to authenticated
  using ((select public.est_coach())) with check ((select public.est_coach()));
create policy programmes_coach_suppr on public.programmes_sportifs for delete to authenticated
  using ((select public.est_coach()));

-- La cliente note qu'elle a ouvert son programme (rien d'autre).
create or replace function public.programme_sportif_vu(p_programme uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.programmes_sportifs
     set vu_le = now()
   where id = p_programme and cliente_id = (select auth.uid()) and publie and vu_le is null
     and (select public.acces_ouvert());
$$;
revoke execute on function public.programme_sportif_vu(uuid) from public, anon;
grant execute on function public.programme_sportif_vu(uuid) to authenticated;

-- Publier : dépublie les autres programmes de la cliente dans la même opération.
create or replace function public.publier_programme_sportif(p_programme uuid, p_publie boolean)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_cliente uuid;
begin
  if not public.est_coach() then
    raise exception 'Réservé à la coach' using errcode = 'insufficient_privilege';
  end if;
  select cliente_id into v_cliente from public.programmes_sportifs where id = p_programme;
  if v_cliente is null then
    raise exception 'Programme introuvable' using errcode = 'no_data_found';
  end if;
  if p_publie then
    update public.programmes_sportifs set publie = false where cliente_id = v_cliente and publie and id <> p_programme;
    update public.programmes_sportifs set publie = true, publie_le = now(), vu_le = null where id = p_programme;
  else
    update public.programmes_sportifs set publie = false where id = p_programme;
  end if;
end;
$$;
revoke execute on function public.publier_programme_sportif(uuid, boolean) from public, anon;
grant execute on function public.publier_programme_sportif(uuid, boolean) to authenticated;
