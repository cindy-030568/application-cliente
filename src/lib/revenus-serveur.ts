import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { trierClientes } from "@/app/coach/donnees";
import { estMoyen } from "./paiements";
import { numeroterEcheances, type Mouvement } from "./revenus";

type EcheanceBrute = { id: string; cliente_id: string; date_echeance: string; montant: number | string; payee_le: string | null };

/**
 * Tous les mouvements (échéances des clientes + revenus hors échéancier).
 * `null` si la mise à jour 0010 (paiements) n'est pas faite ; `divers: false` si la 0017 manque.
 */
export async function lireMouvements(supabase: SupabaseClient) {
  const [ech, notes, clientes, paiements, divers] = await Promise.all([
    supabase.from("echeances_paiement").select("id, cliente_id, date_echeance, montant, payee_le").returns<EcheanceBrute[]>(),
    supabase.from("echeances_paiement").select("id, note"),
    supabase.from("clientes").select("id, statut, profils!inner(prenom, nom)").returns<{ id: string; statut: string; profils: { prenom: string; nom: string } }[]>(),
    supabase.from("paiements_clientes").select("cliente_id, formule, moyen"),
    supabase.from("revenus_divers").select("id, date_revenu, libelle, montant, moyen, cliente_id, note"),
  ]);
  if (ech.error) return null;

  const listeClientes = trierClientes(clientes.data ?? []);
  const nom = new Map(listeClientes.map((c) => [c.id, `${c.profils.prenom} ${c.profils.nom}`.trim()]));
  const pai = new Map((paiements.data ?? []).map((p) => [p.cliente_id as string, p as { formule: string | null; moyen: string | null }]));
  const noteDe = new Map((notes.error ? [] : (notes.data ?? [])).map((n) => [n.id as string, (n.note as string | null) ?? null]));
  const numeros = numeroterEcheances(ech.data ?? []);

  const mouvements: Mouvement[] = (ech.data ?? []).map((e) => {
    const p = pai.get(e.cliente_id);
    return {
      id: e.id,
      type: "echeance",
      cliente_id: e.cliente_id,
      cliente: nom.get(e.cliente_id) ?? "Cliente",
      formule: p?.formule ?? null,
      libelle: numeros.get(e.id) ?? "Paiement",
      date_prevue: e.date_echeance,
      montant: Number(e.montant),
      payee_le: e.payee_le,
      moyen: estMoyen(p?.moyen) ? p.moyen : null,
      note: noteDe.get(e.id) ?? null,
    } satisfies Mouvement;
  });
  if (!divers.error) {
    for (const d of divers.data ?? []) {
      mouvements.push({
        id: d.id as string,
        type: "divers",
        cliente_id: (d.cliente_id as string | null) ?? null,
        cliente: d.cliente_id ? (nom.get(d.cliente_id as string) ?? null) : null,
        formule: null,
        libelle: d.libelle as string,
        date_prevue: d.date_revenu as string,
        montant: Number(d.montant),
        payee_le: d.date_revenu as string,
        moyen: estMoyen(d.moyen) ? d.moyen : null,
        note: (d.note as string | null) ?? null,
      });
    }
  }
  return {
    mouvements,
    divers: !divers.error,
    notes: !notes.error,
    clientes: listeClientes.filter((c) => c.statut !== "fermee").map((c) => ({ id: c.id, nom: nom.get(c.id)! })),
  };
}
