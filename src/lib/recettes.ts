import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SELECTION_RECETTE, normaliserRecette, type Recette, type RecetteBrute, type Tag } from "@/lib/types";
import { SUPABASE_URL } from "@/lib/env";

export async function chargerTags(supabase: SupabaseClient): Promise<Tag[]> {
  const { data } = await supabase.from("tags").select("id, nom, ordre").order("ordre").returns<Tag[]>();
  return data ?? [];
}

export async function chargerRecettes(supabase: SupabaseClient): Promise<Recette[]> {
  const { data } = await supabase.from("recettes").select(SELECTION_RECETTE).order("titre").returns<RecetteBrute[]>();
  return (data ?? []).map(normaliserRecette);
}

export async function chargerRecette(supabase: SupabaseClient, id: string): Promise<Recette | null> {
  const { data } = await supabase.from("recettes").select(SELECTION_RECETTE).eq("id", id).maybeSingle<RecetteBrute>();
  return data ? normaliserRecette(data) : null;
}

/** Photos fournies avec les recettes de départ : fichiers de l'app (public/recettes-depart). */
export const PREFIXE_PHOTO_DEPART = "depart/";
export const PHOTO_DEPART_VALIDE = /^depart\/[a-z0-9-]+\.webp$/;

/** Les photos de recettes sont publiques (aucune donnée personnelle). */
export function urlPhotoRecette(chemin: string | null): string | null {
  if (!chemin) return null;
  if (PHOTO_DEPART_VALIDE.test(chemin)) return `/recettes-depart/${chemin.slice(PREFIXE_PHOTO_DEPART.length)}`;
  return `${SUPABASE_URL()}/storage/v1/object/public/recettes/${chemin}`;
}
