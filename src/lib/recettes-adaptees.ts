import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  recettesPourRepas,
  type Cible,
  type Exclusions,
  type IngredientMoteur,
  type RecetteAdaptee,
  type RecetteMoteur,
  type Tolerance,
} from "@/lib/moteur";
import { typeRecettePourRepas, type TypeRepas } from "@/lib/nutrition";
import { chargerRecettes } from "@/lib/recettes";
import type { Recette, Reglages } from "@/lib/types";

/** Recette de la base, prête pour le moteur (on garde la recette d'origine pour l'affichage). */
export type RecettePourMoteur = RecetteMoteur & { source: Recette };

export function versMoteur(r: Recette): RecettePourMoteur {
  const ingredients: IngredientMoteur[] = [...r.ingredients]
    .sort((a, b) => a.ordre - b.ordre)
    .map((i) => ({
      id: i.id,
      role: i.role,
      unite: i.unite,
      base: i.qte_base,
      min: i.qte_min,
      max: i.qte_max,
      pas: i.pas,
      aliment: {
        id: i.aliment.id,
        proteines_100: i.aliment.proteines_100,
        glucides_100: i.aliment.glucides_100,
        lipides_100: i.aliment.lipides_100,
        kcal_100: i.aliment.kcal_100,
        poids_unite_g: i.aliment.poids_unite_g,
        categories: i.aliment.categories,
      },
    }));
  return { id: r.id, titre: r.titre, repas: r.repas, ingredients, source: r };
}

export type RepasCible = {
  type_repas: TypeRepas;
  libelle: string;
  proteines_g: number;
  glucides_g: number;
  lipides_g: number;
};

export type RepasAvecRecettes = {
  repas: RepasCible;
  cible: Cible;
  compatibles: RecetteAdaptee<RecettePourMoteur>[];
  approximatives: RecetteAdaptee<RecettePourMoteur>[];
  exclues: number;
};

export function toleranceDepuis(r: Pick<Reglages, "tolerance_pct" | "tolerance_g">): Tolerance {
  return { pct: Number(r.tolerance_pct), g: Number(r.tolerance_g) };
}

/**
 * Cibles, exclusions et recettes publiées d'une cliente, puis le moteur pour chaque repas.
 * Les droits sont ceux du client Supabase fourni (RLS) : la coach voit tout,
 * une cliente ne voit que ses propres cibles et exclusions.
 */
export async function recettesAdapteesCliente(
  supabase: SupabaseClient,
  clienteId: string,
  reglages: Pick<Reglages, "tolerance_pct" | "tolerance_g" | "hors_tolerance">,
): Promise<RepasAvecRecettes[]> {
  const [{ data: repas }, { data: exclusions }, recettes] = await Promise.all([
    supabase
      .from("repas_cibles")
      .select("type_repas, libelle, proteines_g, glucides_g, lipides_g")
      .eq("cliente_id", clienteId)
      .order("ordre")
      .returns<RepasCible[]>(),
    supabase
      .from("exclusions")
      .select("categorie_id, aliment_id")
      .eq("cliente_id", clienteId)
      .returns<{ categorie_id: string | null; aliment_id: string | null }[]>(),
    chargerRecettes(supabase),
  ]);
  const ex: Exclusions = { categories: new Set(), aliments: new Set() };
  for (const e of exclusions ?? []) {
    if (e.categorie_id) ex.categories.add(e.categorie_id);
    if (e.aliment_id) ex.aliments.add(e.aliment_id);
  }
  const pourMoteur = recettes.filter((r) => r.publiee).map(versMoteur);
  const tol = toleranceDepuis(reglages);
  return (repas ?? []).map((rp) => {
    const cible = { proteines: Number(rp.proteines_g), glucides: Number(rp.glucides_g), lipides: Number(rp.lipides_g) };
    const s = recettesPourRepas(pourMoteur, typeRecettePourRepas(rp.type_repas), cible, tol, ex, reglages.hors_tolerance === "badge");
    return { repas: rp, cible, ...s };
  });
}

/** Une recette proposée à la cliente, avec les repas pour lesquels elle convient. */
export type RecettePourCliente = {
  recette: Recette;
  /** Index des repas (dans l'ordre des cibles) pour lesquels la recette est proposée. */
  repas: number[];
  approximative: boolean;
};

/**
 * Toutes les recettes proposables à la cliente (mode « inspiration ») :
 * celles qui conviennent à au moins un de ses repas.
 */
export function recettesInspiration(repas: RepasAvecRecettes[]): RecettePourCliente[] {
  const parId = new Map<string, { recette: Recette; exacts: number[]; approx: number[] }>();
  repas.forEach((r, index) => {
    for (const [liste, approx] of [[r.compatibles, false], [r.approximatives, true]] as const) {
      for (const a of liste) {
        const e = parId.get(a.recette.id) ?? { recette: a.recette.source, exacts: [], approx: [] };
        (approx ? e.approx : e.exacts).push(index);
        parId.set(a.recette.id, e);
      }
    }
  });
  return [...parId.values()]
    // Les repas où la recette colle exactement d'abord.
    .map((e) => ({ recette: e.recette, repas: [...e.exacts, ...e.approx], approximative: e.exacts.length === 0 }))
    .sort((a, b) => a.recette.titre.localeCompare(b.recette.titre, "fr"));
}

/** Résultat du moteur pour UNE recette et UN repas de la cliente (null si non proposée). */
export function trouverAdaptation(repas: RepasAvecRecettes[], index: number, recetteId: string) {
  const r = repas[index];
  if (!r) return null;
  const c = r.compatibles.find((a) => a.recette.id === recetteId);
  if (c) return { ...c, approximative: false, repas: r };
  const a = r.approximatives.find((x) => x.recette.id === recetteId);
  return a ? { ...a, approximative: true, repas: r } : null;
}
