-- =====================================================================
-- Le bilan reprend la trame de Cindy (« Trame bilan », tous les 15 jours) :
-- 4 rubriques de questions, puis les mesures et les photos.
-- Ajoute : rubriques (sections), questions en texte libre, précisions
-- facultatives, texte d'introduction réglable.
-- Dans les libellés, {jours} est remplacé par le rythme de bilan de la cliente.
-- =====================================================================

alter table public.champs_mesure
  add column section text not null default 'Mes ressentis' check (length(section) between 1 and 60),
  add column avec_precision boolean not null default false;
alter table public.champs_mesure drop constraint if exists champs_mesure_type_check;
alter table public.champs_mesure
  add constraint champs_mesure_type_check check (type in ('nombre', 'echelle', 'choix', 'texte'));
alter table public.champs_mesure drop constraint if exists champs_mesure_libelle_check;
alter table public.champs_mesure
  add constraint champs_mesure_libelle_check check (length(libelle) between 1 and 140);

alter table public.bilan_valeurs drop constraint if exists bilan_valeurs_valeur_texte_check;
alter table public.bilan_valeurs
  add constraint bilan_valeurs_valeur_texte_check check (valeur_texte is null or length(valeur_texte) <= 2000),
  add column precision text check (precision is null or length(precision) <= 1000);
-- Une précision seule (sans note ni choix) est acceptée.
alter table public.bilan_valeurs drop constraint if exists bilan_valeurs_check;
alter table public.bilan_valeurs
  add constraint bilan_valeurs_check check (valeur_num is not null or valeur_texte is not null or precision is not null);

alter table public.reglages
  add column intro_bilan text not null default
    'Voici les points pour faire le point sur ces {jours} derniers jours. Réponds en toute simplicité, avec tes mots à toi. Pas besoin d’être parfaite : ce bilan, c’est ton espace pour faire le point et avancer 💛'
    check (length(intro_bilan) <= 600);

-- Anciennes questions de ressenti : supprimées si jamais utilisées, sinon masquées
-- (leur historique reste consultable).
delete from public.champs_mesure c
where c.groupe = 'ressenti'
  and not exists (select 1 from public.bilan_valeurs v where v.champ_id = c.id);
update public.champs_mesure set actif = false where groupe = 'ressenti';

-- Les mesures passent après les questions.
update public.champs_mesure set section = 'Mes mesures', ordre = 100 + ordre where groupe = 'mesure';

insert into public.champs_mesure (section, groupe, type, libelle, aide, options, avec_precision, ordre) values
  -- Ressentis & énergie
  ('Ressentis & énergie', 'ressenti', 'texte', 'Comment te sens-tu globalement ces {jours} derniers jours ?', null, null, false, 1),
  ('Ressentis & énergie', 'ressenti', 'echelle', 'Ton niveau d’énergie', '1 = plutôt fatiguée · 5 = en forme · 10 = boostée', null, false, 2),
  ('Ressentis & énergie', 'ressenti', 'echelle', 'La qualité de ton sommeil', '1 = pas reposée du tout · 10 = très bien reposée', null, true, 3),
  ('Ressentis & énergie', 'ressenti', 'echelle', 'Ton niveau de stress', '1 = faible · 5 = moyen · 10 = élevé', null, false, 4),
  ('Ressentis & énergie', 'ressenti', 'texte', 'Ton état d’esprit du moment', 'Un mot, une phrase, une vibe ✨', null, false, 5),
  -- Nutrition & habitudes
  ('Nutrition & habitudes', 'ressenti', 'choix', 'Est-ce que ton plan te convient ?', 'Variété, quantités, organisation',
   array['Oui, complètement', 'Plutôt oui', 'Pas vraiment'], true, 10),
  ('Nutrition & habitudes', 'ressenti', 'choix', 'Arrives-tu à finir tes repas ?', null,
   array['Oui, sans souci', 'Oui, mais j’ai encore faim', 'Non, c’est trop copieux', 'Ça dépend des jours'], true, 11),
  ('Nutrition & habitudes', 'ressenti', 'choix', 'Hydratation : arrives-tu à boire suffisamment ?', 'Sens-tu une différence ?',
   array['Oui', 'Presque', 'Pas encore'], true, 12),
  ('Nutrition & habitudes', 'ressenti', 'texte', 'Repas plaisir et imprévus : comment les as-tu vécus ?', null, null, false, 13),
  ('Nutrition & habitudes', 'ressenti', 'choix', 'Compléments : arrives-tu à les prendre régulièrement ?', null,
   array['Oui', 'La plupart du temps', 'Pas vraiment', 'Je n’en prends pas'], false, 14),
  -- Victoires & difficultés
  ('Victoires & difficultés', 'ressenti', 'texte', '2 ou 3 victoires que tu veux célébrer', 'Grandes ou petites !', null, false, 20),
  ('Victoires & difficultés', 'ressenti', 'texte', '1 ou 2 difficultés rencontrées', 'Organisation, motivation, envies…', null, false, 21),
  -- Projection & engagement
  ('Projection & engagement', 'ressenti', 'texte', 'Tes objectifs pour les {jours} prochains jours', null, null, false, 30),
  ('Projection & engagement', 'ressenti', 'texte', 'Une petite action concrète que tu t’engages à mettre en place', null, null, false, 31),
  ('Projection & engagement', 'ressenti', 'texte', 'Une question ou un besoin particulier ?', null, null, false, 32);
