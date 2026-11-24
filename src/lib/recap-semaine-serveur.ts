import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ajouterJours } from "./bilan";
import { jourParisDe } from "./programme-sportif";
import { calculerRecap, type Recap } from "./recap-semaine";

/**
 * Récap d'une semaine (du lundi au dimanche donné) pour une ou plusieurs clientes.
 * Lit seulement les séances et le sommeil, les pas et l'eau du journal (jamais le poids).
 */
export async function chargerRecaps(supabase: SupabaseClient, clientes: { id: string; prenom: string }[], dimanche: string): Promise<Map<string, Recap>> {
  const ids = clientes.map((c) => c.id);
  const lundi = ajouterJours(dimanche, -6);
  const [{ data: seances }, { data: journal }] = await Promise.all([
    supabase
      .from("seances_faites")
      .select("cliente_id, faite_le")
      .in("cliente_id", ids)
      .gte("faite_le", `${ajouterJours(lundi, -1)}T00:00:00Z`)
      .lte("faite_le", `${ajouterJours(dimanche, 1)}T23:59:59Z`)
      .limit(1000),
    supabase
      .from("journal_quotidien")
      .select("cliente_id, jour, sommeil, pas, hydratation")
      .in("cliente_id", ids)
      .gte("jour", lundi)
      .lte("jour", dimanche)
      .limit(1000),
  ]);
  const num = (v: unknown) => (v == null ? null : Number(v));
  return new Map(
    clientes.map((c) => [
      c.id,
      calculerRecap({
        dimanche,
        prenom: c.prenom,
        seances: (seances ?? []).filter((s) => s.cliente_id === c.id).map((s) => jourParisDe(s.faite_le as string)),
        journal: (journal ?? [])
          .filter((j) => j.cliente_id === c.id)
          .map((j) => ({ jour: j.jour as string, sommeil: num(j.sommeil), pas: num(j.pas), hydratation: num(j.hydratation) })),
      }),
    ]),
  );
}
