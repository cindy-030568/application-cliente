import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { LigneCharge } from "./seance-guidee";

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

/** Poids notés pour ces exercices (noms normalisés). null tant que la mise à jour 0021 n'est pas faite. */
export async function lireCharges(
  supabase: SupabaseClient,
  options: { cles?: string[]; clienteId?: string; limite?: number } = {},
): Promise<(LigneCharge & { exercice_nom: string })[] | null> {
  let requete = supabase
    .from("charges_series")
    .select("seance_ref, exercice_cle, exercice_nom, serie, charge_kg, faite_le")
    .order("faite_le", { ascending: false })
    .limit(options.limite ?? 400);
  if (options.cles) {
    if (!options.cles.length) return [];
    requete = requete.in("exercice_cle", options.cles.slice(0, 60));
  }
  if (options.clienteId) requete = requete.eq("cliente_id", options.clienteId);
  const { data, error } = await requete.returns<(LigneCharge & { exercice_nom: string })[]>();
  return error ? null : (data ?? []);
}
