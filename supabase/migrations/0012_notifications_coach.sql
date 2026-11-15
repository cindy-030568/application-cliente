-- =====================================================================
-- Notifications pour la coach : bilan envoyé, message signalé, nouveau
-- message dans la communauté. Par email et/ou sur ses appareils.
-- =====================================================================

alter table public.reglages
  add column notif_coach_email        boolean not null default true,
  add column notif_coach_bilans       boolean not null default true,
  add column notif_coach_signalements boolean not null default true,
  add column notif_coach_messages     boolean not null default false,
  add column notif_coach_dernier_message timestamptz;

-- Appareils de la coach abonnés aux notifications (téléphone, ordinateur).
create table public.abonnements_coach (
  id          uuid primary key default gen_random_uuid(),
  profil_id   uuid not null default auth.uid() references public.profils (id) on delete cascade,
  endpoint    text not null unique check (endpoint like 'https://%' and length(endpoint) <= 1000),
  p256dh      text not null check (length(p256dh) <= 200),
  auth        text not null check (length(auth) <= 100),
  appareil    text check (length(appareil) <= 60),
  created_at  timestamptz not null default now()
);
alter table public.abonnements_coach enable row level security;
revoke all on public.abonnements_coach from anon;

create policy abonnements_coach_tout on public.abonnements_coach for all to authenticated
  using ((select public.est_coach())) with check ((select public.est_coach()) and profil_id = (select auth.uid()));
