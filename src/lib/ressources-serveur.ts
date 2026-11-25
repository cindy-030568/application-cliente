import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { COLONNES_RESSOURCE, type CategorieRessource, type Ressource } from "./types";
import { DUREE_LIEN_AUDIO_S } from "./ressources";

export type RessourceComplete = Ressource & { contenu: string | null; audio_path: string | null; audio_duree: number | null };
export type Ecoute = { ressource_id: string; position_s: number; terminee: boolean; maj_le: string };

/**
 * Les ressources que la cliente a le droit de voir (la RLS filtre : publiées, pour toutes ou pour elle),
 * avec le texte des fiches et les audios. Colonnes récentes lues à part : rien ne casse avant 0037 / 0043.
 */
export async function lireRessourcesCompletes(supabase: SupabaseClient): Promise<RessourceComplete[]> {
  const { data: base } = await supabase.from("ressources").select(COLONNES_RESSOURCE).order("titre").returns<Ressource[]>();
  const [{ data: fiches }, { data: audios }] = await Promise.all([
    supabase.from("ressources").select("id, contenu").returns<{ id: string; contenu: string | null }[]>(),
    supabase.from("ressources").select("id, audio_path, audio_duree").returns<{ id: string; audio_path: string | null; audio_duree: number | null }[]>(),
  ]);
  const contenu = new Map((fiches ?? []).map((f) => [f.id, f.contenu]));
  const audio = new Map((audios ?? []).map((a) => [a.id, a]));
  return (base ?? []).map((r) => ({
    ...r,
    contenu: contenu.get(r.id) ?? null,
    audio_path: audio.get(r.id)?.audio_path ?? null,
    audio_duree: audio.get(r.id)?.audio_duree ?? null,
  }));
}

export async function lireCategories(supabase: SupabaseClient): Promise<CategorieRessource[]> {
  const { data } = await supabase.from("categories_ressource").select("id, nom, ordre").order("ordre").returns<CategorieRessource[]>();
  return data ?? [];
}

/** Favoris de la cliente (vide avant la mise à jour 0043). */
export async function lireFavorisRessources(supabase: SupabaseClient, clienteId: string): Promise<Set<string>> {
  const { data } = await supabase.from("ressources_favoris").select("ressource_id").eq("cliente_id", clienteId);
  return new Set((data ?? []).map((f) => f.ressource_id as string));
}

export async function lireEcoutes(supabase: SupabaseClient, clienteId: string): Promise<Map<string, Ecoute>> {
  const { data } = await supabase.from("ressources_ecoutes").select("ressource_id, position_s, terminee, maj_le").eq("cliente_id", clienteId).returns<Ecoute[]>();
  return new Map((data ?? []).map((e) => [e.ressource_id, e]));
}

/** Lien temporaire (3 h) vers l'audio. Le stockage refuse si la ressource n'est pas pour elle. */
export async function lienAudio(supabase: SupabaseClient, chemin: string): Promise<string | null> {
  const { data } = await supabase.storage.from("audios").createSignedUrl(chemin, DUREE_LIEN_AUDIO_S);
  return data?.signedUrl ?? null;
}
