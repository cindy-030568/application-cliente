-- =====================================================================
-- Changement de programme sportif : date prévue (6 semaines après la
-- publication, modifiable par la coach) et rappel à la coach.
-- Les droits ne changent pas : seule la coach peut modifier un programme.
-- =====================================================================

alter table public.programmes_sportifs
  add column if not exists renouveler_le date,
  -- Dernier jour où la coach a été prévenue (jamais deux rappels le même jour).
  add column if not exists rappel_renouvellement_le date;

-- Programmes déjà publiés : changement prévu 6 semaines après leur publication.
update public.programmes_sportifs
   set renouveler_le = (publie_le at time zone 'Europe/Paris')::date + 42
 where publie and renouveler_le is null and publie_le is not null;

create index if not exists programmes_sportifs_renouveler_idx
  on public.programmes_sportifs (renouveler_le) where publie;
