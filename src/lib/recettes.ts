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

/** Les photos de recettes sont publiques (aucune donnée personnelle). */
export function urlPhotoRecette(chemin: string | null): string | null {
  return chemin ? `${SUPABASE_URL()}/storage/v1/object/public/recettes/${chemin}` : null;
}
