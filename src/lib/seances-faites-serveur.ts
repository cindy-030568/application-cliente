import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type SeanceFaite = {
  id: string;
  cliente_id: string;
  programme_id: string | null;
  seance_nom: string;
  faite_le: string;
  duree_minutes: number | null;
  ressenti: number | null;
  commentaire: string | null;
};

/** Séances faites (les plus récentes d'abord). null tant que la mise à jour 0019 n'est pas faite. */
export async function lireSeancesFaites(supabase: SupabaseClient, options: { clienteId?: string; programmeId?: string; limite?: number } = {}): Promise<SeanceFaite[] | null> {
  let requete = supabase
    .from("seances_faites")
    .select("id, cliente_id, programme_id, seance_nom, faite_le, duree_minutes, ressenti, commentaire")
    .order("faite_le", { ascending: false })
    .limit(options.limite ?? 50);
  if (options.clienteId) requete = requete.eq("cliente_id", options.clienteId);
  if (options.programmeId) requete = requete.eq("programme_id", options.programmeId);
  const { data, error } = await requete.returns<SeanceFaite[]>();
  return error ? null : (data ?? []);
}
