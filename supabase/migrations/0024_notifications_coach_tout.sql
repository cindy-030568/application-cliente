-- =====================================================================
-- Notifications de la coach : tout ce qui se passe dans l'appli, à cocher.
-- Nouveau : journée remplie, séance faite, note à lire vite (douleur,
-- santé, moral, demande), rappels de changement de programme.
-- Tout est coché par défaut (y compris les messages de la communauté).
-- =====================================================================

alter table public.reglages
  add column if not exists notif_coach_journal    boolean not null default true,
  add column if not exists notif_coach_seances    boolean not null default true,
  add column if not exists notif_coach_alertes    boolean not null default true,
  add column if not exists notif_coach_programmes boolean not null default true;

alter table public.reglages alter column notif_coach_messages set default true;
update public.reglages set notif_coach_messages = true;
