import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { normaliser } from "@/lib/texte";
import { SELECTION_ALIMENT, normaliserAliment, type Aliment, type AlimentBrut, type CategorieAliment } from "@/lib/types";

export async function chargerCategoriesAliment(supabase: SupabaseClient): Promise<CategorieAliment[]> {
  const { data } = await supabase.from("categories_aliment").select("id, nom, ordre").order("ordre").returns<CategorieAliment[]>();
  return data ?? [];
}

/** Recherche par mots (tous les mots doivent apparaître), sans accents. */
export async function rechercherAliments(
  supabase: SupabaseClient,
  q: string,
  options: { source?: "ciqual" | "perso"; limite?: number; actifsSeulement?: boolean; avecUnite?: boolean } = {},
): Promise<Aliment[]> {
  const mots = normaliser(q).split(/\s+/).filter(Boolean).slice(0, 5).map((m) => m.replace(/[%_]/g, ""));
  const limite = options.limite ?? 50;
  // Deux recherches : les noms qui COMMENCENT par le premier mot (« oeuf » → Œuf…), puis ceux qui le contiennent
  // (sinon « oeuf » ne renverrait que des « Boeuf… », classés avant par ordre alphabétique).
  const construire = (prefixe: boolean) => {
    let requete = supabase.from("aliments").select(SELECTION_ALIMENT);
    mots.forEach((mot, i) => {
      requete = requete.ilike("nom_recherche", i === 0 && prefixe ? `${mot}%` : `%${mot}%`);
    });
    if (options.source) requete = requete.eq("source", options.source);
    if (options.actifsSeulement) requete = requete.eq("actif", true);
    if (options.avecUnite) requete = requete.not("nom_unite", "is", null);
    return requete.order("source", { ascending: false }).order("nom").limit(limite).returns<AlimentBrut[]>();
  };
  const [{ data: debut }, { data: partout }] = await Promise.all([construire(true), construire(false)]);
  const vus = new Set<string>();
  const data = [...(debut ?? []), ...(partout ?? [])].filter((a) => !vus.has(a.id) && vus.add(a.id)).slice(0, limite);
  const resultats = (data ?? []).map(normaliserAliment);
  // Les noms qui commencent par le premier mot passent devant (« riz » avant « farine de riz »).
  const premier = normaliser(q).split(/\s+/)[0] ?? "";
  return premier
    ? [...resultats].sort((a, b) => Number(!normaliser(a.nom).startsWith(premier)) - Number(!normaliser(b.nom).startsWith(premier)))
    : resultats;
}

export async function chargerAliment(supabase: SupabaseClient, id: string): Promise<Aliment | null> {
  const { data } = await supabase.from("aliments").select(SELECTION_ALIMENT).eq("id", id).maybeSingle<AlimentBrut>();
  return data ? normaliserAliment(data) : null;
}
