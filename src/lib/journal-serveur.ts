import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { EntreeJournal } from "@/lib/journal";

const COLONNES = "jour, poids, tour_taille, sommeil, hydratation, pas, trainings, stress, digestion, regles, observations";
const num = (x: unknown) => (x === null || x === undefined ? null : Number(x));

/** Journal d'une cliente, ou null si la mise à jour 0013 n'est pas encore faite. */
export async function lireJournal(supabase: SupabaseClient, clienteId: string): Promise<EntreeJournal[] | null> {
  const { data, error } = await supabase
    .from("journal_quotidien")
    .select(COLONNES)
    .eq("cliente_id", clienteId)
    .order("jour", { ascending: false })
    .limit(800);
  if (error) return null;
  return (data ?? []).map((d) => ({
    jour: d.jour as string,
    poids: num(d.poids),
    tour_taille: num(d.tour_taille),
    sommeil: num(d.sommeil),
    hydratation: num(d.hydratation),
    pas: num(d.pas),
    trainings: num(d.trainings),
    stress: num(d.stress),
    digestion: num(d.digestion),
    regles: Boolean(d.regles),
    observations: (d.observations as string | null) ?? null,
  }));
}

/** Journal activé pour cette cliente ? (vrai par défaut ; faux avant la mise à jour 0013). */
export async function journalActif(supabase: SupabaseClient, clienteId: string): Promise<boolean | null> {
  const { data, error } = await supabase.from("clientes").select("journal_actif").eq("id", clienteId).maybeSingle<{ journal_actif: boolean }>();
  if (error) return null;
  return data?.journal_actif !== false;
}
