-- =====================================================================
-- Analyse & conseils : ce que la cliente mange aujourd'hui (estimation)
-- et son objectif, pour adapter les conseils (plan de départ progressif,
-- stagnation, prise de masse…). Mêmes droits que ses besoins : coach seule.
-- =====================================================================

alter table public.besoins_clientes
  add column if not exists kcal_actuelles integer check (kcal_actuelles between 400 and 6000),
  add column if not exists objectif text check (objectif in ('perte', 'maintien', 'prise', 'recompo'));
