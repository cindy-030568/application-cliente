-- =====================================================================
-- Phase 10 : la Communauté — un seul groupe d'échange entre clientes.
-- - adhésion volontaire après acceptation de la charte ;
-- - messages (texte et photo), affichés avec le seul prénom ;
-- - réactions, signalements ;
-- - modération par la coach (épingler, supprimer, retirer une cliente).
-- Aucune donnée de suivi n'est accessible depuis la communauté.
-- =====================================================================

alter table public.reglages
  add column communaute_ouverte boolean not null default false,
  add column communaute_charte text not null default
    'Bienvenue dans la communauté fitw_cindy 💛
• Bienveillance avant tout : on encourage, on ne juge jamais (ni les corps, ni les assiettes).
• Pas de conseils médicaux ni de régimes : pour ton accompagnement, c''est Cindy.
• Ce qui se dit ici reste ici : pas de captures d''écran partagées ailleurs.
• Tu partages seulement ce que tu veux : ton prénom et tes messages sont visibles par les autres membres.
• Cindy peut retirer un message ou une personne qui ne respecte pas ces règles.'
    check (length(communaute_charte) between 1 and 3000);

-- ---------- Membres ----------
create table public.membres_communaute (
  cliente_id     uuid primary key references public.clientes (id) on delete cascade,
  statut         text not null default 'membre' check (statut in ('membre', 'exclue')),
  charte_acceptee_le timestamptz not null default now(),
  notifications  boolean not null default false,
  dernier_vu     timestamptz not null default now(),
  derniere_notif timestamptz,
  created_at     timestamptz not null default now()
);
alter table public.membres_communaute enable row level security;
revoke all on public.membres_communaute from anon;

-- Vrai si l'utilisatrice connectée peut voir et écrire dans la communauté.
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
      where m.cliente_id = (select auth.uid()) and m.statut = 'membre' and c.statut <> 'fermee'
    )
  );
$$;
revoke execute on function public.est_membre_communaute() from public, anon;
grant execute on function public.est_membre_communaute() to authenticated;

create policy membres_lecture on public.membres_communaute for select to authenticated
  using (cliente_id = (select auth.uid()) or (select public.est_coach()));
-- Rejoindre : seulement soi-même, accès ouvert, communauté ouverte.
create policy membres_ajout on public.membres_communaute for insert to authenticated
  with check (
    cliente_id = (select auth.uid()) and statut = 'membre'
    and (select public.acces_ouvert()) and not (select public.est_coach())
    and exists (select 1 from public.reglages where communaute_ouverte)
  );
-- Quitter : seulement tant qu'on n'a pas été retirée (sinon on pourrait revenir).
create policy membres_depart on public.membres_communaute for delete to authenticated
  using ((cliente_id = (select auth.uid()) and statut = 'membre') or (select public.est_coach()));
create policy membres_coach on public.membres_communaute for update to authenticated
  using ((select public.est_coach())) with check ((select public.est_coach()));

