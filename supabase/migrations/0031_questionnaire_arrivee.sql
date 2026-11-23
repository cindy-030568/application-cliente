-- =====================================================================
-- Questionnaire d'arrivée : à la première connexion, après le contrat.
-- Habitudes, objectif, allergies et aliments évités, rythme de vie, sport,
-- cycle (facultatif). Il pré-remplit les exclusions de recettes (catégories)
-- et l'objectif ; la coach corrige tout depuis la fiche. Questions
-- modifiables dans Réglages. Réponses visibles par la cliente et la coach seulement.
-- Les clientes déjà en cours avant cette mise à jour ne sont pas concernées.
-- =====================================================================

alter table public.reglages
  add column if not exists questionnaire_actif   boolean not null default true,
  add column if not exists questionnaire_depuis  timestamptz not null default now();

create table public.questions_arrivee (
  id          uuid primary key default gen_random_uuid(),
  ordre       integer not null default 0,
  section     text not null default '' check (length(section) <= 80),
  libelle     text not null check (length(libelle) between 1 and 300),
  aide        text check (length(aide) <= 500),
  -- objectif : choix lié à l'objectif de sa fiche ; exclusions : catégories d'aliments à exclure + autres aliments.
  type        text not null check (type in ('texte', 'texte_long', 'choix', 'choix_multiple', 'objectif', 'exclusions')),
  options     text[] not null default '{}' check (cardinality(options) <= 20),
  obligatoire boolean not null default false,
  actif       boolean not null default true,
  created_at  timestamptz not null default now()
);
alter table public.questions_arrivee enable row level security;
revoke all on public.questions_arrivee from anon;
create policy questions_arrivee_lecture on public.questions_arrivee for select to authenticated
  using ((select public.est_coach()) or (actif and (select public.acces_ouvert())));
create policy questions_arrivee_coach on public.questions_arrivee for all to authenticated
  using ((select public.est_coach())) with check ((select public.est_coach()));

create table public.reponses_arrivee (
  cliente_id uuid primary key references public.clientes (id) on delete cascade,
  -- [{ "question": "…", "reponse": "…" ou [ "…", "…" ] }] : la question est recopiée telle qu'elle a été posée.
  reponses   jsonb not null check (jsonb_typeof(reponses) = 'array' and length(reponses::text) <= 60000),
  envoye_le  timestamptz not null default now()
);
alter table public.reponses_arrivee enable row level security;
revoke all on public.reponses_arrivee from anon;
create policy reponses_arrivee_lecture on public.reponses_arrivee for select to authenticated
  using ((select public.est_coach()) or (cliente_id = (select auth.uid()) and (select public.acces_ouvert())));
create policy reponses_arrivee_coach on public.reponses_arrivee for delete to authenticated
  using ((select public.est_coach()));
-- Pas d'écriture directe par la cliente : uniquement par envoyer_questionnaire.

-- Le questionnaire est-il à remplir par la cliente connectée ?
create or replace function public.questionnaire_a_remplir()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select r.questionnaire_actif
       and exists (select 1 from public.questions_arrivee q where q.actif)
       and exists (select 1 from public.clientes c where c.id = (select auth.uid()) and c.statut <> 'fermee')
       and not exists (select 1 from public.reponses_arrivee a where a.cliente_id = (select auth.uid()))
       -- Déjà en cours avant le questionnaire : pas concernée.
       and not exists (select 1 from public.consentements co where co.cliente_id = (select auth.uid()) and co.accepte_le < r.questionnaire_depuis)
    from public.reglages r
  ), false);
$$;

