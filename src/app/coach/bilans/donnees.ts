import "server-only";
import { exigerCoach } from "@/lib/auth";
import { aujourdhuiParis, alertesCliente, type Alerte } from "@/lib/bilan";
import { listerClientes, type ClienteListe } from "../donnees";

export type BilanFile = {
  id: string;
  cliente_id: string;
  date_mesure: string;
  echeance: string | null;
  envoye_le: string;
  retour: { created_at: string } | null;
  nom: string;
};

/** Bilans récents de toutes les clientes, et alertes calculées. */
export async function chargerFile() {
  const { supabase, profil } = await exigerCoach();
  const [clientes, { data }] = await Promise.all([
    listerClientes(),
    supabase
      .from("bilans")
      .select("id, cliente_id, date_mesure, echeance, envoye_le, saisi_par, retours_bilan(created_at)")
      .order("envoye_le", { ascending: false })
      .limit(400),
  ]);
  const parId = new Map(clientes.map((c) => [c.id, c]));
  const bilans: (BilanFile & { saisi_par: string | null })[] = (data ?? []).flatMap((b) => {
    const c = parId.get(b.cliente_id as string);
    if (!c || c.statut === "fermee") return [];
    const r = b.retours_bilan as { created_at: string } | { created_at: string }[] | null;
    return [
      {
        id: b.id as string,
        cliente_id: b.cliente_id as string,
        date_mesure: b.date_mesure as string,
        echeance: b.echeance as string | null,
        envoye_le: b.envoye_le as string,
        saisi_par: b.saisi_par as string | null,
        retour: Array.isArray(r) ? (r[0] ?? null) : r,
        nom: `${c.profils.prenom} ${c.profils.nom}`.trim(),
      },
    ];
  });

  // À traiter : les bilans (rattachés à une échéance) envoyés par les clientes, sans retour.
  // Les saisies libres et les saisies faites par la coach n'y entrent pas.
  const aTraiter = bilans
    .filter((b) => !b.retour && b.echeance && b.saisi_par !== profil.id)
    .sort((a, b) => a.envoye_le.localeCompare(b.envoye_le));
  const traites = bilans.filter((b) => b.retour).slice(0, 30);

  const auj = aujourdhuiParis();
  const alertes: { cliente: ClienteListe; alerte: Alerte }[] = [];
  for (const c of clientes) {
    const recues = new Set(bilans.filter((b) => b.cliente_id === c.id && b.echeance).map((b) => b.echeance!));
    for (const alerte of alertesCliente(c, recues, auj)) alertes.push({ cliente: c, alerte });
  }
  return { clientes, bilans, aTraiter, traites, alertes };
}
