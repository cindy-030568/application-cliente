import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ajouterJours } from "./bilan";
import { jourParisDe } from "./programme-sportif";
import type { DonneesVictoires } from "./victoires";

type Donnees = Omit<DonneesVictoires, "prenom" | "sansChiffres">;

/** Lit toutes les lignes d'une requête, par pages de 1 000 (limite de Supabase), 10 pages au plus. */
async function toutLire<T>(page: (de: number, a: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const lignes: T[] = [];
  for (let i = 0; i < 10; i++) {
    const { data, error } = await page(i * 1000, i * 1000 + 999);
    if (error || !data) break;
    lignes.push(...data);
    if (data.length < 1000) break;
  }
  return lignes;
}

/**
 * Données utiles aux victoires hors balance, par cliente : charges (1 an), séances (depuis le début),
 * tour de taille (depuis le début), stress et digestion (4 dernières semaines). Jamais le poids.
 * Avec `clienteId` : une seule cliente (côté cliente, la RLS ne laisse de toute façon voir que les siennes).
 * Une mise à jour de la base pas encore faite donne simplement des listes vides.
 */
export async function chargerDonneesVictoires(supabase: SupabaseClient, aujourdhui: string, clienteId?: string): Promise<Map<string, Donnees>> {
  const pour = (table: string, colonnes: string) => {
    const q = supabase.from(table).select(colonnes);
    return clienteId ? q.eq("cliente_id", clienteId) : q;
  };
  const [charges, seances, tailles, ressentis] = await Promise.all([
    toutLire((de, a) =>
      pour("charges_series", "cliente_id, exercice_cle, exercice_nom, charge_kg, faite_le")
        .gte("faite_le", `${ajouterJours(aujourdhui, -365)}T00:00:00Z`)
        .order("faite_le", { ascending: false })
        .range(de, a)
        .returns<{ cliente_id: string; exercice_cle: string; exercice_nom: string; charge_kg: number; faite_le: string }[]>(),
    ),
    toutLire((de, a) => pour("seances_faites", "cliente_id, faite_le").order("faite_le", { ascending: false }).range(de, a).returns<{ cliente_id: string; faite_le: string }[]>()),
    toutLire((de, a) =>
      pour("journal_quotidien", "cliente_id, jour, tour_taille")
        .not("tour_taille", "is", null)
        .order("jour")
        .range(de, a)
        .returns<{ cliente_id: string; jour: string; tour_taille: number }[]>(),
    ),
    toutLire((de, a) =>
      pour("journal_quotidien", "cliente_id, jour, stress, digestion")
        .gte("jour", ajouterJours(aujourdhui, -27))
        .range(de, a)
        .returns<{ cliente_id: string; jour: string; stress: number | null; digestion: number | null }[]>(),
    ),
  ]);

  const parCliente = new Map<string, Donnees>();
  const de = (id: string) => {
    let d = parCliente.get(id);
    if (!d) parCliente.set(id, (d = { charges: [], seances: [], journal: [] }));
    return d;
  };
  for (const c of charges) {
    de(c.cliente_id).charges.push({ exercice_cle: c.exercice_cle, exercice_nom: c.exercice_nom, charge_kg: Number(c.charge_kg), jour: jourParisDe(c.faite_le) });
  }
  for (const s of seances) de(s.cliente_id).seances.push(jourParisDe(s.faite_le));
  for (const t of tailles) de(t.cliente_id).journal.push({ jour: t.jour, tour_taille: Number(t.tour_taille), stress: null, digestion: null });
  for (const r of ressentis) {
    if (r.stress === null && r.digestion === null) continue;
    de(r.cliente_id).journal.push({ jour: r.jour, tour_taille: null, stress: r.stress === null ? null : Number(r.stress), digestion: r.digestion === null ? null : Number(r.digestion) });
  }
  return parCliente;
}
