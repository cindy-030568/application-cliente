-- =====================================================================
-- Horloge des rappels du journal (à lancer UNE fois, après la mise à jour 0014).
-- Toutes les 15 minutes, Supabase appelle l'app pour envoyer les rappels du journal
-- aux clientes dont l'heure choisie vient de passer.
-- Supabase crée lui-même la clé qui protège cet appel : rien à copier ailleurs.
-- Sans danger si relancé.
-- =====================================================================

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- 1. La clé (créée et gardée dans le coffre de Supabase).
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'horloge_rappels') then
    perform vault.create_secret(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), 'horloge_rappels');
  end if;
end $$;

-- 2. L'app vérifie la clé avec cette fonction (réservée à la clé secrète du serveur).
create or replace function public.jeton_horloge_valide(p_jeton text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1 from vault.decrypted_secrets where name = 'horloge_rappels' and decrypted_secret = p_jeton
  );
$$;
revoke execute on function public.jeton_horloge_valide(text) from public, anon, authenticated;
grant execute on function public.jeton_horloge_valide(text) to service_role;

-- 3. L'horloge : toutes les 15 minutes.
select cron.unschedule('rappels-journal') where exists (select 1 from cron.job where jobname = 'rappels-journal');
select cron.schedule(
  'rappels-journal',
  '*/15 * * * *',
  $$
  select net.http_get(
    url := 'https://app.fitw-cindy.fr/api/rappels/journal',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'horloge_rappels')
    )
  );
  $$
);
