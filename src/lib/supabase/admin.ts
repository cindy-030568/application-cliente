import "server-only";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/env";

/**
 * Client administrateur (clé secrète) : contourne la RLS.
 * À n'utiliser QUE pour les opérations sur les comptes (créer, bloquer,
 * supprimer, générer un lien), toujours après avoir vérifié exigerCoach().
 */
export function createAdminClient() {
  const cle = process.env.SUPABASE_SECRET_KEY;
  if (!cle) throw new Error("Variable d'environnement manquante : SUPABASE_SECRET_KEY");
  return createClient(SUPABASE_URL(), cle, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
