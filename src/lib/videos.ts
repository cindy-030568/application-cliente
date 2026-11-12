import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SELECTION_VIDEO, normaliserVideo, type FiltreVideo, type Video, type VideoBrute } from "@/lib/types";

export async function chargerFiltres(supabase: SupabaseClient): Promise<FiltreVideo[]> {
  const { data } = await supabase.from("filtres_video").select("id, famille, nom, ordre").order("ordre").returns<FiltreVideo[]>();
  return data ?? [];
}

/** Vidéos triées par titre (la RLS ne renvoie aux clientes que les vidéos publiées). */
export async function chargerVideos(supabase: SupabaseClient): Promise<Video[]> {
  const { data } = await supabase.from("videos").select(SELECTION_VIDEO).order("titre").returns<VideoBrute[]>();
  return (data ?? []).map(normaliserVideo);
}

export async function chargerVideo(supabase: SupabaseClient, id: string): Promise<Video | null> {
  const { data } = await supabase.from("videos").select(SELECTION_VIDEO).eq("id", id).maybeSingle<VideoBrute>();
  return data ? normaliserVideo(data) : null;
}

/** Recherche sans accents ni majuscules. */
export function normaliser(texte: string): string {
  return texte.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}
