import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  COLONNES_CHAMP,
  SELECTION_BILAN,
  normaliserBilan,
  type Bilan,
  type BilanBrut,
  type ChampMesure,
} from "@/lib/types";

/** Champs du bilan (actifs seulement, ou tous pour l'historique). */
export async function chargerChamps(supabase: SupabaseClient, tous = false) {
  let requete = supabase.from("champs_mesure").select(COLONNES_CHAMP).order("ordre");
  if (!tous) requete = requete.eq("actif", true);
  const { data } = await requete.returns<ChampMesure[]>();
  return data ?? [];
}

/** Bilans d'une cliente, du plus récent au plus ancien (la RLS filtre). */
export async function chargerBilans(supabase: SupabaseClient, clienteId: string): Promise<Bilan[]> {
  const { data } = await supabase
    .from("bilans")
    .select(SELECTION_BILAN)
    .eq("cliente_id", clienteId)
    .order("date_mesure", { ascending: false })
    .order("envoye_le", { ascending: false })
    .returns<BilanBrut[]>();
  return (data ?? []).map(normaliserBilan);
}

export async function chargerBilan(supabase: SupabaseClient, bilanId: string): Promise<Bilan | null> {
  const { data } = await supabase
    .from("bilans")
    .select(SELECTION_BILAN)
    .eq("id", bilanId)
    .maybeSingle<BilanBrut>();
  return data ? normaliserBilan(data) : null;
}

/** URLs signées (15 min) pour une liste de photos. */
export async function urlsPhotos(supabase: SupabaseClient, chemins: string[]) {
  if (chemins.length === 0) return new Map<string, string>();
  const { data } = await supabase.storage.from("photos").createSignedUrls(chemins, 900);
  const urls = new Map<string, string>();
  for (const d of data ?? []) if (d.path && d.signedUrl) urls.set(d.path, d.signedUrl);
  return urls;
}

/** Champs visibles pour une cliente donnée (mode sans chiffres : seulement les ressentis). */
export function champsVisibles(champs: ChampMesure[], sansChiffres: boolean) {
  return champs.filter((c) => !sansChiffres || c.groupe === "ressenti");
}
