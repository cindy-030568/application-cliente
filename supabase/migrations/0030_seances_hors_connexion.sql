-- =====================================================================
-- Séances hors connexion : une séance validée sans réseau est gardée sur
-- le téléphone puis envoyée au retour du réseau. Chaque séance porte un
-- identifiant créé sur le téléphone : renvoyée deux fois, elle n'est
-- enregistrée qu'une seule fois.
-- =====================================================================

alter table public.seances_faites add column if not exists ref_locale uuid;
alter table public.seances_faites
  add constraint seances_faites_ref_locale_unique unique (cliente_id, ref_locale);
