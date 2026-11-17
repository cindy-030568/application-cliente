import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cleExercice, lireProgramme, type Programme } from "./programme-sportif";

/** Lu à part : tant que la mise à jour 0016 n'est pas faite, ces fonctions renvoient null. */

export type ProgrammeSportif = {
  id: string;
  cliente_id: string;
  titre: string;
  contenu: Programme;
  publie: boolean;
  publie_le: string | null;
  vu_le: string | null;
  created_at: string;
  updated_at: string;
};
const COLONNES = "id, cliente_id, titre, contenu, publie, publie_le, vu_le, created_at, updated_at";
const normaliser = (d: Record<string, unknown>): ProgrammeSportif => ({ ...(d as unknown as ProgrammeSportif), contenu: lireProgramme(d.contenu) });

export async function lireProgrammes(supabase: SupabaseClient, clienteId: string): Promise<ProgrammeSportif[] | null> {
  const { data, error } = await supabase.from("programmes_sportifs").select(COLONNES).eq("cliente_id", clienteId).order("created_at", { ascending: false });
  if (error) return null;
  return (data ?? []).map((d) => normaliser(d as Record<string, unknown>));
}

export async function lireProgrammeSportif(supabase: SupabaseClient, id: string): Promise<ProgrammeSportif | null> {
  const { data, error } = await supabase.from("programmes_sportifs").select(COLONNES).eq("id", id).maybeSingle();
  if (error || !data) return null;
  return normaliser(data as Record<string, unknown>);
}

/** Côté cliente : son programme publié (la sécurité de la base ne laisse voir que celui-là). */
export async function lireMonProgramme(supabase: SupabaseClient): Promise<ProgrammeSportif | null> {
  const { data, error } = await supabase.from("programmes_sportifs").select(COLONNES).eq("publie", true).limit(1).maybeSingle();
  if (error || !data) return null;
  return normaliser(data as Record<string, unknown>);
}

/** Vidéos publiées de la bibliothèque, par titre normalisé : un exercice du même nom affiche sa vidéo. */
export async function videosParExercice(supabase: SupabaseClient): Promise<Record<string, string>> {
  const { data } = await supabase.from("videos").select("id, titre").eq("publiee", true);
  const index: Record<string, string> = {};
  for (const v of data ?? []) index[cleExercice(v.titre as string)] = v.id as string;
  return index;
}
