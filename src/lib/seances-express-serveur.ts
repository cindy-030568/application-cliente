import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { lireContenuExpress, type NiveauExpress, type SeanceExpress } from "./seances-express";

const COLONNES = "id, titre, description, duree_minutes, materiel, type, niveau, contenu, publiee, visibilite";

type Brute = Omit<SeanceExpress, "contenu"> & { contenu: unknown };

function nettoyer(r: Brute): SeanceExpress | null {
  const contenu = lireContenuExpress(r.contenu, r.titre);
  if (!contenu) return null;
  return { ...r, niveau: r.niveau as NiveauExpress, materiel: r.materiel ?? [], contenu };
}

/** Séances express visibles (la RLS filtre : la coach voit tout, une cliente seulement les siennes). null avant la mise à jour 0040. */
export async function lireSeancesExpress(supabase: SupabaseClient, options: { publiees?: boolean } = {}): Promise<SeanceExpress[] | null> {
  let q = supabase.from("seances_express").select(COLONNES).order("duree_minutes").order("titre");
  if (options.publiees) q = q.eq("publiee", true);
  const { data, error } = await q.returns<Brute[]>();
  if (error) return null;
  return (data ?? []).flatMap((r) => {
    const s = nettoyer(r);
    return s ? [s] : [];
  });
}

export async function lireSeanceExpress(supabase: SupabaseClient, id: string): Promise<SeanceExpress | null> {
  const { data } = await supabase.from("seances_express").select(COLONNES).eq("id", id).maybeSingle<Brute>();
  return data ? nettoyer(data) : null;
}

/** Listes de Réglages (matériel, types). Valeurs par défaut avant la mise à jour 0040. */
export async function lireListesExpress(supabase: SupabaseClient): Promise<{ materiel: string[]; types: string[] }> {
  const { data } = await supabase.from("reglages").select("express_materiel, express_types").maybeSingle<{ express_materiel: string[]; express_types: string[] }>();
  return {
    materiel: data?.express_materiel ?? ["Aucun", "Tapis", "Élastique", "Haltères", "Kettlebell", "Chaise ou banc", "Corde à sauter"],
    types: data?.express_types ?? ["Renfo", "Cardio", "Mobilité", "Étirements", "Marche à la maison", "Gainage"],
  };
}
