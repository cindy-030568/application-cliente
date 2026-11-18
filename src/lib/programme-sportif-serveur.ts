import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cleExercice, dateRenouvellement, lireProgramme, type Programme } from "./programme-sportif";

/** Lu à part : tant que la mise à jour 0016 n'est pas faite, ces fonctions renvoient null. */

export type ProgrammeSportif = {
  id: string;
  cliente_id: string;
  titre: string;
  contenu: Programme;
  publie: boolean;
  publie_le: string | null;
  vu_le: string | null;
  /** Date prévue du prochain programme (mise à jour 0018 ; sinon 6 semaines après la publication). */
  renouveler_le: string | null;
  created_at: string;
  updated_at: string;
};
const COLONNES = "id, cliente_id, titre, contenu, publie, publie_le, vu_le, created_at, updated_at";
const normaliser = (d: Record<string, unknown>, dates: Map<string, string | null>): ProgrammeSportif => {
  const p = { ...(d as unknown as ProgrammeSportif), contenu: lireProgramme(d.contenu) };
  p.renouveler_le = p.publie ? dateRenouvellement({ renouveler_le: dates.get(p.id), publie_le: p.publie_le }) : (dates.get(p.id) ?? null);
  return p;
};

/** Dates de changement (colonne de la mise à jour 0018, lue à part : vide si elle n'est pas faite). */
async function datesRenouvellement(supabase: SupabaseClient, ids: string[]): Promise<Map<string, string | null>> {
  if (!ids.length) return new Map();
  const { data, error } = await supabase.from("programmes_sportifs").select("id, renouveler_le").in("id", ids);
  if (error) return new Map();
  return new Map((data ?? []).map((d) => [d.id as string, (d.renouveler_le as string | null) ?? null]));
}

export async function lireProgrammes(supabase: SupabaseClient, clienteId: string): Promise<ProgrammeSportif[] | null> {
  const { data, error } = await supabase.from("programmes_sportifs").select(COLONNES).eq("cliente_id", clienteId).order("created_at", { ascending: false });
  if (error) return null;
  const dates = await datesRenouvellement(supabase, (data ?? []).map((d) => d.id as string));
  return (data ?? []).map((d) => normaliser(d as Record<string, unknown>, dates));
}

export async function lireProgrammeSportif(supabase: SupabaseClient, id: string): Promise<ProgrammeSportif | null> {
  const { data, error } = await supabase.from("programmes_sportifs").select(COLONNES).eq("id", id).maybeSingle();
  if (error || !data) return null;
  return normaliser(data as Record<string, unknown>, await datesRenouvellement(supabase, [data.id as string]));
}

/** Côté cliente : son programme publié (la sécurité de la base ne laisse voir que celui-là). */
export async function lireMonProgramme(supabase: SupabaseClient): Promise<ProgrammeSportif | null> {
  const { data, error } = await supabase.from("programmes_sportifs").select(COLONNES).eq("publie", true).limit(1).maybeSingle();
  if (error || !data) return null;
  return normaliser(data as Record<string, unknown>, await datesRenouvellement(supabase, [data.id as string]));
}

/** Côté coach : les programmes publiés et leur date de changement (null si la mise à jour 0016 manque). */
export async function lireRenouvellements(
  supabase: SupabaseClient,
  clienteId?: string,
): Promise<{ id: string; cliente_id: string; titre: string; publie_le: string | null; renouveler_le: string }[] | null> {
  let requete = supabase.from("programmes_sportifs").select("id, cliente_id, titre, publie_le").eq("publie", true);
  if (clienteId) requete = requete.eq("cliente_id", clienteId);
  const { data, error } = await requete;
  if (error) return null;
  const dates = await datesRenouvellement(supabase, (data ?? []).map((d) => d.id as string));
  return (data ?? []).flatMap((d) => {
    const date = dateRenouvellement({ renouveler_le: dates.get(d.id as string), publie_le: d.publie_le as string | null });
    return date ? [{ id: d.id as string, cliente_id: d.cliente_id as string, titre: d.titre as string, publie_le: d.publie_le as string | null, renouveler_le: date }] : [];
  });
}

/** Vidéos publiées de la bibliothèque, par titre normalisé : un exercice du même nom affiche sa vidéo. */
export async function videosParExercice(supabase: SupabaseClient): Promise<Record<string, string>> {
  const { data } = await supabase.from("videos").select("id, titre").eq("publiee", true);
  const index: Record<string, string> = {};
  for (const v of data ?? []) index[cleExercice(v.titre as string)] = v.id as string;
  return index;
}
