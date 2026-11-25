-- =====================================================================
-- Ressources : audios, favoris et reprise de l'écoute.
--
-- - Une ressource peut être un audio seul (relaxation, conseil…), ou une
--   fiche / un lien avec sa version audio en plus.
-- - Les audios (m4a, mp3…) sont dans un stockage PRIVÉ, 50 Mo par fichier,
--   lus seulement avec des liens temporaires. Une cliente ne peut lire que
--   l'audio d'une ressource qu'elle a le droit de voir.
-- - Favoris (cœur) et position d'écoute : par cliente, sur son compte.
--   La coach voit ce qui a été écouté, jamais rien d'autre.
-- =====================================================================

alter table public.ressources
  add column audio_path  text check (audio_path ~ '^[0-9a-f-]{36}\.(m4a|mp3|mp4|aac|webm)$'),
  add column audio_duree integer check (audio_duree between 1 and 36000);

-- Une ressource est un lien, une fiche ou un audio (ou une fiche / un lien avec son audio).
alter table public.ressources drop constraint ressources_lien_ou_fiche;
alter table public.ressources
  add constraint ressources_lien_fiche_ou_audio check (url is not null or contenu is not null or audio_path is not null);

-- ---------- Stockage des audios : bucket privé « audios », 50 Mo ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('audios', 'audios', false, 52428800,
        array['audio/mp4', 'audio/x-m4a', 'audio/m4a', 'audio/mpeg', 'audio/mp3', 'audio/aac', 'audio/webm'])
on conflict (id) do nothing;

create policy audios_coach on storage.objects for all to authenticated
  using (bucket_id = 'audios' and (select public.est_coach()))
  with check (bucket_id = 'audios' and (select public.est_coach()));
-- Une cliente lit un audio seulement s'il appartient à une ressource qu'elle voit (la RLS des ressources s'applique).
create policy audios_cliente on storage.objects for select to authenticated
  using (bucket_id = 'audios' and exists (select 1 from public.ressources r where r.audio_path = storage.objects.name));

-- ---------- Favoris ----------
create table public.ressources_favoris (
  cliente_id   uuid not null default auth.uid() references public.clientes (id) on delete cascade,
  ressource_id uuid not null references public.ressources (id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (cliente_id, ressource_id)
);
alter table public.ressources_favoris enable row level security;
revoke all on public.ressources_favoris from anon;

create policy ressources_favoris_lecture on public.ressources_favoris for select to authenticated
  using ((cliente_id = (select auth.uid()) and (select public.acces_ouvert())) or (select public.est_coach()));
-- Seulement pour soi, et une ressource qu'elle voit.
create policy ressources_favoris_ajout on public.ressources_favoris for insert to authenticated
  with check (
    cliente_id = (select auth.uid()) and not (select public.est_coach())
    and exists (select 1 from public.ressources r where r.id = ressource_id)
  );
create policy ressources_favoris_suppr on public.ressources_favoris for delete to authenticated
  using (cliente_id = (select auth.uid()));

-- ---------- Écoutes (reprise de la lecture) ----------
create table public.ressources_ecoutes (
  cliente_id   uuid not null default auth.uid() references public.clientes (id) on delete cascade,
  ressource_id uuid not null references public.ressources (id) on delete cascade,
  position_s   integer not null default 0 check (position_s between 0 and 36000),
  terminee     boolean not null default false,
  maj_le       timestamptz not null default now(),
  primary key (cliente_id, ressource_id)
);
alter table public.ressources_ecoutes enable row level security;
revoke all on public.ressources_ecoutes from anon;

create policy ressources_ecoutes_lecture on public.ressources_ecoutes for select to authenticated
  using ((cliente_id = (select auth.uid()) and (select public.acces_ouvert())) or (select public.est_coach()));
create policy ressources_ecoutes_ajout on public.ressources_ecoutes for insert to authenticated
  with check (
    cliente_id = (select auth.uid()) and not (select public.est_coach())
    and exists (select 1 from public.ressources r where r.id = ressource_id and r.audio_path is not null)
  );
create policy ressources_ecoutes_modif on public.ressources_ecoutes for update to authenticated
  using (cliente_id = (select auth.uid()))
  with check (
    cliente_id = (select auth.uid())
    and exists (select 1 from public.ressources r where r.id = ressource_id and r.audio_path is not null)
  );