-- La membre règle ses notifications et note sa dernière visite (rien d'autre).
create or replace function public.reglages_membre(p_notifications boolean default null, p_vu boolean default false)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.membres_communaute
     set notifications = coalesce(p_notifications, notifications),
         dernier_vu = case when p_vu then now() else dernier_vu end
   where cliente_id = (select auth.uid()) and statut = 'membre';
$$;
revoke execute on function public.reglages_membre(boolean, boolean) from public, anon;
grant execute on function public.reglages_membre(boolean, boolean) to authenticated;

-- ---------- Messages ----------
create table public.messages_communaute (
  id            uuid primary key default gen_random_uuid(),
  auteur_id     uuid not null default auth.uid() references public.profils (id) on delete cascade,
  auteur_prenom text not null default '',
  auteur_coach  boolean not null default false,
  texte         text not null default '' check (length(texte) <= 2000),
  photo_path    text check (photo_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$'),
  epingle       boolean not null default false,
  created_at    timestamptz not null default now(),
  check (length(trim(texte)) > 0 or photo_path is not null)
);
create index messages_communaute_date_idx on public.messages_communaute (created_at desc);
alter table public.messages_communaute enable row level security;
revoke all on public.messages_communaute from anon;

-- Prénom et rôle figés côté serveur (impossible de publier sous un autre nom) + garde-fou de débit.
create or replace function public.preparer_message_communaute()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select coalesce(nullif(trim(p.prenom), ''), 'Membre'), p.role = 'coach'
    into new.auteur_prenom, new.auteur_coach
    from public.profils p where p.id = new.auteur_id;
  new.epingle := false;
  if (select count(*) from public.messages_communaute
       where auteur_id = new.auteur_id and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'Trop de messages en peu de temps' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke execute on function public.preparer_message_communaute() from public, anon, authenticated;
create trigger messages_communaute_preparer before insert on public.messages_communaute
  for each row execute function public.preparer_message_communaute();

create policy messages_lecture on public.messages_communaute for select to authenticated
  using ((select public.est_membre_communaute()));
create policy messages_ajout on public.messages_communaute for insert to authenticated
  with check (auteur_id = (select auth.uid()) and (select public.est_membre_communaute()));
create policy messages_suppr on public.messages_communaute for delete to authenticated
  using (auteur_id = (select auth.uid()) or (select public.est_coach()));
-- Épingler : la coach seulement.
create policy messages_epingle on public.messages_communaute for update to authenticated
  using ((select public.est_coach())) with check ((select public.est_coach()));

-- ---------- Réactions ----------
create table public.reactions_communaute (
  message_id uuid not null references public.messages_communaute (id) on delete cascade,
  auteur_id  uuid not null default auth.uid() references public.profils (id) on delete cascade,
  emoji      text not null check (emoji in ('coeur', 'bravo', 'force', 'rire')),
  created_at timestamptz not null default now(),
  primary key (message_id, auteur_id, emoji)
);
alter table public.reactions_communaute enable row level security;
revoke all on public.reactions_communaute from anon;
create policy reactions_lecture on public.reactions_communaute for select to authenticated
  using ((select public.est_membre_communaute()));
create policy reactions_ajout on public.reactions_communaute for insert to authenticated
  with check (auteur_id = (select auth.uid()) and (select public.est_membre_communaute()));
create policy reactions_suppr on public.reactions_communaute for delete to authenticated
  using (auteur_id = (select auth.uid()));

-- ---------- Signalements ----------
create table public.signalements_communaute (
  id         uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages_communaute (id) on delete cascade,
  auteur_id  uuid not null default auth.uid() references public.profils (id) on delete cascade,
  motif      text check (length(motif) <= 300),
  traite     boolean not null default false,
  created_at timestamptz not null default now(),
  unique (message_id, auteur_id)
);
alter table public.signalements_communaute enable row level security;
revoke all on public.signalements_communaute from anon;
create policy signalements_ajout on public.signalements_communaute for insert to authenticated
  with check (auteur_id = (select auth.uid()) and (select public.est_membre_communaute()));
create policy signalements_lecture on public.signalements_communaute for select to authenticated
  using (auteur_id = (select auth.uid()) or (select public.est_coach()));
create policy signalements_coach on public.signalements_communaute for update to authenticated
  using ((select public.est_coach())) with check ((select public.est_coach()));

-- ---------- Photos : bucket privé « communaute », 10 Mo, images ----------
-- Chemin : <id de l'autrice>/<id>.jpg ; visibles par les membres seulement (liens temporaires).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('communaute', 'communaute', false, 10485760, array['image/jpeg'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy communaute_fichiers_lecture on storage.objects for select to authenticated
  using (bucket_id = 'communaute' and (select public.est_membre_communaute()));
create policy communaute_fichiers_ajout on storage.objects for insert to authenticated
  with check (bucket_id = 'communaute'
              and (storage.foldername(name))[1] = (select auth.uid())::text
              and (select public.est_membre_communaute()));
create policy communaute_fichiers_suppr on storage.objects for delete to authenticated
  using (bucket_id = 'communaute'
         and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.est_coach())));