-- Envoi : les réponses, les catégories d'aliments à exclure et l'objectif (si sa fiche n'en a pas encore).
create or replace function public.envoyer_questionnaire(p_reponses jsonb, p_categories uuid[] default '{}', p_objectif text default null)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := (select auth.uid());
begin
  if not exists (select 1 from public.clientes where id = v_id and statut <> 'fermee') then
    raise exception 'réservé aux clientes' using errcode = 'insufficient_privilege';
  end if;
  if jsonb_typeof(p_reponses) is distinct from 'array' or jsonb_array_length(p_reponses) > 100 then
    raise exception 'réponses illisibles' using errcode = 'check_violation';
  end if;
  insert into public.reponses_arrivee (cliente_id, reponses) values (v_id, p_reponses) on conflict (cliente_id) do nothing;
  if not found then return false; end if;
  insert into public.exclusions (cliente_id, categorie_id)
    select v_id, c.id from public.categories_aliment c where c.id = any (coalesce(p_categories, '{}'))
  on conflict (cliente_id, categorie_id) where categorie_id is not null do nothing;
  if p_objectif in ('perte', 'maintien', 'prise', 'recompo') then
    insert into public.besoins_clientes (cliente_id, objectif) values (v_id, p_objectif)
    on conflict (cliente_id) do update set objectif = excluded.objectif where public.besoins_clientes.objectif is null;
  end if;
  return true;
end;
$$;

revoke execute on function public.questionnaire_a_remplir() from public, anon;
revoke execute on function public.envoyer_questionnaire(jsonb, uuid[], text) from public, anon;
grant execute on function public.questionnaire_a_remplir() to authenticated;
grant execute on function public.envoyer_questionnaire(jsonb, uuid[], text) to authenticated;

-- Questions de départ (modifiables dans Réglages → Questionnaire d'arrivée).
insert into public.questions_arrivee (ordre, section, libelle, aide, type, options, obligatoire) values
  (10, 'Ton objectif', 'Quel est ton objectif principal ?', null, 'objectif',
    array['Perdre du gras', 'Me sentir mieux sans viser un poids (maintien)', 'Prendre du muscle ou du poids', 'Me tonifier : perdre du gras et gagner du muscle'], true),
  (20, 'Ton objectif', 'Dans 3 mois, qu''est-ce qui te ferait dire que l''accompagnement a réussi ?', 'Une énergie retrouvée, une tenue que tu remets, une habitude installée…', 'texte_long', '{}', true),
  (30, 'Ton alimentation', 'Allergies, intolérances ou aliments que tu ne manges pas', 'Coche ce qui te concerne : les recettes qui en contiennent ne te seront pas proposées.', 'exclusions', '{}', false),
  (40, 'Ton alimentation', 'Combien de repas prends-tu par jour, en général ?', null, 'choix', array['2', '3', '4', '5 ou plus'], true),
  (50, 'Ton alimentation', 'Tes habitudes du moment', 'Plusieurs réponses possibles, sans jugement 💛', 'choix_multiple',
    array['Je saute souvent le petit-déjeuner', 'Je grignote entre les repas', 'Je mange souvent à l''extérieur ou au travail', 'Je cuisine la plupart de mes repas', 'Je bois moins d''1 litre d''eau par jour', 'Je bois de l''alcool plusieurs fois par semaine'], false),
  (60, 'Ton alimentation', 'Des aliments que tu adores et que tu veux garder ?', null, 'texte', '{}', false),
  (70, 'Ton rythme de vie', 'Ton rythme de travail', null, 'choix', array['Horaires de bureau', 'Horaires décalés ou de nuit', 'Travail physique', 'À la maison', 'Étudiante'], true),
  (80, 'Ton rythme de vie', 'Combien d''heures dors-tu par nuit, en moyenne ?', null, 'choix', array['Moins de 6 h', '6 à 7 h', '7 à 8 h', 'Plus de 8 h'], true),
  (90, 'Ton rythme de vie', 'Ton niveau de stress en ce moment', null, 'choix', array['Faible', 'Moyen', 'Élevé'], false),
  (100, 'Ton activité physique', 'Quel sport pratiques-tu aujourd''hui, et combien de fois par semaine ?', 'Marche comprise. Écris « aucun » si tu débutes.', 'texte', '{}', true),
  (110, 'Ton activité physique', 'Où vas-tu t''entraîner ?', null, 'choix', array['En salle de sport', 'À la maison, avec du matériel', 'À la maison, sans matériel', 'En extérieur'], false),
  (120, 'Ton activité physique', 'As-tu des douleurs, blessures ou contre-indications ?', 'Écris « rien » si tout va bien.', 'texte', '{}', false),
  (130, 'Ton cycle (facultatif)', 'Ton cycle', 'Facultatif. Ça m''aide à mieux lire tes variations de poids (rétention d''eau). Visible seulement par toi et moi.', 'choix',
    array['Règles régulières', 'Cycle irrégulier', 'Contraception hormonale ou pas de règles', 'Périménopause ou ménopause', 'Je préfère ne pas répondre'], false);
