-- =====================================================================
-- Brouillon de réponse au bilan par Claude : option de la coach,
-- désactivée par défaut (il faut aussi la clé ANTHROPIC_API_KEY dans l'hébergeur).
-- =====================================================================

alter table public.reglages
  add column if not exists brouillon_claude boolean not null default false;
