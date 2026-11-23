-- =====================================================================
-- Contrat : variables remplies pour chaque cliente.
-- Dans le texte du contrat (Réglages), la coach écrit par exemple {{prenom}}
-- ou {{montant_total}} : l'app les remplace par les informations de la
-- cliente (sa fiche, sa formule et son paiement). L'adresse et la date de
-- naissance sont demandées à la cliente sur l'écran du contrat.
-- Le texte gardé comme preuve est le texte rempli, exactement tel qu'elle l'a lu.
-- =====================================================================

alter table public.acceptations_contrat
  add column if not exists adresse        text check (length(adresse) <= 300),
  add column if not exists date_naissance date;

-- Remplace les variables du contrat pour une cliente (fonction interne, pas appelable directement).
create or replace function public.rendre_contrat(p_texte text, p_cliente uuid, p_adresse text, p_date_naissance date, p_le timestamptz)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_prenom text; v_nom text; v_email text; v_debut date;
  v_formule text; v_montant numeric; v_nb integer; v_jour integer;
  v_t text := coalesce(p_texte, '');
begin
  select prenom, nom, email into v_prenom, v_nom, v_email from public.profils where id = p_cliente;
  select date_debut into v_debut from public.clientes where id = p_cliente;
  select formule, montant_total, nb_fois into v_formule, v_montant, v_nb from public.paiements_clientes where cliente_id = p_cliente;
  select extract(day from min(date_echeance))::integer into v_jour from public.echeances_paiement where cliente_id = p_cliente;

  v_t := replace(v_t, '{{prenom}}', coalesce(nullif(trim(v_prenom), ''), '—'));
  v_t := replace(v_t, '{{nom}}', coalesce(nullif(trim(v_nom), ''), '—'));
  v_t := replace(v_t, '{{email}}', coalesce(nullif(trim(v_email), ''), '—'));
  v_t := replace(v_t, '{{adresse}}', coalesce(nullif(trim(p_adresse), ''), '[ton adresse, à remplir ci-dessous]'));
  v_t := replace(v_t, '{{date_naissance}}', coalesce(to_char(p_date_naissance, 'DD/MM/YYYY'), '[ta date de naissance, à remplir ci-dessous]'));
  v_t := replace(v_t, '{{date_debut}}', coalesce(to_char(v_debut, 'DD/MM/YYYY'), '—'));
  v_t := replace(v_t, '{{formule}}', coalesce(nullif(trim(v_formule), ''), '—'));
  v_t := replace(v_t, '{{montant_total}}', case
    when v_montant is null then '—'
    when v_montant = trunc(v_montant) then to_char(v_montant, 'FM999999990') || ' €'
    else replace(to_char(v_montant, 'FM999999990.00'), '.', ',') || ' €' end);
  v_t := replace(v_t, '{{paiement}}', case
    when v_nb is null then '—'
    when v_nb = 1 then 'Intégral'
    else 'Échelonné (en ' || v_nb || ' fois)' end);
  v_t := replace(v_t, '{{jour_echeance}}', case when v_nb > 1 and v_jour is not null then v_jour::text else '—' end);
  v_t := replace(v_t, '{{date}}', to_char(p_le at time zone 'Europe/Paris', 'DD/MM/YYYY'));
  return v_t;
end;
$$;
revoke execute on function public.rendre_contrat(text, uuid, text, date, timestamptz) from public, anon, authenticated;

-- Ce que l'écran du contrat doit demander, et la date de naissance déjà connue (sa propre donnée).
create or replace function public.mon_contrat_infos()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'demande_adresse', position('{{adresse}}' in coalesce(r.contrat_texte, '')) > 0,
    'demande_date_naissance', position('{{date_naissance}}' in coalesce(r.contrat_texte, '')) > 0,
    'date_naissance', (select b.date_naissance from public.besoins_clientes b where b.cliente_id = (select auth.uid()))
  )
  from public.reglages r
  where exists (select 1 from public.clientes c where c.id = (select auth.uid()) and c.statut <> 'fermee');
$$;

-- Aperçu du contrat rempli, pour la cliente connectée (adresse et date encore à saisir).
create or replace function public.mon_contrat_apercu(p_adresse text default null, p_date_naissance date default null)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select public.rendre_contrat(r.contrat_texte, (select auth.uid()), p_adresse, p_date_naissance, now())
  from public.reglages r
  where exists (select 1 from public.clientes c where c.id = (select auth.uid()) and c.statut <> 'fermee');
$$;

-- Aperçu pour la coach : le contrat tel que cette cliente le verra.
create or replace function public.apercu_contrat(p_cliente uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select public.rendre_contrat(r.contrat_texte, p_cliente, null, null, now())
  from public.reglages r
  where public.est_coach();
$$;

-- Acceptation : le texte gardé est le contrat rempli. Adresse et date de naissance obligatoires si le contrat les utilise.
drop function if exists public.accepter_contrat(text, boolean, boolean);
create or replace function public.accepter_contrat(
  p_version text, p_accepte boolean, p_renonciation boolean, p_adresse text default null, p_date_naissance date default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reglages public.reglages;
  v_adresse text := nullif(trim(coalesce(p_adresse, '')), '');
begin
  if not coalesce(p_accepte, false) or not coalesce(p_renonciation, false) then
    raise exception 'les deux cases sont obligatoires' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.clientes where id = (select auth.uid()) and statut <> 'fermee') then
    raise exception 'réservé aux clientes' using errcode = 'insufficient_privilege';
  end if;
  select * into v_reglages from public.reglages;
  if v_reglages.contrat_version is distinct from p_version or coalesce(v_reglages.contrat_texte, '') = '' then
    return false; -- le contrat a changé entre-temps : la page se recharge avec la nouvelle version
  end if;
  if position('{{adresse}}' in v_reglages.contrat_texte) > 0 and (v_adresse is null or length(v_adresse) > 300) then
    raise exception 'adresse manquante' using errcode = 'check_violation';
  end if;
  if position('{{date_naissance}}' in v_reglages.contrat_texte) > 0
     and (p_date_naissance is null or p_date_naissance < date '1900-01-01' or p_date_naissance > (now() at time zone 'Europe/Paris')::date - interval '10 years') then
    raise exception 'date de naissance manquante' using errcode = 'check_violation';
  end if;
  insert into public.acceptations_contrat (cliente_id, version, texte, renonciation_retractation, texte_renonciation, adresse, date_naissance)
  values (
    (select auth.uid()),
    v_reglages.contrat_version,
    public.rendre_contrat(v_reglages.contrat_texte, (select auth.uid()), v_adresse, p_date_naissance, now()),
    true,
    v_reglages.contrat_case_renonciation,
    v_adresse,
    p_date_naissance
  )
  on conflict (cliente_id, version) do nothing;
  return true;
end;
$$;

revoke execute on function public.mon_contrat_infos() from public, anon;
revoke execute on function public.mon_contrat_apercu(text, date) from public, anon;
revoke execute on function public.apercu_contrat(uuid) from public, anon;
revoke execute on function public.accepter_contrat(text, boolean, boolean, text, date) from public, anon;
grant execute on function public.mon_contrat_infos() to authenticated;
grant execute on function public.mon_contrat_apercu(text, date) to authenticated;
grant execute on function public.apercu_contrat(uuid) to authenticated;
grant execute on function public.accepter_contrat(text, boolean, boolean, text, date) to authenticated;
