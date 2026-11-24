import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ModeCycle } from "./cycle";

/** Ce que suit la cliente (cycle, périménopause ou rien). null avant la mise à jour 0034. */
export async function lireCycle(supabase: SupabaseClient, clienteId: string): Promise<{ mode: ModeCycle; duree: number } | null> {
  const { data, error } = await supabase
    .from("clientes")
    .select("suivi_cycle, cycle_duree")
    .eq("id", clienteId)
    .maybeSingle<{ suivi_cycle: ModeCycle; cycle_duree: number }>();
  if (error || !data) return null;
  return { mode: data.suivi_cycle ?? "aucun", duree: Number(data.cycle_duree) || 28 };
}

/** Symptômes de périménopause notés, par jour (les plus récents). Vide avant la mise à jour 0034. */
export async function lireSymptomesJournal(supabase: SupabaseClient, clienteId: string, depuis: string): Promise<Map<string, string[]>> {
  const { data, error } = await supabase
    .from("journal_quotidien")
    .select("jour, symptomes")
    .eq("cliente_id", clienteId)
    .gte("jour", depuis)
    .order("jour", { ascending: false })
    .limit(400);
  if (error) return new Map();
  return new Map((data ?? []).filter((d) => Array.isArray(d.symptomes) && d.symptomes.length).map((d) => [d.jour as string, d.symptomes as string[]]));
}
