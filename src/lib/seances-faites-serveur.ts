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
  /** Séance express (« séance libre ») : à part des séances du programme. Absent avant la mise à jour 0040. */
  seance_express_id?: string | null;
};

/** Séances faites (les plus récentes d'abord). null tant que la mise à jour 0019 n'est pas faite. */
export async function lireSeancesFaites(supabase: SupabaseClient, options: { clienteId?: string; programmeId?: string; limite?: number } = {}): Promise<SeanceFaite[] | null> {
  const lire = (colonnes: string) => {
    let requete = supabase
      .from("seances_faites")
      .select(colonnes)
      .order("faite_le", { ascending: false })
      .limit(options.limite ?? 50);
    if (options.clienteId) requete = requete.eq("cliente_id", options.clienteId);
    if (options.programmeId) requete = requete.eq("programme_id", options.programmeId);
    return requete.returns<SeanceFaite[]>();
  };
  const base = "id, cliente_id, programme_id, seance_nom, faite_le, duree_minutes, ressenti, commentaire";
  // Avec la colonne des séances express (0040) ; sinon comme avant.
  const avec = await lire(`${base}, seance_express_id`);
  if (!avec.error) return avec.data ?? [];
  const sans = await lire(base);
  return sans.error ? null : (sans.data ?? []);
}

/** Séance express (séance libre) ? */
export const estSeanceExpress = (s: Pick<SeanceFaite, "seance_express_id">) => Boolean(s.seance_express_id);

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
