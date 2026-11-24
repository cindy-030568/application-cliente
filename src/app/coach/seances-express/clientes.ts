import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Clientes non fermées, par ordre alphabétique (pour « Certaines clientes »). */
export async function clientesAChoisir(supabase: SupabaseClient) {
  const { data } = await supabase
    .from("clientes")
    .select("id, profils!inner(prenom, nom)")
    .neq("statut", "fermee")
    .returns<{ id: string; profils: { prenom: string; nom: string } }[]>();
  return (data ?? []).map((c) => ({ id: c.id, nom: `${c.profils.prenom} ${c.profils.nom}`.trim() })).sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
}
